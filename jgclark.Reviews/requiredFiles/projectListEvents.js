/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
//--------------------------------------------------------------------------------------
// Scripts for setting up and handling all of the HTML events in Project Lists
// Note: this file is run as a script in the Project List window, _so DO NOT USE TYPE ANNOTATIONS, or IMPORTs_.
// Last updated: 2026-02-08 for v1.3.0.b8 by @jgclark
//--------------------------------------------------------------------------------------

// Add event handler
addCommandButtonEventListeners()

//--------------------------------------------------------------------------------------
// Show Modal Dialog

/**
 * Show the action dialog to use on Project items
 * @param {any} dataObject 
 */
function showProjectControlDialog(dataObject) {
  const openDialog = () => {
    dialog.showModal()
  }

  const closeDialog = () => {
    dialog.close()
  }

  const dialog = document.getElementById("projectControlDialog")
  const mousex = event.clientX  // Horizontal
  const mousey = event.clientY  // Vertical
  const thisID = dataObject.itemID
  const thisIDElement = document.getElementById(thisID)

  // Set the dialog header from the folder name and note title
  const thisEncodedFilename = dataObject.encodedFilename // i.e. the "data-encoded-filename" element, with auto camelCase transposition
  const thisFilename = decodeRFC3986URIComponent(dataObject.encodedFilename)
  const thisFolderName = getFolderFromFilename(thisFilename)
  const thisTitle = decodeRFC3986URIComponent(dataObject.encodedTitle)
  const dialogNoteFolderElem = document.getElementById('dialogProjectFolder')
  dialogNoteFolderElem.innerHTML = thisFolderName !== '' ? `${thisFolderName}/` : ''
  const dialogItemNoteElem = document.getElementById('dialogProjectNote')
  dialogItemNoteElem.innerHTML = thisTitle ?? thisFilename

  // One-time: add click handler to note name to open in  the Editor
  dialogItemNoteElem.dataset.encodedFilename = thisEncodedFilename
  if (!dialogItemNoteElem._dialogNoteClickHandlerAdded) {
    dialogItemNoteElem._dialogNoteClickHandlerAdded = true
    dialogItemNoteElem.addEventListener('click', function (event) {
      event.preventDefault()
      const encodedFilename = event.currentTarget.dataset.encodedFilename
      if (encodedFilename) {
        onClickProjectListItem({ itemID: '-', type: 'showNoteInEditorFromFilename', encodedFilename: encodedFilename, encodedContent: '' })
      }
    }, false)
  }

  // Set the dialog interval from the note
  const thisReviewInterval = dataObject.reviewInterval ?? ''
  const dialogItemIntervalElem = document.getElementById('dialogProjectInterval')
  dialogItemIntervalElem.innerHTML = ` (review every ${thisReviewInterval})`

  // Set latest progress summary (encoded for safe passing in onclick)
  const encodedLastProgress = dataObject.encodedLastProgressComment ?? ''
  const lastProgressComment = encodedLastProgress ? decodeRFC3986URIComponent(encodedLastProgress) : ''
  const dialogLatestProgressLabelElem = document.getElementById('dialogLatestProgressLabel')
  dialogLatestProgressLabelElem.textContent = lastProgressComment ? 'Latest: ' : ''
  const dialogLatestProgressTextElem = document.getElementById('dialogLatestProgressText')
  dialogLatestProgressTextElem.textContent = lastProgressComment ? `${lastProgressComment}` : ''

  console.log(`showProjectControlDialog() starting for filename '${thisFilename}', interval '${thisReviewInterval}', title '${thisTitle}'`)

  const possibleControlTypes = [
    { controlStr: 'start', handlingFunction: 'startReview' },
    { controlStr: 'finish', handlingFunction: 'reviewFinished' },
    { controlStr: 'nr+1w', handlingFunction: 'setNextReviewDate' },
    { controlStr: 'nr+2w', handlingFunction: 'setNextReviewDate' },
    { controlStr: 'nr+1m', handlingFunction: 'setNextReviewDate' },
    { controlStr: 'nr+1q', handlingFunction: 'setNextReviewDate' },
    { controlStr: 'newrevint', handlingFunction: 'setNewReviewInterval' },
    { controlStr: 'addtask', handlingFunction: 'quickAddTaskUnderHeading' },
    { controlStr: 'progress', handlingFunction: 'addProgress' },
    { controlStr: 'pause', handlingFunction: 'togglePause' },
    { controlStr: 'complete', handlingFunction: 'completeProject' },
    { controlStr: 'cancel', handlingFunction: 'cancelProject' },
  ]

  let allDialogButtons = document.getElementById("projectDialogButtons").getElementsByTagName("BUTTON")
  // remove previous event handlers
  // V1: simple 'button.removeEventListener('click', function (event) { ...}, false) didn't work for some reason
  // V2 Instead: Workaround suggested by Codeium AI:
  // Clone all the button elements, and then remove them. Requires re-finding all references afterwards.
  let removed = 0
  for (const button of allDialogButtons) {
    const clonedButton = button.cloneNode(true)
    // Replace the original element with the cloned element
    button.parentNode.replaceChild(clonedButton, button)
    removed++
  }
  // console.log(`- removed ${String(removed)} buttons' ELs`)

  // Register click handlers for each button in the dialog with details of this item
  // Using [HTML data attributes](https://developer.mozilla.org/en-US/docs/Learn/HTML/Howto/Use_data_attributes)
  allDialogButtons = document.getElementById("projectDialogButtons").getElementsByTagName("BUTTON")
  let added = 0
  for (const button of allDialogButtons) {
    // Ignore the mainButton(s) (e.g. 'Close')
    if (button.className === 'mainButton') {
      continue
    }
    const thisControlStr = button.dataset.controlStr
    const functionToInvoke = possibleControlTypes.filter((p) => p.controlStr === thisControlStr)[0].handlingFunction ?? '?'
    const buttonDisplayString = possibleControlTypes.filter((p) => p.controlStr === thisControlStr)[0].displayString ?? '?'
    // console.log(`- adding button for ${thisControlStr} / ${functionToInvoke}`)

    // add event handler and make visible
    // console.log(`- displaying button ${thisControlStr}`)
    button.addEventListener('click', function (event) {
      event.preventDefault()
      handleButtonClick(functionToInvoke, thisControlStr, thisEncodedFilename, event.metaKey)
    }, false)
    // Set button visible
    button.style.display = "inline-block"
    added++
  }
  // console.log(`- ${String(added)} button ELs added`)

  // Add click handler to close dialog when clicking outside (keep ref so we can remove on close)
  const clickOutsideHandler = (event) => {
    const dialogDimensions = dialog.getBoundingClientRect()
    if (
      event.clientX < dialogDimensions.left ||
      event.clientX > dialogDimensions.right ||
      event.clientY < dialogDimensions.top ||
      event.clientY > dialogDimensions.bottom
    ) {
      closeDialog()
    }
  }
  dialog.addEventListener('click', clickOutsideHandler)

  // Remove click-outside listener when dialog closes (avoids accumulating listeners)
  dialog.addEventListener('close', function removeClickOutsideListener() {
    dialog.removeEventListener('click', clickOutsideHandler)
  }, { once: true })

  // Actually show the dialog
  dialog.showModal()

  // Set place on the screen for dialog to appear
  const approxDialogWidth = 505 // TODO: can we do better than this?
  const approxDialogHeight = 120
  setPositionForDialog(approxDialogWidth, approxDialogHeight, dialog, event)

  // For clicking on dialog buttons
  function handleButtonClick(functionToInvoke, controlStr, encodedFilename, metaModifier) {
    console.log(`Button clicked on encodedFilename: ${encodedFilename} with controlStr: ${controlStr}, metaModifier: ${metaModifier}`)
    sendMessageToPlugin('onClickProjectListItem', { itemID: '-', type: functionToInvoke, controlStr: controlStr, encodedFilename: encodedFilename, metaModifier: metaModifier })
    // Dismiss dialog
    closeDialog()
  }
}

