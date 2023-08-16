/**
 * html-PluginComms.js - HTML Window: process data to/from the plugin
 * This file is loaded by the browser via <script> tag in the HTML file
 * IMPORTANT NOTE: you can use flow and eslint to give you feedback but DO NOT put any type annotations in the actual code
 * the file will fail silently and you will be scratching your head for why it doesn't work
 *
 * USAGE:
 * 1) Make sure your plugin.json has the following field:
 *   "plugin-requiredFiles": ["html-plugin-comms.js"],
 * 2) Import this file (and the shared bridge functions) into your HTML window when you generate it:
      <script type="text/javascript" src="../np.Shared/pluginToHTMLErrorBridge.js"></script>
      <script>const receivingPluginID = "dbludeau.TodoistNoteplanSync"</script>
      <script type="text/javascript" src="./html-plugin-comms.js"></script>
      <script type="text/javascript" src="../np.Shared/pluginToHTMLCommsBridge.js"></script>
 * 3) onMessageFromPlugin() below will receive your data from the plugin and route it to the appropriate function
 * 4) Call sendMessageToPlugin(type:string, data:any) from your HTML window to send data back to the plugin asynchronously
 */

/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */

/**
 * onMessageFromPlugin is a router where you route the data returned from the plugin
 * the plugin will send a 'type' and 'data' object
 * this function is just a switch/router. Based on the type, call a function to process the data.
 * do not do any processing here, just call the function to do the processing
 * @param {string} type
 * @param {any} data
 */
function onMessageFromPlugin(type, data) {
  switch (type) {
    case 'updateDiv':
      onUpdateDivReceived(data)
      break
    default:
      console.log(`onMessageFromPlugin: unknown type: ${type}`)
      showError(`onMessageFromPlugin: received unknown type: ${type}`)
    // ...call other functions to process the data for other types of messages from the plugin
  }
}

/****************************************************************************************************************************
 *                             DATA PROCESSING FUNCTIONS FOR RETURNED DATA FROM THE PLUGIN
 ****************************************************************************************************************************/
// these are the functions called in the onMessageFromPlugin function above

/**
 * Plugin wants to replace a div with some HTML (or plain text if innerText is true)
 * @param { { divID: string, html: string, innerText:boolean } } data
 */
function onUpdateDivReceived(data) {
  const { divID, html, innerText } = data
  console.log(`onUpdateDivReceived: divID: ${divID}, html: ${html}`)
  replaceHTML(divID, html, innerText)
}

/****************************************************************************************************************************
 *                             EVENT HANDLERS FOR THE HTML VIEW
 ****************************************************************************************************************************/
// These event handlers are called by the HTML view when the user clicks on something
// It's a good idea to have a separate function for each event handler so that you can easily see what's going on
// And have the receiving function on the plugin side named the same thing as the event handler
// So it's easy to match them all up
// You could call sendMessageToPlugin directly from the HTML onClick event handler, but I prefer to have a separate function
// so you can do error checking, logging, etc.

/**
 * Event handler for the 'click' event on the status icon
 * @param {string} filename
 * @param {number} lineIndex
 * @param {string} statusWas
 */
function onClickStatus(filename, lineIndex, statusWas, lineID) {
  if (!filename || typeof lineIndex !== 'number' || !statusWas || !lineID) {
    const msg = `onClickStatus: invalid data: filename: ${filename}, lineIndex: ${lineIndex}, statusWas: ${statusWas}, lineID: ${lineID}`
    console.log(msg)
    showError(msg) // you should have a div with id='error' in your HTML
  } else {
    console.log(`onClickStatus received click on: filename: ${filename}, lineIndex: ${lineIndex}, status: ${status}; sending 'onClickStatus' to plugin`)
    const data = { filename, lineIndex: lineIndex, statusWas, lineID }
    sendMessageToPlugin('onClickStatus', data) // actionName, data
  }
}

/****************************************************************************************************************************
 *                             HELPER FUNCTIONS
 ****************************************************************************************************************************/

function replaceHTML(divID, html, innerText) {
  console.log(`replaceHTML: divID: ${divID}, html: ${html}`)
  const div = document.getElementById(divID)
  if (div) {
    if (innerText) {
      div.innerText = html
    } else {
      div.innerHTML = html
    }
  }
}

function showError(message) {
  const div = document.getElementById('error')
  if (div) {
    div.innerText = message
  }
}
