// @flow

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import { moveParagraphToNote, getOverdueParagraphs } from '../../helpers/NPParagraph'
import { getNPWeekData, getWeekOptions } from '../../helpers/NPdateTime'
import { filterNotesAgainstExcludeFolders, noteType } from '../../helpers/note'
import { getReferencedParagraphs, getTodaysReferences } from '../../helpers/NPnote'
import { chooseHeading, chooseNote, chooseOptionWithModifiers, showMessage } from '../../helpers/userInput'
import { followUpSaveHere, followUpInFuture } from './NPFollowUp'
import { filenameDateString } from './dateHelpers'
import { updateLastUsedChoices } from './lastUsedChoices'
import { changePriority } from '@helpers/paragraph'
import { isOpen } from '@helpers/utils'
import { getDateOptions, replaceArrowDatesInString, RE_DATE, RE_WEEKLY_NOTE_FILENAME, getTodaysDateHyphenated, isWeeklyNote, isScheduled } from '@helpers/dateTime'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
import { eliminateDuplicateSyncedParagraphs, textWithoutSyncedCopyTag } from '@helpers/syncedCopies'
import { sortListBy } from '@helpers/sorting'

export type OverdueSearchOptions = {
  openOnly: boolean,
  foldersToIgnore: Array<string>,
  datePlusOnly: boolean,
  confirm: boolean,
  showUpdatedTask: boolean,
  showNote: boolean,
  replaceDate: boolean,
  noteTaskList: null | Array<Array<TParagraph>>,
  noteFolder: ?string | false,
  overdueAsOf?: string /* YYYY-MM-DD - for looking into the future */,
  overdueOnly: ?boolean /* used for reviewing today's references etc */,
}

type RescheduleUserAction =
  | '__today__'
  | '__done__'
  | '__canceled__'
  | '__remove__'
  | '__skip__'
  | '__xcl__'
  | '__list__'
  | '__listMove__'
  | '__checklist__'
  | '__checklistMove__'
  | '__mdhere__'
  | '__mdfuture__'
  | '__newTask__'
  | '__opentask__'
  | '__p0__'
  | '__p1__'
  | '__p2__'
  | '__p3__'
  | '__p4__'
  | '__>>__'
  | string /* >dateOptions */
  | number /* lineIndex of item to pop open */

// When reviewing Overdue Tasks, we increment through tasks in a note from the bottom/end of the note upwards
export const CONTINUE = 1
export const CANCEL = -2
export const SEE_TASK_AGAIN = 0

/**
 * Update a single paragraph in a note
 * @param {TParagraph} origPara
 * @returns {void}
 */
function updateParagraph(origPara): void {
  if (!origPara?.note) {
    logError(pluginJson, `NPTaskAndProcess::updateParagraph: note is null`)
    return
  }
  origPara.note?.updateParagraph(origPara)
}

/**
 * An individual task command was selected with the CMD modifier key pressed
 * So we need to move the task to the note that was specified
 * @param {TParagraph} para
 * @param {RescheduleUserAction} userChoice - string user action
 * @return {boolean} true if moved (used to work around API inconsistencies after changes in Editor and Editor.note)
 */
export async function processCmdKey(para: TParagraph, userChoice: RescheduleUserAction = ''): Promise<boolean> {
  if (userChoice.length && typeof userChoice === 'string' && userChoice[0] === '>') {
    logDebug(pluginJson, `processCmdKey(): is >date command [CMD] + userChoice=${userChoice}`)
    let date = userChoice?.slice(1)
    if (new RegExp(RE_DATE).test(date)) {
      date = date.replace(/-/g, '') // convert 8601 date to daily note filename
    }
    let filename = `${date}.${DataStore.defaultFileExtension}`
    const nType = noteType(filename)
    if (nType === 'Calendar' && !new RegExp(`^${RE_WEEKLY_NOTE_FILENAME}(md|txt)$`).test(filename)) filename = filename.replace(/-/g, '')
    // MOVE TASK TO SPECIFIED NOTE
    const note = await DataStore.noteByFilename(filename, nType)
    if (note) {
      logDebug(pluginJson, `processCmdKey ready to write task to: ${filename}`)
      return moveParagraphToNote(para, note)
    } else {
      logDebug(pluginJson, `processCmdKey could not open: ${filename}. Leaving task in place (${para.content})`)
    }
  } else {
    // non-date commands
    logDebug(pluginJson, `processCmdKey(): not a >date command [${keyModifiers.toString()}] + userChoice=${userChoice}. Ignoring CMD press`)
  }
  return false
}

