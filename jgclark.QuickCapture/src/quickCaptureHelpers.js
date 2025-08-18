// @flow
// ----------------------------------------------------------------------------
// Helpers for QuickCapture plugin for NotePlan
// by Jonathan Clark
// last update 2025-07-28 for v0.17.0 by @jgclark
// ----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { clo, logInfo, logDebug, logError, logTimer, logWarn } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'

//----------------------------------------------------------------------------
// helpers

export type QCConfigType = {
  inboxLocation: string,
  inboxTitle: string,
  inboxHeading: string,
  textToAppendToTasks: string,
  textToAppendToJots: string,
  addInboxPosition: string,
  headingLevel: number,
  journalHeading: string,
  shouldAppend: boolean, // special case set in getQuickCaptureSettings()
  _logLevel: string,
}

/**
 * Get QuickCapture settings
 * @param {boolean} useDefaultsIfNecessary?
 * @author @jgclark
 */
export async function getQuickCaptureSettings(useDefaultsIfNecessary: boolean = true): Promise<any> {
  try {
    // Get settings
    let config: QCConfigType = await DataStore.loadJSON('../jgclark.QuickCapture/settings.json')

    if (config == null || Object.keys(config).length === 0) {
      if (useDefaultsIfNecessary) {
        logInfo('QuickCapture', 'No QuickCapture settings found, but will use defaults instead.')
        await showMessage(`Cannot find settings for the 'QuickCapture' plugin. I will use defaults instead, but to avoid this, please install it in the Plugin Preferences.`)
        config = {
          inboxLocation: 'Inbox',
          inboxTitle: 'Inbox',
          textToAppendToTasks: '',
          textToAppendToJots: '',
          addInboxPosition: 'append',
          headingLevel: 2,
          journalHeading: '',
          shouldAppend: false,
          _logLevel: 'info',
        }
      } else {
        logWarn('QuickCapture', 'No QuickCapture settings found')
        await showMessage(`Cannot find settings for the 'QuickCapture' plugin. Please make sure you have installed it in the Plugin Preferences.`)
        return
      }
    } else {
      // Additionally set 'shouldAppend' from earlier setting 'addInboxPosition'
      config.shouldAppend = config.addInboxPosition === 'append'
      // clo(config, `QuickCapture Settings:`)
      return config
    }
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}
