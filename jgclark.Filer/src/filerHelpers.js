// @flow
// ----------------------------------------------------------------------------
// Helper functions for Filer plugin.
// Jonathan Clark
// last updated 2025-07-13, for v1.2.1
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { clo, logDebug, logError, logWarn } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'

//-----------------------------------------------------------------------------

const pluginID = pluginJson['plugin.id'] // was 'jgclark.Filer'

export type FilerConfig = {
  addDateBacklink: boolean,
  dateRefStyle: string,
  includeFromStartOfSection: boolean,
  allowNotePreambleBeforeHeading: boolean,
  useTightBlockDefinition: boolean,
  whereToAddInSection: string, // 'start' (default) or 'end'
  typesToFile: string, // now a choice: all but incomplete tasks
  useBlocks: boolean,
  whereToAddInNote: string, // 'start' (default) or 'end'
  ignoreNoteLinkFilerTag: string,
  copyOrMove: string, // 'copy' or 'move'. Note: not set in this plugin settings, but in object to send from wrappers to main functions, e.g. from x-callbacks
  recentDays: number,
  defaultHeadingToSyncTo: string,
  whereToAddNewHeadingInNote: string, // 'start' (default) or 'end'
  _logLevel: string,
}

export async function getFilerSettings(): Promise<any> {
  try {
    // // TODO: add to np.Shared
    // // First get global setting 'useTightBlockDefinition'
    // let useTightBlockDefinition = await getSetting('np.Shared', 'useTightBlockDefinition')
    // logDebug('getFilerSettings', `- useTightBlockDefinition: np.Globals: ${String(useTightBlockDefinition)}`)

    // Get settings
    const config: FilerConfig = await DataStore.loadJSON(`../${pluginID}/settings.json`)

    if (config == null || Object.keys(config).length === 0) {
      logError(pluginJson, `getFilerSettings() cannot find '${pluginID}' plugin settings. Stopping.`)
      await showMessage(`Cannot find settings for the '${pluginID}' plugin. Please make sure you have installed it from the Plugin Preferences pane.`)
      return
    } else {
      // clo(config, `${pluginID} settings:`)
      return config
    }
  } catch (err) {
    logError(pluginJson, `GetFilerSettings(): ${err.name}: ${err.message}`)
    await showMessage(`Error: ${err.message}`)
  }
}
