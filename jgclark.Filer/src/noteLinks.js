/* eslint-disable prefer-template */
// @flow
// ----------------------------------------------------------------------------
// Functions to file [[note links]] from calendar notes to project notes.
// Jonathan Clark
// last updated 2026-11-12, for v1.6.4 by @CursorAI
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { getFilerSettings, type FilerConfig } from './filerHelpers'
import {
  clo, logDebug, logError, logInfo, logWarn,
  overrideSettingsWithEncodedTypedArgs,
} from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { getNoteFromEditorWindow } from '@helpers/NPEditor'
import { getAllNotesOfType, getNotesChangedInInterval } from '@helpers/NPnote'
import { addParagraphsToNote, findHeading, isBlankParagraph } from '@helpers/paragraph'
import { escapeRegExp } from '@helpers/regexEscape'
import { NP_RE_note_title_link, RE_NOTE_TITLE_CAPTURE } from '@helpers/regex'
import { showMessage } from '@helpers/userInput'

//-----------------------------------------------------------------------------

const pluginID = pluginJson['plugin.id']

export type FileNoteLinksResult = { filed: number, skipped: number }

//-----------------------------------------------------------------------------
// Wrappers that are called

export async function copyNoteLinks(): Promise<number> {
  const settings: FilerConfig = await getFilerSettings()
  settings.copyOrMove = "copy"
  // get current note (Editor itself when a calendar note has no .note)
  const note = getNoteFromEditorWindow(Editor)
  if (!note) {
    logWarn(pluginID, `No note selected, so stopping.`)
    await showMessage("No note selected, so cannot run.")
    return NaN
  }
  // main call
  const result = await fileNoteLinks(note, settings, false)
  await showMessage(noteLinkResultMessage('copied', result, displayTitle(note)), 'OK', 'Copy note links')
  return result.filed
}

/**
 * Entry point for copyRecentNoteLinks, but will process any passed JSON parameters to override the settings object.
 * @param {string?} params - can pass JSON parameter string e.g. '{"period": "mtd", "progressHeading": "Progress"}'
 * @returns {number} number of note links copied
 */
export async function copyRecentNoteLinks(params: string = ''): Promise<number> {
  logDebug(pluginJson, `copyRecentNoteLinks: Starting with params '${params}'`)
  let settings: FilerConfig = await getFilerSettings()
  settings.copyOrMove = "copy"

  // If there are params passed, then we've been called by a template command (and so use those).
  if (params) {
    settings = overrideSettingsWithEncodedTypedArgs(settings, params)
    clo(settings, `- config after overriding with params '${params}'`)
  } else {
    // If no params are passed, then we've been called by a plugin command (and so use defaults from config).
    clo(settings, '- settings without params')
  }

  // main call
  const result = await fileRecentNoteLinks(settings, false)
  if (!params) {
    await showMessage(noteLinkResultMessage('copied', result), 'OK', 'Copy recent note links')
  }
  return result.filed
}

export async function moveNoteLinks(): Promise<number> {
  const settings: FilerConfig = await getFilerSettings()
  settings.copyOrMove = "move"
  // get current note (Editor itself when a calendar note has no .note)
  const note = getNoteFromEditorWindow(Editor)
  if (!note) {
    logWarn(pluginID, `No note selected, so stopping.`)
    await showMessage("No note selected, so cannot run.")
    return NaN
  }
  // main call
  const result = await fileNoteLinks(note, settings, false)
  await showMessage(noteLinkResultMessage('moved', result, displayTitle(note)), 'OK', 'Move note links')
  return result.filed
}

/**
 * Entry point for moveRecentNoteLinks, but will process any passed JSON parameters to override the settings object.
 * Move of the work is done by calling fileRecentNoteLinks().
 * @param {?string} params - can pass JSON parameter string e.g. '{"period": "mtd", "progressHeading": "Progress"}'
 * @returns {number} number of note links moved
 */
export async function moveRecentNoteLinks(params: string = ''): Promise<number> {
  logDebug(pluginJson, `moveRecentNoteLinks(): Starting`)
  let settings: FilerConfig = await getFilerSettings()
  // Override the copyOrMove setting
  settings.copyOrMove = "move"

  // If there are params passed, then we've been called by a template command (and so use those).
  if (params) {
    settings = overrideSettingsWithEncodedTypedArgs(settings, params)
    // clo(settings, `- config after overriding with params '${params}'`)
  } else {
    // If no params are passed, then we've been called by a plugin command (and so use defaults from config).
    // clo(settings, '- settings without params')
  }

  // main call
  const result = await fileRecentNoteLinks(settings, false)
  if (!params) {
    await showMessage(noteLinkResultMessage('moved', result), 'OK', 'Move recent note links')
  }
  return result.filed
}

