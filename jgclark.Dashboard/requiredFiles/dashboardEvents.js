/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
//--------------------------------------------------------------------------------------
// Scripts for setting up and handling all of the Dashboard events
// Last updated: 13.3.2024 for v1.0.0 by @jgclark

//--------------------------------------------------------------------------------------
// Add event handlers

addIconClickEventListeners()

addContentEventListeners()

addReviewProjectEventListeners()

addCallbackButtonEventListeners()

//--------------------------------------------------------------------------------------
// Show Modal Dialogs

/**
 * Show the action dialog to use on all items other than Projects
 * @param {any} dataObject 
 */
function showItemControlDialog(dataObject) {
  const openDialog = () => {
    dialog.showModal()
  }

  const closeDialog = () => {
    console.log("Closing actions dialog via function")
    // Enable keyboard shortcuts again
    enableDashboardShortcuts()
    dialog.close()
  }

  // Remove shortcuts that interfere with the dialog
  disableDashboardShortcuts()

  const thisID = dataObject.itemID
  const thisNoteType = dataObject.noteType
  const thisSectionType = dataObject.sectionType
  const reschedOrMove = dataObject.reschedOrMove // sending as a string, as I couldn't get boolean to be passed correctly
  const thisItemType = dataObject.itemType // 'task' | 'checklist'
  // Items can be moved or rescheduled -- we work out which is relevant in HTMLGeneratorGrid
  const dateChangeFunctionToUse = (reschedOrMove === 'resched') ? "updateTaskDate" : "moveFromCalToCal"
  // console.log(`- using ${dateChangeFunctionToUse} from ${reschedOrMove}`)
  const thisIDElement = document.getElementById(thisID)
  const thisEncodedContent = thisIDElement.dataset.encodedContent // i.e. the "data-encoded-content" element, with auto camelCase transposition
  const thisEncodedFilename = thisIDElement.dataset.encodedFilename
  const thisFilename = decodeRFC3986URIComponent(thisEncodedFilename)
  console.log(`dataObject() starting for ID:${thisID}, noteType:${thisNoteType}, sectionType:${thisSectionType}, itemType:${thisItemType}, filename:${thisEncodedFilename}`)

  const dialog = document.getElementById("itemControlDialog")

  // Set the dialog title from the filename
  const dialogItemNoteElem = document.getElementById('dialogItemNote')
  dialogItemNoteElem.innerHTML = thisFilename
  // Update text in the dialog for this particular item, if not empty
  const dialogItemContentElem = document.getElementById('dialogItemContent')
  // If we have some content, show an input control to edit it
  if (thisEncodedContent !== '') {
    dialogItemContentElem.value = decodeRFC3986URIComponent(thisEncodedContent)
    dialogItemContentElem.parentElement.style.display = "block"
  } else {
    dialogItemContentElem.parentElement.style.display = "none"
  }

  const possibleControlTypes = [
    // date change controls
    { controlStr: 't', sectionTypes: ['DY', 'DO', 'W', 'M', 'Q', 'OVERDUE', 'TAG'], handlingFunction: dateChangeFunctionToUse }, // special controlStr to indicate change to '>today'
    { controlStr: '+1d', sectionTypes: ['DT', 'DY', 'DO', 'W', 'M', 'OVERDUE', 'TAG'], handlingFunction: dateChangeFunctionToUse },
    { controlStr: '+1b', sectionTypes: ['DT', 'DY', 'DO', 'W', 'M', 'OVERDUE', 'TAG'], handlingFunction: dateChangeFunctionToUse },
    { controlStr: '+2d', sectionTypes: ['DT', 'DY', 'DO', 'W', 'M', 'OVERDUE', 'TAG'], handlingFunction: dateChangeFunctionToUse },
    { controlStr: '+0w', sectionTypes: ['DT', 'DY', 'DO', 'M', 'OVERDUE', 'TAG'], handlingFunction: dateChangeFunctionToUse },
    { controlStr: '+1w', sectionTypes: ['DT', 'DY', 'DO', 'W', 'OVERDUE', 'TAG'], handlingFunction: dateChangeFunctionToUse },
    { controlStr: '+2w', sectionTypes: ['DT', 'DY', 'DO', 'W', 'OVERDUE', 'TAG'], handlingFunction: dateChangeFunctionToUse },
    { controlStr: '+0m', sectionTypes: ['DT', 'DY', 'DO', 'W', 'Q', 'OVERDUE', 'TAG'], handlingFunction: dateChangeFunctionToUse },
    { controlStr: '+1m', sectionTypes: ['M', 'OVERDUE', 'TAG'], handlingFunction: dateChangeFunctionToUse },
    { controlStr: '+0q', sectionTypes: ['M', 'OVERDUE', 'TAG'], handlingFunction: dateChangeFunctionToUse },
    // other controls
    { controlStr: 'movetonote', sectionTypes: ['DT', 'DY', 'DO', 'W', 'M', 'Q', 'OVERDUE'], handlingFunction: 'moveToNote' },
    { controlStr: 'priup', sectionTypes: ['DT', 'DY', 'DO', 'W', 'M', 'Q', 'OVERDUE', 'TAG'], handlingFunction: 'cyclePriorityStateUp' },
    { controlStr: 'pridown', sectionTypes: ['DT', 'DY', 'DO', 'W', 'M', 'Q', 'OVERDUE', 'TAG'], handlingFunction: 'cyclePriorityStateDown' },
    { controlStr: 'tog', sectionTypes: ['OVERDUE', 'DT', 'DY', 'DO', 'W', 'M', 'Q', 'TAG'], handlingFunction: 'toggleType' },
    { controlStr: 'ct', sectionTypes: ['OVERDUE', 'TAG'], handlingFunction: 'completeTaskThen' },
    { controlStr: 'unsched', sectionTypes: ['OVERDUE', 'TAG'], notNoteType: 'Calendar', handlingFunction: 'unscheduleItem' }, // NB: only valid for noteType 'Note'
    { controlStr: 'update', sectionTypes: ['OVERDUE', 'DT', 'DY', 'DO', 'W', 'M', 'Q', 'TAG'], handlingFunction: 'updateItemContent' },
  ]
  const controlTypesForThisSection = possibleControlTypes.filter((t) => t.sectionTypes.includes(thisSectionType) && t.notNoteType !== thisNoteType)
  const controlStrsForThisSection = controlTypesForThisSection.map((t) => t.controlStr)
  console.log(controlStrsForThisSection)

  // remove previous event handlers
  // V1: simple 'button.removeEventListener('click', function (event) { ...}, false) didn't work for some reason
  // V2 Instead: Workaround suggested by Codeium AI:
  // Clone all the button elements, and then remove them. Requires re-finding all references afterwards.
  let allDialogButtons = document.getElementById("itemDialogButtons").getElementsByTagName("BUTTON")
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
  // As we go also (un)hide buttons that aren't relevant for this item type
  allDialogButtons = document.getElementById("itemDialogButtons").getElementsByTagName("BUTTON")
  let added = 0
  for (const button of allDialogButtons) {
    // Ignore the mainButton(s) (e.g.'Close')
    if (button.className === 'mainButton') {
      continue
    }

    const thisControlStr = button.dataset.controlStr
    const functionToInvoke = possibleControlTypes.filter((p) => p.controlStr === thisControlStr)[0].handlingFunction ?? '?'
    // let buttonDisplayString = possibleControlTypes.filter((p) => p.controlStr === thisControlStr)[0].displayString ?? '?'
    // console.log(`- adding button for ${thisControlStr} / ${thisFilename} / ${functionToInvoke}`)

    // Extra processing for 'Change to X' type button: update the icon the button label shows
    if (thisControlStr === 'tog') {
      // buttonDisplayString = buttonDisplayString.replace('X', (thisItemType === 'checklist') ? 'O' : '⃞')
      buttonDisplayString = `change to ${(thisItemType === 'checklist') ? '<i class="fa-regular fa-circle"></i>' : '<i class="fa-regular fa-square"></i>'}`
      // console.log(buttonDisplayString)
    }

    // add event handler and make visible
    // if it's a relevant one for this section
    if (controlStrsForThisSection.includes(thisControlStr)) {
      // console.log(`- displaying button ${thisControlStr}`)
      button.addEventListener('click', function (event) {
        event.preventDefault()
        handleButtonClick(thisID, functionToInvoke, thisControlStr, thisEncodedFilename, thisEncodedContent, thisItemType, event.metaKey)
      }, false)
      // Set button's text
      // button.innerHTML = buttonDisplayString
      // Set button visible
      button.style.display = "inline-block"
      added++
    } else {
      // console.log(`- NOT displaying button ${thisControlStr}`)
      button.style.display = "none"
    }
  }
  console.log(`- ${String(added)} button ELs added`)

  // Trap for Escape key to get it to call the close function
  // From https://stackoverflow.com/questions/27758991/css-html-modal-using-the-escape-key-click-outside-to-close
  // Note: Seems the EL has to be on document element
  // FIXME: this remove doesn't seem to work, so ELs build up
  document.removeEventListener('keyup', handleEscape)
  document.addEventListener('keyup', handleEscape)

  // Trap Close button to call the close function
  const closeButtonElem = document.querySelector('#closeButton')
  closeButtonElem.addEventListener('click', function (event) {
    console.log("Close button was pressed")
    event.preventDefault() // we don't want to submit -> reload the page
    closeDialog()
  })

  // Hide or Show button row 1 depending whether it has any non-hidden buttons
  const itemControlDialogMoveControls = document.getElementById("itemControlDialogMoveControls")
  const iCDMCB = itemControlDialogMoveControls.getElementsByTagName("BUTTON")
  let numICDMCBShown = 0
  for (const item of iCDMCB) {
    const itemComputedStyle = getComputedStyle(item, null)
    // console.log(itemComputedStyle.display)
    if (itemComputedStyle.display !== "none") {
      numICDMCBShown++
    }
  }
  // console.log(`"Move to" row set to ${(numICDMCBShown === 0) ? "none" : "block"}`)
  itemControlDialogMoveControls.style.display = (numICDMCBShown === 0) ? "none" : "block"
  itemControlDialogMoveControls.previousElementSibling.style.display = (numICDMCBShown === 0) ? "none" : "block"

  // Hide or Show button row 2 depending whether it has any non-hidden buttons
  const itemControlDialogOtherControls = document.getElementById("itemControlDialogOtherControls")
  const iCDOCB = itemControlDialogOtherControls.getElementsByTagName("BUTTON")
  let numICDOCBShown = 0
  for (const item of iCDOCB) {
    const itemComputedStyle = getComputedStyle(item, null)
    // console.log(itemComputedStyle.display)
    if (itemComputedStyle.display !== "none") {
      numICDOCBShown++
    }
  }
  // console.log(`"Other controls" row set to ${(numICDOCBShown === 0) ? "none" : "block"}`)
  itemControlDialogOtherControls.style.display = (numICDOCBShown === 0) ? "none" : "block"
  itemControlDialogOtherControls.previousElementSibling.style.display = (numICDOCBShown === 0) ? "none" : "block"

  // Set place on the screen for dialog to appear
  const approxDialogWidth = 490 // TODO: can we do better than this?
  const approxDialogHeight = 210
  setPositionForDialog(approxDialogWidth, approxDialogHeight, dialog, event)

  // Actually show the dialog
  dialog.showModal()
  // This then does work:
  // console.log(dialog.clientWidth, dialog.clientHeight)

  function handleEscape(event) {
    if (event.keyCode === 27) {
      console.log("ESC key was pressed")
      closeDialog()
    }
  }

  // For clicking on dialog buttons
  function handleButtonClick(id, type, controlStr, encodedFilename, encodedCurrentContent, itemType, metaModifier) {
    console.log(`Button clicked on id: ${id} for controlStr: ${controlStr}, type: ${type}, itemType: ${itemType}, encodedFilename: ${encodedFilename}, metaModifier: ${metaModifier}`)

    if (controlStr === 'update') {
      const encodedUpdatedContent = encodeRFC3986URIComponent(document.getElementById("dialogItemContent").value)
      console.log(`- orig content: {${encodedCurrentContent}} / updated content: {${encodedUpdatedContent}}`)

      onClickDashboardItem({
        itemID: id, type, controlStr: controlStr,
        encodedFilename: encodedFilename, encodedContent: encodedCurrentContent,
        encodedUpdatedContent: encodedUpdatedContent
      }) // = sendMessageToPlugin('onClickDashboardItem', ...)
    } else {
      onClickDashboardItem({
        itemID: id, type: type, controlStr: controlStr, itemType: itemType,
        encodedFilename: encodedFilename, encodedContent: encodedCurrentContent
      }) // = sendMessageToPlugin('onClickDashboardItem', ...)
    }

    // Dismiss dialog, unless meta key pressed
    if (!metaModifier) {
      closeDialog()
    } else {
      console.log(`Option key pressed. But closing dialog anyway.`)
      // Note: this is where we would want to update and re-gather the data-encoded-content, as it might well have changed.
      // But id might have changed, so so for now this is just as a future idea.
      closeDialog()
    }
  }
}