/**
 * Get shared CommandBar options to be displayed for both full notes or individual tasks
 * @param {TPara} origPara
 * @param {boolean} isSingleLine
 * @returns {$ReadOnlyArray<{ label: string, value: string }>} the options for feeding to a command bar
 */
export function getGenericTaskActionOptions(origPara?: TParagraph | { note: TNote } | null, isSingleLine?: boolean = true): Array<{ label: string, value: string }> {
  const isGeneric = !origPara || !origPara.note
  const dateOpts = [...getDateOptions(), ...getWeekOptions()]
  const note = isGeneric ? null : origPara?.note
  const taskText = isSingleLine ? `this task` : `these tasks`
  const contentText = isGeneric ? '' : isSingleLine ? `"${origPara?.content || ''}"` : `tasks in "${note?.title || ''}"`
  const skip = isSingleLine ? [] : [{ label: `➡️ Skip - Do not change ${contentText} (and continue)`, value: '__skip__' }]
  const todayLine = dateOpts.splice(0, 1)
  todayLine[0].label = `⬇︎ Change date to ${todayLine[0].label}`
  return [
    ...skip,
    ...todayLine,
    { label: `> Change ${taskText} to >today (repeating until complete)`, value: '__today__' },
    { label: `🚫 Mark ${taskText} cancelled`, value: '__canceled__' },
    { label: `⌫ Remove the >date from the ${taskText}`, value: '__remove__' },
    { label: `⦿ Convert ${taskText} to a bullet/list item`, value: '__list__' },
    { label: `☑︎ Convert ${taskText} to a checklist item`, value: '__checklist__' },
    { label: `⦿ Convert ${taskText} to a bullet/list item & move to another note`, value: '__listMove__' },
    { label: `☑︎ Convert ${taskText} to a checklist item & move to another note`, value: '__checklistMove__' },
    { label: '❌ Cancel Review', value: '__xcl__' },
    { label: '------ Set Due Date To: -------', value: '-----' },
    ...dateOpts,
  ]
}

/**
 *
 * @param {TParagraph} origPara
 * @param {Array<{label:string,value:string}>} todayLines
 * @returns
 */
export function getSingleTaskOptions(origPara: TParagraph, todayLines: any, content: string): Array<{ label: string, value: string }> {
  const opts = [
    { label: `➡️ Leave "${content}" (and continue)`, value: '__skip__' },
    ...todayLines,
    { label: `✏️ Edit this task in note: ("${origPara.note?.title || ''}")`, value: '__edit__' },
    { label: `✓ Mark done/complete`, value: '__done__' },
    { label: `✓⏎ Mark done and add follow-up in same note`, value: '__mdhere__' },
    { label: `✓📆 Mark done and add follow-up in future note`, value: '__mdfuture__' },
    { label: `💡 This reminds me...(create new task then continue)`, value: '__newTask__' },
    { label: `>> Set task as next up`, value: '__>>__' },
    { label: `! Set priority to p1`, value: '__p1__' },
    { label: `!! Set priority to p2`, value: '__p2__' },
    { label: `!!! Set priority to p3`, value: '__p3__' },
    { label: `!!!! Set priority to p4`, value: '__p4__' },
    { label: `x! Remove priority from task (p0)`, value: '__p0__' },
  ]
  if (NotePlan.environment.platform === 'macOS') {
    // splice in option in 2nd position
    opts.splice(1, 0, { label: `====== [CMD+click = move task to chosen date; OPT+click = multi-action] ======`, value: '__skip__' })
  }
  return opts
}

/**
 * Open a note, highlight the task being looked at and prompt user for a choice of what to do with one specific line/task
 * @param {*} origPara
 * @returns {Promise<RescheduleUserAction | false>} the user choice or false
 */
async function getUserActionForThisTask(origPara: TParagraph /*, updatedPara: TParagraph */): Promise<CommandBarChoice | false> {
  logDebug(pluginJson, `getUserActionForThisTask note:"${origPara.note?.title || ''}": task:"${origPara.content || ''}"`)
  if (Editor.filename !== origPara.note?.filename) {
    await Editor.openNoteByFilename(origPara.note?.filename || '')
  }
  Editor.highlight(origPara)

  const sharedOpts = getGenericTaskActionOptions(origPara, true)
  const todayLines = sharedOpts.splice(0, 2) // get the two >today lines and bring to top
  const content = textWithoutSyncedCopyTag(origPara.content)
  let opts = getSingleTaskOptions(origPara, todayLines, content)

  // concatenate sharedOpts to the end of opts array
  opts = opts.concat(...sharedOpts)
  opts.push({ label: `␡ Delete this line (be sure!)`, value: '__delete__' }) // add delete option at the very end

  const weektext = />\d{4}-W/i.test(origPara.content) ? 'Week ' : ''
  const prompt = `${weektext}Task: "${content}"`
  logDebug(pluginJson, `getUserActionForThisTask calling chooseOptionWithModifiers() - opts.length: ${opts.length}, prompt="${prompt}"`)
  // opts.forEach((o) => console.log(o.value))
  // clo(opts, 'getUserActionForThisTask: opts')
  const choice = await chooseOptionWithModifiers(prompt, opts)
  choice ? updateLastUsedChoices(choice) : null
  logDebug(pluginJson, `getUserActionForThisTask user selection: ${JSP(choice)}`)
  return choice
}

