// @flow

import pluginJson from '../plugin.json'
import { appendTaskToDailyNote } from '../../jgclark.QuickCapture/src/quickCapture'
import { followUpSaveHere, followUpInFuture } from './NPFollowUp'
import { getDateOptions, replaceArrowDatesInString, RE_DATE, RE_WEEKLY_NOTE_FILENAME, getTodaysDateHyphenated } from '@helpers/dateTime'
import { getWeekOptions } from '@helpers/NPdateTime'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
import { chooseOptionWithModifiers, showMessage } from '@helpers/userInput'
import { eliminateDuplicateSyncedParagraphs, textWithoutSyncedCopyTag } from '@helpers/syncedCopies'
import { getOverdueParagraphs, noteType } from '@helpers/note'
import { sortListBy } from '@helpers/sorting'
import { moveParagraphToNote } from '@helpers/NPParagraph'

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
  overdueOnly: ?boolean /* used for reviewing today's references etc */,
}

type RescheduleUserAction =
  | '__yes__'
  | '__mark__'
  | '__canceled__'
  | '__remove__'
  | '__skip__'
  | '__xcl__'
  | '__list__'
  | '__mdhere__'
  | '__mdfuture__'
  | '__newTask__'
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
function getSharedOptions(origPara: TParagraph | { note: TNote }, isSingleLine: boolean): Array<{ label: string, value: string }> {
  const dateOpts = [...getDateOptions(), ...getWeekOptions()]
  // clo(dateOpts, `getSharedOptions dateOpts`)
  const note = origPara.note
  const taskText = isSingleLine ? `this task` : `the above tasks`
  const contentText = isSingleLine ? `"${origPara?.content || ''}"` : `tasks in "${note?.title || ''}"`
  const skip = isSingleLine ? [] : [{ label: `➡️ Skip - Do not change ${contentText} (and continue)`, value: '__skip__' }]
  const todayLine = dateOpts.splice(0, 1)
  todayLine[0].label = `⬇︎ Change date to ${todayLine[0].label}`
  return [
    ...skip,
    ...todayLine,
    { label: `> Change ${taskText} to >today (repeating until complete)`, value: '__yes__' },
    { label: `✓ Mark ${taskText} done/complete`, value: '__mark__' },
    { label: `🚫 Mark ${taskText} cancelled`, value: '__canceled__' },
    { label: `⌫ Remove the >date from ${taskText}`, value: '__remove__' },
    { label: `⦿ Convert task to a bullet/list item`, value: '__list__' },
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
    { label: `➡️ Skip - Do not change "${content}" (and continue)`, value: '__skip__' },
    ...todayLines,
    { label: `✏️ Edit this task in note: "${origPara.note?.title || ''}"`, value: '__edit__' },
    { label: `✓⏎ Mark done and add follow-up in same note`, value: '__mdhere__' },
    { label: `✓📆 Mark done and add follow-up in future note`, value: '__mdfuture__' },
    { label: `💡 This reminds me...(create new task then continue)`, value: '__newTask__' },
    ...sharedOpts,
    { label: `␡ Delete this line (be sure!)`, value: '__delete__' },
  ]
  const weektext = />\d{4}-W/i.test(origPara.content) ? 'Week ' : ''
  const res = await chooseOptionWithModifiers(`${weektext}Task: "${content}"`, opts)
  logDebug(pluginJson, `promptUserToActOnLine user selection: ${JSP(res)}`)
  // clo(res, `promptUserToActOnLine after chooseOption res=`)
  return res
}

/**
 * Given a user choice on a specific action to take on a line, process the line accordingly
 * @param {TParagraph} origPara
 * @param {TParagraph} updatedPara
 * @param {RescheduleUserAction|false} userChoice
 * @returns
 * @jest (limited) tests exist
 */