//--------------------------------------------------------------------------------------
// Utility Functions

/**
 * Get the folder name from the regular note filename, without leading or trailing slash.
 * Except for items in root folder -> ''.
 * Note: Copied, and tweaked slightly, from @helpers/folders.js to avoid imports.
 * TODO: Cope with Teamspace notes.
 * @param {string} fullFilename - full filename to get folder name part from
 * @returns {string} folder/subfolder name
 */
function getFolderFromFilename(fullFilename) {
  try {
    // If filename is empty, warn and return '(error)'
    if (!fullFilename) {
      logWarn('folders/getFolderFromFilename', `Empty filename given. Returning '(error)'`)
      return '(error)'
    }
    // Deal with special case of file in root -> ''
    if (!fullFilename.includes('/')) {
      return ''
    }
    // drop first character if it's a slash
    const filename = fullFilename.startsWith('/') ? fullFilename.substr(1) : fullFilename
    const filenameParts = filename.split('/')
    return filenameParts.slice(0, filenameParts.length - 1).join('/')
  } catch (error) {
    console.error(`getFolderFromFilename: Error getting folder from filename '${fullFilename}: ${error.message}`)
    return '(error)'
  }
}

// Set place in the HTML window for dialog to appear
function setPositionForDialog(approxDialogWidth, approxDialogHeight, dialog, event) {
  const fudgeFactor = 20 // pixels to take account of scrollbars etc.
  const mousex = event.clientX  // Horizontal
  const mousey = event.clientY  // Vertical

  // Harder than it looks in Safari, as left/top seem to be relative to middle of window, not top-left.
  // And, in Safari, it leaves quite a clear area around edge of window where it will not put the dialog.
  // Note: in the future the draft spec for CSS Anchor Positioning could be helpful for positioning this dialog relative to other things
  // Check if this is going to be outside available window width
  // Note: accessing dialog.clientWidth doesn't work, as dialog is not yet drawn
  // Note: not sure why window.clientWidth doesn't work either, so using inner... which then requires a fudge factor for scrollbars
  console.log(`Window dimensions (approx): w${window.innerWidth} x h${window.innerHeight}`)
  console.log(`Mouse at x${mousex}, y${mousey}`)
  console.log(`Dialog dimensions: w${approxDialogWidth} x h${approxDialogHeight} / fudgeFactor ${String(fudgeFactor)}`)
  let x = mousex - Math.round((approxDialogWidth + fudgeFactor) / 3)
  if (x < fudgeFactor) { x = fudgeFactor }
  if ((x + (approxDialogWidth + fudgeFactor)) > window.innerWidth) {
    x = window.innerWidth - (approxDialogWidth + fudgeFactor)
    console.log(`Move left: now x${String(x)}`)
  }
  if (x < fudgeFactor) {
    x = fudgeFactor
    const maxW = Math.round(window.innerWidth * 0.8)
    dialog.style.width = `${String(Math.min(window.innerWidth - fudgeFactor, maxW))}px`
    console.log(`Off left: now x=0; width=${dialog.style.width}`)
  }

  let y = mousey - Math.round((approxDialogHeight + fudgeFactor) / 2)
  if (y < fudgeFactor) { y = fudgeFactor }
  if ((y + (approxDialogHeight + fudgeFactor)) > window.innerHeight) {
    y = window.innerHeight - (approxDialogHeight + fudgeFactor)
    console.log(`Move up: now y${String(y)}`)
  }
  if (y < fudgeFactor) {
    y = fudgeFactor
    dialog.style.height = `${String(window.innerHeight - fudgeFactor)}px`
    console.log(`Off top: now y=0; height=${dialog.style.height}`)
  }

  dialog.style.left = `${String(x)}px`
  dialog.style.top = `${String(y)}px`
  console.log(`-> x${x}, y${y} / w${dialog.style.width} x h${dialog.style.height}`)
}