/**
 * Change the arrow date in a task to today and update it in in the DataStore
 * By default, changes the arrow date to today
 * Optionally blanks the date out
 * @param {TParagraph} paragraph
 * @param {boolean} removeDate - whether to blank out the date
 * @returns {TParagraph} - the updated paragraph (if you need it, but can be ignored since it's saved)
 */
export function updateParagraphWithArrowDate(paragraph: TParagraph, removeDate: boolean = false): TParagraph {
  paragraph.content = replaceArrowDatesInString(paragraph.content, removeDate ? '' : null)
  updateParagraph(paragraph)
  return paragraph
}

/**
 * Allow for editing of the task
 * @param {TParagraph} origPara 
// @returns {number} incrementor to move to next task. CONTINUE to go to next one, CANCEL to cancel, 0 to see this task again
 */
export async function handleEditAction(origPara: TParagraph): Promise<number> {
  logDebug(pluginJson, `handleEditAction: editing task: "${origPara.content}"`)
  const input = await CommandBar.textPrompt('Edit task contents', `Change text:\n"${origPara.content}" to:\n`, origPara.content)
  if (input) {
    origPara.content = input
    updateParagraph(origPara)
    return CONTINUE
  } else {
    logDebug(pluginJson, `handleEditAction: no input received, canceling`)
  }
  return CANCEL
}

/**
 * Change the type of the task (e.g. from checklist to list)
 * @param {TParagraph} origPara 
// @returns {number} incrementor to move to next task. CONTINUE to go to next one, CANCEL to cancel, 0 to see this task again
 */
export async function handleTypeAction(origPara: TParagraph, userChoice: string): Promise<number> {
  const tMap = {
    __done__: 'done',
    __canceled__: 'cancelled',
    __list__: 'list',
    __checklist__: 'checklist',
    __listMove__: 'list',
    __checklistMove__: 'checklist',
  }
  // if userChoice is not inTMap, return CANCEL and log an error
  if (!tMap[userChoice]) {
    logError(pluginJson, `handleTypeAction: unknown userChoice: ${userChoice}`)
    return CANCEL
  }

  origPara.type = tMap[userChoice]

  if (/Move/.test(userChoice)) {
    const noteToMoveTo = await chooseNote(true, true, [], 'Note to move to', true, true)
    if (noteToMoveTo) {
      const heading = await chooseHeading(noteToMoveTo, true, true, false)
      if (heading) {
        noteToMoveTo.addParagraphBelowHeadingTitle(origPara.content, origPara.type, heading, false, true)
        origPara.note?.removeParagraph(origPara)
        return CONTINUE
      } else {
        logError(pluginJson, `handleTypeAction: could not find heading in note: ${noteToMoveTo.title || ''}`)
        return SEE_TASK_AGAIN
      }
    } else {
      logError(pluginJson, `handleTypeAction: could not find note to move to`)
      return SEE_TASK_AGAIN
    }
  }
  updateParagraph(origPara)
  return CONTINUE
}

// remove arrow date from the string
export function handleRemoveAction(origPara: TParagraph): number {
  origPara.content = replaceArrowDatesInString(origPara.content, '')
  updateParagraph(origPara)
  return CONTINUE
}

// change the priority
export function handlePriorityAction(origPara: TParagraph, userChoice: string): number {
  const priorityMap = {
    __p0__: '',
    __p1__: '!',
    __p2__: '!!',
    __p3__: '!!!',
    __p4__: '!!!!',
    '__>>__': '>>',
  }
  const prioritySymbol = priorityMap[userChoice] || ''
  changePriority(origPara, prioritySymbol, true)
  return SEE_TASK_AGAIN
}

// delete the task
export function handleDeleteAction(origPara: TParagraph): number {
  origPara.note?.removeParagraph(origPara)
  return CONTINUE
}

// set the date to >today
export function handleTodayAction(origPara: TParagraph): number {
  origPara.content = replaceArrowDatesInString(origPara.content, '>today')
  updateParagraph(origPara)
  return CONTINUE
}

