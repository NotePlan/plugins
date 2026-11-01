// @flow
//--------------------------------------------------------------------------
// Request Handler: addReminder
// Creates an Apple Reminder from the add-anything dialog (REQUEST/RESPONSE).
// React then refreshes the section(s) from doAddReminder / sectionCodesForNewReminder.
//--------------------------------------------------------------------------

import { doAddReminder } from '../clickHandlers'
import type { RequestResponse } from './addTaskToNote'
import { logDebug, logError } from '@helpers/dev'

/**
 * @param {{ text?: string, list?: string, date?: mixed, time?: string }} params
 * @param {any} pluginJson
 * @returns {Promise<RequestResponse>}
 */
export async function addReminder(
  params: { text?: string, list?: string, date?: mixed, time?: string },
  pluginJson: any,
): Promise<RequestResponse> {
  try {
    const text = params && typeof params.text === 'string' ? params.text : ''
    const list = params && typeof params.list === 'string' ? params.list : ''
    logDebug('requestHandlers/addReminder', `Starting list="${list}" textLen=${String(text.length)}`)

    const result = await doAddReminder({
      actionType: 'addReminder',
      userInputObj: {
        text,
        list,
        date: params && params.date != null ? params.date : '',
        time: params && typeof params.time === 'string' ? params.time : '',
      },
    })

    if (result && result.success) {
      const listLabel = list.trim() || 'Reminders'
      const sectionCodes = Array.isArray(result.sectionCodes) ? result.sectionCodes : []
      return {
        success: true,
        message: `Reminder added to "${listLabel}"`,
        data: {
          list: listLabel,
          sectionCodes,
        },
      }
    }

    return {
      success: false,
      message: (result && result.errorMsg) || 'Failed to add reminder',
      data: null,
    }
  } catch (error) {
    logError(pluginJson, `requestHandlers/addReminder ERROR: ${error.message}`)
    return {
      success: false,
      message: `Error adding reminder: ${error.message}`,
      data: null,
    }
  }
}
