// @flow
//-----------------------------------------------------------------------------
// bannerClickHandlers.js
// Handler functions for banner test clicks that come over the bridge.
// The routing is in pluginToHTMLBridge.js/bridgeClickDashboardItem()
// Last updated 2025-12-16 for v2.4.0.b2 by @jgclark
//-----------------------------------------------------------------------------

import { WEBVIEW_WINDOW_ID } from './constants'
import { handlerResult } from './dashboardHelpers'
import type { MessageDataObject, TBridgeClickHandlerResult } from './types'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { sendBannerMessage } from '@helpers/HTMLView'

/********************************************************************************
 *                                   HANDLERS
- Handlers should use the standard return type of TBridgeClickHandlerResult
- handlerResult() can be used to create the result object
- Types are defined in types.js
    - type TActionOnReturn = 'UPDATE_CONTENT' | 'REMOVE_LINE' | 'REFRESH_JSON' | 'START_DELAYED_REFRESH_TIMER' etc.
 *********************************************************************************/

/**
 * Handle a banner test click
 * @param {MessageDataObject} data
 * @returns {TBridgeClickHandlerResult}
 */
export async function handleBannerTestClick(
  data: MessageDataObject,
): Promise<TBridgeClickHandlerResult> {
  try {
    const { actionType, sectionCodes } = data
    logInfo('handleBannerTestClick', `actionType: ${actionType}`)
    switch (actionType) {
      case 'testBannerInfo':
        await sendBannerMessage(WEBVIEW_WINDOW_ID, `Showing info banner: current sections are ${String(sectionCodes)}`, 'INFO', 5000)
        break
      case 'testBannerError':
        await sendBannerMessage(WEBVIEW_WINDOW_ID, `Test error banner`, 'ERROR')
        break
      case 'testBannerWarning':
        await sendBannerMessage(WEBVIEW_WINDOW_ID, `Test warning banner`, 'WARN')
        break
      case 'testRemoveBanner':
        await sendBannerMessage(WEBVIEW_WINDOW_ID, ``, 'REMOVE')
        break
      default:
        logError('handleBannerTestClick', `Unknown actionType: ${actionType}`)
        return handlerResult(true)
    }
    return handlerResult(true)
  }
  catch (error) {
    logError('handleBannerTestClick', error.message)
    await sendBannerMessage(WEBVIEW_WINDOW_ID, `Error in handleBannerTestClick: ${error.message}`, 'ERROR')
    return handlerResult(false, [], { errorMsg: error.message, errorMessageLevel: 'ERROR' })
  }
}
