// @flow

//---------------------------------------------------------------
// Render notes to HTML, including Mermaid and MathML.
// by Jonathan Clark
// v0.2.0, 19.5.2023
//---------------------------------------------------------------

export {
  testMermaid1,
  testMermaid2,
  testMermaid3,
  testMermaid4
} from './mermaidTests'

export {
  testMathML1,
  testMathML2,
  testMathJax1,
  testMathJax2,
  testMathJax3
} from './mathTests'

export {
  previewNote
} from './main'

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { JSP, logDebug, logError, logInfo } from '@helpers/dev'
// import { pluginUpdated, semverVersionToNumber, updateSettingData } from '@helpers/NPConfiguration'
// import { showMessage, showMessageYesNo } from '@helpers/userInput'

const pluginID = "np.Preview"

export function init(): void {
  // placeholder
}

export function onSettingsUpdated(): void {
  // placeholder
}

export async function onUpdateOrInstall(testUpdate: boolean = false): Promise<void> {
  //placeholder
}
