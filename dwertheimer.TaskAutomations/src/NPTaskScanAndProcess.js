// @flow

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import { appendTaskToCalendarNote } from '../../jgclark.QuickCapture/src/quickCapture'
import { noteHasContent, moveParagraphToNote, getOverdueParagraphs } from '../../helpers/NPParagraph'
import { getNPWeekData, getWeekOptions } from '../../helpers/NPdateTime'
import { filterNotesAgainstExcludeFolders, noteType } from '../../helpers/note'
import { getReferencedParagraphs, getTodaysReferences } from '../../helpers/NPnote'
import { chooseHeading, chooseNote, chooseOptionWithModifiers, showMessage } from '../../helpers/userInput'
import { followUpSaveHere, followUpInFuture } from './NPFollowUp'
import { filenameDateString } from './dateHelpers'
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
  | string /* >dateOptions */
  | number /* lineIndex of item to pop open */

/**
 * An individual task command was selected with a modifier key pressed
 * @param {*} para
 * @param {*} keyModifiers
 * @param {*} userChoice
 * @return {boolean} true if moved (used to work around API inconsistencies after changes in Editor and Editor.note)
 */
export async function processModifierKey(para: TParagraph, keyModifiers: Array<string>, userChoice: string = ''): Promise<boolean> {
  if (userChoice.length && userChoice[0] === '>') {
    logDebug(pluginJson, `processModifierKey(): is >date command [${keyModifiers.toString()}] + userChoice=${userChoice}`)
    let date = userChoice?.slice(1)
    if (new RegExp(RE_DATE).test(date)) {
      date = date.replace(/-/g, '') // convert 8601 date to daily note filename
    }
    let filename = `${date}.${DataStore.defaultFileExtension}`
    const nType = noteType(filename)
    if (nType === 'Calendar' && !new RegExp(`^${RE_WEEKLY_NOTE_FILENAME}(md|txt)$`).test(filename)) filename = filename.replace(/-/g, '')
    if (keyModifiers.includes('cmd')) {
      // MOVE TASK TO SPECIFIED NOTE
      const note = await DataStore.noteByFilename(filename, nType)
      if (note) {
        logDebug(pluginJson, `processModifierKey ready to write task to: ${filename}`)
        return moveParagraphToNote(para, note)
      } else {
        logDebug(pluginJson, `processModifierKey could not open: ${filename}. Leaving task in place (${para.content})`)
      }
    } else if (keyModifiers.includes('opt')) {
      // option key pressed so should allow editing after new date is appended
      return true
    }
  } else {
    // non-date commands
    logDebug(pluginJson, `processModifierKey(): not a >date command [${keyModifiers.toString()}] + userChoice=${userChoice}`)
  }
  return false
}

/**
 * Get shared CommandBar options to be displayed for both full notes or individual tasks
 * @param {TPara} origPara
 * @param {boolean} isSingleLine
 * @returns {$ReadOnlyArray<{ label: string, value: string }>} the options for feeding to a command bar
 */