// open the note for this task
export async function handleOpenTaskAction(origPara: TParagraph): Promise<number> {
  logDebug(`handleOpenTaskAction: opening Editor to task: ${origPara.content} filename: ${origPara.note?.filename || ''}`)
  if (origPara.note?.filename) {
    await Editor.openNoteByFilename(origPara.note.filename, false, origPara.contentRange?.start || 0, origPara.contentRange?.end || 0)
    return SEE_TASK_AGAIN
  }
  return CANCEL
}

// change the date to the user's choice of >date
export async function handleArrowDatesAction(origPara: TParagraph, userChoice: string, optionChosen?: CommandBarChoice): Promise<number> {
  const cmdPressed = optionChosen ? optionChosen.keyModifiers?.length && optionChosen.keyModifiers.includes('cmd') : false
  origPara.content = replaceArrowDatesInString(origPara.content, cmdPressed ? '' : userChoice)
  updateParagraph(origPara) // Note: after origPara is updated, the pointer is no longer good in Obj-C
  if (cmdPressed) {
    logDebug(pluginJson, `handleArrowDatesAction: keyModifiers: ${optionChosen ? optionChosen.keyModifiers.toString() : ''}`)
    const updatedPara = origPara.note?.paragraphs[origPara.lineIndex] || origPara // get the updated paragraph
    await processCmdKey(updatedPara, userChoice)
  }
  return CONTINUE
}

// add a new task ("this reminds me...")
export async function createNewTask(): Promise<void> {
  // prompt user for task
  const task = await CommandBar.textPrompt('New Task', "Create new task in todays's note")
  if (task) {
    const note = await DataStore.calendarNoteByDate(new Date())
    if (note) {
      note.addParagraphBelowHeadingTitle(task, 'open', 'Tasks', false, true)
    } else {
      logError(pluginJson, `createNewTask: could not find note: ${getTodaysDateHyphenated()}`)
    }
  } else {
    logDebug(pluginJson, `createNewTask: did not create new task - no task entered in CommandBar`)
  }
}

// handle follow up or create new task
export async function handleNewTaskAction(origPara: TParagraph, userChoice: string): Promise<number> {
  Editor.openNoteByFilename(origPara.note?.filename || '')
  switch (userChoice) {
    case `__mdhere__`:
      await followUpSaveHere(origPara)
      break
    case `__mdfuture__`: {
      await followUpInFuture(origPara)
      break
    }
    case '__newTask__': {
      await createNewTask()
      // await appendTaskToCalendarNote(getTodaysDateHyphenated())
      return SEE_TASK_AGAIN
    }
  }
  return CONTINUE
}

export type CommandBarChoice = {
  value: string,
  keyModifiers: Array<string>,
  label: string,
  index: number,
}

/**
 * Given a user choice on a specific action to take on a line, create an {action: string, changed?: TParagraph, userChoice?: string} object for further processing
 * @param {TParagraph} origPara
 * @param {TParagraph} updatedPara
 * @param {RescheduleUserAction|false} userChoice
 * @returns {number} incrementor to move to next task. CONTINUE to go to next one, CANCEL to cancel, 0 to see this task again
 * @jest (limited) tests exist
 */
export async function processUserAction(origPara: TParagraph, optionChosen: CommandBarChoice): Promise<number> {
  const userChoice = optionChosen.value
  switch (userChoice) {
    case '__edit__':
      return await handleEditAction(origPara)
    case '__done__':
    case '__checklist__':
    case '__checklistMove__':
    case '__listMove__':
    case '__canceled__':
    case '__list__':
      return await handleTypeAction(origPara, userChoice)
    case '__remove__':
      return handleRemoveAction(origPara)
    case '__delete__':
      return handleDeleteAction(origPara)
    case '__newTask__':
    case '__mdhere__':
    case '__mdfuture__':
      return await handleNewTaskAction(origPara, userChoice)
    case '__p0__':
    case '__p1__':
    case '__p2__':
    case '__p3__':
    case '__p4__':
    case '__>>__':
      return handlePriorityAction(origPara, userChoice)
    case '__today__':
      return await handleTodayAction(origPara)
    case '__opentask__':
      return await handleOpenTaskAction(origPara)
    case '__skip__':
      return CONTINUE
    default:
      if (typeof userChoice === 'string' && userChoice[0] === '>') {
        return await handleArrowDatesAction(origPara, userChoice, optionChosen)
      }
  }
  logError(pluginJson, `processUserAction: unknown userChoice: ${userChoice}`)
  return CANCEL
}

