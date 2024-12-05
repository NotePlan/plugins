// @flow
//---------------------------------------------------------------
// Other windowing functions
// Jonathan Clark
// last update 15.3.2024 for v1.2.0 by @jgclark
// Minimum NP version: v3.9.8
//---------------------------------------------------------------

import pluginJson from '../plugin.json'
import * as wth from './WTHelpers'
import { getDateStringFromCalendarFilename } from '@np/helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@np/helpers/dev'
import { getNoteTitleFromFilename } from '@np/helpers/NPnote'
import {
  closeWindowFromId,
  constrainWindowSizeAndPosition,
  openNoteInNewSplitIfNeeded,
  rectToString,
} from '@np/helpers/NPWindows'
import { chooseOption, showMessage } from '@np/helpers/userInput'

//-----------------------------------------------------------------

// const pluginID = 'jgclark.WindowTools'

//---------------------------------------------------------------
// Other Windowing tools

/**
 * Constrain main window, so it actually all shows on the screen
 * @author @jgclark
 */
export function constrainMainWindow(): void {
  try {
    // Get current editor window details
    const mainWindowRect: Rect = NotePlan.editors[0].windowRect
    logDebug(pluginJson, `- mainWindowRect: ${rectToString(mainWindowRect)}`)

    // Constrain into the screen area
    const updatedRect = constrainWindowSizeAndPosition(mainWindowRect)
    logDebug(pluginJson, `- updatedRect: ${rectToString(updatedRect)}`)

    NotePlan.editors[0].windowRect = updatedRect
  } catch (error: any) {
    logError(pluginJson, error.message)
  }
}

/**
 * Move a split window to the main window (first) position.
 * @author @jgclark
 */
