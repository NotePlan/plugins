// @flow

import moment from 'moment/min/moment-with-locales'
import { format, add, eachWeekendOfInterval } from 'date-fns'
import pluginJson from '../plugin.json'
import { sortListBy } from '../../helpers/sorting'
import { getTodaysDateAsArrowDate, getTodaysDateHyphenated, getDateOptions } from '../../helpers/dateTime'
import { getWeekOptions } from '../../helpers/NPdateTime'
import { getGlobalSharedData, sendToHTMLWindow, sendBannerMessage } from '../../helpers/HTMLView'
import { convertAllLinksToHTMLLinks, stripAllMarkersFromString } from '../../helpers/stringTransforms'
import { getOrMakeNote } from '../../helpers/note'
import { appendTaskToCalendarNote } from '../../jgclark.QuickCapture/src/quickCapture'
import { chooseFolder } from '../../helpers/userInput'
import { findOpenTodosInNote } from '../../helpers/NPnote'
import { followUpInFuture, followUpSaveHere } from './NPFollowUp'
import { getLimitedLastUsedChoices, updateLastUsedChoices } from './lastUsedChoices'

import {
  getNotesAndTasksToReview,
  getReferencesForReview,
  getGenericTaskActionOptions,
  processUserAction,
  getNotesWithOpenTasks,
  getWeeklyOpenTasks,
  type CommandBarChoice,
  SEE_TASK_AGAIN,
} from './NPTaskScanAndProcess'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
import { getParagraphFromStaticObject, createStaticObject, createStaticParagraphsArray, noteHasContent } from '@helpers/NPParagraph'

const DEBUG = true /* print data at bottom of webview */
const WEBVIEW_WINDOW_ID = 'TaskAutomations.Overdue'

/**
 * Create a fake CommandBar choice for sending to processUserAction
 * @param {string} value
 * @returns
 */
function createOptionChoice(value: string): CommandBarChoice {
  return {
    index: 0,
    keyModifiers: [],
    label: value,
    value: value,
  }
}
/* Finalize the actions taken by the user (save/update the results)
 * @param {*} resultObj - the result of the user's action { action:string, changed:TParagraph }
 * @returns {TParagraph | null} - the updated paragraph with new data (has not been saved to API yet)
 */
