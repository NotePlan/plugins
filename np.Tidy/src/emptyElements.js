// @flow
//-----------------------------------------------------------------------------
// Remove empty blocks functionality for Tidy plugin
// Last updated 2025-11-22 for v1.17.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getSettings } from './tidyHelpers'
import { JSP, logDebug, logError, logInfo, logWarn, overrideSettingsWithEncodedTypedArgs, timer } from '@helpers/dev'
import { displayTitle, getTagParamsFromString } from '@helpers/general'
import { getAllNotesOfType, getNoteFromFilename, getNotesChangedInInterval } from '@helpers/NPnote'
import { showMessage } from '@helpers/userInput'

// -----------------------------------------------------------------------------
// Private Helper functions
// -----------------------------------------------------------------------------

/**
 * PASS 1: Removes empty list items, quotes, and headings with no content
 *
 * This is the first pass of the empty elements removal process. It handles the simplest
 * cases where elements are completely empty (no text content).
 *
 * @param {TNote} note - The note to process
 * @param {boolean} preserveHeadings - Whether to preserve heading structure (skip removing empty headings)
 * @returns {number} - Number of changes made
 *
 * @example
 * When preserveHeadings = false (default):
 * - Removes: "- " (empty list item)
 * - Removes: "> " (empty quote)
 * - Removes: "# " (empty heading)
 * - Removes: "* " (empty task)
 * - Removes: "+ " (empty checklist)
 * - Preserves: "- Some content" (list with content)
 * - Preserves: "> Some quote" (quote with content)
 * - Preserves: "# Some heading" (heading with content)
 *
 * When preserveHeadings = true:
 * - Preserves: "# " (empty heading - structure preserved)
 */
function removeEmptyParagraphs(note: TNote, preserveHeadings: boolean = false): number {
  const paragraphs = note.paragraphs
  let numChangesMade = 0

  for (const para of paragraphs) {
    const trimmedContent = para.content.trim()
    const isEmptyContent = trimmedContent === ''

    // For headings, when preserving structure, never remove them
    // For other types, check if content is empty
    let shouldRemove = false
    if (para.type === 'title' && preserveHeadings) {
      // Don't remove headings when preserving structure
      shouldRemove = false
    } else if (para.type === 'title' && !preserveHeadings) {
      // Remove empty headings when not preserving structure
      shouldRemove = isEmptyContent
    } else {
      // For most other paragraph types, remove if empty
      shouldRemove = isEmptyContent && ['open', 'checklist', 'scheduled', 'checklistScheduled', 'list', 'quote'].includes(para.type)
    }
    if (shouldRemove) {
      logDebug('removeEmptyElements', `Removing empty ${para.type} para on line ${String(para.lineIndex)}`)
      note.removeParagraph(para)
      numChangesMade++
    }
  }
  logDebug('removeEmptyElements', `Removed ${String(numChangesMade)} empty paras`)
  return numChangesMade
}

/**
 * PASS 2: Removes empty sections (headings with no content and no subheadings with content)
 *
 * This is the second pass of the empty elements removal process. It handles the complex
 * logic for determining which headings should be preserved based on their content and
 * subheadings. This implements the "smart heading preservation" feature.
 *
 * A heading is preserved if:
 * - It has content in its section (text, lists, quotes, etc.), OR
 * - It has subheadings that contain content
 *
 * A heading is removed if:
 * - It has no content in its section AND no subheadings with content
 *
 * @param {TNote} note - The note to process
 * @returns {number} - Number of changes made
 *
 * @example
 * // This heading is PRESERVED because its subheading has content:
 * // # Main Section
 * // ## Subsection with content
 *
 * // This heading is REMOVED because it has no content and no subheadings with content:
 * // # Empty Section
 * // (no content)
 * // ## Empty Subsection
 * // (no content)
 */
