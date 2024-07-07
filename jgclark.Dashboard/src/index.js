// @flow
// ----------------------------------------------------------------------------
// Dashboard plugin for NotePlan
// Jonathan Clark
// last updated 7.7.2024 for v2.0.1, @jgclark
// ----------------------------------------------------------------------------

/**
 * Imports
 */
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'

/**
 * Command Exports
 */
export { editSettings } from '@helpers/NPSettings'

/**
 * Other imports/exports
 */

export { decideWhetherToUpdateDashboard } from './dashboardTriggers.js'

export {
  showDashboardReact,
  onMessageFromHTMLView,
  showDemoDashboard,
  setSetting,
  setSettings,
  makeSettingsAsCallback,
} from './reactMain.js'

export { onUpdateOrInstall, init, onSettingsUpdated, versionCheck } from './NPHooks'