//-----------------------------------------------------------------------------
// Helpers

/**
 * User-facing summary of a note-link filing run.
 * @param {string} action - 'copied' or 'moved'
 * @param {FileNoteLinksResult} result
 * @param {string} fromTitle - optional source note title
 * @returns {string}
 */
function noteLinkResultMessage(action: string, result: FileNoteLinksResult, fromTitle: string = ''): string {
  const fromBit = fromTitle ? ` from ${fromTitle}` : ''
  const base = `${String(result.filed)} note links ${action}${fromBit}`
  if (result.skipped > 0) {
    return `${base}. ${String(result.skipped)} skipped (destination note not found).`
  }
  return base
}

/**
 * Paragraph types included for a 'typesToFile' setting.
 * Completed includes cancelled tasks and checklists. Headings are not completed items.
 * @param {string} typesToFile
 * @returns {Array<string>}
 */
export function paragraphTypesForFiling(typesToFile: string): Array<string> {
  switch (typesToFile) {
    case "all lines":
      return ['open', 'done', 'scheduled', 'cancelled', 'checklist', 'checklistDone', 'checklistScheduled', 'checklistCancelled', 'title', 'quote', 'list', 'empty', 'text', 'code'] // all but 'separator'
    case "all but incomplete task/checklist items":
      return ['done', 'cancelled', 'checklistDone', 'checklistCancelled', 'title', 'quote', 'list', 'empty', 'text', 'code'] // all but 'open', 'scheduled', 'checklist', 'checklistScheduled', 'separator'
    case "only completed task/checklist items":
      return ['done', 'cancelled', 'checklistDone', 'checklistCancelled']
    case "only non-task/checklist items":
      return ['title', 'quote', 'list', 'empty', 'text', 'code']
    default:
      throw new Error(`Invalid 'typesToFile' setting: ${typesToFile}`)
  }
}

/**
 * True when `content` contains `tag` as its own token. The tag is literal text, not a regular expression.
 * @param {string} content
 * @param {string} tag
 * @returns {boolean}
 */
export function lineContainsIgnoreTag(content: string, tag: string): boolean {
  const trimmed = (tag || '').trim()
  if (!trimmed || !content) return false
  const re = new RegExp(`(?:^|\\s)${escapeRegExp(trimmed)}(?:\\s|$)`)
  return re.test(content)
}

/**
 * Lines to file with the note-link paragraph at `startIndex` (an index into `note.paragraphs`).
 * A normal line includes only following lines indented further.
 * A heading includes following lines until a blank line, a separator, or a heading of the same level or higher.
 * Lines before `startIndex` are not included.
 * @param {CoreNoteFields} note
 * @param {number} startIndex
 * @returns {Array<TParagraph>}
 */
export function getNoteLinkBlock(note: CoreNoteFields, startIndex: number): Array<TParagraph> {
  const paras = note.paragraphs ?? []
  if (startIndex < 0 || startIndex >= paras.length) return []
  const startPara = paras[startIndex]
  const block: Array<TParagraph> = [startPara]
  if (startPara.type === 'title') {
    const thisLevel = startPara.headingLevel ?? 1
    for (let i = startIndex + 1; i < paras.length; i++) {
      const p = paras[i]
      if (p.type === 'title' && (p.headingLevel ?? 1) <= thisLevel) break
      if (p.type === 'separator' || isBlankParagraph(p)) break
      block.push(p)
    }
    return block
  }
  const startingIndent = startPara.indents ?? 0
  for (let i = startIndex + 1; i < paras.length; i++) {
    const p = paras[i]
    if (p.type === 'title' || p.type === 'separator' || isBlankParagraph(p)) break
    if ((p.indents ?? 0) <= startingIndent) break
    block.push(p)
  }
  return block
}

/**
 * True when this paragraph is a note-link line the current settings should file.
 * @param {TParagraph} para
 * @param {Array<string>} typesToFile
 * @param {string} ignoreTag
 * @returns {boolean}
 */
function isFileableNoteLinkParagraph(para: TParagraph, typesToFile: Array<string>, ignoreTag: string): boolean {
  if (!typesToFile.includes(para.type)) return false
  const content = para.content ?? ''
  if (!content.match(NP_RE_note_title_link)) return false
  if (ignoreTag && lineContainsIgnoreTag(content, ignoreTag)) return false
  return true
}

//-----------------------------------------------------------------------------
// Main functions (not exposed)