function removeEmptySections(note: TNote): number {
  const paragraphs = note.paragraphs
  const titleParas = paragraphs.filter((para) => para.type === 'title')
  let numChangesMade = 0

  // First, mark which headings have content (including subheadings)
  const headingHasContent = new Map<number, boolean>()

  for (let i = titleParas.length - 1; i >= 0; i--) {
    const para = titleParas[i]
    let sectionHasContent = false

    for (let j = para.lineIndex + 1; j < paragraphs.length; j++) {
      const nextPara = paragraphs[j]
      // Stop if we hit a heading of the same or higher level, or a separator, or end of note
      if ((nextPara.type === 'title' && nextPara.headingLevel <= para.headingLevel) || nextPara.type === 'separator') {
        break
      }
      // If we find any non-empty, non-empty-line, non-separator content, mark as having content
      // But don't count headings as content (they are structure, not content)
      if (nextPara.type !== 'empty' && nextPara.type !== 'separator' && nextPara.type !== 'title' && nextPara.content.trim() !== '') {
        sectionHasContent = true
        break
      }
    }

    // Check if any subheadings have content
    let hasSubheadingWithContent = false
    for (let k = i + 1; k < titleParas.length; k++) {
      const subPara = titleParas[k]
      if (subPara.headingLevel > para.headingLevel) {
        // This is a subheading - check if it has content
        if (headingHasContent.get(subPara.lineIndex)) {
          hasSubheadingWithContent = true
          break
        }
      } else {
        // We've reached a heading of same or higher level, stop checking
        break
      }
    }

    // A heading should be preserved if:
    // 1. It has content in its section, OR
    // 2. It has subheadings with content
    const hasContent = sectionHasContent || hasSubheadingWithContent
    headingHasContent.set(para.lineIndex, hasContent)

    // Remove headings that have no content AND no subheadings with content
    // (regardless of whether they have text - empty sections should be removed)
    if (!hasContent) {
      logDebug('removeEmptyElements', `Removing heading '${para.content.trim()}' on line ${String(para.lineIndex)} (no content and no subheadings with content)`)
      note.removeParagraph(para)
      numChangesMade++
    }
  }
  logDebug('removeEmptyElements', `Removed ${String(numChangesMade)} empty headings`)
  return numChangesMade
}

/**
 * PASS 3: Removes consecutive empty lines (or all empty lines if stripAllEmptyLines is true).
 *
 * This is the third and final pass of the empty elements removal process. It handles the cleanup of empty lines based on the user's preference for how many empty lines to preserve.
 *
 * @param {TNote} note - The note to process
 * @param {boolean} stripAllEmptyLines - Whether to remove all empty lines or just consecutive ones
 * @param {boolean} preserveEmptyHeadings - Whether to skip removing empty headings (e.g. just `## ` or `### `)
 * @returns {number} - Number of changes made
 *
 * @example
 * When stripAllEmptyLines = false (default):
 * Before: "Line 1\n\n\n\nLine 2"
 * After:  "Line 1\n\nLine 2"  (reduces multiple consecutive empty lines to single)
 *
 * When stripAllEmptyLines = true:
 * Before: "Line 1\n\n\n\nLine 2"
 * After:  "Line 1\nLine 2"  (removes all empty lines)
 * 
 * When preserveEmptyHeadings = false:
 * Before: "Line 1\n## \n\n\nLine 2"
 * After:  "Line 1\n\n\nLine 2"  (preserves empty headings)
 */
function removeConsecutiveEmptyLines(note: TNote, stripAllEmptyLines: boolean, preserveEmptyHeadings: boolean = false): number {
  const paragraphs = note.paragraphs
  let numChangesMade = 0

  if (stripAllEmptyLines) {
    // Delete *all* empty paras, but preserve headings if preserveEmptyHeadings is true
    const emptyParasToRemove = paragraphs.filter((para) => {
      if (para.type === 'empty') return true
      if (preserveEmptyHeadings && para.type === 'title' && para.content.trim() === '') return false
      return false
    })
    for (const para of emptyParasToRemove) {
      logDebug('removeEmptyElements', `Removing empty para on line ${String(para.lineIndex)}`)
      note.removeParagraph(para)
      numChangesMade++
    }
  } else {
    // Delete multiple consecutive empty paras, leaving only one empty line
    const parasToRemove = []
    let inEmptySequence = false

    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i]

      if (para.type === 'empty') {
        if (inEmptySequence) {
          // This is a consecutive empty line, mark it for removal
          logDebug('removeEmptyElements', `Marking empty para on line ${String(para.lineIndex)} for removal (consecutive empty)`)
          parasToRemove.push(para)
        } else {
          // This is the first empty line in a sequence
          // logDebug('removeEmptyElements', `Line ${String(para.lineIndex)} is empty (first in sequence)`)
          inEmptySequence = true
        }
      } else if (preserveEmptyHeadings && para.type === 'title' && para.content.trim() === '') {
        // When preserving headings, treat empty headings as non-empty to break sequences
        inEmptySequence = false
      } else {
        // Non-empty line, reset the sequence flag
        inEmptySequence = false
      }
    }

    // Remove the marked paragraphs in reverse order to avoid index shifting
    if (parasToRemove.length > 0) {
      for (let i = parasToRemove.length - 1; i >= 0; i--) {
        const para = parasToRemove[i]
        logDebug('removeEmptyElements', `Removing empty para on line ${String(para.lineIndex)}`)
        note.removeParagraph(para)
        numChangesMade++
      }
    }
  }
  logDebug('removeEmptyElements', `Removed ${String(numChangesMade)} empty paras`)
  return numChangesMade
}

