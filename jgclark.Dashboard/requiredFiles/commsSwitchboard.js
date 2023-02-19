/**
 * commsSwitchboard.js - HTML Window: process data to/from the plugin
 * This file is loaded by the browser via <script> tag in the HTML file
 * IMPORTANT NOTE: you can use flow and eslint to give you feedback but DO NOT put any type annotations in the actual code
 * the file will fail silently and you will be scratching your head for why it doesn't work
 */

/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */

/**
 * onMessageFromPlugin is where you route the data returned from the plugin
 * the plugin will send a 'type' and 'data' object
 * this function is just a switch/router. Based on the type, call a function to process the data.
 * do not do any processing here, just call the function to do the processing
 * @param {string} type
 * @param {any} data
 */
function onMessageFromPlugin(type, data) {
  console.log(`onMessageFromPlugin: starting with type: ${type}`)
  switch (type) {
    case 'updateDiv':
      updateDivReceived(data)
      break
    case 'deleteItemRow':
      deleteItemRow(data)
      break
    default:
      console.log(`- unknown type: ${type}`)
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
function updateDivReceived(data) {
  const { divID, html, innerText } = data
  console.log(`updateDivReceived: for divID: ${divID}, html: ${html}`)
  replaceHTML(divID, html, innerText)
}

/**
 * Plugin wants to remove a row from its table
 * @param { { ID: string, html: string, innerText:boolean } } data
 */
function deleteItemRow(data) {
  const { itemID } = data
  console.log(`deleteItemRow: for itemID: ${itemID}`)
  deleteHTMLItem(itemID)
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
function onClickDashboardCell(ID, type, filename, rawContent = '') {
  if (!ID || !type || !filename) {
    const msg = `onClickDashboardCell: invalid data: ID: ${ID}, type: ${type}, filename: ${filename}, rawContent: '${rawContent}'`
    console.log(msg)
    showError(msg)
  } else {
    console.log(`onClickDashboardCell received click on: ID: ${ID}, type: ${type}, filename: ${filename}, rawContent: '${rawContent}; sending 'onClickDashboardCell' to plugin`)
    const data = { ID, type, filename, rawContent }
    sendMessageToPlugin('onClickDashboardCell', data) // actionName, data
  }
}

/****************************************************************************************************************************
 *                             HELPER FUNCTIONS
 ****************************************************************************************************************************/

function deleteHTMLItem(itemID) {
  console.log(`deleteHTMLItem: itemID: ${itemID}`)
  const div = document.getElementById(itemID)
  if (div) {
    div.innerHTML = ''
  }
}

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
