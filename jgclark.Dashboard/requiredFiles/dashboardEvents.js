/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
//--------------------------------------------------------------------------------------
// Scripts for setting up and handling all of the Dashboard events
// Last updated: 9.3.2024 for v1.0.0 by @jgclark

//--------------------------------------------------------------------------------------
// Add event handlers

addIconClickEventListeners()

addContentEventListeners()

addReviewProjectEventListeners()

//--------------------------------------------------------------------------------------
// Show Modal Dialogs

function showItemControlDialog(dataObject) {
  const openDialog = () => {
    dialog.showModal()
  }

  const closeDialog = () => {
    dialog.close()
  }

  const thisID = dataObject.itemID
  const thisSectionType = dataObject.sectionType
  const reschedOrMove = dataObject.reschedOrMove // sending as a string, as I couldn't get boolean to be passed correctly
  const thisItemType = dataObject.itemType // 'task' or 'checklist'
  const dateChangeFunctionToUse = (reschedOrMove === 'resched') ? "updateTaskDate" : "moveFromCalToCal"
  // console.log(`- using ${dateChangeFunctionToUse} from ${reschedOrMove}`)
  const thisIDElement = document.getElementById(thisID)
  const thisEncodedContent = thisIDElement.dataset.encodedContent // i.e. the "data-encoded-content" element, with auto camelCase transposition
  const thisEncodedFilename = thisIDElement.dataset.encodedFilename
  const thisFilename = decodeRFC3986URIComponent(thisEncodedFilename)
  console.log(`dataObject() starting for ID ${thisID}, type ${thisSectionType}, itemType ${thisItemType}, filename ${thisEncodedFilename}`)

  const dialog = document.getElementById("itemControlDialog")
  const closeDialogBtn = document.getElementById("closeTaskControlDialog")

  // Set the dialog title from the filename
  const dialogItemNoteElem = document.getElementById('dialogItemNote')
  dialogItemNoteElem.innerHTML = thisFilename
  // Update text in the dialog for this particular item, if not empty
  const dialogItemContentElem = document.getElementById('dialogItemContent')
  if (thisEncodedContent !== '') {
    // For previous text label:
    // dialogItemContentElem.innerHTML = `${thisItemType} '${decodeRFC3986URIComponent(thisEncodedContent)}'`
    // For newer input box
    dialogItemContentElem.value = decodeRFC3986URIComponent(thisEncodedContent)
    dialogItemContentElem.parentElement.style.display = "block"
  } else {
    dialogItemContentElem.parentElement.style.display = "none"
  }

  const possibleControlTypes = [
    { displayString: 'today', controlStr: 't', sectionTypes: ['DY', 'W', 'M', 'Q', 'OVERDUE'], handlingFunction: dateChangeFunctionToUse }, // special controlStr to indicate change to '>today'
    { displayString: '+1d', controlStr: '+1d', sectionTypes: ['DT', 'DY', 'W', 'M', 'OVERDUE'], handlingFunction: dateChangeFunctionToUse },
    { displayString: '+1b', controlStr: '+1b', sectionTypes: ['DT', 'DY', 'W', 'M', 'OVERDUE'], handlingFunction: dateChangeFunctionToUse },
    { displayString: '+2d', controlStr: '+2d', sectionTypes: ['DT', 'DY', 'W', 'M', 'OVERDUE'], handlingFunction: dateChangeFunctionToUse },
    { displayString: 'this week', controlStr: '+0w', sectionTypes: ['DT', 'DY', 'M', 'OVERDUE'], handlingFunction: dateChangeFunctionToUse },
    { displayString: '+1w', controlStr: '+1w', sectionTypes: ['DT', 'DY', 'W', 'OVERDUE'], handlingFunction: dateChangeFunctionToUse },
    { displayString: '+2w', controlStr: '+2w', sectionTypes: ['DT', 'DY', 'W', 'OVERDUE'], handlingFunction: dateChangeFunctionToUse },
    { displayString: 'this month', controlStr: '+0m', sectionTypes: ['DT', 'DY', 'W', 'Q', 'OVERDUE'], handlingFunction: dateChangeFunctionToUse },
    { displayString: '+1m', controlStr: '+1m', sectionTypes: ['M', 'OVERDUE'], handlingFunction: dateChangeFunctionToUse },
    { displayString: 'this quarter', controlStr: '+0q', sectionTypes: ['M', 'OVERDUE'], handlingFunction: dateChangeFunctionToUse },
    { displayString: 'move to note', controlStr: 'movetonote', sectionTypes: ['DT', 'DY', 'W', 'M', 'Q', 'OVERDUE'], handlingFunction: 'moveToNote' },
    { displayString: 'unschedule', controlStr: 'unsched', sectionTypes: ['OVERDUE', 'TAG'], handlingFunction: 'unscheduleItem' },
    { displayString: 'priority ↑', controlStr: 'priup', sectionTypes: ['DT', 'DY', 'W', 'M', 'Q', 'OVERDUE', 'TAG'], handlingFunction: 'cyclePriorityStateUp' },
    { displayString: 'priority ↓', controlStr: 'pridown', sectionTypes: ['DT', 'DY', 'W', 'M', 'Q', 'OVERDUE', 'TAG'], handlingFunction: 'cyclePriorityStateDown' },
    { displayString: 'change to X', controlStr: 'tog', sectionTypes: ['OVERDUE', 'DT', 'DY', 'W', 'M', 'Q', 'TAG'], handlingFunction: 'toggleType' },
    { displayString: 'complete then', controlStr: 'ct', sectionTypes: ['OVERDUE', 'TAG'], handlingFunction: 'completeTaskThen' },
    { displayString: 'Update', controlStr: 'update', sectionTypes: ['OVERDUE', 'DT', 'DY', 'W', 'M', 'Q', 'TAG'], handlingFunction: 'updateItemContent' },
  ]
  const controlTypesForThisSection = possibleControlTypes.filter((t) => t.sectionTypes.includes(thisSectionType))
  const controlStrsForThisSection = controlTypesForThisSection.map((t) => t.controlStr)
  console.log(String(controlStrsForThisSection))

  // Register click handlers for each button in the dialog with details of this item
  // Using [HTML data attributes](https://developer.mozilla.org/en-US/docs/Learn/HTML/Howto/Use_data_attributes)
  // As we go also (un)hide buttons that aren't relevant for this item type
  const allDialogButtons = document.getElementById("itemDialogButtons").getElementsByTagName("BUTTON")
  let added = 0
  for (const button of allDialogButtons) {
    // Ignore the submitButton(s) (e.g.'Close')
    if (button.className === 'submitButton') {
      continue
    }

    // remove previous event handlers
    // FIXME: not getting removed, at least for toggle
    // Can we list them?
    button.removeEventListener('click', function (event) {
      event.preventDefault()
      handleButtonClick(thisID, functionToInvoke, thisControlStr, thisEncodedFilename, thisEncodedContent, thisItemType, event.metaKey)
    }, false)

    const thisControlStr = button.dataset.controlStr
    const functionToInvoke = possibleControlTypes.filter((p) => p.controlStr === thisControlStr)[0].handlingFunction ?? '?'
    let buttonDisplayString = possibleControlTypes.filter((p) => p.controlStr === thisControlStr)[0].displayString ?? '?'
    if (thisControlStr === 'tog') {
      // buttonDisplayString = buttonDisplayString.replace('X', (thisItemType === 'checklist') ? 'O' : '⃞')
      console.log(buttonDisplayString)
      buttonDisplayString = `change to ${(thisItemType === 'checklist') ? '<i class="fa-regular fa-circle"></i>' : '<i class="fa-regular fa-square"></i>'}`
      console.log(buttonDisplayString)
    }
    // console.log(`- adding button for ${thisControlStr} / ${thisFilename} / ${functionToInvoke}`)

    // add event handler and make visible
    // if it's a relevant one for this section
    if (controlStrsForThisSection.includes(thisControlStr)) {
      // console.log(`- displaying button ${thisControlStr}`)
      button.addEventListener('click', function (event) {
        event.preventDefault()
        handleButtonClick(thisID, functionToInvoke, thisControlStr, thisEncodedFilename, thisEncodedContent, thisItemType, event.metaKey)
      }, false)
      // Set button's text
      button.innerHTML = buttonDisplayString
      // Set button visible
      button.style.display = "inline-block"
      added++
    } else {
      // console.log(`- NOT displaying button ${thisControlStr}`)
      button.style.display = "none"
    }
  }
  console.log(`- ${String(added)} button ELs added`)

  // If we have "change to X" then replace last character with the right icon


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

  // Add close button event
  closeDialogBtn.addEventListener("click", closeDialog)

  // Set place on the screen for dialog to appear
  const approxDialogWidth = 530 // TODO: can we do better than this?
  const approxDialogHeight = 180
  setPositionForDialog(approxDialogWidth, approxDialogHeight, dialog, event)

  // Actually show the dialog
  dialog.showModal()
  // This does work:
  // console.log(dialog.clientWidth, dialog.clientHeight)

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
      // re-gather the content part, as it might just have changed
      const thisElement = document.getElementById(id)
      // // TODO: doesn't get here??  Is this needed for Priority?
      // console.log(`- ${thisElement.outerText}`)
      // const updatedContent = thisElement.getAttribute('data-encoded-content') ?? '<error>'
      // console.log(`- updated content: {${  updatedContent  }}`)
    }
  }
}

