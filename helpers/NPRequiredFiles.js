// @flow

import { checkForWantedResources } from '../np.Shared/src/index.js'
import { clo, JSP, logDebug, logError, logWarn } from '@helpers/dev'
import { showMessage, showMessageYesNo } from '@helpers/userInput'

export async function checkForRequiredSharedFiles(pluginJson: any): Promise<void> {
  try {
    const thisPluginID = pluginJson['plugin.id']
    logDebug(`${thisPluginID}/checkForRequiredSharedFiles`, `Starting...`)
    const sharedPluginID = "np.Shared"
    const sharedPluginName = "Shared Resources"
    const wantedFileList = pluginJson['plugin.requiredSharedFiles']
    logDebug(`${thisPluginID}/checkForRequiredSharedFiles`, `${String(wantedFileList.length)} wanted files: ${String(wantedFileList)}`)
    const wantedRes = await checkForWantedResources(wantedFileList)
    if (typeof wantedRes === 'number' && wantedRes >= wantedFileList.length) {
      // plugin np.Shared is loaded, and is providing all the wanted resources
      logDebug(`${thisPluginID}/checkForRequiredSharedFiles`, `plugin np.Shared is loaded 😄 and provides all the ${String(wantedFileList.length)} wanted files`)
    } else if (typeof wantedRes === 'number' && wantedRes < wantedFileList.length) {
      // plugin np.Shared is loaded, but isn't providing all the wanted resources
      logWarn(
        `thisPluginID`,
        `plugin np.Shared is loaded 😄, but is only providing ${String(wantedRes)} out of ${String(wantedFileList.length)} wanted files, so there might be display issues 😳`,
      )
    } else if (wantedRes) {
      // plugin np.Shared is loaded
      logDebug(`${thisPluginID}/checkForRequiredSharedFiles`, `plugin np.Shared is loaded 😄; no further checking done`)
    } else {
      // plugin np.Shared is not loaded
      logWarn(`${thisPluginID}/checkForRequiredSharedFiles`, `plugin np.Shared isn't loaded 🥵, so icons probably won't display`)
      const res = await showMessageYesNo(`It looks like you haven't installed the '${sharedPluginName}' plugin, which is required for the Dashboard to operate properly. Would you like me to install it for you?`, ['Yes', 'No'], 'Dashboard plugin problem')
      if (res === 'Yes') {
        const pluginObjects = await DataStore.listPlugins(true) ?? []
        const pluginObject = pluginObjects?.find((p) => p.id === sharedPluginID)
        if (pluginObject) {
          // clo(pluginObject, `installPlugin "${sharedPluginID}"`)
          await DataStore.installPlugin(pluginObject, true)
        } else {
          await showMessage(`Could not install '${sharedPluginName}' plugin: not found in repository. If this persists, please contact NotePlan support.`)
        }
      }
    }
  } catch (err) {
    logError(pluginJson, `checkForRquiredSharedFiles():) ${err.name}: ${err.message}`)
  }
}
