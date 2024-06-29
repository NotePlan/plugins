// @flow

// ----------------------------------------------------------------------------
// Dashboard plugin for NotePlan
// Jonathan Clark
// last updated 13.5.2024 for v2.0.0, @jgclark
// ----------------------------------------------------------------------------

/**
 * Imports
 */
// allow changes in plugin.json to trigger recompilation
// import pluginJson from '../plugin.json'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
// // import { getPluginJson, pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
// import { editSettings } from '@helpers/NPSettings'
// import { isHTMLWindowOpen, logWindowsList } from '@helpers/NPWindows'
// import { showMessage } from '@helpers/userInput'

/**
 * Command Exports
 */
export { editSettings } from '@helpers/NPSettings'

/**
 * Other imports/exports
 */
// eslint-disable-next-line import/order
export {
  showDashboardReact,
  onMessageFromHTMLView,
  showDemoDashboard,
} from './reactMain.js'

export { decideWhetherToUpdateDashboard } from './dashboardTriggers.js'

export { onUpdateOrInstall, init, onSettingsUpdated, versionCheck } from './NPHooks'

// TODO(later): Remove 
export { buildListOfDoneTasksToday } from './countDoneTasks.js'