export async function processUserActionOnLine(
  origPara: TParagraph,
  updatedPara: TParagraph,
  userChoice: any,
): Promise<{ action: string, changed?: TParagraph, userChoice?: string }> {
  // const userChoice = userChoiceObj?.value
  if (userChoice) {
    const content = origPara?.content || ''
    logDebug(pluginJson, `processUserActionOnLine on content: "${content}" res= "${userChoice}"`)
    switch (userChoice) {
      case '__edit__': {
        const input = await CommandBar.textPrompt('Edit task contents', `Change text:\n"${content}" to:\n`, updatedPara.content)
        if (input) {
          origPara.content = input
          return { action: 'set', changed: origPara }
        } else {
          return { action: 'cancel' }
        }
      }
      case `__mark__`:
      case '__canceled__':
      case '__list__': {
        const tMap = { __mark__: 'done', __canceled__: 'cancelled', __list__: 'list' }
        origPara.type = tMap[userChoice]
        origPara.content = replaceArrowDatesInString(origPara.content)
        return { action: 'set', changed: origPara }
      }
      case '__remove__':
        origPara.content = replaceArrowDatesInString(origPara.content, '')
        return { action: 'set', changed: origPara }
      case `__delete__`:
        return { action: 'delete' }
      case `__newTask__`:
      case `__mdhere__`:
      case `__mdfuture__`: {
        return { action: userChoice }
      }
      case `__yes__`: {
        origPara.content = replaceArrowDatesInString(origPara.content, '>today')
        return { action: 'set', changed: updatedPara }
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
    logDebug(pluginJson, `processUserActionOnLine chosen: ${userChoice} returning`)
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
            logDebug(pluginJson, `reviewNote: back from promptUser, calling processUserActionOnLine with: ${JSP(res)}`)
            const result = await processUserActionOnLine(origPara, updatedPara, choice && choice.value) //FIXME: use modifiers key
            logDebug(pluginJson, `reviewNote: back from processUserActionOnLine: result=${JSP(result)}`)
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
                  origPara.note?.removeParagraph(origPara)
                  //FIXME: should i add an update here?
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
              case '__yes__':
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
  const flatTasks = notesWithTasks.reduce((acc, n) => acc.concat(n), [])
  logDebug(pluginJson, `dedupeSyncedLines  flatTasks.length BEFORE deduping ${flatTasks.length}`)
  const noDupes = eliminateDuplicateSyncedParagraphs(flatTasks)
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
  const { foldersToIgnore = [], /* openOnly = true, datePlusOnly = true, replaceDate = true, */ noteTaskList = null, noteFolder = false } = options
  logDebug(`NPNote::getNotesAndTasksToReview`, `noteTaskList.length: ${noteTaskList?.length || 'undefined'}`)
  let notesWithDates = []
  if (!noteTaskList) {
    logDebug(`NPNote::getNotesAndTasksToReview`, `no noteTaskList, so searching for notes`)
    if (noteFolder) {
      notesWithDates = [...DataStore.projectNotes, ...DataStore.calendarNotes]
        .filter((n) => (n?.filename ? n.filename.includes(`${noteFolder}/`) : false))
        .filter((n) => (n?.datedTodos ? n.datedTodos?.length > 0 : false))
    } else {
      notesWithDates = [...DataStore.projectNotes, ...DataStore.calendarNotes].filter((n) => (n?.datedTodos ? n.datedTodos?.length > 0 : false))
    }
  } else {
    clo(noteTaskList, `getNotesAndTasksToReview noteTaskList`)
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
        const updates = getOverdueParagraphs(n, '')
        if (updates.length > 0) {
          notesToUpdate.push(updates)
        }
      }
    }
  } else {
    logDebug(pluginJson, `getNotesAndTasksToReview using supplied task list: ${noteTaskList.length} tasks`)
    notesToUpdate = noteTaskList
  }
  logDebug(`NPNote::getNotesAndTasksToReview`, `total notesToUpdate: ${notesToUpdate.length}`)
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