export async function finalizeChanges(result: any): Promise<TParagraph | null> {
  logDebug(pluginJson, `finalizeChanges ${JSON.stringify(result)}`)
  if (result) {
    const { action, changed: para } = result
    switch (action) {
      case 'cancel': {
        return null
      }
      case 'set':
        {
          logDebug('finalizeChanges', `received set command for paragraph "${para.content}"`)
          if (para) {
            // para.note.updateParagraph(para) //remove item which was updated from note's updates
            return para
          }
        }
        break
      case 'delete':
        {
          if (para) {
            const before = noteHasContent(para.note, para.content)
            para.note?.removeParagraph(para)
            // just double checking that the delete worked
            // TODO: remove these checks when we r confident
            const after = para.note ? noteHasContent(para.note, para.content) : null
            logDebug(pluginJson, `reviewOverdueTasksInNote delete content is in note:  before:${String(before)} | after:${String(after)}`)
          }
          // return updates.length ? noteIndex - 1 : noteIndex
        }
        break
      case `__mdhere__`:
        await Editor.openNoteByFilename(para.filename)
        return (await followUpSaveHere(para)) || para
      // para.type = 'done'
      // return para
      case `__mdfuture__`: {
        return (await followUpInFuture(para)) || para
        // para.type = 'done'
        // return para
      }
      case '__newTask__': {
        await appendTaskToCalendarNote(getTodaysDateHyphenated())
        await Editor.openNoteByDateString(getTodaysDateHyphenated())
      }
    }
    logDebug('finalizeChanges', `updated paragraph action:"${action}" para:"${para.content}"`)
  }
  return null
}
/*    __opentask__

      case 'delete': {
        if (origPara && origPara.note) {
          const before = noteHasContent(origPara.note, origPara.content)
          origPara.note?.removeParagraph(origPara)
          const after = origPara.note ? noteHasContent(origPara.note, origPara.content) : null
          logDebug(pluginJson, `reviewOverdueTasksInNote delete content is in note:  before:${String(before)} | after:${String(after)}`)
        }
        return updates.length ? noteIndex - 1 : noteIndex
      }
      case 'skip': {
        updates.splice(index, 1) //remove item which was updated from note's updates
        return updates.length ? noteIndex - 1 : noteIndex
      }
      case `__mdhere__`:
        updates.splice(index, 1) //remove item which was updated from note's updates
        await followUpSaveHere()
        return updates.length ? noteIndex - 1 : noteIndex
      case `__mdfuture__`: {
        updates.splice(index, 1) //remove item which was updated from note's updates
        await followUpInFuture()
        return updates.length ? noteIndex - 1 : noteIndex
      }
      case '__newTask__': {
        await appendTaskToCalendarNote(getTodaysDateHyphenated())
        return updates.length ? noteIndex - 1 : noteIndex
      }
    }
    //user selected an item in the list to come back to later (in splitview)
    // const range = note.paragraphs[Number(res) || 0].contentRange
    // await Editor.openNoteByFilename(note.filename, false, range?.start || 0, range?.end || 0, true)
    // if (range) Editor.select(range.start,range.end-range.start)
    // makeChanges = false
  }
} else {
  switch (String(res)) {
    case '__xcl__': {
      // const range = note.paragraphs[updates[0].lineIndex].contentRange
      // await Editor.openNoteByFilename(note.filename, false, range?.start || 0, range?.end || 0, true)
      return -2
    }
    case '__today__':
      makeChanges = true
      break
    case '__done__':
    case '__canceled__':
    case '__list__': {
      const tMap = { __done__: 'done', __canceled__: 'cancelled', __list__: 'list' }
      updates = updates.map((p) => {
        p.type = tMap[res]
        p.content = replaceArrowDatesInString(p.content)
        return p
      })
      makeChanges = true
      break
    }
  }
  if (typeof res === 'string' && res[0] === '>') {
    logDebug(pluginJson, `reviewOverdueTasksInNote changing to a >date : "${res}"`)
    updates = updates.map((p) => {
      const origPara = note.paragraphs[p.lineIndex]
      p.content = replaceArrowDatesInString(origPara.content, String(res))
      // if (choice.keyModifiers.includes('cmd')) {
      //   // user selected move //TODO: do something with full notes? let's start with tasks only
      // }
      return p
    })
    // clo(updates, `reviewOverdueTasksInNote updates=`)
    makeChanges = true
  }
  */

/**
 * Update one field of a specific paragraph
 * Called by the function receiving the callback/updates from the HTML window
 */
export function paragraphUpdateReceived(data: { rows: Array<any>, field: string }): Array<any> {
  const { rows, field } = data
  const updatesByNote = {}
  const updatedStatics = []
  if (rows?.length && field) {
    const sortedRows = sortListBy(rows, ['filename', '-lineIndex'])
    for (const row of sortedRows) {
      clo(row, `paragraphUpdateReceived getting row of ${rows.length} (${row.content})`)
      const para = getParagraphFromStaticObject(row)
      if (para) {
        // $FlowFixMe
        para[field] = row[field]
        // const val = { action: 'set', changed: para }
        if (para && para.filename) {
          // writing one at a time will not work in the same note, so we need to save them and write them all at once
          if (!updatesByNote[para.filename]) updatesByNote[para.filename] = []
          updatesByNote[para.filename || ''].push(para)
          clo(para, `paragraphUpdateReceived setting ${field} to ${row[field]}`)
        }
        updatedStatics.push(getStaticParagraph(para, { id: row.id }))
      }
    }
    Object.keys(updatesByNote).forEach((filename) => {
      if (updatesByNote[filename].length) {
        updatesByNote[filename][0].note.updateParagraphs(updatesByNote[filename])
      }
    })
    return updatedStatics
  }
  return []
}

