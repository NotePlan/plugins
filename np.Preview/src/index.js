// @flow

//---------------------------------------------------------------
// Render notes to HTML, including Mermaid and MathML.
// by Jonathan Clark
// v0.3.0, 1.6.2023
//---------------------------------------------------------------

// export {
//   testMermaid1,
//   testMermaid2,
//   testMermaid3,
//   testMermaid4
// } from './mermaidTests'

// export {
//   testMathML1,
//   testMathML2,
//   testMathJax1,
//   testMathJax2,
//   testMathJax3
// } from './mathTests'

export { previewNote } from './previewMain'
export { updatePreview } from './previewTriggers'

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { pluginUpdated } from '@helpers/NPConfiguration'
import { JSP, logDebug, logError, logInfo } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'

const pluginID = "np.Preview"

export async function init(): Promise<void> {
  try {
    // Check for the latest version of the plugin, and if a minor update is available, install it and show a message
    // Note: turned off, as it was causing too much noise in logs
    // DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false).then((r) =>
    //   pluginUpdated(pluginJson, r),
    // )
  } catch (error) {
    logError(`${pluginID}/init`, JSP(error))
  }
}

export function onSettingsUpdated(): void {
  // Placeholder only to stop error in logs
}

export async function onUpdateOrInstall(): Promise<void> {
  try {
    // Tell user the plugin has been updated
    if (pluginJson['plugin.lastUpdateInfo'] !== 'undefined') {
      await showMessage(pluginJson['plugin.lastUpdateInfo'], 'OK, thanks', `Plugin ${pluginJson['plugin.name']}\nupdated to v${pluginJson['plugin.version']}`)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