// -----------------------------------------------------------------------------
/**
 * Remove just empty lines from the open note, without removing any other empty elements.
 * @param {string} filenameIn - Filename of note to work on. If not provided, works on the note open in the Editor. Can also pass literal string "Editor".
 */
export async function removeEmptyLines(filenameIn: string = 'Editor'): Promise<void> {
  try {
    logDebug(pluginJson, `Starting removeEmptyLines() with filenameIn: "${filenameIn}"`)
    // Get the note to work on
    let note: TNote | null
    let workingInEditor = false

    if (filenameIn === 'Editor') {
      note = Editor?.note ?? null
      if (!note) {
        await CommandBar.showOptions(['OK'], 'Please open a note first')
        throw new Error(`No note open in Editor, so stopping.`)
      }
      workingInEditor = true
    } else {
      note = await getNoteFromFilename(filenameIn)
      if (!note) throw new Error(`Cannot open note with filename '${filenameIn}'`)
    }
    logInfo(pluginJson, `Starting removeEmptyLines() for note '${displayTitle(note)}' ${workingInEditor ? ' (open in Editor)' : ''}`)
    // Remove just empty lines, preserving empty headings
    const changes1 = removeConsecutiveEmptyLines(note, true, true)
    const numChangesMade = changes1

    if (numChangesMade > 0) {
      logInfo('removeEmptyElements', `Removed ${String(numChangesMade)} empty elements from note '${displayTitle(note)}'`)
      // Save Editor (if that's where we're working)
      if (workingInEditor) {
        await Editor.save()
      }
    } else {
      logInfo('removeEmptyElements', `No empty elements found to remove in note '${displayTitle(note)}' `)
    }

  } catch (error) {
    logError('tidy/removeEmptyLines', JSP(error))
  }
}

/**
 * Removes empty list items, quotations, headings, sections, and reduces multiple empty lines to a single empty line.
 * Setting 'stripAllEmptyLines' controls whether to leave no empty paragraphs at all.
 * Setting 'preserveHeadingStructure' controls whether to preserve all heading structure (no heading deletions).
 * Works on the note open in the Editor, unless a filename is provided.
 *
 * By default, this function only processes Calendar notes. To process Project notes as well, either:
 * - Enable the 'Also cover Project notes?' setting in plugin settings, or
 * - Pass coverRegularNotesAsWell=true as a parameter
 *
 * The function operates in three passes:
 * - PASS 1: Removes empty list items, quotes, and headings with no content
 * - PASS 2: Removes empty sections (headings with no content and no subheadings with content)
 * - PASS 3: Handles consecutive empty lines based on stripAllEmptyLines setting
 * @author @jgclark
 *
 * @param {string} filenameIn - Filename of note to work on. If not provided, works on the note open in the Editor. Can also pass literal string "Editor".
 * @param {boolean?} stripAllEmptyLinesArg - Optional setting to control whether to leave no empty paragraphs at all. If present it overrides the setting in the plugin settings.
 * @param {boolean?} preserveHeadingStructure - Optional setting to preserve all heading structure. When true, skips PASS 2 (no heading deletions) and only removes empty list items, quotes, and empty lines. 
 * @returns {Promise<void>} - Promise that resolves when the operation is complete
 *
 * @example
 * Normal behavior - removes empty headings and sections from Calendar notes only
 * - await removeEmptyElements('Editor', false, false)
 *
 * Preserve heading structure - keeps all headings, even empty ones
 * - await removeEmptyElements('Editor', false, true)
 *
 * Remove all empty lines while preserving heading structure
 * - await removeEmptyElements('Editor', true, true)
 */