//--------------------------------------------------------------------------------------
// add various Event Listeners

/**
 * Add event listener added to all todo + checklist icons
 */
function addIconClickEventListeners() {
  // console.log('add Event Listeners to Icons ...')

  // Add event handlers for task icons
  const allTodos = document.getElementsByClassName("sectionItemTodo")
  for (const thisTodo of allTodos) {
    const itemElem = thisTodo.parentElement
    const thisId = itemElem.id
    const thisEncodedFilename = itemElem.dataset.encodedFilename
    const thisEncodedContent = itemElem.dataset.encodedContent
    // console.log('-> (', thisId, 'open', thisEncodedFilename, thisEncodedContent, 'meta?', ')')
    thisTodo.addEventListener('click', function () {
      const metaModifier = event.metaKey
      handleIconClick(thisId, 'open', thisEncodedFilename, thisEncodedContent, metaModifier)
    }, false)
  }
  console.log(`${String(allTodos.length)} sectionItemTodo ELs added (to icons)`)

  // Add event handlers for checklist icons
  const allChecklists = document.getElementsByClassName("sectionItemChecklist")
  for (const thisChecklist of allChecklists) {
    const itemElem = thisChecklist.parentElement
    const thisId = itemElem.id
    const thisEncodedFilename = itemElem.dataset.encodedFilename
    const thisEncodedContent = itemElem.dataset.encodedContent
    // console.log('-> (', thisId, 'checklist', thisEncodedFilename, thisEncodedContent, 'meta?', ')')
    thisChecklist.addEventListener('click', function () {
      const metaModifier = event.metaKey
      handleIconClick(thisId, 'checklist', thisEncodedFilename, thisEncodedContent, metaModifier)
    }, false)
  }
  console.log(`${String(allChecklists.length)} sectionItemChecklist ELs added (to icons)`)
}