export function getSharedOptions(origPara?: TParagraph | { note: TNote } | null, isSingleLine?: boolean = true): Array<{ label: string, value: string }> {
  const isGeneric = !origPara || !origPara.note
  const dateOpts = [...getDateOptions(), ...getWeekOptions()]
  // clo(dateOpts, `getSharedOptions dateOpts`)
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
 * Open a note, highlight the task being looked at and prompt user for a choice of what to do with one specific line
 * @param {*} origPara
 * @returns {Promise<RescheduleUserAction | false>} the user choice or false
 */
async function promptUserToActOnLine(origPara: TParagraph /*, updatedPara: TParagraph */): Promise<{ value: RescheduleUserAction, keyModifiers: Array<string> } | false> {
  logDebug(pluginJson, `promptUserToActOnLine note:"${origPara.note?.title || ''}": task:"${origPara.content || ''}"`)
  const range = origPara.contentRange
  if (origPara?.note?.filename) await Editor.openNoteByFilename(origPara.note.filename, false, range?.start || 0, range?.end || 0)
  const sharedOpts = getSharedOptions(origPara, true)
  const todayLines = sharedOpts.splice(0, 2) // get the two >today lines and bring to top
  const content = textWithoutSyncedCopyTag(origPara.content)
  const opts = [
    { label: `➡️ Leave "${content}" (and continue)`, value: '__skip__' },
    ...todayLines,
    { label: `✏️ Edit this task in note: "${origPara.note?.title || ''}"`, value: '__edit__' },
    { label: `✓ Mark task done/complete`, value: '__done__' },
    { label: `✓⏎ Mark done and add follow-up in same note`, value: '__mdhere__' },
    { label: `✓📆 Mark done and add follow-up in future note`, value: '__mdfuture__' },
    { label: `💡 This reminds me...(create new task then continue)`, value: '__newTask__' },
    ...sharedOpts,
    { label: `␡ Delete this line (be sure!)`, value: '__delete__' },
  ]
  if (NotePlan.environment.platform === 'macOS') {
    // splice in option in 2nd position
    opts.splice(1, 0, { label: `====== [CMD+click = move task to chosen date; OPT+click = multi-action] ======`, value: '__skip__' })
  }
  const weektext = />\d{4}-W/i.test(origPara.content) ? 'Week ' : ''
  const res = await chooseOptionWithModifiers(`${weektext}Task: "${content}"`, opts)
  logDebug(pluginJson, `promptUserToActOnLine user selection: ${JSP(res)}`)
  // clo(res, `promptUserToActOnLine after chooseOption res=`)
  return res
}

/**
 * Given a user choice on a specific action to take on a line, create an {action: string, changed?: TParagraph, userChoice?: string} object for further processing
 * @param {TParagraph} origPara
 * @param {TParagraph} updatedPara
 * @param {RescheduleUserAction|false} userChoice
 * @returns
 * @jest (limited) tests exist
 */
export async function prepareUserAction(origPara: TParagraph, updatedPara: TParagraph, userChoice: any): Promise<{ action: string, changed?: TParagraph, userChoice?: string }> {
  // const userChoice = userChoiceObj?.value
  if (userChoice) {
    const content = origPara?.content || ''
    logDebug(pluginJson, `prepareUserAction on content: "${content}" res= "${userChoice}"`)
    switch (userChoice) {
      case '__edit__': {
        const input = await CommandBar.textPrompt('Edit task contents', `Change text:\n"${content}" to:\n`, content)
        if (input) {
          origPara.content = input
          return { action: 'set', changed: origPara }
        } else {
          return { action: 'cancel', changed: origPara }
        }
      }
      case `__done__`:
      case `__checklist__`:
      case `__checklistMove__`:
      case `__listMove__`:
      case '__canceled__':
      case '__list__': {
        const tMap = { __done__: 'done', __canceled__: 'cancelled', __list__: 'list', __checklist__: 'checklist', __listMove__: 'list', __checklistMove__: 'checklist' }
        origPara.type = tMap[userChoice]
        origPara.content = replaceArrowDatesInString(origPara.content)
        if (/Move/.test(userChoice)) {
          const noteToMoveTo = await chooseNote(true, true, [], 'Note to move to', true, true)
          if (noteToMoveTo) {
            const heading = await chooseHeading(noteToMoveTo, true, true, false)
            if (heading) {
              noteToMoveTo.addParagraphBelowHeadingTitle(origPara.content, origPara.type, heading, false, true)
            } else {
              noteToMoveTo.prependParagraph(origPara.content, origPara.type)
            }
            return { action: 'delete', changed: origPara }
          }
        }
        return { action: 'set', changed: origPara }
      }
      case '__remove__':
        origPara.content = replaceArrowDatesInString(origPara.content, '')
        return { action: 'set', changed: origPara }
      case `__delete__`:
        return { action: 'delete', changed: origPara }
      case `__newTask__`:
      case `__mdhere__`:
      case `__mdfuture__`: {
        return { action: userChoice, changed: origPara }
      }
      case `__today__`: {
        origPara.content = replaceArrowDatesInString(origPara.content, '>today')
        return { action: 'set', changed: origPara } // dbw NOTE: this said "updatedPara". Not sure how/why that worked before. changing it for React
      }
      case '__opentask__': {
        if (origPara.note?.filename) {
          await Editor.openNoteByFilename(origPara.note.filename, false, origPara.contentRange?.start || 0, origPara.contentRange?.end || 0)
          return { action: 'skip', changed: origPara }
        }
        break
      }
      case `__no__`: {
        return { action: 'set', changed: origPara }
      }
      case '__skip__':
        return { action: 'skip', changed: origPara }
    }
    if (typeof userChoice === 'string' && userChoice[0] === '>') {
      origPara.content = replaceArrowDatesInString(origPara.content, userChoice)
      return { action: 'set', changed: origPara, userChoice }
    }
    logDebug(pluginJson, `prepareUserAction chosen: ${userChoice} returning`)
  }
  return { action: 'cancel' }
}

/**
 * Helper function to show overdue tasks in note & allow user selection
 * @param {TNote} note
 * @param {*} updates
 * @param {*} index
 * @param {*} totalNotesToUpdate
 * @returns
 */
async function showOverdueNote(note: TNote, updates: Array<TParagraph>, index: number, totalNotesToUpdate: number) {
  const range = updates[0].contentRange
  logDebug(pluginJson, `showOverdueNote: openingNote "filename: ${note.filename}" | title:"${note.title || ''}"`)
  await Editor.openNoteByFilename(note.filename, false, range?.start || 0, range?.end || 0)
  // const options = updates.map((p) => ({ label: `${note?.paragraphs?[Number(p.lineIndex) || 0]?.content}`, value: `${p.lineIndex}` })) //show the original value
  // clo(note, `showOverdueNote: note[${index}]=`)
  logDebug(pluginJson, `showOverdueNote note in Editor, title=${Editor.note?.title || ''}`)
  const options = updates.map((p, i) => {
    logDebug(
      `showOverdueNote updates.map[${i}] note.title=${note.title || ''} note?.paragraphs=${note?.paragraphs.length} p.lineIndex=${p.lineIndex} p.type=${p.type} p.content=${
        p.content
      }`,
    )
    if (note.paragraphs.length <= p.lineIndex) {
      //seems like this is an API bug which shouldn't be possible
      return { label: `Error: LineIndex=${p.lineIndex} > paragraphs=${note.paragraphs.length} in "${note.title || ''}"`, value: `0` }
    } else {
      const content = textWithoutSyncedCopyTag(note?.paragraphs[Number(p.lineIndex) || 0]?.content)
      return { label: `${content}`, value: `${p.lineIndex}` }
    }
  }) //show the original value
  const opts = [
    { label: '>> SELECT A TASK INDIVIDUALLY OR MARK THEM ALL (below) <<', value: '-----' },
    ...options,
    { label: '----------------------------------------------------------------', value: '-----' },
    { label: `✓ Mark done/complete`, value: '__done__' },
    ...getSharedOptions({ note }, false),
  ]
  const res = await chooseOptionWithModifiers(`Note (${index + 1}/${totalNotesToUpdate}): "${note?.title || ''}"`, opts)
  logDebug(`NPnote`, `showOverdueNote note:"${note?.title || ''}" user action: ${JSP(res)}`)
  return res
}

/**
 * Review a single note get user input on what to do with it (either the whole note or the tasks on this note)
 * @param {Array<Array<TParagraph>>} notesToUpdate
 * @param {number} noteIndex
 * @param {OverdueSearchOptions} options
 * @returns {number} the new note index (e.g. to force it to review this note again) by default, just return the index you got. -2 means user canceled. noteIndex-1 means show this note again
 */
async function reviewNote(notesToUpdate: Array<Array<TParagraph>>, noteIndex: number, options: OverdueSearchOptions): Promise<number> {
  // clo(options, `reviewNote: noteIndex=${noteIndex} options=`)
  // clo(notesToUpdate[noteIndex], `reviewNote: notesToUpdate[${noteIndex}]`)
  const { showNote, confirm } = options
  let updates = sortListBy(notesToUpdate[noteIndex], '-lineIndex'), //reverse so we can delete from the end without messing up the lineIndexes and confusing NotePlan
    currentTaskIndex = showNote ? -1 : 0,
    currentTaskLineIndex = updates[0].lineIndex,
    res
  const note = updates[0].note
  // clo(updates, `reviewNote: updates after sort=`)
  logDebug(pluginJson, `reviewNote starting review of note: "${note?.title || ''}" tasksToUpdate=${updates.length}`)
  // clo(updates, `reviewNote updates`)
  if (note) {
    if (updates.length > 0) {
      let makeChanges = !confirm
      if (confirm) {
        do {
          if (!updates.length) return currentTaskIndex
          if (showNote) {
            const { value, keyModifiers } = await showOverdueNote(note, updates, noteIndex, notesToUpdate.length)
            logDebug(`NPnote`, `reviewNote ${keyModifiers} and value:${value}`)
            res = value
          } else {
            res = currentTaskLineIndex // skip note and process each task as if someone clicked it to edit
          }
          if (!isNaN(res)) {
            // this was an index of a line to edit
            // clo(note.paragraphs, `reviewNote: note.paragraphs=`)
            logDebug(`NPnote`, `reviewNote lineIndex of task to work on in note is:${res} "${note.paragraphs[Number(res) || 0].content}"`)
            // edit a single task item
            const origPara = note.paragraphs[Number(res) || 0]
            const index = updates.findIndex((u) => u.lineIndex === origPara.lineIndex) || 0
            const updatedPara = updates[index]
            const choice = await promptUserToActOnLine(origPara /*, updatedPara */)
            logDebug(pluginJson, `reviewNote: back from promptUser, calling prepareUserAction with: ${JSP(res)}`)
            const result = await prepareUserAction(origPara, updatedPara, choice && choice.value) //FIXME: use modifiers key
            logDebug(pluginJson, `reviewNote: back from prepareUserAction: result=${JSP(result)}`)
            // clo(result, 'NPTaskScan::reviewNote result')
            if (result) {
              switch (result.action) {
                case 'set':
                  logDebug('NPTaskScan::reviewNote', `received set command; index= ${index}`)
                  if (result?.changed) {
                    updates[index] = result.changed
                    logDebug(
                      'NPTaskScan::reviewNote',
                      `after set command; updates[index].content="${updates[index].content}" origPara.content="${origPara.content}" | "${
                        note.paragraphs[Number(res) || 0].content
                      }"`,
                    )
                    if (choice && choice.keyModifiers.length) {
                      logDebug('NPTaskScan::reviewNote', `received set+cmd key; index= ${index}`)
                      await processModifierKey(updates[index], choice.keyModifiers, result.userChoice || '')
                      if (choice.keyModifiers.includes('opt')) {
                        // option key pressed so should allow editing after new date is appended
                        note.updateParagraph(updates[index])
                        return noteIndex - 1
                      }
                      // TODO: check if this works and delete this code
                      // I don't think checking success should be necessary now with the DataStore.updateCache implemented
                      // const success = await processModifierKey(updates[index], choice.keyModifiers, result.userChoice || '')
                      // if (success) {
                      //   updates[index]?.note?.removeParagraph(updates[index])
                      // } else {
                      //   note.updateParagraph(updates[index]) //have to do this to eliminate race condition on set/delete
                      // }
                    } else {
                      note.updateParagraph(updates[index])
                    }
                    updates.splice(index, 1) //remove item which was updated from note's updates
                    logDebug(
                      'NPTaskScan::reviewNote',
                      `after splice/remove this line from updates.length=${updates.length} noteIndex=${noteIndex} ; will return noteIndex=${
                        updates.length ? noteIndex - 1 : noteIndex
                      }`,
                    )
                  }
                  // if there are still updates on this note, subtract one so the i++ in the caller function will increment
                  // it and show this note again for the other tasks to be update
                  // if there are no updates, do nothing and let the i++ take us to the next note
                  return updates.length ? noteIndex - 1 : noteIndex
                case 'cancel': {
                  const range = note.paragraphs[updates[0].lineIndex].contentRange
                  await Editor.openNoteByFilename(note.filename, false, range?.start || 0, range?.end || 0, true)
                  return -2
                }
                case 'delete': {
                  updates.splice(index, 1) //remove item which was updated from note's updates
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
          }
          if (currentTaskIndex > -1) {
            currentTaskIndex = currentTaskIndex < updates.length - 2 ? currentTaskIndex++ : -1
            currentTaskLineIndex = updates[currentTaskIndex].lineIndex
          }
        } while (currentTaskIndex !== -1)
      }
      if (makeChanges) {
        // updatedParas = updatedParas.concat(updates)
        logDebug(`NPTaskScan::reviewNote`, `about to update ${updates.length} todos in note "${note.filename || ''}" ("${note.title || ''}")`)
        clo(updates, `\nreviewNote updates`)
        note?.updateParagraphs(updates)
        updates.forEach(async (para) => {
          if (note.paragraphs[para.lineIndex].content !== para.content) {
            logError(
              pluginJson,
              `Checked paragraph after set and results did not match.\nnote's content:"${note.paragraphs[para.lineIndex].content}" !== expected/updated: "${para.content}"`,
            )
            await showMessage('Encountered an error. Pls enable logging in settings and check logs when running again.')
            return
          }
        })
        logDebug(`NPTaskScan::reviewNote`, `...after note.updateParagraphs...`)
      } else {
        logDebug(`NPTaskScan::reviewNote`, `No update because makeChanges = ${String(makeChanges)}`)
      }
      // clo(updatedParas,`overdue tasks to be updated`)
    }
  }
  return noteIndex
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
export async function reviewTasksInNotes(notesToUpdate: Array<Array<TParagraph>>, options: OverdueSearchOptions) {
  const { overdueOnly, confirm } = options
  logDebug(`NPNote::reviewTasksInNotes`, `total notes with overdue dates: ${notesToUpdate.length}`)
  if (!notesToUpdate.length && confirm) {
    await showMessage(`Did not find any ${overdueOnly ? 'overdue' : 'relevant'} tasks!`, 'OK', 'Task Search', true)
  }

  // loop through all notes and process each individually
  for (let i = 0; i < notesToUpdate.length; i++) {
    logDebug(
      `NPNote::reviewTasksInNotes`,
      `starting note loop:${i} of ${notesToUpdate.length} notes;  number of updates left: notesToUpdate[${i}].length=${notesToUpdate[i].length}`,
    )
    if (notesToUpdate[i].length) {
      logDebug(`reviewTasksInNotes`, `calling reviewNote on notesToUpdate[${i}]: "${(notesToUpdate && notesToUpdate[i] && String(notesToUpdate[i][0].filename)) || ''}"`)
      // clo(notesToUpdate[i], `notesToUpdate[${i}]`)
      i = await reviewNote(notesToUpdate, i, options) // result may decrement index to see the note again after one line change
      if (i === -2) break //user selected cancel
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
        logDebug(`getOpenTasksByNote: Including note: "${note.title || ''}" and task: "${p.content}".`)
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
