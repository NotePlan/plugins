/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
// TODO: Add flow in here
//--------------------------------------------------------------------------------------
// Scripts for setting up and handling all of the HTML events in Project Lists
// Last updated: 30.3.2024 for v0.14.0 by @jgclark

//--------------------------------------------------------------------------------------
// Add event handlers

// Note: // Not yet used
// addIconClickEventListeners()
// addContentEventListeners()
// addReviewProjectEventListeners()

addPluginCommandButtonEventListeners()

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

  const mousex = event.clientX  // Horizontal
  const mousey = event.clientY  // Vertical
  // const thisID = dataObject.itemID
  // const thisIDElement = document.getElementById(thisID)
  // const thisEncodedFilename = thisIDElement.dataset.encodedFilename // i.e. the "data-encoded-filename" element, with auto camelCase transposition
  const thisEncodedFilename = dataObject.encodedFilename
  const thisFilename = decodeRFC3986URIComponent(thisEncodedFilename)
  // console.log(`dataObject() starting for ID ${thisID}, filename ${thisEncodedFilename}`)
  console.log(`dataObject() starting for filename ${thisEncodedFilename}`)

  const dialog = document.getElementById("projectControlDialog")

  // Set the dialog title from the filename
  const dialogItemNoteElem = document.getElementById('dialogProjectNote')
  dialogItemNoteElem.innerHTML = thisFilename // TODO(later): use note title

  const possibleControlTypes = [
    // { displayString: 'Finish Review <i class="fa-solid fa-flag-checkered"></i>', controlStr: 'reviewed', handlingFunction: 'reviewFinished' },
    { controlStr: 'finish', handlingFunction: 'reviewFinished' },
    { controlStr: 'nr+1w', handlingFunction: 'setNextReviewDate' },
    { controlStr: 'nr+2w', handlingFunction: 'setNextReviewDate' },
    { controlStr: 'nr+1m', handlingFunction: 'setNextReviewDate' },
    { controlStr: 'nr+1q', handlingFunction: 'setNextReviewDate' },
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
  console.log(`- removed ${String(removed)} buttons' ELs`)

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

  console.log(`- ${String(added)} button ELs added`)

  // Actually show the dialog
  dialog.showModal()

  // Set place on the screen for dialog to appear
  const approxDialogWidth = 480 // TODO: can we do better than this?
  const approxDialogHeight = 110
  setPositionForDialog(approxDialogWidth, approxDialogHeight, dialog, event)

  // For clicking on dialog buttons
  function handleButtonClick(functionToInvoke, controlStr, encodedFilename, metaModifier) {
    console.log(`Button clicked on encodedFilename: ${encodedFilename} with controlStr: ${controlStr}, metaModifier: ${metaModifier}`)

    // onClickProjectListItem({ itemID: '-', controlStr: controlStr, encodedFilename: encodedFilename}) // = sendMessageToPlugin('onClickProjectListItem', ...)
    sendMessageToPlugin('onClickProjectListItem', { itemID: '-', type: functionToInvoke, controlStr: controlStr, encodedFilename: encodedFilename, metaModifier: metaModifier })
    // Dismiss dialog
    closeDialog()
  }
}

