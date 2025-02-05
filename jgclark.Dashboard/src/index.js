// @flow
// ----------------------------------------------------------------------------
// Dashboard plugin for NotePlan
// Jonathan Clark
// last updated for v2.1.8
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
  refreshSectionByCode,
} from './dashboardHooks.js'

export { generateDiagnosticsFile } from './diagnosticGenerator'

export {
  addNewPerspective,
  deletePerspective,
  deleteAllNamedPerspectiveSettings,
  getPerspectiveSettings, // TODO(later): remove
  logPerspectiveFiltering,
  updateCurrentPerspectiveDef,
} from './perspectiveHelpers.js'

export {
  showDashboardReact,
  onMessageFromHTMLView,
  showDemoDashboard,
  showPerspective,
  showSections,
  setSetting,
  setSettings,
  makeSettingsAsCallback,
  reactWindowInitialised,
} from './reactMain.js'

export { onUpdateOrInstall, init, onSettingsUpdated, versionCheck } from './NPHooks'
