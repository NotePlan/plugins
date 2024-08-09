// @flow
// ----------------------------------------------------------------------------
// Dashboard plugin for NotePlan
// Jonathan Clark
// last updated 2024-08-07 for v2.1.0.a5, @jgclark
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

export {
  decideWhetherToUpdateDashboard,
  refreshProjectSection, // TODO: remove me in time
  refreshSectionByCode,
} from './dashboardHooks.js'

export {
  addNewPerspective,
  deletePerspective,
  deletePerspectiveSettings,
} from './perspectiveHelpers.js'

export {
  showDashboardReact,
  onMessageFromHTMLView,
  showDemoDashboard,
  setSetting,
  setSettings,
  makeSettingsAsCallback,
} from './reactMain.js'

export { onUpdateOrInstall, init, onSettingsUpdated, versionCheck } from './NPHooks'
