// @flow
//-------------------------------------------------------------------------------
// Note-level Functions that require NP API calls

import { log, logError, logDebug, timer, clo } from './dev'
import { displayTitle } from './general'
import { chooseOption, showMessage } from './userInput'
import { convertOverdueTasksToToday, RE_PLUS_DATE } from './note'
import { findStartOfActivePartOfNote } from './paragraph'
import { getDateOptions } from '@helpers/dateTime'
const pluginJson = 'NPnote.js'

/**
 * Convert the note to using frontmatter Syntax
 * If optional default text is given, this is added to the frontmatter.
 * @author @jgclark
 * @param {TNote} note
 * @param {string} defaultText (optional) to add after title in the frontmatter
 */
export async function convertNoteToFrontmatter(note: TNote, defaultText?: string = ''): Promise<void> {
  if (note == null) {
    logError('note/convertToFrontmatter', `No note found. Stopping conversion.`)
    await showMessage(`No note found to convert.`)
    return
  }
  if (note.paragraphs.length < 1) {
    logError('note/convertToFrontmatter', `'${displayTitle(note)}' is empty. Stopping conversion.`)
    await showMessage(`Cannot convert '${displayTitle(note)}' note as it is empty.`)
    return
  }

  // Get title
  const firstLine = note.paragraphs[0]
  if (firstLine.content === '---') {
    logError('note/convertToFrontmatter', `'${displayTitle(note)}' appears to already use frontmatter. Stopping conversion.`)
    await showMessage(`Cannot convert '${displayTitle(note)}' as it already appears to use frontmatter.`)
    return
  }
  const title = firstLine.content ?? '(error)' // gets heading without markdown

  // Working backwards through the frontmatter (to make index addressing easier)
  // Change the current first line to be ---
  firstLine.content = '---'
  firstLine.type = 'separator'
  note.updateParagraph(firstLine)
  if (defaultText) {
    note.insertParagraph(defaultText, 0, 'text')
  }
  note.insertParagraph(`title: ${title}`, 0, 'text')
  note.insertParagraph('---', 0, 'separator')
  logDebug('note/convertToFrontmatter', `Note '${displayTitle(note)}' converted to use frontmatter.`)
}

