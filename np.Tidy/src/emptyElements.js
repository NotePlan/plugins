// @flow
//-----------------------------------------------------------------------------
// Remove empty blocks functionality for Tidy plugin
// Last updated 2025-09-24 for v1.0.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getSettings } from './tidyHelpers'
import { JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { getNoteFromFilename } from '@helpers/NPnote'

export async function testRemoveEmptyElements(): Promise<void> {
  // await removeEmptyElements() // ❌
  // await removeEmptyElements("Editor") // ❌
  // await removeEmptyElements("Editor", true) // ✅
  await removeEmptyElements('Editor', false) // ❌
  // await removeEmptyElements("TEST/Tidy TESTs/Empty Block TESTs.md", false) // ❌
  // await removeEmptyElements("TEST/Tidy TESTs/Empty Block TESTs.md", false) // ✅
}

/**
 * Removes empty list items, quotations, headings, sections, and reduces multiple empty lines to a single empty line.
 * Setting 'stripAllEmptyLines' controls whether to leave no empty paragraphs at all.
 * Works on the note open in the Editor, unless a filename is provided.
 *
 * The function operates in three passes:
 * - PASS 1: Removes empty list items, quotes, and headings with no content
 * - PASS 2: Removes empty sections (headings with no content and no subheadings with content)
 * - PASS 3: Handles consecutive empty lines based on stripAllEmptyLines setting
 *
 * @param {string} filenameIn - Filename of note to work on. If not provided, works on the note open in the Editor. Can also pass literal string "Editor".
 * @param {boolean?} stripAllEmptyLinesArg - Optional setting to control whether to leave no empty paragraphs at all. If present it overrides the setting in the plugin settings.
 * @author @jgclark
 */
/**
 * PASS 1: Removes empty list items, quotes, and headings with no content
 *
 * This is the first pass of the empty elements removal process. It handles the simplest
 * cases where elements are completely empty (no text content).
 *
 * @param {TNote} note - The note to process
 * @returns {boolean} - Whether any changes were made
 *
 * @example
 * // Removes: "- " (empty list item)
 * // Removes: "> " (empty quote)
 * // Removes: "# " (empty heading)
 * // Preserves: "- Some content" (list with content)
 * // Preserves: "> Some quote" (quote with content)
 * // Preserves: "# Some heading" (heading with content)
 */
function removeEmptyListItemsAndHeadings(note: TNote): boolean {
  const paragraphs = note.paragraphs
  let changesMade = false

  for (const para of paragraphs) {
    const trimmedContent = para.content.trim()
    const isEmptyContent = trimmedContent === ''

    if (isEmptyContent && ['list', 'quote', 'title'].includes(para.type)) {
      logDebug('removeEmptyElements', `Removing empty ${para.type} para on line ${String(para.lineIndex)}`)
      note.removeParagraph(para)
      changesMade = true
    }
  }

  return changesMade
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
 * @returns {boolean} - Whether any changes were made
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
function removeEmptySections(note: TNote): boolean {
  const paragraphs = note.paragraphs
  const titleParas = paragraphs.filter((para) => para.type === 'title')
  let changesMade = false

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
      logDebug('removeEmptyElements', `Removing heading para on line ${String(para.lineIndex)} (no content and no subheadings with content)`)
      note.removeParagraph(para)
      changesMade = true
    }
  }

  return changesMade
}

/**
 * PASS 3: Removes consecutive empty lines based on the stripAllEmptyLines setting
 *
 * This is the third and final pass of the empty elements removal process. It handles
 * the cleanup of empty lines based on the user's preference for how many empty lines
 * to preserve.
 *
 * @param {TNote} note - The note to process
 * @param {boolean} stripAllEmptyLines - Whether to remove all empty lines or just consecutive ones
 * @returns {boolean} - Whether any changes were made
 *
 * @example
 * // When stripAllEmptyLines = false (default):
 * // Before: "Line 1\n\n\n\nLine 2"
 * // After:  "Line 1\n\nLine 2"  (reduces multiple consecutive empty lines to single)
 *
 * // When stripAllEmptyLines = true:
 * // Before: "Line 1\n\n\n\nLine 2"
 * // After:  "Line 1\nLine 2"  (removes all empty lines)
 */
function removeConsecutiveEmptyLines(note: TNote, stripAllEmptyLines: boolean): boolean {
  const paragraphs = note.paragraphs
  let changesMade = false

  if (stripAllEmptyLines) {
    // Delete *all* empty paras
    const emptyParasToRemove = paragraphs.filter((para) => para.type === 'empty')
    for (const para of emptyParasToRemove) {
      logDebug('removeEmptyElements', `Removing empty para on line ${String(para.lineIndex)}`)
      note.removeParagraph(para)
      changesMade = true
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
          logDebug('removeEmptyElements', `Line ${String(para.lineIndex)} is empty (first in sequence)`)
          inEmptySequence = true
        }
      } else {
        // Non-empty line, reset the sequence flag
        inEmptySequence = false
      }
    }

    // Remove the marked paragraphs in reverse order to avoid index shifting
    for (let i = parasToRemove.length - 1; i >= 0; i--) {
      const para = parasToRemove[i]
      logDebug('removeEmptyElements', `Removing empty para on line ${String(para.lineIndex)}`)
      note.removeParagraph(para)
      changesMade = true
    }
  }

  return changesMade
}

export async function removeEmptyElements(filenameIn: string = 'Editor', stripAllEmptyLinesArg: ?boolean = null): Promise<void> {
  try {
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
    logDebug(pluginJson, `stripAllEmptyLinesArg: ${String(stripAllEmptyLinesArg)} typeof=${typeof stripAllEmptyLinesArg} / stripAllEmptyLines: ${String(stripAllEmptyLines)}`)

    // Execute the three phases of cleanup
    const changes1 = removeEmptyListItemsAndHeadings(note)
    const changes2 = removeEmptySections(note)
    const changes3 = removeConsecutiveEmptyLines(note, Boolean(stripAllEmptyLines))

    const changesMade = changes1 || changes2 || changes3

    if (changesMade) {
      logInfo('removeEmptyElements', `Removed empty elements from note '${displayTitle(note)}'`)
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
