// @flow

import pluginJson from '../plugin.json'
import { showHTMLWindow, getCallbackCodeString } from '@helpers/HTMLView'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'

/**
 * reactTest
 * Plugin entrypoint for "/React Test"
 * @author @dwertheimer
 */

/**
 * Pops up an HTML window to allow for color picking
 * @param {*} key
 * @param {*} defaultValue
 * Uses invokePluginCommandByName to set the color after it's chosen
 */
export function reactTest(): void {
  try {
    const cb = getCallbackCodeString('callbackTest', pluginJson['plugin.id'])
    showHTMLWindow('Test', `<p>Test</p><button id="foo" onclick="callbackTest(['colorWasPicked', document.getElementById('foo').value])">Select this color</button>`, {
      savedFilename: 'test.html',
      postBodyScript: cb,
    })
  } catch (error) {
    console.log(error)
  }
}

/**
 * callbackTest
 * Plugin entrypoint for "/callbackTest (callback from html)"
 * @author @dwertheimer
 */
export async function callbackTest(...incoming: string) {
  try {
    console.log('callbackTest')
    clo(incoming, `callbackTest::incoming`)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