// ---------------------------------------------------------------------

/**
 * Show the action dialog to use on only Project items
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
  const thisID = dataObject.itemID
  const thisNoteTitle = decodeRFC3986URIComponent(dataObject.encodedTitle)
  const thisSectionType = 'PROJ'
  const thisIDElement = document.getElementById(thisID)
  const thisEncodedContent = thisIDElement.dataset.encodedContent // i.e. the "data-encoded-content" element, with auto camelCase transposition
  const thisEncodedFilename = thisIDElement.dataset.encodedFilename
  const thisFilename = decodeRFC3986URIComponent(thisEncodedFilename)
  console.log(`dataObject() starting for ID ${thisID}, type ${thisSectionType}, filename ${thisEncodedFilename}`)

  const dialog = document.getElementById("projectControlDialog")

  // Add close button event handler
  // const closeDialogBtn = document.getElementById("closeProjectControlDialog")
  // closeDialogBtn.addEventListener("click", closeDialog)

  // Set the dialog title from the filename
  const dialogItemNoteElem = document.getElementById('dialogProjectNote')
  dialogItemNoteElem.innerHTML = thisNoteTitle // thisFilename

  const possibleControlTypes = [
    { controlStr: 'finish', handlingFunction: 'reviewFinished' },
    { controlStr: 'nr+1w', handlingFunction: 'setNextReviewDate' },
    { controlStr: 'nr+2w', handlingFunction: 'setNextReviewDate' },
    { controlStr: 'nr+1m', handlingFunction: 'setNextReviewDate' },
    { controlStr: 'nr+1q', handlingFunction: 'setNextReviewDate' },
  ]
  const possibleCcontrolStrs = possibleControlTypes.map((t) => t.controlStr)
  console.log(String(possibleCcontrolStrs))


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
    // const buttonDisplayString = possibleControlTypes.filter((p) => p.controlStr === thisControlStr)[0].displayString ?? '?'
    // console.log(`- adding button for ${thisControlStr} / ${thisFilename} / ${functionToInvoke}`)

    // remove any previous event handlers
    button.removeEventListener('click', function (event) {
      event.preventDefault()
      handleButtonClick(thisID, functionToInvoke, thisControlStr, thisEncodedFilename, thisEncodedContent, '', event.metaKey)
    }, false)

    // add event handler and make visible
    // if it's a relevant one for this section
    if (possibleCcontrolStrs.includes(thisControlStr)) {
      // console.log(`- displaying button ${thisControlStr}`)
      button.addEventListener('click', function (event) {
        event.preventDefault()
        handleButtonClick(thisID, functionToInvoke, thisControlStr, thisEncodedFilename, thisEncodedContent, '', event.metaKey)
      }, false)
      // Set button's text
      // button.innerHTML = buttonDisplayString
      // Set button visible
      button.style.display = "inline-block"
      added++
    } else {
      // console.log(`- NOT displaying button ${thisControlStr}`)
      button.style.display = "none"
    }
  }
  console.log(`- ${String(added)} button ELs added`)

  // Actually show the dialog
  dialog.showModal()

  // Set place on the screen for dialog to appear
  const approxDialogWidth = 480 // TODO: can we do better than this?
  const approxDialogHeight = 110
  setPositionForDialog(approxDialogWidth, approxDialogHeight, dialog, event)

  // For clicking on dialog buttons
  function handleButtonClick(id, type, controlStr, encodedFilename, encodedCurrentContent, metaModifier) {
    console.log(`Button clicked on id: ${id} for controlStr: ${controlStr}, type: ${type}, encodedFilename: ${encodedFilename}, metaModifier: ${metaModifier}`)
    console.log(`- orig content: {${  encodedCurrentContent  }}`)

    onClickDashboardItem({ itemID: id, type: type, controlStr: controlStr, encodedFilename: encodedFilename, encodedContent: encodedCurrentContent }) // = sendMessageToPlugin('onClickDashboardItem', ...)

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
  console.log(`Window dimensions (approx): w${window.innerWidth} x h${window.innerHeight}`)
  console.log(`Mouse at x${mousex}, y${mousey}`)
  console.log(`Dialog dimesnions: w${approxDialogWidth} x h${approxDialogHeight}`)
  let x = mousex - Math.round((approxDialogWidth + fudgeFactor) / 3)
  if (x < fudgeFactor) { x = fudgeFactor }
  if ((x + (approxDialogWidth + fudgeFactor)) > window.innerWidth) {
    x = window.innerWidth - (approxDialogWidth + fudgeFactor)
    console.log(`Move left: now x${String(x)}`)
  }
  if (x < fudgeFactor) {
    x = fudgeFactor
    dialog.style.width = `${String(window.innerWidth - fudgeFactor)}px`
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
 * Add an event listener to all class="XCButton" items
 */
function addCallbackButtonEventListeners() {
  // Register click handlers for each 'PCButton' on the window with URL to call
  allPCButtons = document.getElementsByClassName("PCButton")
  let added = 0
  for (const button of allPCButtons) {
    const thisURL = button.dataset.callbackUrl
    // add event handler and make visible
    console.log(`- displaying button for XCB ${thisURL}`)
    button.addEventListener('click', function (event) {
      event.preventDefault()
      // console.log(`Attempting to call URL ${thisURL} ...`)
      // const myRequest = new Request(thisURL) // normally has await ...
      console.log(`Attempting to send message to plugin ${thisURL} ...`)
      // onClickDashboardItem({ itemID: id, type: type, controlStr: controlStr, encodedFilename: encodedFilename, encodedContent: encodedCurrentContent })
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

/** 
 *  For clicking on checkboxes
 */
function handleCheckboxClick(cb) {
  console.log(`Checkbox for ${cb.name} clicked, new value = ${cb.checked}`)
  onChangeCheckbox(cb.name, cb.checked) // = sendMessageToPlugin('onChangeCheckbox', ...)
}
