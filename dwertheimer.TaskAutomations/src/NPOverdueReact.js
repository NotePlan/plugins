// @flow

import moment from 'moment/min/moment-with-locales'
import { format, add, eachWeekendOfInterval } from 'date-fns'
import pluginJson from '../plugin.json'
import { sortListBy } from '../../helpers/sorting'
import { sendBannerMessage } from '../../dwertheimer.React/src/Bridge'
import { getTodaysDateAsArrowDate } from '../../helpers/dateTime'
import { noteHasContent } from '../../helpers/NPParagraph'
import { getWeekOptions } from '../../helpers/NPdateTime'
import {
  getNotesAndTasksToReview,
  reviewTasksInNotes,
  createArrayOfNotesAndTasks,
  getSharedOptions,
  prepareUserAction,
  getNotesWithOpenTasks,
  getWeeklyOpenTasks,
} from './NPTaskScanAndProcess'
import { log, logError, logDebug, timer, clo, JSP, createStaticArray } from '@helpers/dev'

/**
 * Check a paragraph object against a plain object of fields to see if they match
 * @param {TParagraph} paragraph
 * @param {any} fieldsObject
 * @param {Array<string>} fields
 * @returns {boolean} true if all fields match, false if any do not
 */
export function paragraphMatches(paragraph: TParagraph, fieldsObject: any, fields: Array<string>): boolean {
  let match = true
  fields.forEach((field) => {
    const rawWasEdited = fields.indexOf('rawContent') > 1 && fieldsObject.originalRawContent && fieldsObject.rawContent !== fieldsObject.originalRawContent
    if (field === 'rawContent' && rawWasEdited) {
      if (paragraph[field] !== fieldsObject['originalRawContent']) {
        logDebug(pluginJson, `paragraphMatches failed: ${paragraph[field]} !== ${fieldsObject[field]}`)
        match = false
      }
    } else {
      if (paragraph[field] !== fieldsObject[field]) {
        logDebug(pluginJson, `paragraphMatches failed: ${paragraph[field]} !== ${fieldsObject[field]}`)
        match = false
      }
    }
  })
  return match
}

/**
 * Because a paragraph may have been deleted or changed, we need to find the paragraph in the note
 * @param { Array<TParagraph>} parasToLookIn - paragraph list to search
 * @param {any} paragraphDataToFind - the static data fields to match (filename, rawContent, type)
 * @returns
 */
export function findParagraph(parasToLookIn: $ReadOnlyArray<TParagraph>, paragraphDataToFind: any): TParagraph | null {
  clo(parasToLookIn, `findParagraph', parasToLookIn.length=${parasToLookIn.length}`)
  const fieldsToMatch = ['filename', 'rawContent'] // rawContent is always going to be the content before it was changed
  const potentials = parasToLookIn.filter((p) => paragraphMatches(p, paragraphDataToFind, fieldsToMatch))
  logDebug(pluginJson, `findParagraph potential matches=${potentials.length}`)
  if (potentials?.length === 1) {
    return potentials[0]
  } else if (potentials.length > 1) {
    const matchIndexes = potentials.find((p) => p.lineIndex === paragraphDataToFind.lineIndex)
    if (matchIndexes) {
      return matchIndexes
    }
    logDebug(
      pluginJson,
      `findParagraph: found more than one paragraph in note "${paragraphDataToFind.filename}" that matches ${JSON.stringify(
        paragraphDataToFind,
      )}. Could not determine which one to use.`,
    )
    return null
  }
  logDebug(pluginJson, `findParagraph could not find paragraph in note "${paragraphDataToFind.filename}" that matches ${JSON.stringify(paragraphDataToFind)}`)
  return null
}

/**
 * Take a static object from HTML or wherever and find the paragraph in the note
 * @param {*} staticObject - the static object from the HTML must have fields:
 *    filename, rawContent, type, lineIndex, noteType
 * @returns {TParagraph|null} - the paragraph or null if not found
 */
