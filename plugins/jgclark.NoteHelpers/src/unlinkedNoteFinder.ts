// @flow
/**
 * @author @aaronpoweruser
 */
import pluginJson from '../plugin.json'
import { log, logDebug, logError, logInfo, clo, JSP, timer } from '@np/helpers/dev'

const CODE_BLOCK_PLACEHOLDER = '8ce08058-d387-4d3a-8043-4f3b7ef63eb7'
const MARKDOWN_LINK_PLACEHOLDER = '975b7115-5568-4bc6-b6c8-6603350572ea'

/**
 * Trigger the find unlinked notes command
 */
export async function triggerFindUnlinkedNotes() {
  await findUnlinkedNotesInCurrentNote()
}

/**
 * Find all unlinked notes in the current note and create [[links]] to them
 */
export async function findUnlinkedNotesInCurrentNote() {
  const currentNote = Editor.note
  if (currentNote) {
    await findUnlinkedNotes([currentNote])
  }
}

/**
 * Find all unlinked notes in all notes and create [[links]] to them
 */
export async function findUnlinkedNotesInAllNotes() {
  const runTime = new Date()
  CommandBar.showLoading(true, 'Finding unlinked notes')
  const allNotes = [...DataStore.projectNotes, ...DataStore.calendarNotes]
  const foundLinks = await findUnlinkedNotes(allNotes)
  CommandBar.showLoading(false)
  logInfo(`Found ${foundLinks} unlinked notes in all notes, took: ${timer(runTime)}`)
}

/**
 * Find all unlinked notes in the given notes
 * @param {Array<TNote>} notes - the notes to search for unlinked notes in
 * @returns {number} - the number of unlinked notes found
 **/
async function findUnlinkedNotes(notes: Array<TNote>): Promise<number> {
  let foundLinks = 0
  try {
    await CommandBar.onAsyncThread()

    const noteTitlesSortedByLength = getAllNoteTitlesSortedByLength()
    foundLinks = notes.reduce((count, note) => count + findUnlinkedNotesInNote(note, noteTitlesSortedByLength), 0)

    await CommandBar.onMainThread()
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
  return foundLinks
}

/**
 * Find all note titles in the current note and replace them with [[note title]]
 * @param {TNote} currentNote - the note to search for links in
 * @param {Array<string>} noteTitlesSortedByLength - the note titles sorted by length
 * @returns {number} - the number of links found
 */
function findUnlinkedNotesInNote(currentNote: TNote, noteTitlesSortedByLength: Array<string> = getAllNoteTitlesSortedByLength()): number {
  let foundLinks = 0
  const overallTime = new Date()
  let content = currentNote.content ?? ''

  logDebug(`Searching for unlinked notes in: ${currentNote.title ?? ''}`)

  const [contentWithCodeBlocksRemoved, codeBlockTracker] = extractCodeBlocks(content)
  content = contentWithCodeBlocksRemoved

  const [contentWithLinksRemoved, markdownLinkTracker] = extractMarkdownLinks(content)
  content = contentWithLinksRemoved

  noteTitlesSortedByLength.forEach((note) => {
    if (currentNote.title !== note && content.includes(note)) {
      content = content.replaceAll(buildRegex(note), (_) => {
        logDebug(`Found link to: ${note}`)
        foundLinks++
        return `[[${note}]]`
      })
    }
  })

  content = replaceCodeBlocks(content, codeBlockTracker)
  content = replaceMarkdownLinks(content, markdownLinkTracker)

  if (foundLinks > 0) {
    const startTime = new Date()
    currentNote.content = content
    logDebug(`Updated note took: ${timer(startTime)}`)
  }
  logInfo(`Linked ${foundLinks} notes in ${currentNote.title ?? ''}, took: ${timer(overallTime)}`)

  return foundLinks
}

/**
 * Builds a regular expression to match a specific note title within a text.
 *
 * @param {string} noteTitle - The title of the note to be matched.
 * @returns {RegExp} - A regular expression object for matching the note title in a given text.
 *
 * The regular expression is constructed dynamically to ensure that the note title:
 * - Is surrounded by word boundaries or specific punctuation marks.
 * - Does not appear within square brackets (like [[this]]).
 * - Is case-insensitive and performs a global search (flags 'gi').
 *
 * Breakdown of the regex pattern:
 * `w*(?<=[\\s,.:;"'])|^)`: Matches any leading whitespace or specific punctuation characters before the note title.
 * `(${sanitizeForRegex(noteTitle)})`: The sanitized note title to be matched.
 * `(?![^[\\]]{2})1: Negative lookahead to ensure the note title is  followed by two closing square brackets (]]).
 */
export function buildRegex(noteTitle: string): RegExp {
  return new RegExp(`(w*(?<=[\\s,.:;"'])|^)(${sanitizeForRegex(noteTitle)})(?![^[\]]{2})`, 'gi')
}

/**
 * Extracts code blocks from the content and replaces them with a placeholder
 * @param {string} content - the content to extract code blocks from
 * @returns {[string, Array<string>]} - the content with code blocks replaced and the code blocks
 */
function extractMarkdownLinks(content: string): [string, Array<string>] {
  const markdownLinkTracker: Array<string> = []
  const startTime = new Date()
  const filteredContent = (content ?? '').replaceAll(/\[([^\]]+)\]\(([^)]+)\)/gim, (match) => {
    markdownLinkTracker.push(match)
    return MARKDOWN_LINK_PLACEHOLDER
  })
  logDebug(`Replaced ${markdownLinkTracker.length} markdown links, took: ${timer(startTime)}`)
  return [filteredContent, markdownLinkTracker]
}

