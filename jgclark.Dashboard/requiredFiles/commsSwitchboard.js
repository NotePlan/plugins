/**
 * commsSwitchboard.js - HTML Window: process data to/from the plugin
 * This file is loaded by the browser via <script> tag in the HTML file
 * IMPORTANT NOTE: you can use flow and eslint to give you feedback but DO NOT put any type annotations in the actual code
 * the file will fail silently and you will be scratching your head for why it doesn't work
 */

/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */

/**
 * Blocking delay
 * @param {number} time in milliseconds
 */
async function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time))
}

/**
 * onMessageFromPlugin is where you route the data returned from the plugin
 * the plugin will send a 'type' and 'data' object
 * this function is just a switch/router. Based on the type, call a function to process the data.
 * do not do any processing here, just call the function to do the processing
 * @param {string} type
 * @param {any} data
 */
async function onMessageFromPlugin(type, data) {
  console.log(`onMessageFromPlugin: starting with type: ${type} and data.ID: ${data.ID}`)
  switch (type) {
    case 'updateDiv':
      updateDivReceived(data)
      break
    case 'completeTask':
      completeTask(data)
      break
    case 'completeChecklist':
      completeChecklist(data)
      break
    default:
      console.log(`- unknown type: ${type}`)
      showError(`onMessageFromPlugin: received unknown type: ${type}`)
    // ...call other functions to process the data for other types of messages from the plugin
  }
}

/******************************************************************************
 *         DATA PROCESSING FUNCTIONS FOR RETURNED DATA FROM THE PLUGIN
 *****************************************************************************/
// these are the functions called in the onMessageFromPlugin function above

/**
 * Plugin wants to replace a div with some HTML (or plain text if innerText is true)
 * @param { { ID: string, html: string, innerText:boolean } } data
 */
function updateDivReceived(data) {
  const { ID, html, innerText } = data
  console.log(`updateDivReceived: for ID: ${ID}, html: ${html}`)
  replaceHTML(ID, html, innerText)
}

/**
 * Remove an HTML item that matches data.ID
 * @param { { ID: string, html: string, innerText:boolean } } data
 */
async function deleteItemRow(data) {
  const { ID } = data
  console.log(`deleteItemRow: for ID: ${ID}`)
  deleteHTMLItem(ID)
}

/**
 * A task has been completed (details in data); now update window accordingly
 * @param { { ID: string, html: string, innerText:boolean } } data
 */
async function completeTask(data) {
  const { ID } = data
  const itemID = ID
  console.log(`completeTask: for ID: ${itemID}`)
  replaceClassInID(itemID + 'I', "fa-regular fa-circle-check") // adds ticked box icon
  addClassToID(itemID, "checked") // adds colour + line-through
  addClassToID(itemID, "fadeOutAndHide")
  await delay(2000)
  deleteHTMLItem(itemID)
  // update the totals and other counts
  decrementItemCount("totalOpenCount")
  incrementItemCount("totalDoneCount")
  // update the section count, which is identified as the first part of the itemID
  const sectionID = 'section' + itemID.split('-')[0] + 'Count'
  decrementItemCount(sectionID)
}

/**
 * A checklist has been completed (details in data); now update window accordingly
 * @param { { ID: string, html: string, innerText:boolean } } data
 */
async function completeChecklist(data) {
  const { ID } = data
  const itemID = ID
  console.log(`completeChecklist: for ID: ${itemID}`)
  replaceClassInID(itemID + 'I', "fa-regular fa-box-check") // adds ticked box icon
  addClassToID(itemID, "checked") // adds colour + line-through text
  addClassToID(itemID, "fadeOutAndHide")
  await delay(2000)
  deleteHTMLItem(itemID)
  // update the totals
  decrementItemCount("totalOpenCount")
  incrementItemCount("totalDoneCount")
  // update the section count
  const sectionID = 'section' + ID.split('-')[0] + 'Count'
  decrementItemCount(sectionID)
}

