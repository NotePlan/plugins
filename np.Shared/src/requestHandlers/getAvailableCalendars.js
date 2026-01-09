// @flow
//--------------------------------------------------------------------------
// Shared Request Handler: getAvailableCalendars
// Returns list of available calendar titles
//--------------------------------------------------------------------------

import { logDebug, logError } from '@helpers/dev'

// RequestResponse type definition
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

/**
 * Get list of available calendar titles
 * NOTE: There is a known bug in NotePlan's Calendar.availableCalendarTitles() API that causes
 * it to only return calendars with write access, even when writeOnly=false. This means the
 * list may be incomplete and missing read-only calendars that NotePlan can still access events from.
 * @param {Object} params - Request parameters
 * @param {boolean} params.writeOnly - If true, only return calendars with write access (default: false)
 * @param {Object} pluginJson - Plugin JSON object for logging
 * @returns {RequestResponse}
 */
export function getAvailableCalendars(params: { writeOnly?: boolean } = {}, pluginJson: any): RequestResponse {
  const startTime: number = Date.now()
  try {
    const writeOnly = params.writeOnly ?? false
    logDebug(pluginJson, `[np.Shared/requestHandlers] getAvailableCalendars START: writeOnly=${String(writeOnly)}`)

    // NOTE: Bug in NotePlan API - availableCalendarTitles may only return writeable calendars
    // even when writeOnly=false. This is why we offer "All NotePlan Enabled Calendars" option.
    // Note: Flow type definition shows 2 required params, but API accepts 1 param (2nd param optional from v3.20.0)
    // This matches the implementation in Forms plugin which works correctly at runtime
    // $FlowFixMe[incompatible-call] - Flow type definition incorrectly shows 2 required params, but API accepts 1 param (2nd is optional)
    const calendars: Array<string> = (Calendar.availableCalendarTitles(writeOnly || false): any)

    const totalElapsed: number = Date.now() - startTime
    logDebug(pluginJson, `[np.Shared/requestHandlers] getAvailableCalendars COMPLETE: totalElapsed=${totalElapsed}ms, found=${calendars.length} calendars`)

    return {
      success: true,
      data: calendars,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[np.Shared/requestHandlers] getAvailableCalendars ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get calendars: ${error.message}`,
      data: null,
    }
  }
}

