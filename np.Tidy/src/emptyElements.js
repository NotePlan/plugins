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
  await removeEmptyElements("Editor", false) // ❌
  // await removeEmptyElements("TEST/Tidy TESTs/Empty Block TESTs.md", false) // ❌
  // await removeEmptyElements("TEST/Tidy TESTs/Empty Block TESTs.md", false) // ✅
}

/**
 * Removes empty list items, quotations, headings, sections, and reduces multiple empty lines to a single empty line.
 * Setting 'stripAllEmptyLines' controls whether to leave no empty paragraphs at all.
 * Works on the note open in the Editor, unless a filename is provided.
 * @param {string} filenameIn - Filename of note to work on. If not provided, works on the note open in the Editor. Can also pass literal string "Editor".
 * @param {boolean?} stripAllEmptyLinesArg - Optional setting to control whether to leave no empty paragraphs at all. If present it overrides the setting in the plugin settings.
 * @author @jgclark
 */
export async function removeEmptyElements(
  filenameIn: string = "Editor",
  stripAllEmptyLinesArg: ?boolean = null
): Promise<void> {
  try {
    let note: TNote | null
    let workingInEditor = false

    if (filenameIn === "Editor") {
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
    const stripAllEmptyLines = (stripAllEmptyLinesArg !== null) ? stripAllEmptyLinesArg : config.stripAllEmptyLines
    logDebug(pluginJson, `stripAllEmptyLinesArg: ${String(stripAllEmptyLinesArg)} typeof=${typeof stripAllEmptyLinesArg} / stripAllEmptyLines: ${String(stripAllEmptyLines)}`)
    let changesMade = false

    for (const para of paragraphs) {
      const trimmedContent = para.content.trim()
      const isEmptyContent = trimmedContent === ''

      // Delete empty list items, quotes, and heading paras
      if (isEmptyContent && ['list', 'quote', 'title'].includes(para.type)) {
        logDebug('removeEmptyElements', `Removing empty ${para.type} para on line ${String(para.lineIndex)}`)
        note.removeParagraph(para)
        changesMade = true
      }

      // Delete empty sections
      // i.e. headings that have no following content before the next heading of the same level, a separator, or the end of the note
      if (para && para.type === 'title') {
        let sectionHasContent = false
        for (let i = para.lineIndex + 1; i < paragraphs.length; i++) {
          const nextPara = paragraphs[i]
          // Stop if we hit a heading of the same or higher level, or a separator, or end of note
          if (
            (nextPara.type === 'title' && nextPara.headingLevel <= para.headingLevel) ||
            nextPara.type === 'separator'
          ) {
            break
          }
          // If we find any non-empty, non-empty-line, non-separator content, mark as having content
          if (
            nextPara.type !== 'empty' &&
            nextPara.type !== 'separator' &&
            nextPara.content.trim() !== ''
          ) {
            sectionHasContent = true
            break
          }
        }
        if (!sectionHasContent) {
          logDebug('removeEmptyElements', `Removing heading para on line ${String(para.lineIndex)} (no content before next heading/separator/end)`)
          note.removeParagraph(para)
          changesMade = true
        }
      }
    }

    // Finally, delete all or all consecutive empty paras (depending on setting 'stripAllEmptyLines')
    if (stripAllEmptyLines) {
      // Delete *all* empty paras
      for (const para of paragraphs) {
        if (para.type === 'empty') {
          logDebug('removeEmptyElements', `Removing empty para on line ${String(para.lineIndex)}`)
          note.removeParagraph(para)
          changesMade = true
        }
      }
    } else {
      // Delete multiple consecutive empty paras
      let lastWasEmpty = false
      for (const para of paragraphs) {
        if (para.type === 'empty') {
          logDebug('removeEmptyElements', `Line ${String(para.lineIndex)} is empty. lastWasEmpty: ${String(lastWasEmpty)}`)
          if (lastWasEmpty) {
            logDebug('removeEmptyElements', `Removing empty para on line ${String(para.lineIndex)}`)
            // FIXME: can't work out why this doesn't work as expected for separator/empty/empty sequences. Following line doesn't seem to do anything
            // FIXME: and why does it remove too many paras sometimes?
            note.removeParagraph(para)
            changesMade = true
          }
          lastWasEmpty = true
        } else {
          lastWasEmpty = false
        }
      }
    }

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