/**
 * Update the global data in HTML window after a callback
 * This is required because the React components will update and re-render with the old data if we don't
 * @param {any} data - the updated rows object
 */
export async function updateRowDataAndSend(updateInfo: any, updateText: string = '') {
  // clo(updateInfo, `updateRowDataAndSend updateText=${updateText} updateInfo=`)
  const updatedRows = updateInfo.updatedRows
  const currentJSData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
  const overdueParas = currentJSData.overdueParas
  updatedRows.forEach((row) => {
    overdueParas[row.id] = { ...overdueParas[row.id], ...row }
    clo(overdueParas[row.id], `updateRowDataAndSend updated row=`)
  })
  sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'SET_DATA', currentJSData, updateText)
  // await updateGlobalSharedData(pluginJson['plugin.id'],currentJSData, false)
}

/**
 * Update a specific paragraph(s) due to a dropdown change in the React Window
 * @param { {rows:[any], choice:string } } data - the  single payload object
 */
export async function dropdownChangeReceived(data: { rows: Array<any>, choice: string }): Promise<Array<any>> {
  const { rows, choice } = data
  const commandBarStyleChoice = createOptionChoice(choice)
  updateLastUsedChoices(commandBarStyleChoice)
  if (rows?.length && choice) {
    const updatedStatics = []
    const sortedRows = sortListBy(rows, ['filename', '-lineIndex'])
    const updatesByNote = {}
    for (const row of sortedRows) {
      clo(row, `dropdownChangeReceived getting row of potentials:${sortedRows.length}, staticObject is:`)
      // const note = DataStore.noteByFilename(row.filename, row.noteType || 'Notes')
      const paragraph = getParagraphFromStaticObject(row)
      if (paragraph) {
        clo(paragraph, `dropdownChangeReceived found paragraph "${row.content}" in note "${row.filename}"; calling processUserAction:${String(choice)} for paragraph:`)
        const result = await processUserAction(paragraph, commandBarStyleChoice)
        clo(paragraph, `dropdownChangeReceived: processUserAction returned:${JSON.stringify(result)}`)
        if (result !== SEE_TASK_AGAIN) {
          // const para = await finalizeChanges(result)
          //FIXME: if paragraph is deleted or something, this could be wrong
          //FIXME: The can't update line-by-line may a big problem here. We used to
          // return the changed item. What to do now?
          if (!(paragraph.note?.paragraphs || [].length > paragraph.lineIndex)) {
            throw 'Could not find paragraph in note. Indexes were wrong'
          }
          const para = paragraph.note?.paragraphs[paragraph.lineIndex]
          clo(para, `dropdownChangeReceived: updated paragraph ready to commit`)
          if (para && para.filename) {
            // writing one at a time will not work in the same note, so we need to save them and write them all at once
            if (!updatesByNote[para.filename]) updatesByNote[para.filename] = []
            updatesByNote[para.filename || ''].push(para)
            updatedStatics.push(getStaticParagraph(para, { id: row.id }))
          }
        }
      } else {
        logDebug(pluginJson, `dropdownChangeReceived Could not find note "${row.filename}"`)
        await sendBannerMessage(
          WEBVIEW_WINDOW_ID,
          `NotePlan plugin TaskAutomations could not find the paragraph you were editing. This may be a bug. Or perhaps you edited the content in the note before making a change in the popup window? We need to be able to match lines of text, so you should generally do your editing in the popup window when if it is open. If you still think this is a bug, please report it to the developer.\nSearching for: ${JSON.stringify(
            row,
          )}`,
        )
      }
    }
    Object.keys(updatesByNote).forEach((filename) => {
      if (updatesByNote[filename].length) {
        updatesByNote[filename][0].note.updateParagraphs(updatesByNote[filename])
      }
    })
    clo(updatedStatics, `dropdownChangeReceived finished updates. returning updatedStatics=`)
    return updatedStatics
  }
  return []
}

