// @flow
// ----------------------------------------------------------------------------
// Helpers for window management
// See also HTMLView for specifics of working in HTML
// ----------------------------------------------------------------------------

import { clo, logDebug, logError, logInfo } from '@helpers/dev'
import { caseInsensitiveMatch, caseInsensitiveStartsWith } from '@helpers/search'

/**
 * Return string version of Rect's x/y/width/height attributes
 * @param {Rect} rect
 * @returns {string}
 */
export function rectToString(rect: Rect): string {
  return `X${String(rect.x)},Y${String(rect.x)},w${String(rect.width)},h${String(rect.height)}`
}

/**
 * List all open windows to the plugin console log.
 * Uses API introduced in NP 3.8.1, and extended in 3.9.1 to add .rect.
 * @author @jgclark
 */
export function logWindowsList(): void {
  const outputLines = []
  if (NotePlan.environment.buildVersion >= 1020) {
    let c = 0
    for (const win of NotePlan.editors) {
      outputLines.push(`- ${String(c)}: ${win.type}: customId:'${win.customId ?? ''}' filename:${win.filename ?? ''} ID:${win.id} Rect:${rectToString(win.windowRect)}`)
      c++
    }
    c = 0
    for (const win of NotePlan.htmlWindows) {
      outputLines.push(`- ${String(c)}: ${win.type}: customId:'${win.customId ?? ''}' ID:${win.id} Rect:${rectToString(win.windowRect)}`)
      c++
    }
    outputLines.unshift(`${outputLines.length} Windows:`)
    logInfo('logWindowsList', outputLines.join('\n'))
  } else if (NotePlan.environment.buildVersion >= 973) {
    let c = 0
    for (const win of NotePlan.editors) {
      outputLines.push(`- ${String(c)}: ${win.type}: customId:'${win.customId ?? ''}' filename:${win.filename ?? ''} ID:${win.id}`)
      c++
    }
    c = 0
    for (const win of NotePlan.htmlWindows) {
      outputLines.push(`- ${String(c)}: ${win.type}: customId:'${win.customId ?? ''}' ID:${win.id}`)
      c++
    }
    outputLines.unshift(`${outputLines.length} Windows:`)
    logInfo('logWindowsList', outputLines.join('\n'))
  } else {
    logInfo('logWindowsList', `(Cannot list windows as not running v3.8.1 or later)`)
  }
}

/**
 * Set customID for the (single) HTML window
 * Note: In time, this will be removed, when @EduardMe rolls it into .showWindow() API
 * @author @jgclark
 * @param {string} customId
 */
export function setHTMLWindowID(customId: string): void {
  if (NotePlan.environment.buildVersion >= 973) {
    const allHTMLWindows = NotePlan.htmlWindows
    const thisWindow = allHTMLWindows[0]
    if (thisWindow) {
      thisWindow.customId = customId
      logWindowsList()
    } else {
      logError('setHTMLWindowID', `Couldn't set customId '${customId}' for HTML window`)
    }
  } else {
    logInfo('setHTMLWindowID', `(Cannot set window title as not running v3.8.1 or later)`)
  }
}

/**
 * Is a given HTML window open? Tests by doing a case-insensitive-starts-with-match or case-insensitive-match using the supplied customId string.
 * @author @jgclark
 * @param {string} customId to look for
 * @returns {boolean}
 */
export function isHTMLWindowOpen(customId: string): boolean {
  if (NotePlan.environment.buildVersion >= 973) {
    const allHTMLWindows = NotePlan.htmlWindows
    for (const thisWin of allHTMLWindows) {
      if (caseInsensitiveMatch(customId, thisWin.customId) || caseInsensitiveStartsWith(customId, thisWin.customId)) {
        thisWin.customId = customId
        // logDebug('isHTMLWindowOpen', `Found window '${thisWin.customId}' matching requested customID '${customID}'`)
        return true
      } else {
        // logDebug('isHTMLWindowOpen', `Found window '${thisWin.customId}' *NOT* matching requested customID '${customID}'`)
      }
    }
  } else {
    logDebug('isHTMLWindowOpen', `Could not run test as not running v3.8.1 or later`)
  }
  return false
}

/**
 * Set customID for the given Editor window
 * Note: Hopefully in time, this will be removed, when @EduardMe rolls it into an API call
 * @author @jgclark
 * @param {string} openNoteFilename, i.e. note that is open in an Editor that we're trying to set customID for
 * @param {string} customID
 */