// ---------------------------------------------------------------------

// // Handle updating content in the dialog
// function updateItemContent() {
//   console.log("Called updateContent")
//   const dialogInputElem = document.getElementById("dialogItemContent")
//   const updatedContent = dialogInputElem.value
//   console.log("-> " + updatedContent)
//   // TODO: ...
// }

// ---------------------------------------------------------------------

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
  const thisEncodedContent = thisIDElement.dataset.encodedContent; // i.e. the "data-encoded-content" element, with auto camelCase transposition
  const thisEncodedFilename = thisIDElement.dataset.encodedFilename
  const thisFilename = decodeRFC3986URIComponent(thisEncodedFilename)
  console.log(`dataObject() starting for ID ${thisID}, type ${thisSectionType}, filename ${thisEncodedFilename}`)

  const dialog = document.getElementById("projectControlDialog")
  const closeDialogBtn = document.getElementById("closeProjectControlDialog")

  // Set the dialog title from the filename
  const dialogItemNoteElem = document.getElementById('dialogProjectNote')
  dialogItemNoteElem.innerHTML = thisNoteTitle // thisFilename

  const possibleControlTypes = [
    { displayString: 'finish review', controlStr: 'reviewed', handlingFunction: 'reviewFinished' },
    { displayString: 'skip +1w', controlStr: 'nr+1w', handlingFunction: 'setNextReviewDate' },
    { displayString: 'skip +2w', controlStr: 'nr+2w', handlingFunction: 'setNextReviewDate' },
    { displayString: 'skip +1m', controlStr: 'nr+1m', handlingFunction: 'setNextReviewDate' },
    { displayString: 'skip +1q', controlStr: 'nr+1q', handlingFunction: 'setNextReviewDate' },
  ]
  const possibleCcontrolStrs = possibleControlTypes.map((t) => t.controlStr)
  console.log(String(possibleCcontrolStrs))

  // Register click handlers for each button in the dialog with details of this item
  // Using [HTML data attributes](https://developer.mozilla.org/en-US/docs/Learn/HTML/Howto/Use_data_attributes)
  // As we go also (un)hide buttons that aren't relevant for this item type
  const allDialogButtons = document.getElementById("projectDialogButtons").getElementsByTagName("BUTTON")
  let added = 0
  for (const button of allDialogButtons) {
    // Ignore the submitButton(s) (e.g. 'Close')
    if (button.className === 'submitButton') {
      continue
    }
    const thisControlStr = button.dataset.controlStr
    const functionToInvoke = possibleControlTypes.filter((p) => p.controlStr === thisControlStr)[0].handlingFunction ?? '?'
    const buttonDisplayString = possibleControlTypes.filter((p) => p.controlStr === thisControlStr)[0].displayString ?? '?'
    console.log(`- adding button for ${thisControlStr} / ${thisFilename} / ${functionToInvoke}`)
    console.log(`  ${button.outerHTML}`)

    // remove any previous event handlers
    button.removeEventListener('click', function (event) {
      event.preventDefault()
      handleButtonClick(thisID, functionToInvoke, thisControlStr, thisEncodedFilename, thisEncodedContent, '', event.metaKey)
    }, false)

    // add event handler and make visible
    // if it's a relevant one for this section
    if (possibleCcontrolStrs.includes(thisControlStr)) {
      console.log(`- displaying button ${thisControlStr}`)
      button.addEventListener('click', function (event) {
        event.preventDefault()
        handleButtonClick(thisID, functionToInvoke, thisControlStr, thisEncodedFilename, thisEncodedContent, '', event.metaKey)
      }, false)
      // Set button's text
      button.innerHTML = buttonDisplayString
      // Set button visible
      button.style.display = "inline-block"
      added++
    } else {
      // console.log(`- NOT displaying button ${thisControlStr}`)
      button.style.display = "none"
    }
  }
  console.log(`- ${String(added)} button ELs added`)

  // Add close button event handler
  closeDialogBtn.addEventListener("click", closeDialog)

  // Actually show the dialog
  dialog.showModal()

  // Set place on the screen for dialog to appear
  const approxDialogWidth = 530 // TODO: can we do better than this?
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
// Set place on the screen for dialog to appear
function setPositionForDialog(approxDialogWidth, approxDialogHeight, dialog, event) {
  const fudgeFactor = 20 // pixels
  const mousex = event.clientX  // Horizontal
  const mousey = event.clientY  // Vertical

  // Harder than it looks in Safari, as left/top seem to be relative to middle of window, not top-left.
  // And, in Safari, it leaves quite a clear area around edge of window where it will not put the dialog.
  // Note: in the future the draft spec for CSS Anchor Positioning could be helpful for positioning this dialog relative to other things
  // Check if this is going to be outside available window width
  // Note: this doesn't work, as dialog is not yet drawn
  // console.log(dialog.clientWidth, dialog.clientHeight)
  let x = mousex - ((approxDialogWidth+fudgeFactor) / 3)
  if (x < 0) { x = 0 }
  if ((x + (approxDialogWidth + fudgeFactor)) > window.innerWidth) { x = window.innerWidth - (approxDialogWidth + fudgeFactor) }
  let y = mousey - ((approxDialogHeight+fudgeFactor) / 2)
  if (y < 0) { y = 0 }
  if ((y + (approxDialogHeight + fudgeFactor)) > window.innerHeight) { y = window.innerHeight - (approxDialogHeight + fudgeFactor) }
  // // Now treat as if origin is in centre of screen
  // x -= (window.innerWidth / 2)
  // y -= (window.innerHeight / 2)

  // // New Method:
  // x = mousex - (window.innerWidth / 2)
  // y = mousey - (window.innerHeight / 2)
  dialog.style.left = `${String(x)}px`
  dialog.style.top = `${String(y)}px`
  // console.log(`Mouse at x${mousex}, y${mousey}`)
  // console.log(`Window dimensions: w${window.innerWidth}, h${window.innerHeight}`)
  // console.log(`Dialog dimesnions: w${approxDialogWidth}, h${approxDialogHeight}`)
  // console.log(`-> x${x}, y${y}`)
  
}

