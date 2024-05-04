// @flow

// TODO: go through all of this

// ----------------------------------------------------------------------------
// Dashboard plugin for NotePlan
// Jonathan Clark
// last updated 11.4.2024 for v1.0.0, @jgclark
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
// import { showDashboard } from './HTMLGeneratorGrid'

/**
 * Command Exports
 */
export { editSettings } from '@helpers/NPSettings'

// export {
//   addTask, addChecklist,
//   refreshDashboard,
//   showDashboard,
// } from './demoDashboard'

/**
 * Other imports/exports
 */
// eslint-disable-next-line import/order
export {
  // addTask, addChecklist,
  showDashboardReact,
  onMessageFromHTMLView,
  showDemoDashboard,
} from './reactMain.js'

export { onUpdateOrInstall, init, onSettingsUpdated, versionCheck } from './NPHooks'