export function setEditorWindowID(openNoteFilename: string, customID: string): void {
  if (NotePlan.environment.buildVersion >= 973) {
    const allEditorWindows = NotePlan.editors
    for (const thisEditorWindow of allEditorWindows) {
      if (thisEditorWindow.filename === openNoteFilename) {
        thisEditorWindow.customId = customID
        logDebug('setEditorWindowID', `Set customID '${customID}' for filename ${openNoteFilename}`)
        // logWindowsList()
        return
      }
    }
    logError('setEditorWindowID', `Couldn't match '${openNoteFilename}' to an Editor window, so can't set customID '${customID}' for Editor`)
  } else {
    logInfo('setEditorWindowID', `Cannot set window title as not running v3.8.1 or later`)
  }
}

/**
 * Tests whether the provided filename is open in an Editor window.
 * @author @jgclark
 * @param {string} openNoteFilename
 * @returns {boolean}
 */
export function noteOpenInEditor(openNoteFilename: string): boolean {
  if (NotePlan.environment.buildVersion >= 973) {
    const allEditorWindows = NotePlan.editors
    for (const thisEditorWindow of allEditorWindows) {
      if (thisEditorWindow.filename === openNoteFilename) {
        return true
      }
    }
    return false
  } else {
    logInfo('noteNotOpenInEditor', `Cannot test if note is open in Editor as not running v3.8.1 or later`)
    return false
  }
}

/**
 * Returns the Editor object that matches a given filename (if available)
 * @author @jgclark
 * @param {string} openNoteFilename to find in list of open Editor windows
 * @returns {TEditor} the matching open Editor window
 */
export function getOpenEditorFromFilename(openNoteFilename: string): TEditor | false {
  if (NotePlan.environment.buildVersion >= 973) {
    const allEditorWindows = NotePlan.editors
    for (const thisEditorWindow of allEditorWindows) {
      if (thisEditorWindow.filename === openNoteFilename) {
        return thisEditorWindow
      }
    }
  } else {
    logInfo('getOpenEditorFromFilename', `Cannot test if note is open in Editor as not running v3.8.1 or later`)
  }
  return false
}

/**
 * If the customId matches an open HTML window, then simply focus it, and return true.
 * @param {string} customID
 * @returns {boolean} true if we have given focus to an existing window
 */
export function focusHTMLWindowIfAvailable(customId: string): boolean {
  if (NotePlan.environment.buildVersion >= 973) {
    logInfo('focusHTMLWindowIfAvailable', `(Currently no check run as there's an API bug.)`)
    const allHTMLWindows = NotePlan.htmlWindows
    for (const thisWindow of allHTMLWindows) {
      if (thisWindow.customId === customId) {
        thisWindow.focus()
        logInfo('focusHTMLWindowIfAvailable', `Focused HTML window '${thisWindow.customId}'`)
        return true
      }
    }
    logInfo('focusHTMLWindowIfAvailable', `No HTML window with '${customId}' is open`)
  } else {
    logInfo('focusHTMLWindowIfAvailable', `(Cannot find window Ids as not running v3.8.1 or later)`)
  }
  return false
}

/**
 * Save the Rect (x/y/w/h) of the given window, given by its ID, to the local device's NP preferences store.
 * @param {string} windowID
 */
export function storeWindowRect(windowID: string): void {
  if (NotePlan.environment.buildVersion < 1019) {
    logDebug('storeWindowRect', `Cannot save window rect as not running v3.9.1 or later.`)
    return
  }
  // TODO: ...
  const windowRect: Rect = win.windowRect
  const prefName = `HTMLWinRect_${windowID}`
  DataStore.setPreference(prefName, windowRect)
  logDebug('storeWindowRect', `Saved Rect to ${prefName}`)
}

/**
 * Get the Rect (x/y/w/h) of the given window, given by its ID, from the local device's NP preferences store.
 * @param {string} windowID
 * @returns {Rect} the Rect (x/y/w/h)
 */
export function getWindowRect(windowID: string): Rect | false {
  if (NotePlan.environment.buildVersion < 1019) {
    logDebug('getWindowRect', `Cannot save window rect as not running v3.9.1 or later.`)
    return false
  }
  const prefName = `HTMLWinRect_${windowID}`
  const windowRect: Rect = DataStore.preference(prefName)
  clo(windowRect, `Retrieved Rect for ${prefName}`)
  return windowRect
}

/**
 * Sets the height of the first HTML window in NotePlan to the given height value.
 * @param {number} [height=700] - The height value to set the window to. Defaults to 700.
 */
export function setHTMLWinHeight(height: number = 700): void {
  const thisWin = NotePlan.htmlWindows[0]
  const thisWinRect = thisWin.windowRect
  logDebug('setHTMLWinHeight', `Try to set height to ${String(height)} for HTML window '${thisWin.customId ?? ''}'`)
  thisWinRect.height = height
  logDebug('setHTMLWinHeight ->', rectToString(thisWinRect))
}
