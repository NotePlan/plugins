/**
 * commsSwitchboard.js - HTML Window: process data to/from the plugin
 * This file is loaded by the browser via <script> tag in the HTML file
 * IMPORTANT NOTE: you can use flow and eslint to give you feedback but DO NOT put any type annotations in the actual code
 * the file will fail silently and you will be scratching your head for why it doesn't work
 */

/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */

/**
 * switchboard is where you process the data returned from the plugin
 * the plugin will send a 'type' and 'data' object
 * this function is just a switch. Based on the type, call a function to process the data.
 * do not do any processing here, just call the function to do the processing
 * @param {string} type
 * @param {any} data
 */
function switchboard(type, data) {
  switch (type) {
    case 'updateDiv' /* payload: { divID: string, html: string, innerText:boolean } */:
      {
        const { divID, html, innerText } = data
        onUpdateDivReceived(divID, html, innerText)
      }
      break
    // ...call other functions to process the data for other types of messages from the plugin
  }
}

/****************************************************************************************************************************
 *                             DATA PROCESSING FUNCTIONS FOR RETURNED DATA FROM THE PLUGIN
 ****************************************************************************************************************************/
// these are the functions called in the switchboard function above

function onUpdateDivReceived(divID, html, innerText) {
  console.log(`onUpdateDivReceived: divID: ${divID}, html: ${html}`)
  const div = document.getElementById(divID)
  if (div) {
    if (innerText) {
      div.innerText = html
    } else {
      div.innerHTML = html
    }
  }
}

/****************************************************************************************************************************
 *                             EVENT HANDLERS FOR THE HTML VIEW
 ****************************************************************************************************************************/
// These event handlers are called by the HTML view when the user clicks on something
// It's a good idea to have a separate function for each event handler so that you can easily see what's going on
// And have the receiving function on the plugin side named the same thing as the event handler
// So it's easy to match them all up

/**
 * Event handler for the 'click' event on the status icon
 * @param {string} filename
 * @param {number} lineIndex
 * @param {string} statusWas
 */
function onClickStatus(filename, lineIndex, statusWas, lineID) {
  console.log(`onClickStatus received click on: filename: ${filename}, lineIndex: ${lineIndex}, status: ${status}; sending 'onClickStatus' to plugin`)
  const data = { filename, lineIndex, statusWas, lineID }
  sendMessageToPlugin('onClickStatus', data) // actionName, data
}