//--------------------------------------------------------------------------------------
// addIconClickEventListeners
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

//--------------------------------------------------------------------------------------
// addContentEventListenersScript
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

//--------------------------------------------------------------------------------------
// addReviewProjectEventListenersScript
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

//--------------------------------------------------------------------------------------
// addButtonEventListenersScript
/**
 * Add an event listener to all class="moveButton", "changeDateButton", "completeThen" and "toggleType" items
 */
// function addButtonEventListeners() {
//   function findAncestor(startElement, tagName) {
//     let currentElem = startElement
//     while (currentElem !== document.body) {
//       if (currentElem.tagName.toLowerCase() === tagName.toLowerCase()) { return currentElem }
//       currentElem = currentElem.parentElement
//     }
//     return false
//   }

//   // Add click handler to all hoverExtraControls' buttons
//   // Using [HTML data attributes](https://developer.mozilla.org/en-US/docs/Learn/HTML/Howto/Use_data_attributes)

//   console.log('Add click handlers to all hoverExtraControls buttons')
//   const allMoveButtons = document.getElementsByClassName("moveButton")
//   for (const button of allMoveButtons) {
//     // const thisTD = button.parentElement.parentElement.parentElement;
//     const thisTD = findAncestor(button, 'TD')
//     const thisID = thisTD.parentElement.id
//     const thisControlStr = button.dataset.controlStr
//     const thisEncodedContent = thisTD.dataset.encodedContent // i.e. the "data-encoded-content" element, with auto camelCase transposition
//     // console.log('-', thisID, thisControlStr, thisEncodedContent);
//     const thisFilename = button.parentElement.dataset.dateString
//     // add event handler
//     button.addEventListener('click', function (event) {
//       event.preventDefault()
//       handleButtonClick(thisID, 'moveFromCalToCal', thisControlStr, thisFilename, thisEncodedContent) // , event.metaKey
//     }, false)
//   }
//   console.log(`${String(allMoveButtons.length)} move button ELs added`)