function getParagraphFromStaticObject(staticObject: any): TParagraph | null {
  const { filename, noteType } = staticObject
  const note = DataStore.noteByFilename(filename, noteType)
  if (note) {
    logDebug(pluginJson, `getParagraphFromStaticObject found note ${note.title}`)
    // TODO: dbw - have refactored this a little. dont think we need it do we?
    // the text we are looking for may have been cleansed, so let's add cleansed ones to the search
    // const paras = [...note.paragraphs, ...removeOverdueDatesFromParagraphs([...note?.paragraphs], '')]
    const paras = note.paragraphs
    logDebug(pluginJson, `getParagraphFromStaticObject cleaned paragraphs. count= ${paras.length}`)
    const para = findParagraph(paras, staticObject)
    if (para) {
      const cleanParas = note.paragraphs
      return cleanParas[para.lineIndex] // make sure we are returning the original, non-cleansed version
    }
  } else {
    clo(staticObject, `getParagraphFromStaticObject could not open note "${filename}" of type "${noteType}"`)
  }
  return null
}

/**
 * Finzlize the actions taken by the user (save/update the results)
 * @param {*} resultObj - the result of the user's action { action:string, changed:TParagraph }
 * @returns {TParagraph | null} - the updated paragraph with new data (has not been saved to API yet)
 */
export function finalizeChanges(result: any): TParagraph | null {
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
            logDebug(pluginJson, `reviewNote delete content is in note:  before:${String(before)} | after:${String(after)}`)
          }
          // return updates.length ? noteIndex - 1 : noteIndex
        }
        break
    }
    logDebug('finalizeChanges', `updated paragraph action:"${action}" para:"${para.content}"`)
  }
  return null
}
/*
      case 'delete': {
        if (origPara && origPara.note) {
          const before = noteHasContent(origPara.note, origPara.content)
          origPara.note?.removeParagraph(origPara)
          const after = origPara.note ? noteHasContent(origPara.note, origPara.content) : null
          logDebug(pluginJson, `reviewNote delete content is in note:  before:${String(before)} | after:${String(after)}`)
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
        await appendTaskToDailyNote(getTodaysDateHyphenated())
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
    case '__mark__':
    case '__canceled__':
    case '__list__': {
      const tMap = { __mark__: 'done', __canceled__: 'cancelled', __list__: 'list' }
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
    logDebug(pluginJson, `reviewNote changing to a >date : "${res}"`)
    updates = updates.map((p) => {
      const origPara = note.paragraphs[p.lineIndex]
      p.content = replaceArrowDatesInString(origPara.content, String(res))
      // if (choice.keyModifiers.includes('cmd')) {
      //   // user selected move //TODO: do something with full notes? let's start with tasks only
      // }
      return p
    })
    // clo(updates, `reviewNote updates=`)
    makeChanges = true
  }
  */

export function paragraphUpdateReceived(data) {
  const { rows, field } = data
  const updatesByNote = {}
  if (rows?.length && field) {
    for (const row of rows) {
      clo(row, `paragraphUpdateReceived getting row of ${rows.length} (${row.content})`)
      const para = getParagraphFromStaticObject(row)
      if (para) {
        para[field] = row[field]
        const val = { action: 'set', changed: para }
        clo(val, `paragraphUpdateReceived setting ${field} to ${row[field]}`)
        if (para && para.filename) {
          // writing one at a time will not work in the same note, so we need to save them and write them all at once
          if (!updatesByNote[para.filename]) updatesByNote[para.filename] = []
          updatesByNote[para.filename || ''].push(para)
        }
      }
    }
    Object.keys(updatesByNote).forEach((filename) => {
      if (updatesByNote[filename].length) {
        updatesByNote[filename][0].note.updateParagraphs(updatesByNote[filename])
      }
    })
  }
}