//--------------------------------------------------------------------------------------
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
  // console.log(`Mouse at x${mousex}, y${mousey}`)
  // console.log(`Window dimensions (approx): w${window.innerWidth}, h${window.innerHeight}`)
  // console.log(`Dialog dimesnions: w${approxDialogWidth}, h${approxDialogHeight}`)
  let x = mousex - Math.round((approxDialogWidth + fudgeFactor) / 3)
  if (x < fudgeFactor) { x = fudgeFactor }
  if ((x + (approxDialogWidth + fudgeFactor)) > window.innerWidth) {
    x = window.innerWidth - (approxDialogWidth + fudgeFactor)
    // console.log(`Too wide: now ${String(x)}`)
  }
  if (x < fudgeFactor) {
    x = fudgeFactor
    dialog.style.width = `${String(window.innerWidth)}px`
    // console.log(`Off left: now x=0; width=w${dialog.style.width}`)
  }

  let y = mousey - Math.round((approxDialogHeight + fudgeFactor) / 2)
  if (y < fudgeFactor) { y = fudgeFactor }
  if ((y + (approxDialogHeight + fudgeFactor)) > window.innerHeight) {
    y = window.innerHeight - (approxDialogHeight + fudgeFactor)
    // console.log(`Too tall: now ${String(y)}`)
  }
  if (y < fudgeFactor) {
    y = fudgeFactor
    dialog.style.height = `${String(window.innerHeight)}px`
    // console.log(`Off top: now y=0; height=w${dialog.style.height}`)
  }

  dialog.style.left = `${String(x)}px`
  dialog.style.top = `${String(y)}px`
  console.log(`-> x${x}, y${y}`)
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
    const thisEncodedContent = thisRowElem.dataset.encodedContent // i.e. the "data-encoded-content" element, with auto camelCaseransposition
    const thisEncodedFilename = thisRowElem.dataset.encodedFilename // contentItem.id
    // console.log('- sIC on ' + thisID + ' / ' + thisEncodedFilename + ' / ' + thisEncodedContent)

    // add event handler to each <a> (normally only 1 per item),
    // unless it's a noteTitle, which gets its own click handler.
    // const theseALinks = contentItem.getElementsByTagName("A")
    // for (const thisLink of theseALinks) {
    const thisLink = contentItem
    // console.log('- A on ' + thisID + ' / ' + thisEncodedFilename + ' / ' + thisEncodedContent + ' / ' + thisLink.className)
    if (!thisLink.className.match('noteTitle')) {
      thisLink.addEventListener('click', function (event) {
        event.preventDefault()
        handleContentClick(event, thisID, thisEncodedFilename, thisEncodedContent)
      }, false)
    }
    // }

    // // add event handler to each "div.content" (normally only 1 per item),
    // const theseDIVLinks = contentItem.getElementsByTagName("DIV")
    // for (const thisLink of theseDIVLinks) {
    //   if (thisLink.className.match('content') && !(thisLink.className.match('tooltip'))) {
    //     console.log('DIV.content on ' + thisID + ' / ' + thisEncodedFilename + ' / ' + thisLink.className)
    //     thisLink.addEventListener('click', function (event) {
    //       // event.preventDefault(); // now disabled to ensure that externalLinks etc. can fire
    //       handleContentClick(event, thisID, thisEncodedFilename, thisEncodedContent)
    //     }, false)
    //   }
    // }
  }
  console.log(`${String(allContentItems.length)} sectionItem ELs added (to content links)`)

  // For clicking on main 'paragraph content'
  function handleContentClick(event, id, encodedFilename, encodedContent) {
    console.log(`handleContentClick( ${id} / ${encodedFilename} / ${encodedContent} ) for event currentTarget: ${event.currentTarget}`)
    // already encoded at this point. Was: const encodedFilename = encodeRFC3986URIComponent(filename);
    // already encoded at this point. Was: const encodedContent = encodeRFC3986URIComponent(content);
    onClickDashboardItem({ itemID: id, type: 'showLineInEditorFromFilename', encodedFilename: encodedFilename, encodedContent: encodedContent }) // TEST: change from showNote.. to showLine...
  }
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
  console.log(`${String(allReviewItems.length)} review ELs added`)
}

/**
 * Add an event listener to all class="Commandutton" items
 */
function addPluginCommandButtonEventListeners() {
  // Register click handlers for each 'CommandButton' on the window with URL to call
  allCommandButtons = document.getElementsByClassName("CommandButton")
  let added = 0
  for (const button of allCommandButtons) {
    // const thisURL = button.dataset.PluginCommandUrl
    // add event handler and make visible
    console.log(`- displaying button for Command ${thisURL}`)
    button.addEventListener('click', function (event) {
      event.preventDefault()
      // console.log(`Attempting to call URL ${thisURL} ...`)
      // const myRequest = new Request(thisURL) // normally has await ...
      // console.log(`Attempting to send message to plugin ${thisURL} ...`)
      // onClickDashboardItem({ itemID: id, type: type, controlStr: controlStr, encodedFilename: encodedFilename, encodedContent: encodedCurrentContent })
      console.log(`Attempting to send command '${button.dataset.command}' to plugin ${button.dataset.pluginId} ...`)
      const theseCommandArgs = (button.dataset.commandArgs).split(',')
      sendMessageToPlugin('runPluginCommand', { pluginID: button.dataset.pluginId, commandName: button.dataset.command, commandArgs: theseCommandArgs })
    }, false)
    added++
  }
  console.log(`- ${String(added)} button ELs added`)

}

//--------------------------------------------------------------------------------------
// Handle various clicks

/**
 * Handle clicking on item icons
 */
function handleIconClick(id, itemType, encodedfilename, encodedcontent, metaModifier) {
  console.log(`handleIconClick( ${id} / ${itemType} / ${encodedfilename}/ {${encodedcontent}} / ${String(metaModifier)} )`)
  const encodedFilename = encodedfilename
  const encodedContent = encodedcontent

  switch (itemType) {
    case 'open': {
      onClickDashboardItem({ itemID: id, type: (metaModifier) ? 'cancelTask' : 'completeTask', encodedFilename: encodedFilename, encodedContent: encodedContent })
      break
    }
    case 'checklist': {
      onClickDashboardItem({ itemID: id, type: (metaModifier) ? 'cancelChecklist' : 'completeChecklist', encodedFilename: encodedFilename, encodedContent: encodedContent })
      break
    }
    case 'review': {
      onClickDashboardItem({ itemID: id, type: 'showNoteInEditorFromFilename', encodedFilename: encodedFilename, encodedContent: '' })
      break
    }
    default: {
      console.error(`- unknown itemType: ${itemType}`)
      break
    }
  }
}

/** 
 *  For clicking on main 'paragraph encodedcontent'
 */
function handleContentClick(event, id, encodedfilename, encodedcontent) {
  console.log(`handleContentClick( ${id} / ${encodedfilename} / ${encodedcontent} ) for event currentTarget: ${event.currentTarget}`)
  const encodedFilename = encodedfilename
  const encodedContent = encodedcontent
  onClickDashboardItem({ itemID: id, type: 'showLineInEditorFromFilename', encodedFilename: encodedFilename, encodedContent: encodedContent })
}