//   const allChangeDateButtons = document.getElementsByClassName("changeDateButton")
//   for (const button of allChangeDateButtons) {
//     // const thisTD = button.parentElement.parentElement.parentElement;
//     const thisTD = findAncestor(button, 'TD')
//     const thisID = thisTD.parentElement.id
//     const thisControlStr = button.dataset.controlStr
//     const thisEncodedContent = thisTD.dataset.encodedContent // i.e. the "data-encoded-content" element, with auto camelCase transposition
//     const thisEncodedFilename = thisTD.dataset.encodedFilename
//     // add event handler
//     button.addEventListener('click', function (event) {
//       event.preventDefault()
//       handleButtonClick(thisID, 'updateTaskDate', thisControlStr, thisEncodedFilename, thisEncodedContent) // , event.metaKey
//     }, false)
//   }
//   console.log(`${String(allChangeDateButtons.length)} dateChangeButton ELs added`)

//   const allCompleteThenButtons = document.getElementsByClassName("completeThenButton")
//   for (const button of allCompleteThenButtons) {
//     const thisTD = findAncestor(button, 'TD')
//     const thisID = thisTD.parentElement.id
//     // console.log('- CT on' + thisID);
//     // const thisControlStr = button.dataset.controlStr
//     const thisEncodedContent = thisTD.dataset.encodedContent // i.e. the "data-encoded-content" element, with auto camelCase transposition
//     const thisEncodedFilename = thisTD.dataset.encodedFilename
//     // add event handler
//     button.addEventListener('click', function (event) {
//       event.preventDefault()
//       handleButtonClick(thisID, 'completeTaskThen', '', thisEncodedFilename, thisEncodedContent) // , event.metaKey
//     }, false)
//   }
//   console.log(`${String(allCompleteThenButtons.length)} completeThenButton ELs added`)

