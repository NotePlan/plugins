// @flow
//---------------------------------------------------------------
// Other windowing functions
// Jonathan Clark
// last update 27.12.2023 for v1.0.0 by @jgclark
// Minimum NP version: v3.9.8
//---------------------------------------------------------------

import pluginJson from '../plugin.json'
import * as wth from './WTHelpers'
import { getDateStringFromCalendarFilename } from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import {
  closeWindowFromId,
  constrainWindowSizeAndPosition,
  openNoteInNewSplitIfNeeded,
  // openNoteInNewWindowIfNeeded,
  rectToString,
} from '@helpers/NPWindows'
import { showMessage } from '@helpers/userInput'

//-----------------------------------------------------------------

const pluginID = 'jgclark.WindowSets'

//---------------------------------------------------------------
// Other Windowing tools

/**
 * Constrain main window, so it actually all shows on the screen
 * @author @jgclark
 */
export async function constrainMainWindow(): Promise<void> {
  try {
    // Get current editor window details
    const mainWindowRect: Rect = NotePlan.editors[0].windowRect
    logDebug(pluginJson, `- mainWindowRect: ${rectToString(mainWindowRect)}`)

    // Constrain into the screen area
    const updatedRect = constrainWindowSizeAndPosition(mainWindowRect)
    logDebug(pluginJson, `- updatedRect: ${rectToString(updatedRect)}`)

    NotePlan.editors[0].windowRect = updatedRect
  } catch (err) {
    logError(pluginJson, err)
  }
}

/**
 * Move a split window to the main window (first) positionl.
 * @author @jgclark
 */
export async function moveCurrentSplitToMain(): Promise<void> {
  try {
    if (NotePlan.environment.platform !== 'macOS' || NotePlan.environment.buildVersion < 1100) {
      logInfo(pluginJson, `Window Sets needs NotePlan v3.9.8 or later on macOS. Stopping.`)
      return
    }

    // const config = await wth.getPluginSettings()

    // Get filename of Editor
    if (!Editor) {
      throw new Error(`There is no Editor open, so cannot continue.`)
    }
    if (Editor.windowType !== 'split') {
      throw new Error(`You must be editing a split window, other than the first one, so cannot continue.`)
    }
    const originalSplitFilename = Editor.filename
    const originalSplitNoteType = Editor.type

    // Get set of currently open main/split windows
    const originalWinDetails: Array<wth.EditorWinDetails> = NotePlan.editors
      .filter((win) => win.windowType === 'main' || win.windowType === 'split')
      .map((win) => {
        const winRect = win.windowRect
        return {
          id: win.id,
          noteType: win.type,
          windowType: win.windowType,
          filename: win.filename,
          x: winRect.x,
          y: winRect.y,
          width: winRect.width,
          height: winRect.height,
        }
      })
    logDebug(pluginJson, `moveCurrentSplitToMain starting with ${String(originalWinDetails.length)} editor main/split windows`)
    if ((originalWinDetails.length) < 2) {
      throw new Error("There's only 1 open window, so cannot proceed.")
    }

    // Close all current split windows
    for (const ew of originalWinDetails) {
      if (ew.windowType === 'split') {
        logDebug('openWindowSet', `Closing split window with id ${ew.id ?? '?'}`)
        closeWindowFromId(ew.id ?? '?')
      }
    }

    // Constrain window to be fully on the screen while we're at it
    await constrainMainWindow()

    // Make main window the one that this was called about
    if (originalSplitNoteType === 'Notes') {
      logDebug('moveCurrentSplitToMain', `Attempting to open project note ${originalSplitFilename} in main window`)
      let res = await Editor.openNoteByFilename(originalSplitFilename, false)
    } else {
      const noteNPDate = getDateStringFromCalendarFilename(originalSplitFilename)
      logDebug('moveCurrentSplitToMain', `Attempting to open calendar date ${noteNPDate} in main window`)
      let res = await Editor.openNoteByDateString(noteNPDate, false)
    }

    // Open a split with previous main window
    const originalFirstWindow = originalWinDetails[0]
    logDebug('moveCurrentSplitToMain', `Attempting to open project note ${originalSplitFilename} in first split`)
    let res = openNoteInNewSplitIfNeeded(originalFirstWindow.filename)

    // Open any other remaining split windows
    if ((originalWinDetails.length) > 2) {
      for (let i = 2; i < originalWinDetails.length; i++) {
        const ew = originalWinDetails[i]
        if (ew.windowType === 'split') {
          res = openNoteInNewSplitIfNeeded(ew.filename)
        } else {
          throw new Error(`Unexpected window type ${ew.windowType} for what should be split #${String(i)}`)
        }
      }
    }
  }
  catch (error) {
    logError('moveCurrentSplitToMain', JSP(error))
    await showMessage(error.message)
  }
}