/**
 * Review a single note's overdue tasks and get user input on what to do with them
 * @param {Array<TParagraph>} notesToUpdate - an array of paragraphs in each note that need to be reviewed/updated
 * @param {OverdueSearchOptions} options
 * @returns {boolean} - true if all went well, false if user canceled
 */
async function reviewOverdueTasksInNote(paragraphsToConsider: Array<TParagraph>, options: OverdueSearchOptions): Promise<boolean> {
  // const { showNote, confirm } = options
  clo(options, 'reviewOverdueTasksInNote options')
  if (!paragraphsToConsider.length) return false // note had no tasks to review...should never happen
  const note = paragraphsToConsider[0].note
  if (!note) return false // should never happen
  const updates = sortListBy(paragraphsToConsider, '-lineIndex') // sort tasks starting at bottom of page
  let currentIndex = 0
  do {
    if (!updates.length) return false
    if (currentIndex >= updates.length) return false
    const paraInUpdates = updates[currentIndex]
    // After updates are edited, the Editor gets confused about character counts, so let's refresh the paragraph from the underlying note each time
    const paragraph = paraInUpdates.note?.paragraphs[paraInUpdates.lineIndex] || paraInUpdates
    logDebug(pluginJson, `reviewOverdueTasksInNote: Reviewing: "${note.title || ''}", currentIndex: ${currentIndex} content:"${paragraph.content}"`)
    const choice = await getUserActionForThisTask(paragraph) // returns { value: RescheduleUserAction, keyModifiers: Array<string> } | false
    if (!choice) return false // user hit escape
    let incrementor = await processUserAction(paragraph, choice)
    logDebug(pluginJson, `reviewOverdueTasksInNote returned incrementor: ${incrementor}`)
    if (incrementor === CANCEL) return false // user canceled
    if (choice.keyModifiers.includes('opt')) incrementor = SEE_TASK_AGAIN // option key pressed so should allow editing after new date is appended
    currentIndex += incrementor
  } while (currentIndex < updates.length)
  return true
}

/**
 * Take in an array of arrays of paragraphs and return the same but with multiple synced lines removed
 * @param {*} notesWithTasks
 * @returns Array<Array<TParagraph>>
 * @author @dwertheimer
 */
function dedupeSyncedLines(notesWithTasks: Array<Array<TParagraph>>): Array<Array<TParagraph>> {
  logDebug(pluginJson, `dedupeSyncedLines  notesWithTasks ${notesWithTasks.length}`)
  const flatTasks = notesWithTasks.reduce((acc, n) => acc.concat(n), []) //flatten the array
  // clo(flatTasks, `dedupeSyncedLines  flatTasks`)
  logDebug(pluginJson, `dedupeSyncedLines  flatTasks.length BEFORE deduping ${flatTasks.length}`)
  const noDupes = eliminateDuplicateSyncedParagraphs(flatTasks)
  // clo(noDupes, `dedupeSyncedLines  noDupes`)
  logDebug(pluginJson, `dedupeSyncedLines  flatTasks.length AFTER deduping ${noDupes.length}`)
  return createArrayOfNotesAndTasks(noDupes)
}

/**
 * Take in a flat list of tasks and create an array of arrays
 * Level 1: Each Note
 *  Level 2: Tasks within that note
 * @param {Array<TParagraph>} tasks - Flat list of tasks from different notes
 * @returns array (per note) of arrays of tasks
 * @author @dwertheimer
 */
export function createArrayOfNotesAndTasks(tasks: Array<TParagraph>): Array<Array<TParagraph>> {
  const notes = tasks.reduce((acc, r) => {
    if (r.note?.filename) {
      if (r.note.filename && !acc.hasOwnProperty(r.note.filename)) acc[r.note.filename] = []
      if (r.note?.filename) acc[r.note.filename].push(r)
    }
    return acc
  }, {})
  // generate an array for each note (key)
  return Object.keys(notes).reduce((acc, k) => {
    acc.push(notes[k])
    return acc
  }, [])
}

/**
 * Create a list of notes and paragraphs in each note that need to be reviewed/updated (overdue or otherwise depending on options sent)
 * @param {OverdueSearchOptions} - options object with the following characteristics
 * @return {Array<Array<TParagraph>>} - array (one for each note) containing array of paragraphs/lines to potentially update
 * @author @dwertheimer
 */
