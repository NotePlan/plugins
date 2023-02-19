/**
 * Generic Plugin-to-HTML communications bridge
 * @author @dwertheimer
 * @version 1.0.0
 * Last updated 2023-02-18 @dwertheimer
 */

/**
 * This file is loaded by the browser via <script> tag in the HTML file
 * IMPORTANT NOTE: you can use flow and eslint to give you feedback but DO NOT put any type annotations in the actual code
 * the file will fail silently and you will be scratching your head for why it doesn't work
 */

if (typeof receivingPluginID === 'undefined') {
  throw new Error('The variable receivingPluginID is not defined. This variable must be set prior to the inclusion of the pluginToHTMLCommsBridge file.')
}
if (typeof onMessageFromPlugin === 'undefined') {
  throw new Error('The function onMessageFromPlugin is not defined. This function must be imported/set prior to the inclusion of the pluginToHTMLCommsBridge file.')
}

/**
 * Generic callback bridge from HTML to the plugin. We use this to generate the convenience function sendMessageToPlugin(args)
 * This command be used to run any plugin command, but it's better to use one single command: sendMessageToPlugin(args) for everything
 * @param {string} commandName
 * @param {string} pluginID
 * @param {Array<any>} commandArgs? - optional parameters
 */
const runPluginCommand = (commandName = '%%commandName%%', pluginID = '%%pluginID%%', commandArgs = []) => {
  const code = '(async function() { await DataStore.invokePluginCommandByName("%%commandName%%", "%%pluginID%%", %%commandArgs%%);})()'
    .replace('%%commandName%%', commandName)
    .replace('%%pluginID%%', pluginID)
    .replace('%%commandArgs%%', JSON.stringify(commandArgs))
  // console.log(`runPluginCommand: Sending command "${commandName}" to NotePlan: "${pluginID}" with args: ${JSON.stringify(commandArgs)}`);
  console.log(`window.runPluginCommand: Sending code: "${code}"`)
  if (window.webkit) {
    window.webkit.messageHandlers.jsBridge.postMessage({
      code: code,
      onHandle: '',
      id: '1',
    })
  } else {
    console.log(`Simulating: window.runPluginCommand: ${commandName} called with args:`, commandArgs)
  }
}

/**
 * SENDER to the plugin: one single function to send data to your plugin - supply whatever arguments as an array
 * @param {type:string} type - the type of action we want the plugin to perform
 * @param {data:any} data - the data we want to send to the plugin
 */
const sendMessageToPlugin = (type, data) => runPluginCommand('onMessageFromHTMLView', receivingPluginID, [type, data])

/**
 * RECEIVER from the plugin -- callback function which receives async messages from the Plugin to the HTML view
 * Sends the messages sent to the 'switchboard' function which you define in your JS code before this file is imported
 * @param {} event
 * @returns
 */
const onMessageReceived = (event) => {
  const { origin, source, data } = event
  if (!data || (typeof data === 'string' && data.startsWith('setImmediate$'))) return
  try {
    // $FlowFixMe
    const { type, payload } = event.data // remember: data exists even though event is not JSON.stringify-able (like NP objects)
    if (!type) throw (`onMessageReceived: received a message, but the 'type' was undefined`, event.data)
    if (!payload) throw (`onMessageReceived: received a message but 'payload' was undefined`, event.data)
    console.log(`onMessageReceived: received a message of type: ${type} with a payload`, payload)
    onMessageFromPlugin(type, payload) /* you need to have a function called onMessageFromPlugin in your code */
  } catch (error) {
    console.log(`Root: onMessageReceived: error=${JSON.stringify(error)}`)
  }
}

/* set up window listener to listen for messages back from the plugin */
window.addEventListener('message', onMessageReceived)

/* global shared data variable which can be written later by a plugin or the WebView JS */
// eslint-disable-next-line prefer-const
let globalSharedData = {}

/**
 * This is a bridge to route JS errors from the HTML window back to the NP console.log for debugging
 * @param {string} msg
 * @param {string} url
 * @param {number} line
 * @param {number} column
 * @param {Error} error
 */
window.onerror = (msg, url, line, column, error) => {
  const message = {
    message: msg,
    url: url,
    line: line,
    column: column,
    error: JSON.stringify(error),
  }

  if (window.webkit) {
    window.webkit.messageHandlers.error.postMessage(message)
  } else {
    console.log('JS Error:', message)
  }
}