export async function dropdownChangeReceived(data) {
  const { rows, choice } = data
  if (rows?.length && choice) {
    const sortedRows = sortListBy(rows, ['filename', '-lineIndex'])
    const overdueParas = getOverdueTasks() //FIXME: to generalize this, we can't just pull overdue tasks
    const updatesByNote = {}
    for (const row of sortedRows) {
      clo(row, `onParagraphChange getting row of ${sortedRows.length} (${row.content})`)
      // const note = DataStore.noteByFilename(row.filename, row.noteType || 'Notes')
      if (overdueParas) {
        logDebug(pluginJson, `onParagraphChange found overdueParas: ${overdueParas.length} `)
        const paragraph = findParagraph(overdueParas, row)
        if (!paragraph) {
          logDebug(pluginJson, `onParagraphChange Could not find row: ${JSON.stringify(row)}`)
          await sendBannerMessage(
            `NotePlan plugin TaskAutomations could not find the paragraph you were editing. This may be a bug. Please report it to the developer.\n\Item "${row.content}" not found.`,
          )
        } else {
          clo(paragraph, `onParagraphChange found paragraph "${row.content}" in overdueParas`)
          const result = await prepareUserAction(paragraph, paragraph, choice)
          clo(paragraph, `onParagraphChange prepareUserAction: ${JSON.stringify(result)}`)
          const para = finalizeChanges(result)
          if (para && para.filename) {
            // writing one at a time will not work in the same note, so we need to save them and write them all at once
            if (!updatesByNote[para.filename]) updatesByNote[para.filename] = []
            updatesByNote[para.filename || ''].push(para)
          }
        }
      } else {
        logDebug(pluginJson, `onParagraphChange Could not find note "${row.filename}"`)
        await sendBannerMessage(
          `NotePlan plugin TaskAutomations could not find the paragraph you were editing. This may be a bug. Please report it to the developer.\n\nNote "${row.filename}" not found.`,
        )
      }
    }
    Object.keys(updatesByNote).forEach((filename) => {
      if (updatesByNote[filename].length) {
        updatesByNote[filename][0].note.updateParagraphs(updatesByNote[filename])
      }
    })
  }
}

/**
 * onParagraphChange
 * Plugin entrypoint for "/onParagraphChange - item was changed in HTML"
 * @author @dwertheimer
 */