/**
 * Add an event listener to all content items (not the icons),
 * except ones with class 'noteTitle', as they get their own onClick definition
 * Uses [HTML data attributes](https://developer.mozilla.org/en-US/docs/Learn/HTML/Howto/Use_data_attributes)
 */
function addContentEventListeners() {
  // console.log('add Event Listeners to Content...')

  // Add click handler to all sectionItemContent items (which already have a basic <a>...</a> wrapper)
  // const allContentItems = document.getElementsByClassName("sectionItemContent")
  const allContentItems = document.getElementsByClassName("content")
  for (const contentItem of allContentItems) {
    // const thisRowElem = contentItem.parentElement
    const thisRowElem = contentItem.parentElement.parentElement
    const thisID = thisRowElem.id
    const thisEncodedContent = thisRowElem.dataset.encodedContent // i.e. the "data-encoded-content" element, with auto camelCase transposition
    const thisEncodedFilename = thisRowElem.dataset.encodedFilename // contentItem.id
    // console.log('- sIC on ' + thisID + ' / ' + thisEncodedFilename + ' / ' + thisEncodedContent)

    // add event handler to each <a> (normally only 1 per item),
    // unless it's a noteTitle, which gets its own click handler.
    const thisLink = contentItem
    // console.log('- A on ' + thisID + ' / ' + thisEncodedFilename + ' / ' + thisEncodedContent + ' / ' + thisLink.className)
    if (!thisLink.className.match('noteTitle')) {
      thisLink.addEventListener('click', function (event) {
        event.preventDefault()
        handleContentClick(event, thisID, thisEncodedFilename, thisEncodedContent)
      }, false)
    }
  }
  console.log(`${String(allContentItems.length)} sectionItem ELs added (to content links)`)
  // handleContentClick is defined at script level below
}

/**
 * Add an event listener to all class="reviewProject" items
 */