async function showLineInEditor(data) {
  const { ID } = data
  console.log(`showLineInEditor: for ID: ${ID}`)
}

/******************************************************************************
 *                       EVENT HANDLERS FOR THE HTML VIEW
 *****************************************************************************/
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
function onClickDashboardItem(ID, type, filenameEncoded, rawContentEncoded = '') {
  const filename = decodeRFC3986URIComponent(filenameEncoded)
  const rawContent = decodeRFC3986URIComponent(rawContentEncoded)
  if (!ID || !type || !filename) {
    const msg = `onClickDashboardItem: invalid data: ID: ${ID}, type: ${type}, filename: ${filename}, rawContent: '${rawContent}'`
    console.log(msg)
    showError(msg)
  } else {
    console.log(`onClickDashboardItem received click on: ID: ${ID}, type: ${type}, filename: ${filename}, rawContent: <${rawContent}>; sending 'onClickDashboardItem' to plugin`)
    const data = { ID, type, filename, rawContent }
    sendMessageToPlugin('onClickDashboardItem', data) // actionName, data
  }
}

/******************************************************************************
 *                             HELPER FUNCTIONS
 *****************************************************************************/

function deleteHTMLItem(ID) {
  console.log(`deleteHTMLItem: ID: ${ID}`)
  const div = document.getElementById(ID)
  if (div) {
    console.log(`innerHTML was: ${div.innerHTML}`)
    div.innerHTML = ''
  } else {
    console.log(`Couldn't find item with ID ${ID}`)
  }
}

function addClassToID(ID, newerClass) {
  console.log(`addClassToID: ID: ${ID}`)
  const elem = document.getElementById(ID)
  if (elem) {
    const origClass = elem.getAttribute("class")
    // console.log(`before = ${origClass}`)
    elem.setAttribute("class", `${origClass} ${newerClass}`)
    // console.log(`after = ${elem.getAttribute("class")}`)
  }
}

function replaceClassInID(ID, replacementClass) {
  console.log(`replaceClassInID: ID: ${ID}`)
  const elem = document.getElementById(ID)
  if (elem) {
    elem.setAttribute("class", replacementClass)
    // console.log(`after = ${elem.getAttribute("class")}`)
  }
}

function replaceHTML(ID, html, innerText) {
  console.log(`replaceHTML: ID: ${ID}, html: ${html}`)
  const div = document.getElementById(ID)
  if (div) {
    if (innerText) {
      div.innerText = html
    } else {
      div.innerHTML = html
    }
  }
}

function setCounter(counterID, value) {
  console.log(`setCounter '${counterID}' to ${value}`)
  replaceHTML(counterID, String(value), true)
}

function incrementItemCount(counterID) {
  console.log(`incrementItemCount: '${counterID}'`)
  const div = document.getElementById(counterID)
  if (div) {
    const value = parseInt(div.innerText)
    replaceHTML(counterID, String(value + 1), true)
  }
}

function decrementItemCount(counterID) {
  console.log(`decrementItemCount: '${counterID}'`)
  const div = document.getElementById(counterID)
  if (div) {
    const value = parseInt(div.innerText)
    replaceHTML(counterID, String(value - 1), true)
  }
}

function showError(message) {
  const div = document.getElementById('error')
  if (div) {
    div.innerText = message
  }
}

/**
 * Reverse of encodeRFC3986URIComponent
 * Note: copy of function in helpers/stringTransforms.js, but without type information
 * @author @jgclark
 * @tests in jest file
 * @param {string} input 
 * @returns {string}
 */
function decodeRFC3986URIComponent(input) {
  return decodeURIComponent(input)
    .replace(/%5B/g, "[")
    .replace(/%5D/g, "]")
    .replace(/%21/g, "!")
    .replace(/%27/g, "'")
    .replace(/%28/g, "(")
    .replace(/%29/g, ")")
    .replace(/%2A/g, "*")
}
