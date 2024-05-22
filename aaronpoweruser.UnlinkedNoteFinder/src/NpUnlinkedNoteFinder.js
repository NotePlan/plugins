// @flow
import pluginJson from '../plugin.json'
import { log, logDebug, logError, logInfo, clo, JSP } from '@helpers/dev'

const CODE_BLOCK_PLACEHOLDER = '8ce08058-d387-4d3a-8043-4f3b7ef63eb7'
const MARKDOWN_LINK_PLACEHOLDER = '975b7115-5568-4bc6-b6c8-6603350572ea'

const parseForRegex = (s: string) => {
  //Remove regex special characters from string
  return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
}

/**
 * Find all note titles in the current note and replace them with [[note title]]
 */
export async function findUnlinkedNotesInCurrentNote() {
  let foundLinks = 0
  try {
    const currentNote = Editor.note
    if (currentNote) {
      await CommandBar.onAsyncThread()
      CommandBar.showLoading(true, 'Finding unlinked notes')
      foundLinks += findUnlinkedNotesInNote(currentNote)
      logInfo(`Found ${foundLinks} unlinked notes in ${currentNote.title ?? ''}`)
      CommandBar.showLoading(false)
      CommandBar.onMainThread()
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Find all note titles in all notes and replace them with [[note title]]
 */
export async function findUnlinkedNotesInAllNotes() {
  let foundLinks = 0
  try {
    await CommandBar.onAsyncThread()
    CommandBar.showLoading(true, 'Finding unlinked notes')
    const allNotes = DataStore.projectNotes.concat(DataStore.calendarNotes)
    allNotes.forEach((note) => (foundLinks += findUnlinkedNotesInNote(note)))
    logInfo(`Found ${foundLinks} unlinked notes in all notes`)
    CommandBar.showLoading(false)
    CommandBar.onMainThread()
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Get all note titles in the project notes sorted by length
 * @returns {Array<string>} - an array of all note titles
 */
function getAllNoteTitlesSortedByLength(): Array<string> {
  return DataStore.projectNotes
    .filter((note) => note.title !== undefined && note.title !== '')
    .map((note) => note.title ?? '')
    .sort((a, b) => (b?.length ?? 0) - (a?.length ?? 0)) // sort by length to replace longer titles first
}

/**
 * Find all note titles in the current note and replace them with [[note title]]
 * @param {TNote} currentNote - the note to search for links in
 * @returns {number} - the number of links found
 */
function findUnlinkedNotesInNote(currentNote: TNote): number {
  let foundLinks = 0
  getAllNoteTitlesSortedByLength().forEach((note) => {
    let content = currentNote.content
    const codeblockReversalTracker = []
    const markdownLinkTracker = []

    content = (content ?? '').replaceAll(/```([^`]|\n)*```/gim, (match) => {
      codeblockReversalTracker.push(match)
      logDebug(`Code block found ${match}`)
      return CODE_BLOCK_PLACEHOLDER
    })

    content = (content ?? '').replaceAll(/\[(([^\[\]]|\\\[|\\\])+)\]\(.*\)/g, (match) => {
      markdownLinkTracker.push(match)
      logDebug(`Markdown link found ${match}`)
      return MARKDOWN_LINK_PLACEHOLDER
    })

    const regex = new RegExp(`(\\w*(?<!\\[{2}[^[\\]]*)\\w*(?<!\\#)\\w*(?<!\\w+:\\/\\/\\S*))(?<=[\\s,.:;"']|^)(${parseForRegex(note)})(?![^[\\]]*\\]{2})(?=[\\s,.:;"']|$)`, 'gi')
    if (content && currentNote.title !== note && content.includes(note)) {
      content = (content ?? '').replaceAll(regex, (match) => {
        logInfo(`In note: ${currentNote.title ?? ''} found link to: ${note}`)
        foundLinks++
        return `[[${match}]]`
      })
    }

    codeblockReversalTracker?.forEach((value, _) => {
      content = content ? content.replace(CODE_BLOCK_PLACEHOLDER, value) : ''
    })

    markdownLinkTracker?.forEach((value, _) => {
      content = content ? content.replace(MARKDOWN_LINK_PLACEHOLDER, value) : ''
    })
    currentNote.content = content
  })
  return foundLinks
}