function addReviewProjectEventListeners() {
  // console.log('add Event Listeners to reviewProject items...')

  // Add click handler to all 'review' class items (which already have a basic <a>...</a> wrapper)
  // Using [HTML data attributes](https://developer.mozilla.org/en-US/docs/Learn/HTML/Howto/Use_data_attributes)
  const allReviewItems = document.getElementsByClassName("reviewProject")
  for (const reviewItem of allReviewItems) {
    const thisID = reviewItem.parentElement.id
    const thisEncodedFilename = reviewItem.parentElement.dataset.encodedFilename // i.e. the "data-encoded-review" element, with auto camelCase transposition
    // add event handler
    reviewItem.addEventListener('click', function (event) {
      event.preventDefault()
      handleIconClick(thisID, 'review', thisEncodedFilename, '-', event.metaKey)
    }, false)
  }
  // console.log(`${String(allReviewItems.length)} review ELs added`)
}

/**
 * Add an event listener to all class="PCButton" items
 */
function addCommandButtonEventListeners() {
  // Register click handlers for each 'PCButton' on the window with URL to call
  const allPCButtons = document.getElementsByClassName("PCButton")
  let added = 0
  for (const button of allPCButtons) {
    // Skip Display filters button (opens dropdown, no plugin command)
    if (button.id === 'displayFiltersButton') continue
    // add event handler and make visible
    // console.log(`- displaying button for PCB function ${button.dataset.command}`)
    button.addEventListener('click', function (event) {
      event.preventDefault()
      // console.log(`Attempting to send plugin command '${button.dataset.command}' ...`)
      const theseCommandArgs = (button.dataset.commandArgs).split(',')
      sendMessageToPlugin('runPluginCommand', { pluginID: button.dataset.pluginId, commandName: button.dataset.command, commandArgs: theseCommandArgs })
    }, false)
    added++
  }
  // console.log(`- ${String(added)} PCButton ELs added`)
}

//--------------------------------------------------------------------------------------
// Click Handlers

/**
 * Handle clicking on item icons
 */
function handleIconClick(id, itemType, encodedfilename, encodedcontent, metaModifier) {
  console.log(`handleIconClick( ${id} / ${itemType} / ${encodedfilename}/ {${encodedcontent}} / ${String(metaModifier)} )`)
  const encodedFilename = encodedfilename
  const encodedContent = encodedcontent

  switch (itemType) {
    case 'open': {
      onClickProjectListItem({ itemID: id, type: (metaModifier) ? 'cancelTask' : 'completeTask', encodedFilename: encodedFilename, encodedContent: encodedContent })
      break
    }
    case 'checklist': {
      onClickProjectListItem({ itemID: id, type: (metaModifier) ? 'cancelChecklist' : 'completeChecklist', encodedFilename: encodedFilename, encodedContent: encodedContent })
      break
    }
    case 'review': {
      onClickProjectListItem({ itemID: id, type: 'showNoteInEditorFromFilename', encodedFilename: encodedFilename, encodedContent: '' })
      break
    }
    default: {
      console.error(`- unknown itemType: ${itemType}`)
      break
    }
  }
}

/**
 * Handle clicking on main 'paragraph content'. Used by addContentEventListeners() when content links are clicked.
 * @param {Event} event - DOM click event
 * @param {string} id - item ID
 * @param {string} encodedfilename - RFC3986-encoded filename
 * @param {string} encodedcontent - RFC3986-encoded content
 */
function handleContentClick(event, id, encodedfilename, encodedcontent) {
  console.log(`handleContentClick( ${id} / ${encodedfilename} / ${encodedcontent} ) for event currentTarget: ${event.currentTarget}`)
  const encodedFilename = encodedfilename
  const encodedContent = encodedcontent
  onClickProjectListItem({ itemID: id, type: 'showNoteInEditorFromFilename', encodedFilename: encodedFilename, encodedContent: '' })
}