export function getNotesAndTasksToReview(options: OverdueSearchOptions): Array<Array<TParagraph>> {
  const startTime = new Date()
  const { foldersToIgnore = [], overdueAsOf, /* openOnly = true, datePlusOnly = true, replaceDate = true, */ noteTaskList = null, noteFolder = false } = options
  // if (replaceDate) logDebug('getNotesAndTasksToReview: replaceDate is legacy and no longer supported. David u need to fix this')
  logDebug(`NPNote::getNotesAndTasksToReview`, `noteTaskList.length: ${noteTaskList?.length || 'undefined'} Looking in: ${noteFolder || 'all notes'}`)
  let notesWithDates = []
  if (!noteTaskList) {
    logDebug(`NPNote::getNotesAndTasksToReview`, `no noteTaskList, so searching for notes`)
    if (noteFolder) {
      // if noteFolder is in foldersToIgnore then we need to call showMessage and return
      if (foldersToIgnore.includes(noteFolder)) {
        const msg = `The folder "${noteFolder}" is in the list of folders to ignore in the plugin settings. Please remove it from the ignore list or select another folder.`
        throw msg
      }
      notesWithDates = [...DataStore.projectNotes, ...DataStore.calendarNotes]
        .filter((n) => (n?.filename ? n.filename.includes(`${noteFolder}/`) : false))
        .filter((n) => (n?.datedTodos ? n.datedTodos?.length > 0 : false))
    } else {
      notesWithDates = [...DataStore.projectNotes, ...DataStore.calendarNotes].filter((n) => (n?.datedTodos ? n.datedTodos?.length > 0 : false))
    }
  } else {
    // clo(noteTaskList, `getNotesAndTasksToReview noteTaskList`)
  }
  if (!noteTaskList && foldersToIgnore) {
    notesWithDates = notesWithDates.filter((note) =>
      foldersToIgnore.every((skipFolder) => !(note?.filename && typeof note.filename === 'string' ? note.filename.includes(`${skipFolder}/`) : false)),
    )
  }
  logDebug(`NPNote::getNotesAndTasksToReview`, `total notesWithDates: ${notesWithDates.length}`)
  // let updatedParas = []
  let notesToUpdate = []
  if (!noteTaskList) {
    for (const n of notesWithDates) {
      if (n) {
        // const updates = getOverdueParagraphs(n, replaceDate ? '' : null)
        const updates = getOverdueParagraphs(n.paragraphs, overdueAsOf).filter((p) => p.type === 'open') // do not want open checklist items
        if (updates.length > 0) {
          notesToUpdate.push(updates)
        }
      }
    }
  } else {
    logDebug(pluginJson, `getNotesAndTasksToReview using supplied task list: ${noteTaskList.length} tasks`)
    notesToUpdate = noteTaskList
  }
  logDebug(`NPNote::getNotesAndTasksToReview took:${timer(startTime)}`, `total notesToUpdate: ${notesToUpdate.length}`)
  return dedupeSyncedLines(notesToUpdate)
}

/**
 * Given an array of array of paragraphs to review, review each note individually
 * @param {*} notesToUpdate
 * @param {*} options
 */
export async function reviewOverdueTasksByNote(notesToUpdate: Array<Array<TParagraph>>, options: OverdueSearchOptions) {
  const { overdueOnly, confirm } = options
  logDebug(`NPNote::reviewOverdueTasksByNote`, `total notes with overdue dates: ${notesToUpdate.length}`)
  if (!notesToUpdate.length && confirm) {
    await showMessage(`Did not find any ${overdueOnly ? 'overdue' : 'relevant'} tasks!`, 'OK', 'Task Search', true)
  }

  // loop through all notes and process each individually
  for (let i = 0; i < notesToUpdate.length; i++) {
    logDebug(
      `NPNote::reviewOverdueTasksByNote`,
      `starting note loop:${i} of ${notesToUpdate.length} notes;  number of updates left: notesToUpdate[${i}].length=${notesToUpdate[i].length}`,
    )
    if (notesToUpdate[i].length) {
      logDebug(
        `reviewOverdueTasksByNote`,
        `calling reviewOverdueTasksInNote on notesToUpdate[${i}]: "${(notesToUpdate && notesToUpdate[i] && String(notesToUpdate[i][0].filename)) || ''}"`,
      )
      // clo(notesToUpdate[i], `notesToUpdate[${i}]`)
      const reviewResult = await reviewOverdueTasksInNote(notesToUpdate[i], options) // result may decrement index to see the note again after one line change
      if (!reviewResult) break //user selected cancel
    }
  }
  if (notesToUpdate.length && confirm) await showMessage(`${overdueOnly ? 'Overdue Task ' : ''}Review Complete!`, 'OK', 'Task Search', true)
}