export async function moveCurrentSplitToMain(): Promise<void> {
  try {
    if (NotePlan.environment.platform !== 'macOS' || NotePlan.environment.buildVersion < 1100) {
      logInfo(pluginJson, `Window Sets needs NotePlan v3.9.8 or later on macOS. Stopping.`)
      return
    }

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
    const subWinDetails: Array<wth.EditorWinDetails> = NotePlan.editors
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
    logDebug(pluginJson, `moveCurrentSplitToMain starting with ${String(subWinDetails.length)} editor main/split windows`)
    if ((subWinDetails.length) < 2) {
      throw new Error("There's only 1 open window, so cannot proceed.")
    }

    // Close all current split windows
    for (const ew of subWinDetails) {
      if (ew.windowType === 'split') {
        logDebug('moveCurrentSplitToMain', `Closing split window with id ${ew.id ?? '?'}`)
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
    const originalFirstWindow = subWinDetails[0]
    logDebug('moveCurrentSplitToMain', `Attempting to open project note ${originalSplitFilename} in first split`)
    let res = openNoteInNewSplitIfNeeded(originalFirstWindow.filename)

    // Open any other remaining split windows
    if ((subWinDetails.length) > 2) {
      for (let i = 2; i < subWinDetails.length; i++) {
        const ew = subWinDetails[i]
        if (ew.windowType === 'split') {
          res = openNoteInNewSplitIfNeeded(ew.filename)
        } else {
          throw new Error(`Unexpected window type ${ew.windowType} for what should be split #${String(i)}`)
        }
      }
    }
  }
  catch (error) {
    logError('moveCurrentSplitToMain', error.message)
    await showMessage(error.message)
  }
}
/**
 * Swap the order of sub-windows in the main window.
 * If there are only two sub-windows, it swaps them.
 * If the currently selected sub-window is a split, then swap that one.
 * Otherwise ask which split to move to main.
 * Note: Here sub-window means all visible 'windows' in the main Editor window (i.e. both 'main' and 'split's). It does *not* cover separate floating windows.
 * @author @jgclark
 */
export async function swapSplitWindows(): Promise<void> {
  try {
    if (NotePlan.environment.platform !== 'macOS' || NotePlan.environment.buildVersion < 1100) {
      logInfo(pluginJson, `Window Sets needs NotePlan v3.9.8 or later on macOS. Stopping.`)
      return
    }

    // Get filename of Editor
    if (!Editor) {
      throw new Error(`There is no Editor open, so cannot continue.`)
    }

    // Get set of currently open main/split windows
    const subWinDetails: Array<wth.EditorWinDetails> = NotePlan.editors
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
    logDebug(pluginJson, `moveCurrentSplitToMain starting with ${String(subWinDetails.length)} editor sub-windows`)
    // clo(subWinDetails)
    if ((subWinDetails.length) < 2) {
      throw new Error("There's only 1 open window, so there's nothing to swap. Stopping.")
    }

    // Now work out which sub-window to swap
    let splitNumberToMove = NaN
    if (Editor.windowType === 'split') {
      const thisFilename = Editor.filename
      // Find first item in subWinDetails that matches thisFilename
      const thisWD = subWinDetails.find(obj => obj.filename === thisFilename)
      splitNumberToMove = subWinDetails.indexOf(thisWD)
      logDebug('swapSplitWindows', `Will swap sub-window #${String(splitNumberToMove)}`)
    }
    else if ((subWinDetails.length) === 2) {
      // only 2 sub-windows so just swap them
      splitNumberToMove = 1
      logDebug('swapSplitWindows', `Will swap sub-window #${String(splitNumberToMove)}`)
    }
    else {
      // Ask user which split to swap to main
      // Form list of sub-window display names
      let c = 0
      const splitOptions: Array<Object> = []
      for (const wd of subWinDetails) {
        if (wd.windowType === 'split') {
          splitOptions.push({ label: getNoteTitleFromFilename(wd.filename), value: c })
          c++
        }
      }
      const res = await chooseOption('Which sub-window do you want to swap to the first position?', splitOptions)
      // Note: if user cancels then this stops
      splitNumberToMove = res + 1
      logDebug('swapSplitWindows', `User selected to swap sub-window #${String(splitNumberToMove)} (${res.label})`)
    }

    // swap the original array to make the following easier
    const originalMainDetails = subWinDetails[0]
    subWinDetails[0] = subWinDetails[splitNumberToMove]
    subWinDetails[splitNumberToMove] = originalMainDetails

    // Close all current split windows
    for (const wd of subWinDetails) {
      if (wd.windowType === 'split') {
        logDebug('swapSplitWindows', `Closing split window with id ${wd.id ?? '?'}`)
        closeWindowFromId(wd.id ?? '?')
      }
    }

    // Constrain window to be fully on the screen while we're at it
    await constrainMainWindow()

    // Now open first sub-window as main
    const firstSubWinFilename = subWinDetails[0].filename
    const firstSubWinNoteType = subWinDetails[0].noteType
    if (firstSubWinNoteType === 'Notes') {
      logDebug('swapSplitWindows', `Attempting to open project note ${firstSubWinFilename} as first sub-window (main)`)
      const res = await Editor.openNoteByFilename(firstSubWinFilename, false)
    } else {
      const noteNPDate = getDateStringFromCalendarFilename(firstSubWinFilename)
      logDebug('swapSplitWindows', `Attempting to open calendar date ${noteNPDate} as first sub-window (main)`)
      const res = await Editor.openNoteByDateString(noteNPDate, false)
    }

    // Open all other sub-windows as splits
    if ((subWinDetails.length) > 1) {
      for (let i = 1; i < subWinDetails.length; i++) {
        const wd = subWinDetails[i]
        // logDebug('swapSplitWindows', `Attempting to open  ${wd.filename} in sub-window #${i} (split)`)
        const res = openNoteInNewSplitIfNeeded(wd.filename)
      }
    }
  }
  catch (error) {
    logError('swapSplitWindows', error.message)
    await showMessage(error.message)
  }
}
