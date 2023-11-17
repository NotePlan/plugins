/**
 * commsSwitchboard.js - HTML Window: process data to/from the plugin
 * This file is loaded by the browser via <script> tag in the HTML file
 * IMPORTANT NOTE: you can use flow and eslint to give you feedback but DO NOT put any type annotations in the actual code:
 * the file will fail silently and you will be scratching your head for why it doesn't work
 */

/* eslint-disable no-console */
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
 * Do not do any processing here, just call the function to do the processing.
 * @param {string} type
 * @param {any} data
 */
async function onMessageFromPlugin(type, data) {
  console.log(`onMessageFromPlugin: starting with type: ${type} and data.itemID: ${data.itemID ?? 'n/a'}`)
  switch (type) {
    case 'updateDiv':
      updateDivReceived(data)
      break
    case 'completeTask':
      await completeTask(data) // Note: await not needed
      break
    case 'completeChecklist':
      await completeChecklist(data) // Note: await not needed
      break
    case 'cancelTask':
      await cancelTask(data) // Note: await not needed
      break
    case 'cancelChecklist':
      await cancelChecklist(data) // Note: await not needed
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
function deleteItemRow(data) {
  const { ID } = data
  console.log(`deleteItemRow: for ID: ${ID}`)
  deleteHTMLItem(ID)
}

/**
 * A task has been completed (details in data); now update window accordingly
 * @param { { ID: string, html: string, innerText:boolean } } data
 * TODO: move this into the click event handler?
 */
async function completeTask(data) {
  const { itemID } = data
  console.log(`completeTask: for ID: ${itemID}`)
  replaceClassInID(`${itemID}I`, "fa-regular fa-circle-check") // adds ticked circle icon
  addClassToID(itemID, "checked") // adds colour + line-through
  addClassToID(itemID, "fadeOutAndHide")
  await delay(2000)
  deleteHTMLItem(itemID)
  // update the totals and other counts
  decrementItemCount("totalOpenCount")
  incrementItemCount("totalDoneCount")
  // update the section count, which is identified as the first part of the itemID
  const sectionID = itemID.split('-')[0]
  const sectionCountID = `section${sectionID}Count`
  decrementItemCount(sectionCountID)

  // See if the only remaining item is the '> There are also ... items' line
  const numItemsRemaining = getNumItemsInSection(`${sectionID}-Section`, 'TR')
  if (numItemsRemaining === 1 && doesIDExist(`${sectionID}-Filter`)) {
    // We need to un-hide the lower-priority items: do full refresh
    sendMessageToPlugin('refresh', { itemID: '', type: '', filename: '', rawContent: '' }) // actionName, data
  }
}

/**
 * A checklist has been completed (details in data); now update window accordingly
 * @param { { ID: string, html: string, innerText:boolean } } data
 */
async function completeChecklist(data) {
  // const { ID } = data
  const itemID = data.itemID
  console.log(`completeChecklist: for ID: ${itemID}`)
  replaceClassInID(`${itemID}I`, "fa-regular fa-box-check") // adds ticked box icon
  addClassToID(itemID, "checked") // adds colour + line-through text
  addClassToID(itemID, "fadeOutAndHide")
  await delay(2000)
  deleteHTMLItem(itemID)
  // update the totals
  decrementItemCount("totalOpenCount")
  incrementItemCount("totalDoneCount")
  // update the section count
  const sectionID = itemID.split('-')[0]
  const sectionCountID = `section${sectionID}Count`
  decrementItemCount(sectionCountID)

  // See if the only remaining item is the '> There are also ... items' line
  const numItemsRemaining = getNumItemsInSection(`${sectionID}-Section`, 'TR')
  if (numItemsRemaining === 1 && doesIDExist(`${sectionID}-Filter`)) {
    // We need to un-hide the lower-priority items: do full refresh
    sendMessageToPlugin('refresh', { itemID: '', type: '', filename: '', rawContent: '' }) // actionName, data
  }
}

/**
 * A task has been cancelled (details in data); now update window accordingly
 * @param { { ID: string, html: string, innerText:boolean } } data
 */
async function cancelChecklist(data) {
  // const { ID } = data
  const itemID = data.itemID
  console.log(`cancelChecklist: for ID: ${itemID}`)
  replaceClassInID(`${itemID}I`, "fa-regular fa-square-xmark") // adds x-box icon
  addClassToID(itemID, "cancelled") // adds colour + line-through text
  addClassToID(itemID, "fadeOutAndHide")
  await delay(1400)
  deleteHTMLItem(itemID)
  // update the totals
  decrementItemCount("totalOpenCount")
  // update the section count
  const sectionID = itemID.split('-')[0]
  const sectionCountID = `section${sectionID}Count`
  decrementItemCount(sectionCountID)

  // See if the only remaining item is the '> There are also ... items' line
  const numItemsRemaining = getNumItemsInSection(`${sectionID}-Section`, 'TR')
  if (numItemsRemaining === 1 && doesIDExist(`${sectionID}-Filter`)) {
    // We need to un-hide the lower-priority items: do full refresh
    sendMessageToPlugin('refresh', { itemID: '', type: '', filename: '', rawContent: '' }) // actionName, data
  }
}

/**
 * A checklist has been cancelled (details in data); now update window accordingly
 * @param { { ID: string, html: string, innerText:boolean } } data
 */
async function cancelTask(data) {
  // const { ID } = data
  const itemID = data.itemID
  console.log(`cancelTask: for ID: ${itemID}`)
  replaceClassInID(`${itemID}I`, "fa-regular fa-circle-xmark") // adds x-circle icon
  addClassToID(itemID, "cancelled") // adds colour + line-through text
  addClassToID(itemID, "fadeOutAndHide")
  await delay(1400)
  deleteHTMLItem(itemID)
  // update the totals
  decrementItemCount("totalOpenCount")
  // update the section count
  const sectionID = itemID.split('-')[0]
  const sectionCountID = `section${sectionID}Count`
  decrementItemCount(sectionCountID)

  // See if the only remaining item is the '> There are also ... items' line
  const numItemsRemaining = getNumItemsInSection(`${sectionID}-Section`, 'TR')
  if (numItemsRemaining === 1 && doesIDExist(`${sectionID}-Filter`)) {
    // We need to un-hide the lower-priority items: do full refresh
    sendMessageToPlugin('refresh', { itemID: '', type: '', filename: '', rawContent: '' }) // actionName, data
  }
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
 * Event handler for the 'click' event on the icon
 * Note: v2 with object passed in
 * @param {string} filename
 * @param {number} lineIndex
 * @param {string} statusWas
 */
function onClickDashboardItem(data) {
  sendMessageToPlugin('onClickDashboardItem', data) // actionName, data
}

/**
 * Event handler for the 'change' event on a checkbox
 * @param {string} settingName of checkbox
 * @param {boolean} state that it now has
 */
function onChangeCheckbox(settingName, state) {
  const data = { settingName, state }
  // console.log(`onChangeCheckbox received: settingName: ${data.settingName}, state: ${String(data.state)}; sending 'onChangeCheckbox' to plugin`)
  sendMessageToPlugin('onChangeCheckbox', data) // actionName, data
}

/******************************************************************************
 *                             HELPER FUNCTIONS
 *****************************************************************************/

function deleteHTMLItem(ID) {
  // console.log(`deleteHTMLItem(${ID}) ...`)
  const div = document.getElementById(ID)
  if (div) {
    // console.log(`innerHTML was: ${div.innerHTML}`)
    div.innerHTML = ''
  } else {
    console.log(`- ❗error❗ in deleteHTMLItem: couldn't find an elem with ID ${ID}`)
  }
}

function addClassToID(ID, newerClass) {
  // console.log(`addClassToID(${ID}, '${newerClass}') ...`)
  const elem = document.getElementById(ID)
  if (elem) {
    const origClass = elem.getAttribute("class")
    elem.setAttribute("class", `${origClass} ${newerClass}`)
  } else {
    console.log(`- ❗error❗ in addClassToID: couldn't find an elem with ID ${ID} to add class ${newerClass}`)
  }
}

// TODO: this can't find the ID, and I can't see why
function replaceClassInID(ID, replacementClass) {
  // console.log(`replaceClassInID(${ID}, '${replacementClass}') ...`)
  const elem = document.getElementById(ID)
  if (elem) {
    elem.setAttribute("class", replacementClass)
  } else {
    console.log(`- error in replaceClassInID: couldn't find an elem with ID ${ID} to replace class ${replacementClass}`)
  }
}

function replaceHTML(ID, html, innerText) {
  // console.log(`replaceHTML(${ID}, '${html}', '${innerText}') ...`)
  const div = document.getElementById(ID)
  if (div) {
    if (innerText) {
      div.innerText = html
    } else {
      div.innerHTML = html
    }
  } else {
    console.log(`- ❗error❗ in replaceHTML: couldn't find element with ID ${ID}`)
  }
}

function setCounter(counterID, value) {
  // console.log(`setCounter('${counterID}', ${value}) ...`)
  replaceHTML(counterID, String(value), true)
}

function incrementItemCount(counterID) {
  // console.log(`incrementItemCount('${counterID}') ...`)
  const div = document.getElementById(counterID)
  if (div) {
    const value = parseInt(div.innerText)
    replaceHTML(counterID, String(value + 1), true)
  } else {
    console.log(`- ❗error❗ in incrementItemCount: couldn't find a div for counterID ${counterID}`)
  }
}

function decrementItemCount(counterID) {
  // console.log(`decrementItemCount('${counterID}') ...`)
  const div = document.getElementById(counterID)
  if (div) {
    const value = parseInt(div.innerText)
    replaceHTML(counterID, String(value - 1), true)
  } else {
    console.log(`- ❗error❗ in decrementItemCount: couldn't find a div for counterID ${counterID}`)
  }
}

/**
 * Count how many children of type 'tagName' are in DOM under sectionID.
 * Additionally ignore children with no innerHTML
 * @param {string} sectionID
 * @param {string} tagName uppercase version of HTML tag e.g. 'TR'
 * @returns {number}
 */
function getNumItemsInSection(sectionID, tagName) {
  // console.log(`getNumItemsInSection: ${sectionID} by ${tagName}`)
  const sectionTable = document.getElementById(sectionID)
  // console.log(`${sectionTable.innerHTML}`)
  if (sectionTable) {
    let c = 0
    const items = sectionTable.getElementsByTagName(tagName)
    // I think this is a collection not an array, so can't use a .filter?
    for (i = 0; i < items.length; i++) {
      if (items[i].innerHTML !== '') {
        c++
      }
    }
    // console.log(`= ${String(c)}`)
    return c
  } else {
    console.log(`- ❗error❗ in getNumItemsInSection: couldn't find section with ID ${sectionID}`)
    return 0
  }
}

function doesIDExist(itemID) {
  // console.log(`doesIDExist for ${itemID}? ${String(document.getElementById(itemID))}`)
  return document.getElementById(itemID)
}

function showError(message) {
  const div = document.getElementById('error')
  if (div) {
    div.innerText = message
  }
}
