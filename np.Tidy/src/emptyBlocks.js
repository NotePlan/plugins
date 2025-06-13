// @flow
//-----------------------------------------------------------------------------
// Remove empty blocks functionality for Tidy plugin
// Last updated 2025-06-13 for v0.14.7+ by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { JSP, logDebug, logError, logInfo } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { getNoteFromFilename } from '@helpers/NPnote'

/**
 * Removes empty list items, quotations, headings, and reduces multiple empty lines to a single empty line.
 * Works on the note open in the Editor, unless a filename is provided.
 * @param {string} filenameIn - Optional filename to work on. If not provided, works on the note open in the Editor.
 * @author @jgclark
 */
export async function removeEmptyBlocks(filenameIn?: string) {
  try {
    let note: TNote | null
    let workingInEditor = false

    if (filenameIn) {
      note = await getNoteFromFilename(filenameIn)
    } else {
      note = Editor?.note ?? null
      if (!note) {
        await CommandBar.showOptions(
          ['OK'],
          'Please open a note first'
        )
        logInfo(pluginJson, `removeEmptyBlocks(): no note open in Editor, so stopping.`)
        return
      }
      workingInEditor = true
    }
    logInfo(pluginJson, `Starting removeEmptyBlocks() for note '${displayTitle(note)}' ${workingInEditor ? ' (open in Editor)' : ''}`)

    if (!note) return
    const paragraphs = note.paragraphs
    if (!paragraphs || paragraphs.length === 0) {
      logInfo(pluginJson, `No paragraphs found in note '${displayTitle(note)}', so stopping.`)
      return
    }

    let lastWasEmpty = false
    let changesMade = false

    for (const para of paragraphs) {
      const trimmedContent = para.content.trim()
      const isEmptyContent = trimmedContent === ''

      // Delete empty list items, quotes, and heading paras
      if (isEmptyContent && ['list', 'quote', 'title'].includes(para.type)) {
        logDebug('removeEmptyBlocks', `Removing empty list/quote/heading para on line ${String(para.lineIndex)}`)
        note.removeParagraph(para)
        changesMade = true
      }

      // Handle multiple empty paras
      if (para.type === 'empty') {
        // logDebug('removeEmptyBlocks', `Line ${String(para.lineIndex)} is empty. lastWasEmpty: ${String(lastWasEmpty)}`)
        if (lastWasEmpty) {
          logDebug('removeEmptyBlocks', `Removing empty para on line ${String(para.lineIndex)}`)
          note.removeParagraph(para)
          changesMade = true
        }
        lastWasEmpty = true
      } else {
        lastWasEmpty = false
      }
    }

    if (changesMade) {
      logInfo('removeEmptyBlocks', `Removed empty blocks from note '${displayTitle(note)}'`)
      // Save Editor (if that's where we're working)
      if (workingInEditor) {
        await Editor.save()
      }
    } else {
      logInfo('removeEmptyBlocks', `No empty blocks found to remove in note '${displayTitle(note)}' `)
    }
  } catch (error) {
    logError('removeEmptyBlocks', `Error in removeEmptyBlocks: ${JSP(error)}`)
  }
} 