// @flow
//-----------------------------------------------------------------------------
// Tidy plugin
// Jonathan Clark
// Last updated 29.12.2022 for v0.1.0, @jgclark
//-----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
import { JSP, logError, logInfo } from '@helpers/dev'

export {
  logNotesChangedInInterval,
  removeDoneMarkers,
  removeSectionFromAllNotes,
  removeSectionFromRecentNotes,
  removeDoneTimeParts,
} from './main'

/**
 * Other imports/exports
 */
// eslint-disable-next-line import/order
export { onUpdateOrInstall, init, onSettingsUpdated } from './triggers-hooks'
// export { onOpen, onEditorWillSave } from './NPTriggers-Hooks'
