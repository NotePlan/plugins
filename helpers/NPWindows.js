// @flow
// ----------------------------------------------------------------------------
// Helpers for window management
// See also HTMLView for specifics of working in HTML
// ----------------------------------------------------------------------------

import { logDebug, logError, logInfo } from '@helpers/dev'
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
      outputLines.push(`- ${String(c)}: ${win.type}: customId:'${win.customId ?? ''}' title:'${win.title ?? ''}' filename:${win.filename ?? ''} ID:${win.id}`)
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
 * @param {string} customID 
 */
export function setHTMLWindowID(customID: string): void {
  if (NotePlan.environment.buildVersion >= 973) {
    const allHTMLWindows = NotePlan.htmlWindows
    const thisWindow = allHTMLWindows[0]
    if (thisWindow) {
      thisWindow.customId = customID
      logWindowsList()
    } else {
      logError('setHTMLWindowID', `Couldn't set customID '${customID}' for HTML window`)
    }
  } else {
    logInfo('setHTMLWindowID', `(Cannot set window title as not running v3.8.1 or later)`)
  }
}

/**
 * Is a given HTML window open? Tests by doing a case-insensitive-starts-with match using the supplied customID string.
 * @param {string} customID to look for
 * @returns {boolean}
 */
export function isHTMLWindowOpen(customID: string): boolean {
  if (NotePlan.environment.buildVersion >= 973) {
    const allHTMLWindows = NotePlan.htmlWindows
    for (const thisWin of NotePlan.editors) {
      if (caseInsensitiveStartsWith(thisWin.customID)) {
        thisWindow.customId = customID
        logDebug('isHTMLWindowOpen', `Found window '${thisWin.customID}' matching requested customID '${customID}'`)
        return true
      }
    }
  } else {
    logDebug('isHTMLWindowOpen', `Could not run test as not running v3.8.1 or later`)
  }
  return false
}