/**
 * Get a list of notes which fit the date criteria (and notetype criteria) so we can search them for tasks to review (e.g. overdue or forgotten)
 * @param {NoteType | both} noteType - type of notes to return 'Calendar', 'Notes' or 'both'
 * @param {{num:number, unit:string}} timePeriod - time period to search for notes number of 'unit' (always singular e.g. 1 'day'|'week'|'month'|'year')
 * @param {any} options - overdueFoldersToIgnore
 */
export function getNotesWithOpenTasks(
  noteType: NoteType | 'both',
  timePeriod: { num: number, unit: CalendarDateUnit },
  options: {
    searchForgottenTasksOldestToNewest: boolean,
    overdueFoldersToIgnore: Array<string>,
    ignoreScheduledInForgottenReview: boolean,
    restrictToFolder: string | null,
    endingDateString: string,
  },
): Array<Array<TParagraph>> {
  const { searchForgottenTasksOldestToNewest, overdueFoldersToIgnore, ignoreScheduledInForgottenReview, restrictToFolder, endingDateString = getTodaysDateHyphenated() } = options
  const lookInCalendar = noteType === 'Calendar' || noteType === 'both'
  const lookInNotes = noteType === 'Notes' || noteType === 'both'
  const endDate = new moment(endingDateString).toDate()
  const todayFileName = `${filenameDateString(endDate)}.${DataStore.defaultFileExtension}`
  const startTime = new Date()

  const { num, unit } = timePeriod
  const afterDate = Calendar.addUnitToDate(endDate, unit, -num)
  const thisWeek = getNPWeekData(endDate)?.weekString
  const afterWeek = getNPWeekData(afterDate)?.weekString
  logDebug(`getNotesWithOpenTasks`, `afterdate=${afterDate.toString()}`)

  let recentCalNotes: Array<TNote> = []
  if (lookInCalendar && !restrictToFolder) {
    const afterDateFileName = filenameDateString(Calendar.addUnitToDate(endDate, unit, -num))
    logDebug(`getNotesWithOpenTasks`, `afterDateFileName=${afterDateFileName}`)
    logDebug(`getNotesWithOpenTasks`, `todayFileName=${todayFileName}`)
    // Calendar Notes
    recentCalNotes = DataStore.calendarNotes.filter((note) => {
      if (isWeeklyNote(note) && thisWeek && afterWeek) {
        return note.filename < thisWeek && note.filename >= afterWeek
      } else {
        return note.filename < todayFileName && note.filename >= afterDateFileName
      }
    })
    logDebug(`getNotesWithOpenTasks`, `Calendar Notes in date range: ${recentCalNotes.length}`)
    // recentCalNotes = filterNotesAgainstExcludeFolders(recentCalNotes, overdueFoldersToIgnore, true)
    logDebug(`getNotesWithOpenTasks`, `Calendar Notes after exclude folder filter: ${recentCalNotes.length}`)
  }

  const isInFolder = (note: TNote) => (restrictToFolder ? note.filename.startsWith(`${restrictToFolder}/`) : true)

  // Project Notes
  let recentProjNotes: Array<TNote> = []
  if (lookInNotes) {
    recentProjNotes = DataStore.projectNotes.filter(isInFolder).filter((note) => note.changedDate >= afterDate)
    logDebug(`getNotesWithOpenTasks`, `Total Project Notes in date range: ${recentProjNotes.length}`)
    recentProjNotes = filterNotesAgainstExcludeFolders(recentProjNotes, overdueFoldersToIgnore || [], true)
    logDebug(`getNotesWithOpenTasks`, `Project Notes after exclude folder filter: ${recentProjNotes.length}`)
  }

  const recentCalNotesWithOpens: Array<Array<TParagraph>> = getOpenTasksByNote(
    recentCalNotes,
    searchForgottenTasksOldestToNewest ? 'filename' : '-filename',
    ignoreScheduledInForgottenReview,
  )
  const recentProjNotesWithOpens: Array<Array<TParagraph>> = getOpenTasksByNote(
    recentProjNotes,
    searchForgottenTasksOldestToNewest ? 'changedDate' : '-changedDate',
    ignoreScheduledInForgottenReview,
  )
  logDebug(`getNotesWithOpenTasks`, `Calendar Notes after filtering for open tasks: ${recentCalNotesWithOpens.length}`)
  logDebug(`getNotesWithOpenTasks`, `Project Notes after filtering for open tasks: ${recentProjNotesWithOpens.length}`)

  const notesWithOpenTasks: Array<Array<TParagraph>> = [...recentCalNotesWithOpens, ...recentProjNotesWithOpens]
  logDebug(`getNotesWithOpenTasks took:${timer(startTime)}`, `Combined Notes after filtering for open tasks:${notesWithOpenTasks.length}`)

  return notesWithOpenTasks
}