export async function onParagraphChange(actionType: string, data: any) {
  try {
    logDebug(pluginJson, `onParagraphChange: actionType="${actionType}" (typeof=${typeof actionType})  (typeof data=${typeof data})`)
    clo(data, `onParagraphChange data=`)
    switch (actionType) {
      case 'actionDropdown':
        await dropdownChangeReceived(data) // data = { rows, choice }
        break
      case 'paragraphUpdate':
        await paragraphUpdateReceived(data) // data = { rows, field  } // field that was updated
        break
      default:
        break
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Get all overdue tasks
 * @returns
 */
export function getOverdueTasks(): Array<TParagraph> {
  const start = new Date()
  const { overdueOpenOnly, overdueFoldersToIgnore, showUpdatedTask, replaceDate } = DataStore.settings
  const options = {
    openOnly: overdueOpenOnly,
    foldersToIgnore: overdueFoldersToIgnore,
    datePlusOnly: false,
    confirm: false,
    showUpdatedTask,
    showNote: false,
    noteFolder: false,
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
  const sharedOpts = getSharedOptions(null, isSingleLine)
  const todayLines = sharedOpts.splice(0, 2) // this is probably not necessary anymore
  const opts = [
    ...todayLines,
    { label: `✓ Mark task done/complete`, value: '__mark__' },
    { label: `✓⏎ Mark done and add follow-up in same note`, value: '__mdhere__' },
    { label: `✓📆 Mark done and add follow-up in future note`, value: '__mdfuture__' },
    { label: `💡 This reminds me...(create new task then continue)`, value: '__newTask__' },
    ...sharedOpts,
    { label: `␡ Delete this line (be sure!)`, value: '__delete__' },
  ].filter((o) => o.value !== '__xcl__')
  // opts.forEach((o) => console.log(o.value))
  return opts
}

export function getButtons() {
  // build the buttons
  const now = new moment().toDate()
  const tomorrow = format(add(now, { days: 1 }), 'yyyy-MM-dd')
  const weekends = eachWeekendOfInterval({ start: now, end: add(now, { months: 1 }) }).filter((d) => d > now)
  const weekNotes = getWeekOptions()
  return [
    { text: 'Today', action: getTodaysDateAsArrowDate() },
    { text: '>today', action: '>today' },
    { text: 'Tomorrow', action: `>${tomorrow}` },
    { text: 'Weekend', action: `>${format(weekends[0], '>yyyy-MM-dd')}` },
    { text: 'ThisWeek', action: weekNotes[0].value },
    { text: 'NextWeek', action: weekNotes[1].value },
  ]
}

/**
 * Get
 * @param {Array<TParagraph>} flatParaList - an array of TParagraph objects for the overdue tasks
 * @param {string} statusType - the status type to use for the HTML view (e.g. 'overdue)
 * @returns {Array<any>} - an array of static objects to be used in the HTML view
 */
export function getStaticTaskList(flatParaList: Array<TParagraph>, statusType: string = 'overdue') {
  const sortedFlatlist = sortListBy(flatParaList, ['filename', '-lineIndex']) //TODO: maybe sort by priority later using tasksbytype etc.
  const paraPropsToPass = ['filename', 'lineIndex', 'content', 'rawContent', 'type', 'prefix', 'noteType']
  const staticParasToReview = createStaticArray(sortedFlatlist, paraPropsToPass, { overdueStatus: statusType })
  return staticParasToReview
}

/**
 * Process overdue items using React HTML View
 * Plugin entrypoint for "/Process Overdue Items in Separate Window"
 * @author @dwertheimer
 */
export async function processOverdueReact(incoming: string) {
  try {
    let staticParasToReview = []
    logDebug(pluginJson, `reviewOverdueTasksByTask: incoming="${incoming}" typeof=${typeof incoming}`)
    // TODO: when the react plugin is released, uncomment these lines
    // await installPlugin('dwertheimer.React')
    // logDebug(pluginJson, `reviewOverdueTasksByTask: installed/verified dwertheimer.React`)
    const {
      askToReviewWeeklyTasks,
      askToReviewTodaysTasks,
      askToReviewForgottenTasks,
      ignoreScheduledInForgottenReview,
      searchForgottenTasksOldestToNewest,
      overdueFoldersToIgnore,
      ignoreScheduledTasks,
    } = DataStore.settings

    // const confirmResults = incoming ? false : true
    const overdueStaticTasks = getStaticTaskList(getOverdueTasks(), 'Overdue')
    const openWeeklyTasks = askToReviewWeeklyTasks ? getStaticTaskList(getWeeklyOpenTasks(), 'ThisWeek') : []
    //FIMXE: I am here. need to add settings for wherre to look and for how long
    const notesWithOpenTasks = askToReviewForgottenTasks
      ? await getNotesWithOpenTasks('both', { num: 30, unit: 'day' }, { searchForgottenTasksOldestToNewest, overdueFoldersToIgnore, ignoreScheduledInForgottenReview })
      : []
    // clo(notesWithOpenTasks, `processOverdueReact: notesWithOpenTasks length=${notesWithOpenTasks.length}`)
    const openTasksGoneBy = notesWithOpenTasks.reduce((acc, noteTasks) => [...acc, ...noteTasks], [])
    const forgottenTasks = getStaticTaskList(openTasksGoneBy, 'LeftOpen')
    clo(forgottenTasks, `processOverdueReact: forgottenTasks length=${forgottenTasks.length}`)
    staticParasToReview = [...overdueStaticTasks, ...openWeeklyTasks, ...forgottenTasks]
    //FIXME: need to dedupe the list

    const data = {
      title: `Overdue Tasks`,
      overdueParas: staticParasToReview,
      dropdownOptionsAll: getSpecializedOptions(false),
      dropdownOptionsLine: getSpecializedOptions(true),
      returnPluginCommand: { id: pluginJson['plugin.id'], command: 'onParagraphChange' },
      contextButtons: getButtons(),
    }
    const payload = ['overdueTasksReview', data]
    await DataStore.invokePluginCommandByName('openParagraphTableView', 'dwertheimer.React', payload)
    logDebug(pluginJson, `processOverdueReact finished invoking window. stopping for now.`)
    // await askToReviewWeeklyTasks(true)
    // await askToReviewTodaysTasks(true)
    // await askToReviewForgottenTasks(true)
    // await showMessage(`Review Complete!`, 'OK', 'Task Review', true)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
