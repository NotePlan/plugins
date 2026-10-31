// @flow
//--------------------------------------------------------------------------
// Request Handler: getReminderAddOptions
// List titles (and whether add is supported) for the topbar Reminder choice.
//--------------------------------------------------------------------------

import { getDashboardSettings } from '../dashboardHelpers'
import { reminderItems } from '../demoData'
import { reminderListTitlesFromSectionItems } from '../reminderAddForm'
import { getReminderListsForConfig } from '../reminderMapping'
import { logDebug, logError } from '@helpers/dev'
import { usersVersionHas } from '@helpers/NPVersions'
import type { RequestResponse } from './addTaskToNote'

/**
 * @param {{ demoMode?: boolean }} params
 * @param {any} pluginJson
 * @returns {Promise<RequestResponse>}
 */
export async function getReminderAddOptions(params: { demoMode?: boolean }, pluginJson: any): Promise<RequestResponse> {
  try {
    const demoMode = Boolean(params && params.demoMode)
    if (!usersVersionHas('addRemindersSupport')) {
      logDebug('requestHandlers/getReminderAddOptions', 'addRemindersSupport is not available')
      return { success: true, data: { canAdd: false, listTitles: [] } }
    }

    let listTitles: Array<string> = []
    if (demoMode) {
      listTitles = reminderListTitlesFromSectionItems(reminderItems)
    } else {
      const config = await getDashboardSettings()
      if (!config) {
        return { success: false, message: 'Failed to load dashboard settings', data: null }
      }
      // titles are already in includedReminderLists order (or NotePlan's order when that setting is blank)
      listTitles = getReminderListsForConfig(config).titles
    }

    logDebug('requestHandlers/getReminderAddOptions', `demo=${String(demoMode)} lists=${listTitles.join(', ') || '(none)'}`)
    return {
      success: true,
      data: { canAdd: listTitles.length > 0, listTitles },
    }
  } catch (error) {
    logError(pluginJson, `requestHandlers/getReminderAddOptions ERROR: ${error.message}`)
    return {
      success: false,
      message: `Error loading reminder lists: ${error.message}`,
      data: null,
    }
  }
}
