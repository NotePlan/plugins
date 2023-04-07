// @flow
// ----------------------------------------------------------------------------
// Helpers for window management
// See also HTMLView for specifics of working in HTML
// ----------------------------------------------------------------------------

import { logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { caseInsensitiveStartsWith } from '@helpers/search'

/**
 * List all open windows to the plugin console log.
 * Uses API introduced in NP 3.8.1
 * @author @jgclark
 */
export function logWindowsList(): void {
  const outputLines = []
  if (NotePlan.environment.buildVersion >= 973) {
    let c = 0
    for (const win of NotePlan.editors) {
      outputLines.push(`- ${String(c)}: ${win.type}: customId:'${win.customId ?? ''}' filename:${win.filename ?? ''} ID:${win.id}`)
      c++
    }
    c = 0
    for (const win of NotePlan.htmlWindows) {
      outputLines.push(`- ${String(c)}: ${win.type}: customId:'${win.customId ?? ''}' title:'${win.title ?? 'n/a'}' filename:${win.filename ?? 'n/a'} ID:${win.id}`)
      c++
    }
    outputLines.unshift(`${outputLines.length} Windows:`)
    logInfo('logWindowsList', outputLines.join('\n'))
  } else {
    logInfo('logWindowsList', `(Cannot list windows as not running v3.8.1 or later)`)
  }
}

/**
 * Set customId for the (single) HTML window
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
 * Is a given HTML window open? Tests by doing a case-insensitive-starts-with match using the supplied customId string.
 * @author @jgclark
 * @param {string} customId to look for
 * @returns {boolean}
 */
export function isHTMLWindowOpen(customId: string): boolean {
  if (NotePlan.environment.buildVersion >= 973) {
    const allHTMLWindows = NotePlan.htmlWindows
    for (const thisWin of allHTMLWindows) {
      if (caseInsensitiveStartsWith(customId, thisWin.customId)) {
        thisWin.customId = customId
        logDebug('isHTMLWindowOpen', `Found window '${thisWin.customId}' matching requested customId '${customId}'`)
        return true
      }
    }
  } else {
    logDebug('isHTMLWindowOpen', `Could not run test as not running v3.8.1 or later`)
  }
  return false
}

/**
 * Set customId for the given Editor window
 * Note: Hopefully in time, this will be removed, when @EduardMe rolls it into an API call
 * @author @jgclark
 * @param {string} openNoteFilename, i.e. note that is open in an Editor that we're trying to set customId for
 * @param {string} customId 
 */
export function setEditorWindowID(openNoteFilename: string, customId: string): void {
  if (NotePlan.environment.buildVersion >= 973) {
    const allEditorWindows = NotePlan.editors
    for (const thisEditorWindow of allEditorWindows) {
      if (thisEditorWindow.filename === openNoteFilename) {
        thisEditorWindow.customId = customId
        logDebug('setEditorWindowID', `Set customId '${customId}' for filename ${openNoteFilename}`)
        // logWindowsList()
        return
      }
    }
    logError('setEditorWindowID', `Couldn't match '${openNoteFilename}' to an Editor window, so can't set customId '${customId}' for Editor`)
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
 * FIXME(EduardMe): currently (b983) not working as expected, as HTML entities appear not to be deleted when they should be.
 * @param {string} customId
 * @returns {boolean} true if we have given focus to an existing window
 */
export function focusHTMLWindowIfAvailable(customId: string): boolean {
  if (NotePlan.environment.buildVersion >= 973) {
    // TODO: until Eduard fixes this, always return false
    logInfo('focusHTMLWindowIfAvailable', `(Currently no check run as there's an API bug.)`)
    // const allHTMLWindows = NotePlan.htmlWindows
    // for (const thisWindow of allHTMLWindows) {
    //   if (thisWindow.customId === customId) {
    //     thisWindow.focus()
    //     logInfo('focusHTMLWindowIfAvailable', `Focused HTML window '${thisWindow.customId}'`)
    //     return true
    //   }
    // }
    // logInfo('focusHTMLWindowIfAvailable', `No HTML window with '${customId}' is open`)
  } else {
    logInfo('focusHTMLWindowIfAvailable', `(Cannot find window Ids as not running v3.8.1 or later)`)
  }
  return false
}

export async function openNoteInNewWindowIfNeeded(filename: string): Promise<boolean> {
  const res = await Editor.openNoteByFilename(filename, true, 0, 0, false, true) // create new floating (and the note if needed)
  if (res) {
    logDebug('openWindowSet', `Opened floating window pane '${filename}'`)
  } else {
    logWarn('openWindowSet', `Failed to open floating window '${filename}'`)
  }
  return !!res
}

export async function openNoteInNewSplitIfNeeded(filename: string): Promise<boolean> {
  const res = await Editor.openNoteByFilename(filename, false, 0, 0, true, true) // create new split (and the note if needed) // TODO(@EduardMe): this doesn't create an empty note if needed for Calendar notes
  if (res) {
    logDebug('openWindowSet', `Opened split window '${filename}'`)
  } else {
    logWarn('openWindowSet', `Failed to open split window '${filename}'`)
  }
  return !!res
}