/**
 * File note links from recent calendar notes to project note(s).
 * See various settings passed in the 'config' parameter object.
 * See above for entry points to this function.
 * @author @jgclark
 * @param {FilerConfig} settings object
 * @param {boolean} runInteractively?
 * @returns {FileNoteLinksResult} note links filed, and links skipped because the destination note was missing
 */
async function fileRecentNoteLinks(config: FilerConfig, runInteractively: boolean = false): Promise<FileNoteLinksResult> {
  try {
    // Get array of recent calendar notes
    const recentCalendarNotes = (config.recentDays > 0)
      ? getNotesChangedInInterval(config.recentDays, ['Calendar'])
      : getAllNotesOfType(['Calendar'])
    logDebug(pluginJson, `fileRecentNoteLinks() starting with ${recentCalendarNotes.length} recent calendar notes from last ${String(config.recentDays)} days`)

    // Run the filer on each in turn. Sum note links, not calendar notes.
    let filed = 0
    let skipped = 0
    for (const thisNote of recentCalendarNotes) {
      const res = await fileNoteLinks(thisNote, config, runInteractively)
      filed += res.filed
      skipped += res.skipped
    }
    logInfo(`fileRecentNoteLinks`, `-> ${String(filed)} note links filed (${String(skipped)} skipped) from ${String(recentCalendarNotes.length)} recent calendar notes`)
    return { filed, skipped }
  } catch (err) {
    logError(pluginJson, `fileRecentNoteLinks(): ${err.name}: ${err.message}`)
    return { filed: 0, skipped: 0 }
  }
}

/**
 * File note links from a calendar 'note' to project note(s).
 * See various settings passed in the 'config' parameter object.
 * @author @jgclark
 *
 * @param {CoreNoteFields} note
 * @param {FilerConfig} config settings object
 * @param {boolean} runInteractively? (optional; default=false)
 * @returns {FileNoteLinksResult} note links filed, and links skipped because the destination note was missing
 */