//   const allToggleTypeButtons = document.getElementsByClassName("toggleTypeButton")
//   for (const button of allToggleTypeButtons) {
//     const thisTD = findAncestor(button, 'TD')
//     const thisID = thisTD.parentElement.id
//     // console.log('- TT on' + thisID);
//     // const thisControlStr = button.dataset.controlStr
//     const thisEncodedContent = thisTD.dataset.encodedContent // i.e. the "data-encoded-content" element, with auto camelCase transposition
//     const thisEncodedFilename = thisTD.dataset.encodedFilename
//     // add event handler
//     button.addEventListener('click', function (event) {
//       event.preventDefault()
//       handleButtonClick(thisID, 'toggleType', '', thisEncodedFilename, thisEncodedContent)
//     }, false)
//   }
//   console.log(`${String(allToggleTypeButtons.length)} toggleTypeButton ELs added`)

//   const allPriorityButtons = document.getElementsByClassName("priorityButton")
//   for (const button of allPriorityButtons) {
//     const thisTD = findAncestor(button, 'TD')
//     const thisID = thisTD.parentElement.id
//     // console.log('- P on' + thisID);
//     // const thisControlStr = button.dataset.controlStr
//     const thisEncodedContent = thisTD.dataset.encodedContent // i.e. the "data-encoded-content" element, with auto camelCase transposition
//     const thisEncodedFilename = thisTD.dataset.encodedFilename
//     // add event handler
//     button.addEventListener('click', function (event) {
//       event.preventDefault()
//       handleButtonClick(thisID, 'cyclePriorityState', '', thisEncodedFilename, thisEncodedContent)
//     }, false)
//   }
//   console.log(`${String(allPriorityButtons.length)} priorityButton ELs added`)