export async function removeEmptyElements(
  filenameIn: string = 'Editor',
  stripAllEmptyLinesArg: ?boolean = null,
  preserveHeadingStructure: ?boolean = null,
): Promise<void> {
  try {
    logDebug(
      pluginJson,
      `Starting removeEmptyElements() with args filenameIn: "${filenameIn}", stripAllEmptyLinesArg: ${String(stripAllEmptyLinesArg)}, preserveHeadingStructure: ${String(preserveHeadingStructure)}`,
    )

    let note: TNote | null
    let workingInEditor = false

    if (filenameIn === 'Editor') {
      note = Editor?.note ?? null
      if (!note) {
        await CommandBar.showOptions(['OK'], 'Please open a note first')
        throw new Error(`No note open in Editor, so stopping.`)
      }
      workingInEditor = true
    } else {
      note = await getNoteFromFilename(filenameIn)
      if (!note) throw new Error(`Cannot open note with filename '${filenameIn}'`)
    }
    logInfo(pluginJson, `Starting removeEmptyElements() for note '${displayTitle(note)}' ${workingInEditor ? ' (open in Editor)' : ''}`)

    const paragraphs = note.paragraphs
    if (!paragraphs || paragraphs.length === 0) {
      logInfo(pluginJson, `No paragraphs found in note '${displayTitle(note)}', so stopping.`)
      return
    }

    const config = await getSettings()
    const stripAllEmptyLines = stripAllEmptyLinesArg !== null ? stripAllEmptyLinesArg : config.stripAllEmptyLines
    const preserveHeadings = preserveHeadingStructure !== null ? preserveHeadingStructure : false
    // logDebug(pluginJson, `stripAllEmptyLinesArg: ${String(stripAllEmptyLinesArg)} typeof=${typeof stripAllEmptyLinesArg} / stripAllEmptyLines: ${String(stripAllEmptyLines)}`)
    // logDebug(pluginJson, `preserveHeadingStructure: ${String(preserveHeadingStructure)} typeof=${typeof preserveHeadingStructure} / preserveHeadings: ${String(preserveHeadings)}`)

    // Execute the phases of cleanup
    const changes1 = removeEmptyParagraphs(note, preserveHeadings)
    const changes2 = preserveHeadings ? 0 : removeEmptySections(note) // if preserving headings, don't remove any headings
    const changes3 = removeConsecutiveEmptyLines(note, Boolean(stripAllEmptyLines), preserveHeadings)

    const numChangesMade = changes1 + changes2 + changes3

    if (numChangesMade > 0) {
      logInfo('removeEmptyElements', `Removed ${String(numChangesMade)} empty elements from note '${displayTitle(note)}'`)
      // Save Editor (if that's where we're working)
      if (workingInEditor) {
        await Editor.save()
      }
    } else {
      logInfo('removeEmptyElements', `No empty elements found to remove in note '${displayTitle(note)}' `)
    }
  } catch (error) {
    logError('tidy/removeEmptyElements', JSP(error))
  }
}

/**
 * Checks if the note has meaningful content (non-empty, non-title paragraphs)
 * @param {TNote} note
 * @returns {boolean} True if the note has meaningful content, false otherwise
 */
function noteHasMeaningfulContent(note: TNote): boolean {
  const paragraphs = note.paragraphs
  for (const para of paragraphs) {
    if (para.type !== 'title' && para.content.trim() !== '') {
      return true
    }
  }
  return false
}

/**
 * Run removeEmptyElements on all recently-updated notes
 * Can be passed parameters to override defaults through an x-callback call
 * Supported params: { numDays?: number, runSilently?: boolean, stripAllEmptyLines?: boolean, preserveHeadingStructure?: boolean }
 * @author @jgclark
 * @param {string?} params optional JSON string
 */