export async function fileNoteLinks(note: CoreNoteFields, config: FilerConfig, runInteractively: boolean = false): Promise<FileNoteLinksResult> {
  try {
    let filed = 0
    let skipped = 0
    let sawCandidate = false
    logDebug('fileNoteLinks', `Looking for links to ${config.copyOrMove} in '${note.filename}'`)

    const typesToFile = paragraphTypesForFiling(config.typesToFile)
    const ignoreTag = config.ignoreNoteLinkFilerTag || ''

    // Walk by current paragraph index. After a move, line indexes change, so re-read paragraphs
    // and continue at the index the next surviving line occupies.
    let scanFrom = 0
    while (scanFrom < (note.paragraphs?.length ?? 0)) {
      const paras = note.paragraphs
      let foundIndex = -1
      for (let i = scanFrom; i < paras.length; i++) {
        if (isFileableNoteLinkParagraph(paras[i], typesToFile, ignoreTag)) {
          foundIndex = i
          break
        }
      }
      if (foundIndex < 0) break
      sawCandidate = true

      const thisPara = paras[foundIndex]
      logDebug('fileNoteLinks', `- thisPara ${foundIndex}:<${thisPara.content}>`)
      // Get details of note (and perhaps heading) to file to from (first) [[note link]] in line
      const noteLinkParts = (thisPara.content ?? '').match(RE_NOTE_TITLE_CAPTURE)
      if (!noteLinkParts) {
        logWarn(pluginJson, `fileNoteLinks(): <${thisPara.content ?? ''}> matched a note link but not RE_NOTE_TITLE_CAPTURE. Skipping this line.`)
        scanFrom = foundIndex + 1
        continue
      }
      // logDebug('fileNoteLinks', `- noteLinkParts: ${String(noteLinkParts)}`)
      const noteLinkTitle = noteLinkParts[1]
      const noteLinkHeading = noteLinkParts[2]
      const possibleNotes = DataStore.projectNoteByTitle(noteLinkTitle) ?? []
      if (possibleNotes.length === 0 || !possibleNotes[0] || !possibleNotes[0].filename) {
        logWarn(pluginJson, `fileNoteLinks(): '${noteLinkTitle}' could not be found in project notes. Skipping this link.`)
        skipped++
        scanFrom = foundIndex + 1
        continue
      }
      if (possibleNotes.length > 1) {
        logWarn(pluginJson, `fileNoteLinks(): ${String(possibleNotes.length)} project notes are titled '${noteLinkTitle}'. Filing to '${possibleNotes[0].filename}'.`)
      }
      const noteToAddTo = possibleNotes[0]
      logDebug('fileNoteLinks', `- found linked note '${noteLinkTitle}' ${noteLinkHeading ? "and heading '" + noteLinkHeading + "'" : "with no heading"} (filename: ${noteToAddTo.filename})`)

      // Strip [[note link]] from the *inserted* first line only -- do not mutate source paras
      // (mutating TParagraph.content before removeParagraphs breaks NotePlan's delete matching).
      const noteLinkMatchStr = noteLinkParts[0]
      const firstParaRawRewrite = (rawFirstLine: string): string =>
        rawFirstLine.replace(noteLinkMatchStr, '').replace('  ', ' ')

      // Full block decides how far to advance. Filtered lines are what we insert.
      const fullBlock = config.useBlocks ? getNoteLinkBlock(note, foundIndex) : [thisPara]
      const thisParaLineOrBlock = fullBlock.filter((para) => typesToFile.includes(para.type))
      if (thisParaLineOrBlock.length === 0) {
        scanFrom = foundIndex + 1
        continue
      }

      logDebug('fileNoteLinks', `  - block has ${thisParaLineOrBlock.length} paragraphs:\n\t${thisParaLineOrBlock.map(p => String(p.lineIndex) + ': ' + p.content).join('\n\t')}`)

      // Resolve destination heading fold-aware so '## Heading …' still matches 'Heading' from the link
      let headingForInsert = noteLinkHeading || ''
      if (noteLinkHeading) {
        const foundHeading = findHeading(noteToAddTo, noteLinkHeading, false)
        if (foundHeading) {
          headingForInsert = foundHeading.content
          logDebug(pluginJson, `- Resolved heading '${noteLinkHeading}' to note content '${headingForInsert}'`)
        }
      }

      const beforeNumParasInDest = noteToAddTo.paragraphs.length

      // Add text to the new location in destination note
      // Note: can't use addParagraphBelowHeadingTitle() here because you can't specify H2-H5, but only H1 of type 'title'.
      if (headingForInsert) {
        // add after specified heading
        logDebug(pluginJson, `- Adding ${thisParaLineOrBlock.length} paras after '${headingForInsert}'`)
        addParagraphsToNote(noteToAddTo, thisParaLineOrBlock, headingForInsert, config.whereToAddInSection, config.allowNotePreambleBeforeHeading, '', firstParaRawRewrite)
      } else {

        // Note: can't use Note.prependParagraph() API as it doesn't recognise front matter  (as of 3.8.1)
        // work out what indicator to send to addParagraphsToNote(), based on setting 'whereToAddInNote' (start or end)
        const positionInNoteIndicator = (config.whereToAddInNote === 'start') ? '<<top of note>>' : '<<bottom of note>>'
        addParagraphsToNote(noteToAddTo, thisParaLineOrBlock, positionInNoteIndicator, config.whereToAddInSection, config.allowNotePreambleBeforeHeading, '', firstParaRawRewrite)
      }

      const afterNumParasInDest = noteToAddTo.paragraphs.length
      if (beforeNumParasInDest === afterNumParasInDest) {
        logWarn(pluginJson, `Failed to add ${thisParaLineOrBlock.length} paras to '${displayTitle(noteToAddTo)}' under '${headingForInsert || '(top/bottom)'}'. Skipping source delete to avoid data loss.`)
        scanFrom = foundIndex + 1
        continue
      }

      // if we're doing 'move' not 'copy' then delete from existing location (unmodified source paras)
      if (config.copyOrMove === 'move') {
        logDebug(pluginJson, `- Removing ${thisParaLineOrBlock.length} paras from original note`)
        const beforeRemove = note.paragraphs.length
        note.removeParagraphs(thisParaLineOrBlock)
        // Nothing removed: step past this line so the loop cannot spin.
        // Something removed: the next survivor now sits at foundIndex.
        scanFrom = note.paragraphs.length >= beforeRemove ? foundIndex + 1 : foundIndex
      } else {
        // Copy leaves indexes in place. Skip the rest of this block, including link lines already filed with it.
        scanFrom = foundIndex + fullBlock.length
      }

      filed++
    }

    if (!sawCandidate && runInteractively) {
      await showMessage(`Sorry, no note links found in ${note.filename}.`)
    }
    logDebug('fileNoteLinks', `- filed ${String(filed)} note links, skipped ${String(skipped)}, in ${note.filename}`)
    return { filed, skipped }
  }
  catch (err) {
    logError(pluginJson, `fileNoteLinks(): ${err.name}: ${err.message}`)
    return { filed: 0, skipped: 0 }
  }
}