async function processLineClick(origPara: TParagraph, updatedPara: TParagraph): Promise<{ action: string, changed?: TParagraph }> {
  logDebug(pluginJson, `processLineClick "${origPara.note?.title || ''}": "${origPara.content || ''}"`)
  const range = origPara.contentRange
  if (origPara?.note?.filename) await Editor.openNoteByFilename(origPara.note.filename, false, range?.start || 0, range?.end || 0)
  const content = origPara?.content || ''
  const dateOpts = getDateOptions()
  // clo(dateOpts, `processLineClick dateOpts`)
  const opts = [
    { label: `✏️ Edit this task in note: "${origPara.note?.title || ''}"`, value: '__edit__' },
    { label: `> Change this task to >today (repeating until complete)`, value: '__yes__' },
    { label: `✓ Mark this task complete`, value: '__mark__' },
    { label: `🙅‍♂️ Mark this task cancelled`, value: '__canceled__' },
    { label: `❌ Skip - Do not change "${content}" (and continue)`, value: '__no__' },
    { label: '⎋ Cancel Review ⎋', value: '__xcl__' },
    { label: '------ Set Due Date To: -------', value: '-----' },
  ].concat(dateOpts)
  const res = await chooseOption(`Task: "${origPara.content}"`, opts)
  clo(res, `processLineClick after chooseOption res=`)
  if (res) {
    logDebug(pluginJson, `processLineClick on content: "${content}" res= "${res}"`)
    switch (res) {
      case '__edit__': {
        const input = await CommandBar.textPrompt('Edit task contents', `Change text:\n"${content}" to:\n`, updatedPara.content)
        if (input) {
          origPara.content = input
          // clo(origPara, `chooseOption returning`)
          return { action: 'set', changed: origPara }
        } else {
          return { action: 'cancel' }
        }
      }
      case `__mark__`:
      case '__canceled__':
        origPara.type = res === '__mark__' ? 'done' : 'cancelled'
        return { action: 'set', changed: origPara }
      case `__yes__`: {
        return { action: 'set', changed: updatedPara }
      }
      case `__no__`: {
        return { action: 'set', changed: origPara }
      }
    }
    if (res[0] === '>') {
      origPara.content = origPara.content.replace(RE_PLUS_DATE, res)
      return { action: 'set', changed: origPara }
    }
    logDebug(pluginJson, `processLineClick chosen: ${res} returning`)
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
  await Editor.openNoteByFilename(note.filename, false, range?.start || 0, range?.end || 0)
  // const options = updates.map((p) => ({ label: showUpdatedTask ? p.content : note.paragraphs[Number(p.lineIndex) || 0].content, value: `${p.lineIndex}` })) //show the original value
  const options = updates.map((p) => ({ label: `${note.paragraphs[Number(p.lineIndex) || 0].content}`, value: `${p.lineIndex}` })) //show the original value
  const dateOpts = getDateOptions()
  const opts = [
    { label: '>> SELECT A TASK OR MARK THEM ALL <<', value: '-----' },
    ...options,
    { label: '----------------------------------------------------------------', value: '-----' },
    { label: `> Mark the above tasks as >today (repeating until complete)`, value: '__yes__' },
    { label: `✓ Mark the above tasks done/complete`, value: '__mark__' },
    { label: `🙅‍♂️ Mark the above tasks cancelled`, value: '__canceled__' },
    { label: `❌ Skip -- Do not change tasks in "${note?.title || ''}" (and continue)`, value: '__no__' },
    { label: `⎋ Cancel Review ⎋`, value: '__xcl__' },
    { label: '------ Set All Due Date(s) To: -------', value: '-----' },
  ].concat(dateOpts)
  const res = await chooseOption(`Note (${index + 1}/${totalNotesToUpdate}): "${note?.title || ''}"`, opts)
  logDebug(`NPnote`, `findNotesWithOverdueTasksAndMakeToday note:"${note?.title || ''}" user action: ${res}`)
  return res
}

type OverdueSearchOptions = {
  openOnly: boolean,
  foldersToIgnore: Array<string>,
  datePlusOnly: boolean,
  confirm: boolean,
  showUpdatedTask: boolean,
  showNote: boolean,
  replaceDate: boolean,
  singleNote: ?boolean,
  noteFolder: ?string | false,
}

/**
 * Search the DataStore looking for notes with >date and >date+ tags which need to be converted to >today tags going forward
 * If plusTags are found (today or later), then convert them to >today tags
 * @param {OverdueSearchOptions} - options object with the following characteristics:
 * {TNote} note
 * {boolean} openOnly - if true, only find/convert notes with >date tags that are open tasks
 * {Array<string>} foldersToIgnore (e.g. tests/templates)
 * {boolean} datePlusOnly - true = only find/convert notes with >date+ tags (otherwise all overdue tasks)
 * {boolean} confirm - should NotePlan pop up a message about how many changes are about to be made
 * {boolean} showNote - show the note as review is happening
 * {boolean} replaceDate - whether to replace date with >today or just tack it on (leaving date in place)
 * {boolean} singleNote - run on the open note in the Editor
 * {string} noteFolder - one specific folder to look in (or false)
 * @author @dwertheimer
 */
export async function findNotesWithOverdueTasksAndMakeToday(options: OverdueSearchOptions): Promise<void> {
  const {
    openOnly = true,
    foldersToIgnore = [],
    datePlusOnly = true,
    confirm = false,
    showNote = true,
    replaceDate = true,
    singleNote = false /*, showUpdatedTask = true */,
    noteFolder = false,
  } = options
  const start = new Date()
  let notesWithDates
  if (singleNote) {
    notesWithDates = [Editor.note].filter((n) => n?.datedTodos?.length || 0 > 0)
  } else {
    if (noteFolder) {
      notesWithDates = [...DataStore.projectNotes, ...DataStore.calendarNotes]
        .filter((n) => (n?.filename ? n.filename.includes(`${noteFolder}/`) : false))
        .filter((n) => (n?.datedTodos ? n.datedTodos?.length > 0 : false))
    } else {
      notesWithDates = [...DataStore.projectNotes, ...DataStore.calendarNotes].filter((n) => (n?.datedTodos ? n.datedTodos?.length > 0 : false))
    }
  }
  if (!singleNote && foldersToIgnore) {
    notesWithDates = notesWithDates.filter((note) => foldersToIgnore.every((skipFolder) => !(note?.filename ? note.filename.includes(`${skipFolder}/`) : false)))
  }
  logDebug(`NPNote::findNotesWithOverdueTasksAndMakeToday`, `total notesWithDates: ${notesWithDates.length}`)
  // let updatedParas = []
  const notesToUpdate = []
  for (const n of notesWithDates) {
    if (n) {
      const updates = convertOverdueTasksToToday(n, openOnly, datePlusOnly, replaceDate)
      if (updates.length > 0) {
        notesToUpdate.push(updates)
      }
    }
  }
  logDebug(`NPNote::findNotesWithOverdueTasksAndMakeToday`, `total notes with overdue dates: ${notesToUpdate.length}`)
  if (!notesToUpdate.length && confirm) {
    await showMessage('Did not find any overdue tasks...congratulations!')
  }
  for (let i = 0; i < notesToUpdate.length; i++) {
    let updates = notesToUpdate[i],
      currentTaskIndex = showNote ? -1 : 0,
      currentTaskLineIndex = updates[0].lineIndex,
      res
    const note = updates[0].note
    if (note) {
      if (updates.length > 0) {
        let doIt = !confirm
        if (confirm) {
          do {
            if (showNote) {
              res = await showOverdueNote(note, updates, i, notesToUpdate.length)
            } else {
              res = currentTaskLineIndex // skip note and process each task as if someone clicked it to edit
            }
            if (!isNaN(res)) {
              // this was an index of a line to edit
              logDebug(`NPnote`, `findNotesWithOverdueTasksAndMakeToday ${note.paragraphs[Number(res) || 0].content}`)
              // edit a single task item
              clo(note.paragraphs[Number(res) || 0], `findNotesWithOverdueTasksAndMakeToday paraClicked=`)
              const origPara = note.paragraphs[Number(res) || 0]
              const index = updates.findIndex((u) => u.lineIndex === origPara.lineIndex) || 0
              const updatedPara = updates[index]
              const result = await processLineClick(origPara, updatedPara)
              clo(result, 'NPNote::findNotesWithOverdueTasksAndMakeToday result')
              if (result) {
                switch (result.action) {
                  case 'set':
                    logDebug('NPNote::findNotesWithOverdueTasksAndMakeToday', `received set command; index= ${index}`)
                    clo(result.changed, 'NPNote::findNotesWithOverdueTasksAndMakeToday result')
                    if (result?.changed) {
                      updates[index] = result.changed
                      note.updateParagraph(updates[index])
                    }
                    logDebug('NPNote::findNotesWithOverdueTasksAndMakeToday', `after set command; updates[index].content= ${updates[index].content}`)
                    i-- //show it again so it can be adjusted
                    continue
                  case 'cancel': {
                    const range = note.paragraphs[updates[0].lineIndex].contentRange
                    await Editor.openNoteByFilename(note.filename, false, range?.start || 0, range?.end || 0, true)
                    return
                  }
                }
                //user selected an item in the list to come back to later (in splitview)
                // const range = note.paragraphs[Number(res) || 0].contentRange
                // await Editor.openNoteByFilename(note.filename, false, range?.start || 0, range?.end || 0, true)
                // if (range) Editor.select(range.start,range.end-range.start)
                // doIt = false
              }
            } else {
              switch (res) {
                case '__xcl__': {
                  // const range = note.paragraphs[updates[0].lineIndex].contentRange
                  // await Editor.openNoteByFilename(note.filename, false, range?.start || 0, range?.end || 0, true)
                  return
                }
                case '__yes__':
                  doIt = true
                  break
                case '__mark__':
                case '__canceled__':
                  updates = updates.map((p) => {
                    p.type = res === '__mark__' ? 'done' : 'cancelled'
                    return p
                  })
                  doIt = true
                  break
              }
              if (typeof res === 'string' && res[0] === '>') {
                updates = updates.map((p) => {
                  const origPara = note.paragraphs[p.lineIndex]
                  p.content = origPara.content.replace(RE_PLUS_DATE, String(res))
                  return p
                })
                // clo(updates, `findNotesWithOverdueTasksAndMakeToday updates=`)
                doIt = true
              }
            }
            if (currentTaskIndex > -1) {
              currentTaskIndex = currentTaskIndex < updates.length - 2 ? currentTaskIndex++ : -1
              currentTaskLineIndex = updates[currentTaskIndex].lineIndex
            }
          } while (currentTaskIndex !== -1)
        }
        if (doIt) {
          // updatedParas = updatedParas.concat(updates)
          logDebug(`NPNote::findNotesWithOverdueTasksAndMakeToday`, `about to update ${updates.length} todos in note "${note.filename || ''}" ("${note.title || ''}")`)
          note?.updateParagraphs(updates)
          logDebug(`NPNote::findNotesWithOverdueTasksAndMakeToday`, `Updated ${updates.length} todos in note "${note.filename || ''}" ("${note.title || ''}")`)
        } else {
          logDebug(`NPNote::findNotesWithOverdueTasksAndMakeToday`, `No update because doIt = ${String(doIt)}`)
        }
        // clo(updatedParas,`overdue tasks to be updated`)
      }
    }
  }
  logDebug(`NPNote::findNotesWithOverdueTasksAndMakeToday`, `Total convertOverdueTasksToToday scan took: ${timer(start)}`)
}

/**
 * Select the first non-title line in Editor
 * NotePlan will always show you the ## before a title if your cursor is on a title line, but
 * this is ugly. And so in this function we find and select the first non-title line
 * @author @dwertheimer
 * @returns
 */
export function selectFirstNonTitleLineInEditor(): void {
  if (Editor.content && Editor.note) {
    for (let i = findStartOfActivePartOfNote(Editor.note); i < Editor.paragraphs.length; i++) {
      const line = Editor.paragraphs[i]
      if (line.type !== 'title' && line?.contentRange && line.contentRange.start >= 0) {
        Editor.select(line.contentRange.start, 0)
        return
      }
    }
  }
}