export async function removeEmptyElementsFromRecentNotes(params: string = ''): Promise<void> {
  try {
    // Get plugin settings (config)
    let config = await getSettings()
    if (params) {
      logDebug(pluginJson, `removeEmptyElementsFromRecentNotes() starting with params '${params}'`)
      config = overrideSettingsWithEncodedTypedArgs(config, params)
    } else {
      logDebug(pluginJson, `removeEmptyElementsFromRecentNotes() starting with no params`)
    }

    // Resolve params
    const numDays: number = await getTagParamsFromString(params ?? '', 'numDays', config.numDays ?? 0)
    const runSilently: boolean = await getTagParamsFromString(params ?? '', 'runSilently', false)
    const stripAllEmptyLines: boolean = await getTagParamsFromString(params ?? '', 'stripAllEmptyLines', config.stripAllEmptyLines ?? false)
    const preserveHeadingStructure: boolean = await getTagParamsFromString(params ?? '', 'preserveHeadingStructure', false)
    const coverRegularNotesAsWell: boolean = await getTagParamsFromString(params ?? '', 'coverRegularNotes', config.coverProjectNotes ?? false)
    const noteTypesToProcess: Array<string> = coverRegularNotesAsWell ? ['Notes', 'Calendar'] : ['Calendar']

    const startTime = new Date()
    CommandBar.showLoading(true, `Finding recent notes`)
    await CommandBar.onAsyncThread()

    // Find notes changed in interval (or all when numDays === 0)
    let recentNotes = numDays > 0 ? getNotesChangedInInterval(numDays, noteTypesToProcess) : getAllNotesOfType(noteTypesToProcess)

    // Filter out Template notes (those whose filename starts with '@Templates')
    const originalCount = recentNotes.length
    recentNotes = recentNotes.filter((note) => !note.filename.startsWith('@Templates'))

    if (originalCount > recentNotes.length) {
      logDebug('removeEmptyElementsFromRecentNotes', `- filtered out ${String(originalCount - recentNotes.length)} Template notes`)
    }

    if (recentNotes.length === 0) {
      if (!runSilently) {
        await showMessage('No recently-changed notes found to process')
      } else {
        logInfo('removeEmptyElementsFromRecentNotes', `No recently-changed notes found to process`)
      }
      return
    }
    logDebug('removeEmptyElementsFromRecentNotes', `- found ${String(recentNotes.length)} recently-changednotes to process`)
    // for (const note of recentNotes) {
    //   logDebug('removeEmptyElementsFromRecentNotes', `- ${displayTitle(note)}`)
    // }

    let numChanged = 0
    CommandBar.showLoading(true, `Looking for empty elements in ${String(recentNotes.length)} recent notes...`)
    for (const note of recentNotes) {
      const before = note.paragraphs.map((p) => p.rawContent).join('\n')
      const hasMeaningfulContent = noteHasMeaningfulContent(note)
      await removeEmptyElements(note.filename, stripAllEmptyLines, preserveHeadingStructure)
      const afterNote = await getNoteFromFilename(note.filename)
      const after = afterNote?.paragraphs.map((p) => p.rawContent).join('\n') ?? ''
      const afterContent =
        afterNote?.paragraphs
          .map((p) => p.content)
          .join('\n')
          .trim() ?? ''
      if (hasMeaningfulContent && afterContent === '') {
        await CommandBar.onMainThread()
        CommandBar.showLoading(false)
        await showMessage(
          `Note '${displayTitle(note)}' has meaningful content but no content after removal; this is unexpected and may be a bug. Please report it to @jgclark. Stopping.`,
        )
        logError(
          'removeEmptyElementsFromRecentNotes',
          `- note '${displayTitle(note)}' has meaningful content but no content after removal! Note before:\n${before}\n===\nafter: (empty)`,
        )
        note.content = before // restore the note to its original content
        return
      }
      if (before !== after) numChanged++
    }
    await CommandBar.onMainThread()
    CommandBar.showLoading(false)

    logInfo('removeEmptyElementsFromRecentNotes', `Removed empty elements in ${String(numChanged)} of ${String(recentNotes.length)} recent notes, in ${timer(startTime)}`)
    if (!runSilently) {
      await showMessage(`Removed empty elements in ${String(numChanged)} of ${String(recentNotes.length)} recent notes`)
    }
  } catch (error) {
    logError('removeEmptyElementsFromRecentNotes', JSP(error))
  }
}
