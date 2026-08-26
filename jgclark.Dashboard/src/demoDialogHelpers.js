// @flow
//--------------------------------------------------------------------------
// Hidden demo/screenshot helpers: open Task / Reminder / Project edit dialogs
// by section item ID on the already-open Dashboard window.
// Last updated 2026-08-26 for v2.4.3 by @jgclark + @CursorAI
//--------------------------------------------------------------------------

import { WEBVIEW_WINDOW_ID } from './constants'
import { setPluginData } from './dashboardHelpers'
import { logError, logInfo, logWarn } from '@helpers/dev'
import { isHTMLWindowOpen } from '@helpers/NPWindows'

/**
 * Ask the open Dashboard React window to open the edit dialog for a section item ID.
 * React finds the item in pluginData.sections and routes to DialogForTaskItems /
 * DialogForReminderItems / DialogForProjectItems from item.itemType.
 * Note: avoids showMessage (blocks JSContext) so x-callback / MCP automation can run unattended.
 * @param {string} itemID - e.g. `REM-3`, `0-0`, `PROJACT-0`
 * @param {string} caller - log label for the calling command
 * @returns {Promise<void>}
 */
async function requestOpenDialogForItemID(itemID: string, caller: string): Promise<void> {
  const trimmed = (itemID || '').trim()
  if (!trimmed) {
    logError(caller, 'No item ID (arg0) provided. Pass the section item ID as arg0 (e.g. REM-3).')
    return
  }
  if (!isHTMLWindowOpen(WEBVIEW_WINDOW_ID)) {
    logWarn(caller, `Dashboard window '${WEBVIEW_WINDOW_ID}' is not open; open Demo Dashboard first`)
    return
  }
  logInfo(caller, `Requesting open dialog for item ID="${trimmed}"`)
  await setPluginData({ openDialogForItemID: trimmed }, `Open dialog for item ${trimmed}`)
}

/**
 * Hidden command: open DialogForTaskItems for the given section item ID (arg0).
 * @param {string} itemID
 * @returns {Promise<void>}
 */
export async function openDemoTaskDialog(itemID: string = ''): Promise<void> {
  await requestOpenDialogForItemID(itemID, 'openDemoTaskDialog')
}

/**
 * Hidden command: open DialogForReminderItems for the given section item ID (arg0).
 * Defaults to demo item `REM-3` ("Pick up study books") when arg0 is omitted.
 * @param {string} itemID
 * @returns {Promise<void>}
 */
export async function openDemoReminderDialog(itemID: string = 'REM-3'): Promise<void> {
  await requestOpenDialogForItemID(itemID || 'REM-3', 'openDemoReminderDialog')
}

/**
 * Hidden command: open DialogForProjectItems for the given section item ID (arg0).
 * @param {string} itemID
 * @returns {Promise<void>}
 */
export async function openDemoProjectDialog(itemID: string = ''): Promise<void> {
  await requestOpenDialogForItemID(itemID, 'openDemoProjectDialog')
}