/**
 * Get notes with open tasks FIXME
 * @param {Array<Note>} notes -- array of notes to review
 * @param {*} sortOrder -- sort order for notes (not implemented yet)
 * @param {*} ignoreScheduledTasks - don't show scheduled tasks
 * @returns {Promise<Array<Array<TParagraph>>>} - array of tasks to review, grouped by note
 */
export function getOpenTasksByNote(notes: Array<TNote>, sortOrder: string | Array<string> | null = null, ignoreScheduledTasks: boolean = true): Array<Array<TParagraph>> {
  // CommandBar.showLoading(true, `Searching for open tasks...`)
  // await CommandBar.onAsyncThread()
  let notesWithOpenTasks: Array<Array<TParagraph>> = []
  for (const note of notes) {
    // CommandBar.showLoading(true, `Searching for open tasks...\n${note.title || ''}`)
    const paras = note.paragraphs

    const openTasksInThisNote: Array<TParagraph> = []
    for (let index = 0; index < paras.length; index++) {
      const p = paras[index]
      if (p.type === 'open' && p.content.trim() !== '' && (!ignoreScheduledTasks || !(ignoreScheduledTasks && isScheduled(p.content)))) {
        // logDebug(`getOpenTasksByNote: Including note: "${note.title || ''}" and task: "${p.content}".`)
        openTasksInThisNote.push(p)
      }
    }
    if (openTasksInThisNote.length) notesWithOpenTasks.push(openTasksInThisNote)
  }
  if (sortOrder) {
    const mapForSorting = notesWithOpenTasks.reduce((acc, n, i) => {
      acc?.push({ filename: n[0].filename, changedDate: n[0].note?.changedDate, index: i, noteWithTasks: n })
      return acc
    }, [])
    const sortedByNoteParams = sortListBy(mapForSorting, sortOrder)
    notesWithOpenTasks = sortedByNoteParams.map((i) => i.noteWithTasks) //get back into an array of array of tasks
  }
  // await CommandBar.onMainThread()
  // CommandBar.showLoading(false)
  // clo(notesWithOpenTasks, `getOpenTasksByNote: notesWithOpenTasks - is this by note or flat paragraph?`)
  return notesWithOpenTasks
}

/**
 * Get open tasks from the current week's note
 * @returns {Array<TParagraph>} Array of open tasks
 */
export function getWeeklyOpenTasks(): Array<TParagraph> {
  const weeklyNote = DataStore.calendarNoteByDate(new Date(), 'week')
  const refs = weeklyNote ? getReferencedParagraphs(weeklyNote) : []
  const combined = [...refs, ...(weeklyNote?.paragraphs || [])]
  // clo(weeklyNote, 'weeklyNote')
  logDebug(pluginJson, `getWeeklyOpenTasks ${weeklyNote?.filename || 0}: refs:${refs.length} paras:${weeklyNote?.paragraphs.length || 0} combined:${combined.length}`)
  return combined.filter(isOpen) || []
}

/**
 * Get all today-referenced tasks (called by reviewEditorReferencedTasks and in React review also)
 * @param {CoreNoteFields} note - the note to search
 * @param {any} settings - the DataStore.settings for the plugin
 * @param {boolean} confirmResults - whether to show a confirmation message (default: false)
 * @returns {Array<any>} Array of tasks to review
 */
export function getReferencesForReview(note: CoreNoteFields, weeklyNote: boolean = false): Array<Array<TParagraph>> {
  const refs = getTodaysReferences(note)
  logDebug(pluginJson, `getReferencesForReview refs.length=${refs.length}`)
  const openTasks = weeklyNote ? [] : refs.filter((p) => isOpen(p) && p.content !== '')
  const thisWeeksTasks = weeklyNote ? getWeeklyOpenTasks() : []
  logDebug(pluginJson, `getReferencesForReview openTasks.length=${openTasks.length} thisWeeksTasks=${thisWeeksTasks.length}`)
  // gather references by note
  const arrayOfOpenNotesAndTasks = createArrayOfNotesAndTasks([...thisWeeksTasks, ...openTasks])
  // clo(arrayOfOpenNotesAndTasks, `getReferencesForReview arrayOfOpenNotesAndTasks`)
  // clo(arrayOfNotesAndTasks, `NPOverdue::getReferencesForReview arrayOfNotesAndTasks`)
  logDebug(pluginJson, `getReferencesForReview arrayOfNotesAndTasks.length=${arrayOfOpenNotesAndTasks.length}`)
  return arrayOfOpenNotesAndTasks || []
}