/**
 * Extracts code blocks from the content and replaces them with a placeholder
 * @param {string} content - the content to extract code blocks from
 * @returns {[string, Array<string>]} - the content with code blocks replaced and the code blocks
 */
function extractCodeBlocks(content: string): [string, Array<string>] {
  const codeBlockTracker: Array<string> = []
  const startTime = new Date()
  const filteredContent = (content ?? '').replaceAll(/```([^`]|\n)*```/gim, (match) => {
    codeBlockTracker.push(match)
    return CODE_BLOCK_PLACEHOLDER
  })
  logDebug(`Replaced ${codeBlockTracker.length} code blocks, took: ${timer(startTime)}`)
  return [filteredContent, codeBlockTracker]
}

/**
 * Replaces code blocks in the content with the original code blocks
 * @param {string} content - the content to replace code blocks in
 * @param {Array<string>} codeblockReversalTracker - the code blocks to replace
 * @returns {string} - the content with code blocks replaced
 */
function replaceCodeBlocks(content: string, codeblockReversalTracker: Array<string>): string {
  let contentWithCodeBlocks = content
  codeblockReversalTracker.forEach((value) => {
    contentWithCodeBlocks = contentWithCodeBlocks.replace(CODE_BLOCK_PLACEHOLDER, value)
  })
  return contentWithCodeBlocks
}

/**
 * Replaces markdown links in the content with the original markdown links
 * @param {string} content - the content to replace markdown links in
 * @param {Array<string>} markdownLinkTracker - the markdown links to replace
 * @returns {string} - the content with markdown links replaced
 */
function replaceMarkdownLinks(content: string, markdownLinkTracker: Array<string>): string {
  let contentWithMarkdownLinks = content
  markdownLinkTracker.forEach((value) => {
    contentWithMarkdownLinks = contentWithMarkdownLinks.replace(MARKDOWN_LINK_PLACEHOLDER, value)
  })
  return contentWithMarkdownLinks
}

/**
 * Get all note titles in the project notes sorted by length
 * @returns {Array<string>} - an array of all note titles
 */
function getAllNoteTitlesSortedByLength(): Array<string> {
  return DataStore.projectNotes
    .filter((note) => note.title !== null && note.title !== '')
    .map((note) => note.title ?? '')
    .sort((a, b) => (b.length ?? 0) - (a.length ?? 0)) // sort by length to match longer titles first
}

/**
 * Returns a string with regex special characters escaped
 * @param {string} s - the string to parse
 * @returns {string} - the parsed string
 * */
const sanitizeForRegex = (s: string) => {
  return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
}
