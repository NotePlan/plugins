// @flow
// ----------------------------------------------------------------------------
// Helpers for window management
// See also HTMLView for specifics of working in HTML
// ----------------------------------------------------------------------------

import { logDebug, logError, logInfo } from '@helpers/dev'

/**
 * List all open windows to the plugin console log.
 * Uses API introduced in NP 3.8.1
 * @author @jgclark
 */
export function logWindows(): void {
  const outputLines = []
  if (NotePlan.environment.buildVersion >= 973) {
    for (const win of NotePlan.editors) {
      outputLines.push(`- ${win.type}: ID:${win.id} customId:'${win.customId ?? ''}' filename:${win.filename ?? ''}`)
    }
    for (const win of NotePlan.htmlWindows) {
      outputLines.push(`- ${win.type}: ID:${win.id} customId:'${win.customId ?? ''}' filename:${win.filename ?? ''} title:'${win.title ?? ''}'`)
    }
    outputLines.unshift(`${outputLines.length} Windows:`)
    logInfo('logWindows', outputLines.join('\n'))
  } else {
    logInfo(`(Cannot list windows as not running v3.8.1 or later)`)
  }
}