/**
 * onUserModifiedParagraphs
 * Plugin entrypoint for "/onUserModifiedParagraphs - item was changed in HTML"
 * This is a callback
 * @author @dwertheimer
 */
export async function onUserModifiedParagraphs(actionType: string, data: any): Promise<any> {
  try {
    let returnValue = { success: false }
    logDebug(pluginJson, `NP Plugin return path (onUserModifiedParagraphs) received actionType="${actionType}" (typeof=${typeof actionType})  (typeof data=${typeof data})`)
    clo(data, `onUserModifiedParagraphs data=`)
    switch (actionType) {
      /* a good idea for each function to return the updated rows of items that were affected */
      case 'actionDropdown':
        returnValue = { updatedRows: await dropdownChangeReceived(data) } // data = { rows, choice }
        break
      case 'paragraphUpdate':
        returnValue = { updatedRows: await paragraphUpdateReceived(data) } // data = { rows, field  } // field that was updated
        break
      default:
        break
    }
    if (returnValue?.updatedRows?.length) {
      returnValue.updatedRows = createCleanContent(returnValue.updatedRows)
      await updateRowDataAndSend({ updatedRows: returnValue.updatedRows }, `Plugin Changed: ${JSON.stringify(returnValue.updatedRows)}`)
      // sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'RETURN_VALUE', { type: actionType, dataSent: data, returnValue: returnValue })
    }
    return {} // this return value is ignored but needs to exist or we get an error
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Get all overdue tasks
 * @param {string | false} noteFolder - if false, get all tasks. If a string, get tasks only from that folder
 * @returns
 */
export function getOverdueTasks(noteFolder?: string | false = false): Array<TParagraph> {
  const start = new Date()
  const { overdueOpenOnly, overdueFoldersToIgnore, showUpdatedTask, replaceDate } = DataStore.settings
  const options = {
    openOnly: overdueOpenOnly,
    foldersToIgnore: overdueFoldersToIgnore,
    datePlusOnly: false,
    confirm: false,
    showUpdatedTask,
    showNote: false,
    noteFolder,
    noteTaskList: null,
    replaceDate,
    overdueOnly: true,
  }
  const notesToReview = getNotesAndTasksToReview(options)
  const flatParaList = notesToReview.reduce((acc, noteTasks) => [...acc, ...noteTasks], [])
  logDebug(pluginJson, `getOverdueTasks took ${timer(start)}`)
  return flatParaList
}

/**
 * Get date chooser options, after tweaking the date select options for the HTML view nuances
 * @param {boolean} isSingleLine - true if this pertains to a single item (otherwise false = multiple items)
 * @returns an array of options for the dropdown menu
 */
export function getSpecializedOptions(isSingleLine: boolean): Array<any> {
  const sharedOpts = getGenericTaskActionOptions(null, isSingleLine)
  const todayLines = sharedOpts.splice(0, 2) // this is probably not necessary anymore
  const opts = [
    ...todayLines,
    { label: `✓ Mark done/complete`, value: '__done__' },
    { label: `✓⏎ Mark done and add follow-up in same note`, value: '__mdhere__' },
    { label: `✓📆 Mark done and add follow-up in future note`, value: '__mdfuture__' },
    { label: `⇑ Open this task in NotePlan`, value: '__opentask__' },
    { label: `💡 This reminds me...(create new task then continue)`, value: '__newTask__' },
    ...sharedOpts,
    { label: `␡ Delete this line (be sure!)`, value: '__delete__' },
  ].filter((o) => o.value !== '__xcl__')
  // opts.forEach((o) => console.log(o.value))
  // logDebug(pluginJson, `getSpecializedOptions: ${JSON.stringify(opts)}`)
  return opts
}

export function getButtons(lastUsedChoices: Array<string> = []): Array<{ text: string, action: string }> {
  // build the buttons
  const now = new moment().toDate()
  const tomorrow = format(add(now, { days: 1 }), 'yyyy-MM-dd')
  const weekends = eachWeekendOfInterval({ start: now, end: add(now, { months: 1 }) }).filter((d) => d > now)
  const weekNotes = getWeekOptions()
  const dateOpts = getDateOptions().map((d) => ({ text: d.label, action: d.value }))
  const baseOptions = [
    { text: 'Today', action: getTodaysDateAsArrowDate() },
    { text: '>today', action: '>today' },
    { text: 'Tomorrow', action: `>${tomorrow}` },
    { text: 'Weekend', action: `>${format(weekends[0], '>yyyy-MM-dd')}` },
    { text: 'ThisWeek', action: weekNotes[0].value },
    { text: 'NextWeek', action: weekNotes[1].value },
    { text: '!', action: '__p1__' },
    { text: '!!', action: '__p2__' },
    { text: '!!!', action: '__p3__' },
    ...dateOpts,
    // { text: 'Open Note', action: '__opentask__' },
  ]
  if (lastUsedChoices.length) {
    lastUsedChoices.reverse().forEach((choice) => {
      // if choice is not in baseOptions.action, then add it to the front of the array
      if (!baseOptions.find((o) => o.action === choice)) {
        baseOptions.unshift({ text: choice, action: choice })
      }
    })
  }
  return baseOptions
}

const KEY_PARA_PROPS = ['filename', 'title', 'lineIndex', 'content', 'rawContent', 'type', 'prefix', 'noteType', 'daysOverdue']

/**
 * Take in an array of paragraphs and return a static array of objects for the HTML view
 * @param {Array<TParagraph>} flatParaList - an array of TParagraph objects for the overdue tasks
 * @param {string} statusType - the status type to use for the HTML view (e.g. 'overdue)
 * @returns {Array<any>} - an array of static objects to be used in the HTML view
 */
export function getStaticTaskList(flatParaList: Array<TParagraph>, statusType: string = 'overdue'): Array<TParagraph> {
  if (!flatParaList || flatParaList.length === 0) {
    logDebug(pluginJson, `getStaticTaskList: no tasks sent in task list`)
    return []
  }
  const sortedFlatlist = sortListBy(flatParaList, ['filename', '-lineIndex']) //TODO: maybe sort by priority later using tasksbytype etc.
  const staticParasToReview = createStaticParagraphsArray(sortedFlatlist, KEY_PARA_PROPS, { overdueStatus: statusType })
  return staticParasToReview
}

/**
 * Get a static object for a single paragraph using the props list we want to send to the HTML view
 * @param {TParagraph} para - a Paragraph object
 * @param {Array<string>} additionalPropsObj - an Object of additional props to add to the static object (in addition to the basic KEY_PARA_PROPS)
 * @returns {any} - an object with the fields specified in KEY_PARA_PROPS
 */
export function getStaticParagraph(para: TParagraph, additionalPropsObj: any = {}): any {
  return createStaticObject(para, KEY_PARA_PROPS, additionalPropsObj)
}

/**
 * Create cleanContent for each item in the static array
 * @param {Array<any>} statics
 * @returns
 */
export const createCleanContent = (statics: Array<any>): Array<any> =>
  statics.map((item) => ({
    ...item,
    cleanContent: convertAllLinksToHTMLLinks(stripAllMarkersFromString(item.content || '', false, false)),
  }))

/**
 *  Find all tasks in today's references (either marked for today or in weekly note)
 * @param {boolean} weeklyNote - if true, use weekly note instead of today's note
 */
export async function getTodayReferencedTasks(weeklyNote: boolean = false): Promise<Array<Array<TParagraph>>> {
  try {
    await Editor.openNoteByDate(new Date())
    if (Editor.note?.type !== 'Calendar') {
      throw `You must be in a Calendar Note to run this command.`
    }
    // clo(getTodaysReferences(Editor.note), `reviewEditorReferencedTasks todayReferences`)
    const todosInNote = Editor.note ? findOpenTodosInNote(Editor.note, true) : []
    const arrayOfOpenNotesAndTasks = Editor.note ? getReferencesForReview(Editor.note, weeklyNote) : [[]]
    logDebug(pluginJson, `getTodayReferencedTasks: arrayOfOpenNotesAndTasks.length=${arrayOfOpenNotesAndTasks.length}`)
    return [...arrayOfOpenNotesAndTasks, [...todosInNote]]
  } catch (error) {
    logError(pluginJson, JSP(error))
    return [[]]
  }
}

export async function getDataForReactView(testData?: boolean = false, noteFolder?: string | false = false): any {
  const startTime = new Date()
  let staticParasToReview = []

  const {
    askToReviewWeeklyTasks,
    askToReviewTodaysTasks,
    askToReviewForgottenTasks,
    ignoreScheduledInForgottenReview,
    searchForgottenTasksOldestToNewest,
    /* overdueFoldersToIgnore,
    ignoreScheduledTasks, */
    forgottenFoldersToIgnore,
    reactShowDueInColumn,
  } = DataStore.settings

  if (!testData) {
    // const confirmResults = incoming ? false : true
    let start = new Date()
    const overdueParas = getOverdueTasks(noteFolder)
    const overdueStaticTasks = getStaticTaskList(overdueParas, 'Overdue')
    logDebug(`>>> getDataForReactView getOverdueTasks(${noteFolder || ''}) took: ${timer(start)}`)
    start = new Date()
    const openWeeklyTasks = askToReviewWeeklyTasks ? getStaticTaskList(getWeeklyOpenTasks(), 'ThisWeek') : []
    logDebug(`>>> getDataForReactView openWeeklyTasks() took: ${timer(start)}`)
    start = new Date()
    //FIMXE: I am here. need to add settings for wherre to look and for how long
    const notesWithOpenTasks = askToReviewForgottenTasks
      ? getNotesWithOpenTasks(
          'both',
          { num: 30, unit: 'day' },
          { searchForgottenTasksOldestToNewest, overdueFoldersToIgnore: forgottenFoldersToIgnore, ignoreScheduledInForgottenReview, restrictToFolder: noteFolder || false },
        )
      : []
    logDebug(`>>> getDataForReactView getNotesWithOpenTasks() (forgotten) took: ${timer(start)}`)
    // filter notesWithOpenTasks to only lines that do not exist in the overdueParas array
    const openTasksNotOverdue = notesWithOpenTasks
      .map((noteTasks) => noteTasks.filter((t) => !overdueParas.find((o) => o.filename === t.filename && o.lineIndex === t.lineIndex)))
      .filter(Boolean)
    start = new Date()
    // clo(notesWithOpenTasks, `processOverdueReact: notesWithOpenTasks length=${notesWithOpenTasks.length}`)
    const openTasksinRecentNotes = openTasksNotOverdue.reduce((acc, noteTasks) => [...acc, ...noteTasks], [])
    const forgottenTasks = getStaticTaskList(openTasksinRecentNotes, 'LeftOpen')
    const todayTaskParas = ((await getTodayReferencedTasks()) || []).reduce((acc, noteTasks) => [...acc, ...noteTasks], []).filter((t) => t.content !== '')
    logDebug(`>>> getDataForReactView todayReferenced took: ${timer(start)}`)
    start = new Date()
    // clo(todayTaskParas, `processOverdueReact: todayTaskParas length=${todayTaskParas.length}`)
    const todayTasks = askToReviewTodaysTasks && todayTaskParas.length ? getStaticTaskList(todayTaskParas, 'Today') : []
    // clo(forgottenTasks, `processOverdueReact: forgottenTasks length=${forgottenTasks.length}`)
    logDebug(pluginJson, `processOverdueReact: forgottenTasks length=${forgottenTasks.length}`)
    staticParasToReview = [...overdueStaticTasks, ...openWeeklyTasks, ...forgottenTasks, ...todayTasks]
    staticParasToReview = createCleanContent(staticParasToReview)
    logDebug(`>>> getDataForReactView cleaning conten took: ${timer(start)}`)
    // const lod = await DataStore.listOverdueTasks()
    // logDebug(pluginJson, `getDataForReactView listOverdueTasks:${lod.length} staticParasToReview:${staticParasToReview.length}`)
  }
  const startReactDataPackaging = new Date()
  // clo(staticParasToReview, `processOverdueReact: staticParasToReview length=${staticParasToReview.length}`)
  const ENV_MODE = 'development'
  const lastChoices = getLimitedLastUsedChoices()
  const data = {
    overdueParas: staticParasToReview,
    title: `Overdue Tasks`,
    debug: DEBUG,
    ENV_MODE: ENV_MODE,
    returnPluginCommand: { id: pluginJson['plugin.id'], command: 'onUserModifiedParagraphs' },
    componentPath: `../dwertheimer.TaskAutomations/react.c.WebView.bundle.${ENV_MODE === 'development' ? 'dev' : 'min'}.js`,
    /* ... +any other data you want to be available to your react components */
    dropdownOptionsAll: getSpecializedOptions(false),
    dropdownOptionsLine: getSpecializedOptions(true),
    contextButtons: getButtons(lastChoices),
    showDaysTilDueColumn: reactShowDueInColumn,
    startTime,
  }
  logDebug(`>>> getDataForReactView overdueParas:${data.overdueParas.length} took: ${timer(startReactDataPackaging)}`)
  return data
}

/**
 * Worker function called by processOverdueReact and processFolderReact
 * @author @dwertheimer
 * @param {string} filterSetting - the intial filter setting to use in the HTML view
 * @param {string} folderToSearch - the folder to search for tasks (if any)
 */
export async function startReactReview(filterSetting?: string | null, folderToSearch?: string | false) {
  try {
    logDebug(pluginJson, `startReactReview running with: folderToSearch="${filterSetting || ''}" typeof="${typeof filterSetting}" Starting Timer`)

    let starter = new Date()
    await DataStore.installOrUpdatePluginsByID(['np.Shared'], false, true, true)
    logDebug(pluginJson, `startReactReview: installed/verified np.Shared, took ${timer(starter)}`)
    starter = new Date()

    // NOTE: Relative paths are relative to the plugin folder of dwertheimer.React
    // So ALWAYS go out and back in, like this: `../dwertheimer.TaskAutomations/xxx`
    // because you can't guarantee what folder you are in at any given time
    const cssTagsString = `		<link rel="stylesheet" href="../dwertheimer.TaskAutomations/css.w3.css">
     <link rel="stylesheet" href="../dwertheimer.TaskAutomations/css.plugin.css">\n`

    const data = await getDataForReactView(false, folderToSearch)
    logDebug(pluginJson, `startReactReview: getting data for review, took ${timer(starter)}`)

    data.startingFilter = filterSetting // might be empty which is ok

    /*
       export type HtmlWindowOptions = {
         headerTags?: string, 
         generalCSSIn?: string, 
         specificCSS?: string,
         makeModal?: boolean,
         preBodyScript?: string | ScriptObj | Array<string | ScriptObj>, -- send array or string
         postBodyScript?: string | ScriptObj | Array<string | ScriptObj> -- send array or string
         savedFilename?: string,
         width?: number,
         height?: number,
         includeCSSAsJS?: boolean,
       }
     */
    // most of these ^^^ should work but I haven't tested them all yet
    // we should generalize this so you can pass anything
    const windowOptions = {
      headerTags: cssTagsString,
      savedFilename: `../../${pluginJson['plugin.id']}/reactLocal.html`,
      windowTitle: data.title,
      customId: WEBVIEW_WINDOW_ID,
      shouldFocus: true,
      reuseUsersWindowRect: true /* try to remember last window size */,
    }
    const payload = [data, windowOptions]

    logDebug(`===== Calling React after ${timer(data.startTime)} =====`)
    logDebug(pluginJson, `processOverdueReact invoking window. processOverdueReact stopping here.`)
    await DataStore.invokePluginCommandByName('openReactWindow', 'np.Shared', payload)
    // await askToReviewWeeklyTasks(true)
    // await askToReviewTodaysTasks(true)
    // await askToReviewForgottenTasks(true)
    // await showMessage(`Review Complete!`, 'OK', 'Task Review', true)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Process overdue items using React HTML View
 * Plugin entrypoint for "/Process Overdue Items in Separate Window"
 * Intended for users to invoke from Command Bar
 * @author @dwertheimer
 */
export async function processOverdueReact(filterSetting?: string | null) {
  try {
    await startReactReview(filterSetting || 'Overdue')
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * DESC
 * Plugin entrypoint for command: "/COMMAND"
 * @author @dwertheimer
 * @param {*} incoming
 */
export async function processFolderReact(folderToSearch?: string | false, filterSetting?: string | null) {
  try {
    logDebug(pluginJson, `processFolderReact running with filterSetting:${String(filterSetting)} folderToSearch:${String(folderToSearch)}`)
    const folder = folderToSearch || (await chooseFolder('Choose a folder to search for tasks'))
    await startReactReview(filterSetting || 'Overdue', folder)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Static test data for React view
 * Hidden from command bar
 * fire it by xcallback: N2 -- noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskAutomations&command=testOverdueReact
 * @author @dwertheimer
 */
export async function testOverdueReact() {
  try {
    logDebug(pluginJson, `testOverdueReact`)

    // TODO: when the react plugin is released, uncomment these lines
    // await installPlugin('dwertheimer.React')
    // logDebug(pluginJson, `reviewOverdueTasksByTask: installed/verified dwertheimer.React`)

    const data = await getDataForReactView(true)
    const note = await getOrMakeNote('Overdue Tasks TEST NOTE', '_TEST')
    await Editor.openNoteByFilename(note?.filename || '')
    if (note) {
      note.content = `# Overdue Tasks TEST NOTE
* overdue >2022-02-01
* overdue2 >2022-03-01    
* overdue3 >2022-04-01
* overdue4 >2022-05-01
* overdue5 >2022-02-01
* overdue6 >2022-03-01    
* overdue7 >2022-04-01
* overdue8 >2022-05-01
* overdue9 >2022-02-01
* overdue10 >2022-03-01    
* overdue11 >2022-04-01
* overdue12 >2022-05-01
* overdue13 >2022-02-01
* overdue14 >2022-03-01    
* overdue15 >2022-04-01
* overdue16 >2022-05-01
* overdue16 >2022-02-01
* overdue17 >2022-03-01    
* overdue18 >2022-04-01
* overdue19 >2022-05-01
* overdue20 >2022-05-01
`
    }
    data.debug = true
    const paras = note?.paragraphs.slice(1).filter((para) => para.content?.includes('overdue'))
    data.overdueParas = createCleanContent(getStaticTaskList(paras || []))
    const cssTagsString = `<link rel="stylesheet" href="../dwertheimer.TaskAutomations/css.w3.css">
		<link rel="stylesheet" href="../dwertheimer.TaskAutomations/css.plugin.css">\n`
    const windowOptions = {
      savedFilename: `../../${pluginJson['plugin.id']}/reactLocal.html`,
      headerTags: cssTagsString,
    }
    const payload = [data, windowOptions]

    console.log(`===== Calling React after ${timer(data.startTime)} =====`)
    logDebug(pluginJson, `processOverdueReact invoking window. processOverdueReact stopping here.`)
    // clo(data, `testOverdueReact data`)
    await DataStore.invokePluginCommandByName('openReactWindow', 'np.Shared', payload)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
