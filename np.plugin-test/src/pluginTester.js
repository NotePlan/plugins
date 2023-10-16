// @flow
// import pluginJson from '../plugin.json'
import { showMessage } from '@helpers/userInput'
import { log, JSP, clo, logDebug, logError } from '@helpers/dev'

export async function pluginTester(): Promise<void> {
  const test = 'Evaluation is ' ?? 'NOT '
  const test2 = ['working', 'correctly ']?.join(' ')
  console.log(`1) Test of ??: ${test}${test2}`)
  console.log('The previous line should read "Test of ??: Evaluation is working correctly"')
  console.log('2) pluginTester: About to await Editor.insertTextAtCursor. You should get another output line after this one.')

  await Editor.insertTextAtCursor(`[Plugins must be working...a plugin put this text here!]`)
  console.log(`3) pluginTester: Just inserted some text in the Editor, and here is some text in the plugin console: Noteplan > Help > Plugin Console`)
  await showMessage('If you see this message and some text in the Editor where your cursor was, then plugins are working!')
}

export function testOutputEditorContents(): void {
  log(`PluginTester`, JSP(Editor))
}

/**
 * Do absolutely nothing
 * Plugin entrypoint for command: "/doNothing"
 * @author @dwertheimer
 * @param {*} incoming
 */
export function doNothing() {
  return
}
