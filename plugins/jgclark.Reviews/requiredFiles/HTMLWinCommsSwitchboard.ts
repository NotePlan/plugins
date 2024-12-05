/**
 * HTMLWinCommsSwitchboard.js - in the HTMLWindow process data and logic to/from the plugin
 * This file is loaded by the browser via <script> tag in the HTML file
 * IMPORTANT NOTE: you can use flow and eslint to give you feedback but DO NOT put any type annotations in the actual code:
 * the file will fail silently and you will be scratching your head for why it doesn't work!
 */

/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */

/**
 * Blocking delay
 * @param {number} time in milliseconds
 */
// eslint-disable-next-line require-await
async function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time))
}

/**
 * Routes the data returned from the plugin (a 'type' and 'data' object).
 * This function is just a switch/router. Based on the type, call a function to process the data.
 * Do not do any processing here, just call the function to do the processing.
 * @param {string} type
 * @param {any} data
 */
function onMessageFromPlugin(type, data) {
  console.log(`onMessageFromPlugin: starting with type ${type} and data.itemID ${data.itemID ?? 'n/a'}`)
  switch (type) {
    case 'removeItem':
      deleteItemRow(data)
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
  replaceHTMLinID(ID, html, innerText)
}

/**
 * Remove an HTML item that matches the given data.itemid
 * @param { { ... itemID: string } } data
 */
function deleteItemRow(data) {
  const { itemID } = data
  console.log(`deleteItemRow: for itemID: ${itemID}`)
  deleteHTMLItem(itemID)
}

/**
 * A task has been completed (details in data); now update window accordingly
 * @param { { ID: string, html: string, innerText:boolean } } data
 */
async function completeTaskInDisplay(data) {
  try {
    const itemID = data.itemID
    console.log(`completeTaskInDisplay: for ID: ${itemID}`)
    replaceClassInID(`${itemID}I`, "fa-regular fa-circle-check") // adds ticked circle icon
    addClassToID(itemID, "checked") // adds colour + line-through
    addClassToID(itemID, "fadeOutAndHide")
    await delay(1400)
    deleteHTMLItem(itemID)
    // update the totals and other counts
    incrementItemCount("totalDoneCount")
    // update the section count(s) if spans with the right ID are present
    const sectionID = itemID.split('-')[0]
    const sectionCountID = `section${sectionID}Count`
    decrementItemCount(sectionCountID)
    const sectionTotalCountID = `section${sectionID}TotalCount`
    decrementItemCount(sectionTotalCountID)

    // See if the only remaining item is the '> There are also ... items' line
    const numItemsRemaining = getNumItemsInSectionByClass(`${sectionID}-Section`, 'sectionItemRow')
    console.log(`- ${numItemsRemaining}`)
    console.log(`- ${String(doesIDExist(`${sectionID}-Filter`))}`)
    if (numItemsRemaining === 1 && doesIDExist(`${sectionID}-Filter`)) {
      // We need to un-hide the lower-priority items: do full refresh
      console.log(`We need to un-hide the lower-priority items: doing full refresh`)
      sendMessageToPlugin('refresh', { itemID: '', type: '', filename: '', rawContent: '' }) // = actionName, data
    }

    // See if we now have no remaining items at all
    if (numItemsRemaining === 0) {
      // Delete the whole section from the display
      console.log(`completeTaskInDisplay: trying to delete rest of empty section: ${sectionID}`)
      const sectionItemsGrid = document.getElementById(`${sectionID}-Section`)
      if (!sectionItemsGrid) { throw new Error(`Couldn't find ID ${itemID}`) }
      const enclosingDIV = sectionItemsGrid.parentNode
      console.log(`Will remove node with outerHTML:\n${enclosingDIV.outerHTML}`)
      enclosingDIV.remove()
    }
  } catch (error) {
    console.log(`completeTaskInDisplay: ❗ERROR❗ ${error.message}`)
  }
}

/**
 * A checklist has been completed (details in data); now update window accordingly
 * @param { { ID: string, html: string, innerText:boolean } } data
 */
async function completeChecklistInDisplay(data) {
  try {
    const itemID = data.itemID
    console.log(`completeChecklistInDisplay: for ID: ${itemID}`)
    replaceClassInID(`${itemID}I`, "fa-regular fa-square-check") // adds ticked box icon
    addClassToID(itemID, "checked") // adds colour + line-through text
    addClassToID(itemID, "fadeOutAndHide")
    await delay(1400)
    deleteHTMLItem(itemID)
    // update the totals
    incrementItemCount("totalDoneCount")
    // update the section count(s) if spans with the right ID are present
    const sectionID = itemID.split('-')[0]
    const sectionCountID = `section${sectionID}Count`
    decrementItemCount(sectionCountID)
    const sectionTotalCountID = `section${sectionID}TotalCount`
    decrementItemCount(sectionTotalCountID)

    // See if the only remaining item is the '> There are also ... items' line
    const numItemsRemaining = getNumItemsInSection(`${sectionID}-Section`, 'DIV')
    if (numItemsRemaining === 1 && doesIDExist(`${sectionID}-Filter`)) {
      // We need to un-hide the lower-priority items: do full refresh
      console.log(`We need to un-hide the lower-priority items: doing full refresh`)
      sendMessageToPlugin('refresh', { itemID: '', type: '', filename: '', rawContent: '' }) // = actionName, data
    }

    // See if we now have no remaining items at all
    if (numItemsRemaining === 0) {
      // Delete the whole section from the display
      console.log(`completeChecklistInDisplay: trying to delete rest of empty section: ${sectionID}`)
      const sectionItemsGrid = document.getElementById(`${sectionID}-Section`)
      if (!sectionItemsGrid) { throw new Error(`Couldn't find ID ${itemID}`) }
      const enclosingDIV = sectionItemsGrid.parentNode
      console.log(`Will remove node with outerHTML:\n${enclosingDIV.outerHTML}`)
      enclosingDIV.remove()
    }
  } catch (error) {
    console.log(`completeChecklistInDisplay: ❗ERROR❗ ${error.message}`)
  }
}

/**
 * A checklist has been cancelled (details in data); now update window accordingly
 * @param { { ID: string, html: string, innerText:boolean } } data
 */
async function cancelTaskInDisplay(data) {
  // const { ID } = data
  const itemID = data.itemID
  console.log(`cancelTaskInDisplay: for ID: ${itemID}`)
  replaceClassInID(`${itemID}I`, "fa-regular fa-circle-xmark") // adds x-circle icon
  addClassToID(itemID, "cancelled") // adds colour + line-through text
  addClassToID(itemID, "fadeOutAndHide")
  await delay(1400)
  deleteHTMLItem(itemID)
  // update the section count(s) if spans with the right ID are present
  const sectionID = itemID.split('-')[0]
  const sectionCountID = `section${sectionID}Count`
  decrementItemCount(sectionCountID)
  const sectionTotalCountID = `section${sectionID}TotalCount`
  decrementItemCount(sectionTotalCountID)

  // See if the only remaining item is the '> There are also ... items' line
  const numItemsRemaining = getNumItemsInSection(`${sectionID}-Section`, 'DIV')
  if (numItemsRemaining === 1 && doesIDExist(`${sectionID}-Filter`)) {
    // We need to un-hide the lower-priority items: do full refresh
    console.log(`We need to un-hide the lower-priority items: doing full refresh`)
    sendMessageToPlugin('refresh', { itemID: '', type: '', filename: '', rawContent: '' }) // actionName, data
  }
}

/**
 * A task has been cancelled (details in data); now update window accordingly
 * @param { { ID: string, html: string, innerText:boolean } } data
 */
async function cancelChecklistInDisplay(data) {
  // const { ID } = data
  const itemID = data.itemID
  console.log(`cancelChecklistInDisplay: for ID: ${itemID}`)
  replaceClassInID(`${itemID}I`, "fa-regular fa-square-xmark") // adds x-box icon
  addClassToID(itemID, "cancelled") // adds colour + line-through text
  addClassToID(itemID, "fadeOutAndHide")
  await delay(1400)
  deleteHTMLItem(itemID)
  // update the section count(s) if spans with the right ID are present
  const sectionID = itemID.split('-')[0]
  const sectionCountID = `section${sectionID}Count`
  decrementItemCount(sectionCountID)
  const sectionTotalCountID = `section${sectionID}TotalCount`
  decrementItemCount(sectionTotalCountID)

  // See if the only remaining item is the '> There are also ... items' line
  const numItemsRemaining = getNumItemsInSection(`${sectionID}-Section`, 'DIV')
  if (numItemsRemaining === 1 && doesIDExist(`${sectionID}-Filter`)) {
    // We need to un-hide the lower-priority items: do full refresh
    console.log(`We need to un-hide the lower-priority items: doing full refresh`)
    sendMessageToPlugin('refresh', { itemID: '', type: '', filename: '', rawContent: '' }) // actionName, data
  }
}

/**
 * Toggle display of an item between (open) todo to checklist or vice versa
 * @param { { ID: string, html: string, innerText:boolean } } data
 */
function toggleTypeInDisplay(data) {
  const itemID = data.itemID
  console.log(`toggleTypeInDisplay: for ID: ${itemID}`)
  // Get the element with {itemID}I = the icon for that item
  const iconElement = document.getElementById(`${itemID}I`)
  // Switch the icon
  if (iconElement.className.includes("fa-circle")) {
    console.log("toggling type to checklist")
    replaceClassInID(`${itemID}I`, "todo fa-regular fa-square")
  } else {
    console.log("toggling type to todo")
    replaceClassInID(`${itemID}I`, "todo fa-regular fa-circle")
  }
}

/**
 * Update display of filename
 * @param { { itemID: string, newFilename: string } } data
 */
function updateItemFilename(data) {
  const itemID = data.itemID
  const newFilename = data.filename ?? ''

  console.log(`updateItemFilename: for ID: ${itemID} to '${newFilename}'`)
  // Find child with class="content"
  const thisIDElement = document.getElementById(data.itemID)
  const thisContentElement = findDescendantByClassName(thisIDElement, 'content')
  // Get its inner content
  const currentInnerHTML = thisContentElement.innerHTML
  console.log(`- currentInnerHTML: ${currentInnerHTML}`)

  // TODO: Change the content to reflect the new filename :
  const newInnerHTML = `${currentInnerHTML} <a class="noteTitle sectionItem"><i class="fa-regular fa-file-lines pad-right"></i> ${newFilename}`
  console.log(`- newInnerHTML: ${newInnerHTML}`)
  replaceHTMLinElement(thisContentElement, newInnerHTML, null)
}

/**
 * Update display of item's content
 * Note: this is a basic level of update that can be done quickly.
 * Until all the rendering functions are in the frontend, the assumption is that a full refresh follows within a second or two.
 * @param { { itemID: string, updatedContent: string } } data
 */
function updateItemContent(data) {
  const itemID = data.itemID
  const updatedContent = data.updatedContent ?? ''
  if (!itemID || !updatedContent) {
    console.log(`updateItemContent: Warning empty itemID and/or updatedContent passed`)
    return
  }
  console.log(`updateItemContent: for ID: ${itemID} to '${updatedContent}'`)
  // Find child with class="content"
  const thisIDElement = document.getElementById(data.itemID)
  const thisContentElement = findDescendantByClassName(thisIDElement, 'content')
  // Get its inner content
  const currentInnerHTML = thisContentElement.innerHTML
  console.log(`- currentInnerHTML: ${currentInnerHTML}`)

  // Basic update of the content
  const newInnerHTML = updatedContent
  console.log(`- newInnerHTML: ${newInnerHTML}`)
  replaceHTMLinElement(thisContentElement, newInnerHTML, null)
}

/**
 * Remove a scheduled date from an item: in the display simply remove it and update counts
 * @param { { ID: string, ... } } data
 */
async function unscheduleItem(data) {
  const itemID = data.itemID
  console.log(`unscheduleItem: for ID: ${itemID}`)
  addClassToID(itemID, "fadeOutAndHide")
  await delay(1400)
  deleteHTMLItem(itemID)
  // update the section count(s) if spans with the right ID are present
  const sectionID = itemID.split('-')[0]
  const sectionCountID = `section${sectionID}Count`
  decrementItemCount(sectionCountID)
  const sectionTotalCountID = `section${sectionID}TotalCount`
  decrementItemCount(sectionTotalCountID)
}

/**
 * Display a task with a given priority class
 * @param { {itemID: string, newContent: string, newPriority: number} } data
 */
function setPriorityInDisplay(data) {
  console.log(`starting setPriorityInDisplay for ID ${data.itemID} with new pri ${data.newPriority}`)
  const thisIDElement = document.getElementById(data.itemID)
  console.log(`- thisIDElement class: ${thisIDElement.className}`)
  // Find child with class="content"
  const thisContentElement = findDescendantByClassName(thisIDElement, 'content')
  // Get its inner content
  const currentInnerHTML = thisContentElement.innerHTML
  console.log(`- currentInnerHTML: ${currentInnerHTML}`)

  // Change the class of the content visible to users, to reflect the new priority colours
  const newInnerHTML = (data.newPriority > 0)
    ? `<span class="priority${data.newPriority}">${data.newContent}</span>`
    : data.newContent
  console.log(`- newInnerHTML: ${newInnerHTML}`)
  replaceHTMLinElement(thisContentElement, newInnerHTML, null)

  // We also need to update the two "data-encoded-content" attributes in *both* TDs in the TR with this ID.
  // Note this time it needs to be encoded.
  // FIXME: update for Grid (simpler: just the item itself?)
  // const tdElements = thisIDElement.getElementsByTagName('DIV')
  // for (let i = 0; i < tdElements.length; i++) {
  // const tdElement = tdElements[i]
  const tdElement = thisIDElement
  tdElement.setAttribute('data-encoded-content', data.newContent)
  console.log(`- set tdElement #${i} data-encoded-content: ${tdElement.getAttribute('data-encoded-content')}`)
  // }
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
 * Event handler for various button 'click' events
 * Note: data is an object
 * @param {Object} data
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
  console.log(`onChangeCheckbox received: settingName: ${data.settingName}, state: ${String(data.state)}; sending 'onChangeCheckbox' to plugin`)
  sendMessageToPlugin('onChangeCheckbox', data) // actionName, data
}

/******************************************************************************
 *                             HELPER FUNCTIONS
 *****************************************************************************/

/**
 * Function that returns the nearest ancestor element with the specified tag name
 * Returns false if not found
 * @param {HTMLElement} startElement - the element to start searching from
 * @param {string} tagName - the tag name to search for
 * @returns {HTMLElement | false} - the first descendant element with the specified tag name, or false if not found
 */
function findAncestor(startElement, tagName) {
  let currentElem = startElement
  while (currentElem !== document.body) {
    if (currentElem.tagName.toLowerCase() === tagName.toLowerCase()) {
      return currentElem
    }
    currentElem = currentElem.parentElement
  }
  return false
}

/**
 * Function that returns the first descendant element with the specified tag name
 * Returns false if not found
 * @param {HTMLElement} startElement - the element to start searching from
 * @param {string} tagName - the tag name to search for
 * @returns {HTMLElement | false} - the first descendant element with the specified tag name, or false if not found
 */
function findDescendantByTagName(startElement, tagName) {
  // Get all descendant elements with the specified tag name
  const descendants = startElement.getElementsByTagName(tagName)

  // Check if any descendant elements were found
  if (descendants.length > 0) {
    // Return the first descendant element
    return descendants[0]
  } else {
    // Return false if no descendant element with the specified tag name was found
    return false
  }
}

/**
 * Function that returns the first descendant element with the specified tag name
 * Returns false if not found
 * @param {HTMLElement} startElement - the element to start searching from
 * @param {string} className - the tag name to search for
 * @returns {HTMLElement | false} - the first descendant element with the specified tag name, or false if not found
 */
function findDescendantByClassName(startElement, className) {
  // Get all descendant elements with the specified tag name
  const descendants = startElement.getElementsByClassName(className)

  // Check if any descendant elements were found
  if (descendants.length > 0) {
    // Return the first descendant element
    return descendants[0]
  } else {
    // Return false if no descendant element with the specified tag name was found
    return false
  }
}

function deleteHTMLItem(ID) {
  // console.log(`deleteHTMLItem(${ID}) ...`)
  const div = document.getElementById(ID)
  if (div) {
    // console.log(`innerHTML was: ${div.innerHTML}`)
    div.innerHTML = ''
    // Note: why not use div.remove() ?
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

function replaceHTMLinID(ID, html, innerText) {
  // console.log(`replaceHTMLinID(${ID}, '${html}', '${innerText}') ...`)
  const div = document.getElementById(ID)
  if (div) {
    if (innerText) {
      div.innerText = html
    } else {
      div.innerHTML = html
    }
  } else {
    console.log(`- ❗error❗ in replaceHTMLinID: couldn't find element with ID ${ID}`)
  }
}

function replaceHTMLinElement(elem, html, innerText) {
  console.log(`replaceHTMLinElement(tag:${elem.tagName}, '${html}', '${innerText}') ...`)
  if (elem) {
    if (innerText) {
      elem.innerText = html
    } else {
      elem.innerHTML = html
    }
  } else {
    console.log(`- ❗error❗ in replaceHTMLinElement: problem with passed element`)
  }
}

function setCounter(counterID, value) {
  // console.log(`setCounter('${counterID}', ${value}) ...`)
  replaceHTMLinID(counterID, String(value), true)
}

function incrementItemCount(counterID) {
  // console.log(`incrementItemCount('${counterID}') ...`)
  const elem = document.getElementById(counterID)
  if (elem) {
    const value = parseInt(elem.innerText)
    replaceHTMLinID(counterID, String(value + 1), true)
  } else {
    console.log(`incrementItemCount: couldn't find an elem for counterID ${counterID}`)
  }
}

function decrementItemCount(counterID) {
  // console.log(`decrementItemCount('${counterID}') ...`)
  const elem = document.getElementById(counterID)
  if (elem) {
    const value = parseInt(elem.innerText)
    replaceHTMLinID(counterID, String(value - 1), true)
  } else {
    console.log(`decrementItemCount: no element for counterID ${counterID}`)
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
  const sectionElem = document.getElementById(sectionID)
  // console.log(`${sectionElem.innerHTML}`)
  if (sectionElem) {
    let c = 0
    const items = sectionElem.getElementsByTagName(tagName)
    // I think this is a collection not an array, so can't use a .filter?
    for (i = 0; i < items.length; i++) {
      if (items[i].innerHTML !== '') {
        c++
      }
    }
    // console.log(`=> ${String(c)} items left in this section`)
    return c
  } else {
    console.log(`- ❗error❗ in getNumItemsInSection: couldn't find section with ID ${sectionID}`)
    return 0
  }
}

/**
 * Count how many children of type 'tagName' are in DOM under sectionID.
 * Additionally ignore children with no innerHTML
 * @param {string} sectionID
 * @param {string} tagName uppercase version of HTML tag e.g. 'TR'
 * @returns {number}
 */
function getNumItemsInSectionByClass(sectionID, className) {
  // console.log(`getNumItemsInSectionByClass: ${sectionID} by ${className}`)
  const sectionElem = document.getElementById(sectionID)
  // console.log(`${sectionElem.innerHTML}`)
  if (sectionElem) {
    let c = 0
    const items = sectionElem.getElementsByClassName(className)
    // I think this is a collection not an array, so can't use a .filter?
    for (i = 0; i < items.length; i++) {
      if (items[i].innerHTML !== '') {
        c++
      }
    }
    console.log(`=> ${String(c)} items left in this section`)
    return c
  } else {
    console.log(`- ❗error❗ in getNumItemsInSectionByClass: couldn't find section with ID ${sectionID}`)
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
