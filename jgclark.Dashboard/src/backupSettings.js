// @flow
//-----------------------------------------------------------------------------
// Last updated 2025-04-24 for v2.2.2
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'

//-----------------------------------------------------------------


/**
 * Backup Dashboard settings.json file to a dated version in the plugin data folder.
 */
export async function backupSettings() {
  try {
    const pluginID = pluginJson['plugin.id']
    const pluginSettings = await DataStore.loadJSON(`../${pluginID}/settings.json`)
    const backupFilename = `settings_backup_${moment().format('YYYYMMDDHHmmss')}.json`
    const backupPath = `../${pluginID}/${backupFilename}`
    await DataStore.saveJSON(pluginSettings, backupPath)
    await showMessage(`Backup of Dashboard settings saved to ${backupPath}`, 'OK', 'Dashboard Settings Backup')
    logInfo('backupSettings', `Backup of Dashboard settings saved to ${backupPath}`)
  } catch (error) {
    await showMessage(`Error trying to Backup Dashboard settings. Please see Plugin Console log for details.`, 'OK', 'Dashboard Settings Backup')
    logError('backupSettings', `Error: ${error.message}`)
  }
}
