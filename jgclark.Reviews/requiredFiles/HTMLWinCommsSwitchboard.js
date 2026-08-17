//--------------------------------------------------------------------------------------
//  HTMLWinCommsSwitchboard.js - in the HTMLWindow process data and logic to/from the plugin
// Last updated: 2026-08-17 for v2.0.6 by @jgclark + @CursorAI
//--------------------------------------------------------------------------------------
/**
 * This file is loaded by the browser via <script> tag in the HTML file
 * IMPORTANT NOTE: you can use flow and eslint to give you feedback but DO NOT put any type annotations in the actual code:
 * the file will fail silently and you will be scratching your head for why it doesn't work!
 */

/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */

/**
 * Routes the data returned from the plugin (a 'type' and 'data' object).
 * This function is just a switch/router. Based on the type, call a function to process the data.
 * Do not do any processing here, just call the function to do the processing.
 * @param {string} type
 * @param {any} data
 */
function onMessageFromPlugin(type, data) {
  console.log(`onMessageFromPlugin: starting with type ${type} and data.itemID ${data.itemID == null ? 'n/a' : data.itemID}`)
  switch (type) {
    case 'removeItem':
      deleteItemRow(data)
      break
    case 'SET_REVIEWING_PROJECT':
      setReviewingProject(data)
      break
    case 'CLEAR_REVIEWING_PROJECT':
      clearReviewingProject(data)
      break
    // ...call other functions to process the data for other types of messages from the plugin
    default:
      console.log(`- unknown type: ${type}`)
      showError(`onMessageFromPlugin: received unknown type: ${type}`)
  }
}

/******************************************************************************
 *         DATA PROCESSING FUNCTIONS FOR RETURNED DATA FROM THE PLUGIN
 *****************************************************************************/
// these are the functions called in the onMessageFromPlugin function above

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
 * Set a project row as "reviewing" - marks it visually and updates the display
 * @param { { encodedFilename: string } } data
 */
function setReviewingProject(data) {
  const encodedFilename = data.encodedFilename
  if (!encodedFilename) {
    console.log(`setReviewingProject: no encodedFilename provided`)
    return
  }
  console.log(`setReviewingProject: for encodedFilename: ${encodedFilename}`)

  // First clear any existing 'reviewing' state on all project rows
  clearReviewingProject(data)

  // Then set 'reviewing' on the matching row
  const matchingRows = document.querySelectorAll('.project-grid-row.projectRow')
  let foundMatch = false
  for (const row of matchingRows) {
    if (row.dataset.encodedFilename === encodedFilename) {
      foundMatch = true
      console.log(`setReviewingProject: found match`)
      row.classList.add('reviewing')
      // And add another child of span "projectTagsInline" as `<span class="metadata-lozenge lozenge-reviewing">Under Review</span>`
      const projectTagsInline = row.querySelector('.projectTagsInline')
      if (projectTagsInline) {
        const newSpan = document.createElement('span')
        newSpan.className = 'metadata-lozenge lozenge-reviewing'
        newSpan.innerHTML = 'Under Review'
        projectTagsInline.appendChild(newSpan)
      }
    }
  }
  if (!foundMatch) {
    console.warn(`setReviewingProject: no projectRow matched encodedFilename '${encodedFilename}' (filtered out of list, or stale filename)`)
  }
}

/**
 * Clear the "reviewing" state from all project rows
 * @param { { encodedFilename: string } } data
 */
function clearReviewingProject(data) {
  // Don't need filename here, though leaving for future use
  // const encodedFilename = data.encodedFilename
  // if (!encodedFilename) {
  //   console.log(`clearReviewingProject: no encodedFilename provided`)
  //   return
  // }
  // console.log(`clearReviewingProject: for encodedFilename: ${encodedFilename}`)
  console.log(`clearReviewingProject: clearing all reviewing states`)

  // Clear any existing 'reviewing' state on all project rows
  const allRows = document.querySelectorAll('.project-grid-row.projectRow.reviewing')
  for (const row of allRows) {
    row.classList.remove('reviewing')
  }
  // Clear any existing 'reviewing' lozenges on all project rows
  const allLozenges = document.querySelectorAll('.metadata-lozenge.lozenge-reviewing')
  for (const lozenge of allLozenges) {
    lozenge.remove()
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
 * Event handler for various button 'click' events
 * Note: data is an object
 * @param {Object} data
 */
function onClickProjectListItem(data) {
  sendMessageToPlugin('onClickProjectListItem', data) // actionName, data
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

function showError(message) {
  const div = document.getElementById('error')
  if (div) {
    div.innerText = message
  }
}