//   const allUnscheduleButtons = document.getElementsByClassName("unscheduleButton")
//   for (const button of allUnscheduleButtons) {
//     const thisTD = findAncestor(button, 'TD')
//     const thisID = thisTD.parentElement.id
//     // console.log('- U on' + thisID);
//     // const thisControlStr = button.dataset.controlStr
//     const thisEncodedContent = thisTD.dataset.encodedContent // i.e. the "data-encoded-content" element, with auto camelCase transposition
//     const thisEncodedFilename = thisTD.dataset.encodedFilename
//     // add event handler
//     button.addEventListener('click', function (event) {
//       event.preventDefault()
//       handleButtonClick(thisID, 'unscheduleItem', '', thisEncodedFilename, thisEncodedContent)
//     }, false)
//   }
//   console.log(`${String(allUnscheduleButtons.length)} unscheduleButton ELs added`)

//   const allUpdateItemButtons = document.getElementsByClassName("updateItemContentButton")
//   for (const button of allUpdateItemButtons) {
//     const thisTD = findAncestor(button, 'TD')
//     const thisID = thisTD.parentElement.id
//     // console.log('- U on' + thisID);
//     // const thisControlStr = button.dataset.controlStr
//     const thisEncodedContent = thisTD.dataset.encodedContent // i.e. the "data-encoded-content" element, with auto camelCase transposition
//     const thisEncodedFilename = thisTD.dataset.encodedFilename
//     // add event handler
//     button.addEventListener('click', function (event) {
//       event.preventDefault()
//       handleButtonClick(thisID, 'unscheduleItem', '', thisEncodedFilename, thisEncodedContent)
//     }, false)
//   }
//   console.log(`${String(allUpdateItemButtons.length)} updateItemButton ELs added`)

//   const allNextReviewButtons = document.getElementsByClassName("nextReviewButton")
//   for (const button of allNextReviewButtons) {
//     const thisTD = findAncestor(button, 'TD')
//     const thisID = thisTD.parentElement.id
//     // console.log('- PNR on' + thisID);
//     const thisControlStr = button.dataset.controlStr
//     const thisEncodedFilename = thisTD.dataset.encodedFilename
//     // add event handler
//     button.addEventListener('click', function (event) {
//       event.preventDefault()
//       handleButtonClick(thisID, 'setNextReviewDate', thisControlStr, thisEncodedFilename, '')
//     }, false)
//   }
//   console.log(`${String(allNextReviewButtons.length)} nextReviewButton ELs added`)

//   const allReviewFinishedButtons = document.getElementsByClassName("reviewFinishedButton")
//   for (const button of allReviewFinishedButtons) {
//     const thisTD = findAncestor(button, 'TD')
//     const thisID = thisTD.parentElement.id
//     // console.log('- PRF on' + thisID);
//     const thisControlStr = button.dataset.controlStr
//     const thisEncodedFilename = thisTD.dataset.encodedFilename
//     // add event handler
//     button.addEventListener('click', function (event) {
//       event.preventDefault()
//       handleButtonClick(thisID, 'reviewFinished', thisControlStr, thisEncodedFilename, '')
//     }, false)
//   }
//   console.log(`${String(allReviewFinishedButtons.length)} reviewFinishedButton ELs added`)
// }

//--------------------------------------------------------------------------------------
// clickHandlersScript
/**
 * Handle various clicks
 */
// For clicking on item icons
function handleIconClick(id, itemType, filename, content, metaModifier) {
  console.log(`handleIconClick( ${id} / ${itemType} / ${filename}/ {${content}} / ${String(metaModifier)} )`)
  const encodedFilename = filename // already encoded at this point. Was: encodeRFC3986URIComponent(filename);
  const encodedContent = content // already encoded at this point. Was: encodeRFC3986URIComponent(content);

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

// For clicking on main 'paragraph content'
function handleContentClick(event, id, filename, content) {
  console.log(`handleContentClick( ${id} / ${filename} / ${content} ) for event currentTarget: ${event.currentTarget}`)
  const encodedFilename = filename // already encoded at this point. Was: encodeRFC3986URIComponent(filename);
  const encodedContent = content // already encoded at this point. Was: encodeRFC3986URIComponent(content);
  onClickDashboardItem({ itemID: id, type: 'showLineInEditorFromFilename', encodedFilename: encodedFilename, encodedContent: encodedContent }) // TEST: change from showNote.. to showLine...
}

// For clicking on checkbox
function handleCheckboxClick(cb) {
  console.log(`Checkbox for ${cb.name} clicked, new value = ${cb.checked}`)
  onChangeCheckbox(cb.name, cb.checked) // = sendMessageToPlugin('onChangeCheckbox', ...)
}
