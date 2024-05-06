/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
//--------------------------------------------------------------------------------------
// Scripts for setting up and handling all of the Dashboard events
// Last updated: 13.4.2024 for v2.0.0 by @jgclark

//--------------------------------------------------------------------------------------
// Add event handlers

addIconClickEventListeners()

addContentEventListeners()

addReviewProjectEventListeners()

addCommandButtonEventListeners()

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
    console.log('Closing actions dialog via function')
    // Enable keyboard shortcuts again
    enableDashboardShortcuts()
    dialog.close()
  }

  // Remove shortcuts that interfere with the dialog
  disableDashboardShortcuts()

  const thisOS = dataObject.OS
  const thisID = dataObject.itemID
  const thisNoteType = dataObject.noteType
  const thissectionCode = dataObject.sectionCode
  const reschedOrMove = dataObject.reschedOrMove // sending as a string, as I couldn't get boolean to be passed correctly
  const thisItemType = dataObject.itemType // 'task' | 'checklist'
  // Items can be moved or rescheduled -- we work out which is relevant in HTMLGeneratorGrid
  const dateChangeFunctionToUse = reschedOrMove === 'resched' ? 'updateTaskDate' : 'moveFromCalToCal'
  console.log(`- using ${dateChangeFunctionToUse} from ${reschedOrMove}`)
  const thisIDElement = document.getElementById(thisID)
  const thisEncodedContent = thisIDElement.dataset.encodedContent // i.e. the "data-encoded-content" element, with auto camelCase transposition
  console.log(`- ${thisEncodedContent}`) // ❌
  const thisEncodedFilename = thisIDElement.dataset.encodedFilename
  console.log(`- ${thisEncodedFilename}`) // ❌
  const thisFilename = decodeRFC3986URIComponent(thisEncodedFilename)
  console.log(`dataObject() starting for ID:${thisID}, noteType:${thisNoteType}, sectionCode:${thissectionCode}, itemType:${thisItemType}, filename:${thisEncodedFilename}`)

  const dialog = document.getElementById('itemControlDialog')

  // Set the dialog title from the filename
  const dialogItemNoteElem = document.getElementById('dialogItemNote')
  dialogItemNoteElem.innerHTML = thisFilename
  // Update text in the dialog for this particular item, if not empty
  const dialogItemContentElem = document.getElementById('dialogItemContent')
  // If we have some content, show an input control to edit it
  if (thisEncodedContent !== '') {
    dialogItemContentElem.value = decodeRFC3986URIComponent(thisEncodedContent)
    dialogItemContentElem.parentElement.style.display = 'block'
  } else {
    dialogItemContentElem.parentElement.style.display = 'none'
  }

  const possibleControlTypes = [
    // date change controls
    { controlStr: 't', sectionCodes: ['DY', 'DO', 'W', 'M', 'Q', 'OVERDUE', 'TAG'], handlingFunction: dateChangeFunctionToUse }, // special controlStr to indicate change to '>today'
    { controlStr: '+1d', sectionCodes: ['DT', 'DY', 'DO', 'W', 'M', 'OVERDUE', 'TAG'], handlingFunction: dateChangeFunctionToUse },
    { controlStr: '+1b', sectionCodes: ['DT', 'DY', 'DO', 'W', 'M', 'OVERDUE', 'TAG'], handlingFunction: dateChangeFunctionToUse },
    { controlStr: '+2d', sectionCodes: ['DT', 'DY', 'DO', 'W', 'M', 'OVERDUE', 'TAG'], handlingFunction: dateChangeFunctionToUse },
    { controlStr: '+0w', sectionCodes: ['DT', 'DY', 'DO', 'M', 'OVERDUE', 'TAG'], handlingFunction: dateChangeFunctionToUse },
    { controlStr: '+1w', sectionCodes: ['DT', 'DY', 'DO', 'W', 'OVERDUE', 'TAG'], handlingFunction: dateChangeFunctionToUse },
    { controlStr: '+2w', sectionCodes: ['DT', 'DY', 'DO', 'W', 'OVERDUE', 'TAG'], handlingFunction: dateChangeFunctionToUse },
    { controlStr: '+0m', sectionCodes: ['DT', 'DY', 'DO', 'W', 'Q', 'OVERDUE', 'TAG'], handlingFunction: dateChangeFunctionToUse },
    { controlStr: '+1m', sectionCodes: ['M', 'OVERDUE', 'TAG'], handlingFunction: dateChangeFunctionToUse },
    { controlStr: '+0q', sectionCodes: ['M', 'OVERDUE', 'TAG'], handlingFunction: dateChangeFunctionToUse },
    // other controls
    { controlStr: 'cancel', sectionCodes: ['DT', 'DY', 'DO', 'W', 'M', 'Q', 'OVERDUE', 'TAG'], handlingFunction: 'cancel' },
    { controlStr: 'movetonote', sectionCodes: ['DT', 'DY', 'DO', 'W', 'M', 'Q', 'OVERDUE'], handlingFunction: 'moveToNote' },
    { controlStr: 'priup', sectionCodes: ['DT', 'DY', 'DO', 'W', 'M', 'Q', 'OVERDUE', 'TAG'], handlingFunction: 'cyclePriorityStateUp' },
    { controlStr: 'pridown', sectionCodes: ['DT', 'DY', 'DO', 'W', 'M', 'Q', 'OVERDUE', 'TAG'], handlingFunction: 'cyclePriorityStateDown' },
    { controlStr: 'tog', sectionCodes: ['OVERDUE', 'DT', 'DY', 'DO', 'W', 'M', 'Q', 'TAG'], handlingFunction: 'toggleType' },
    { controlStr: 'ct', sectionCodes: ['OVERDUE', 'TAG'], handlingFunction: 'completeTaskThen' },
    { controlStr: 'unsched', sectionCodes: ['OVERDUE', 'TAG'], notNoteType: 'Calendar', handlingFunction: 'unscheduleItem' }, // NB: only valid for noteType 'Note'
    { controlStr: 'update', sectionCodes: ['OVERDUE', 'DT', 'DY', 'DO', 'W', 'M', 'Q', 'TAG'], handlingFunction: 'updateItemContent' },
  ]
  const controlTypesForThisSection = possibleControlTypes.filter((t) => t.sectionCodes.includes(thissectionCode) && t.notNoteType !== thisNoteType)
  const controlStrsForThisSection = controlTypesForThisSection.map((t) => t.controlStr)
  console.log(controlStrsForThisSection)

  // remove previous event handlers 
  // V1: simple 'button.removeEventListener('click', function (event) { ...}, false) didn't work for some reason
  // V2 Instead: Workaround suggested by Codeium AI:
  // Clone all the button elements, and then remove them. Requires re-finding all references afterwards.
  let allDialogButtons = document.getElementById('itemDialogButtons').getElementsByTagName('BUTTON')
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
  allDialogButtons = document.getElementById('itemDialogButtons').getElementsByTagName('BUTTON')
  let added = 0
  for (const button of allDialogButtons) {
    // Ignore the mainButton(s) (e.g.'Close')
    if (button.className === 'mainButton') {
      continue
    }

    const thisControlStr = button.dataset.controlStr
    let functionToInvoke = possibleControlTypes.filter((p) => p.controlStr === thisControlStr)[0].handlingFunction ?? '?'
    // let buttonDisplayString = possibleControlTypes.filter((p) => p.controlStr === thisControlStr)[0].displayString ?? '?'
    // console.log(`- adding button for ${thisControlStr} / ${thisFilename} / ${functionToInvoke}`)

    // Extra processing for certain buttons
    let buttonDisplayString = ''
    if (thisControlStr === 'tog') {
      // Change to X' button: update the icon the button label shows
      buttonDisplayString = `Change to ${thisItemType === 'checklist' ? '<i class="fa-regular fa-circle"></i>' : '<i class="fa-regular fa-square"></i>'}`
      // console.log(buttonDisplayString)
    } else if (thisControlStr === 'cancel') {
      // Extra processing for 'Cancel' button: update the icon the button label shows
      buttonDisplayString = `${thisItemType === 'checklist' ? '<i class="fa-regular fa-square-xmark"></i> Cancel' : '<i class="fa-regular fa-circle-xmark"></i> Cancel'}`
      // console.log(buttonDisplayString)
      functionToInvoke = thisItemType === 'checklist' ? 'cancelChecklist' : 'cancelTask'
    }

    // add event handler and make visible
    // if it's a relevant one for this section
    if (controlStrsForThisSection.includes(thisControlStr)) {
      // console.log(`- displaying button ${thisControlStr}`)
      button.addEventListener(
        'click',
        function (event) {
          event.preventDefault()
          handleButtonClickGlobal(thisID, functionToInvoke, thisControlStr, thisEncodedFilename, thisEncodedContent, thisItemType, event.metaKey)
        },
        false,
      )
      // Set button's text
      if (buttonDisplayString !== '') {
        button.innerHTML = buttonDisplayString
      }
      // Set button visible
      button.style.display = 'inline-block'
      added++
    } else {
      // console.log(`- NOT displaying button ${thisControlStr}`)
      button.style.display = 'none'
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
    console.log('Close button was pressed')
    event.preventDefault() // we don't want to submit -> reload the page
    closeDialog()
  })

  // Hide or Show button row 1 depending whether it has any non-hidden buttons
  const itemControlDialogMoveControls = document.getElementById('itemControlDialogMoveControls')
  const iCDMCB = itemControlDialogMoveControls.getElementsByTagName('BUTTON')
  let numICDMCBShown = 0
  for (const item of iCDMCB) {
    const itemComputedStyle = getComputedStyle(item, null)
    // console.log(itemComputedStyle.display)
    if (itemComputedStyle.display !== 'none') {
      numICDMCBShown++
    }
  }
  // console.log(`"Move to" row set to ${(numICDMCBShown === 0) ? "none" : "block"}`)
  itemControlDialogMoveControls.style.display = numICDMCBShown === 0 ? 'none' : 'block'
  itemControlDialogMoveControls.previousElementSibling.style.display = numICDMCBShown === 0 ? 'none' : 'block'

  // Hide or Show button row 2 depending whether it has any non-hidden buttons
  const itemControlDialogOtherControls = document.getElementById('itemControlDialogOtherControls')
  const iCDOCB = itemControlDialogOtherControls.getElementsByTagName('BUTTON')
  let numICDOCBShown = 0
  for (const item of iCDOCB) {
    const itemComputedStyle = getComputedStyle(item, null)
    // console.log(itemComputedStyle.display)
    if (itemComputedStyle.display !== 'none') {
      numICDOCBShown++
    }
  }
  // console.log(`"Other controls" row set to ${(numICDOCBShown === 0) ? "none" : "block"}`)
  itemControlDialogOtherControls.style.display = numICDOCBShown === 0 ? 'none' : 'block'
  itemControlDialogOtherControls.previousElementSibling.style.display = numICDOCBShown === 0 ? 'none' : 'block'

  // Set place on the screen for dialog to appear
  const approxDialogWidth = ['TAG', 'OVERDUE'].includes(thissectionCode) ? 520 : 450
  const approxDialogHeight = 180
  setPositionForDialog(thisOS, approxDialogWidth, approxDialogHeight, dialog, event)

  // Actually show the dialog
  dialog.showModal()
  // Note: only at this point does this work:
  // console.log(dialog.clientWidth, dialog.clientHeight)

  function handleEscape(event) {
    if (event.keyCode === 27) {
      console.log('ESC key was pressed')
      closeDialog()
    }
  }

  // For clicking on dialog buttons
  

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

  const thisID = dataObject.itemID
  const thisNoteTitle = decodeRFC3986URIComponent(dataObject.encodedTitle)
  const thissectionCode = 'PROJ'
  const thisIDElement = document.getElementById(thisID)
  const thisEncodedContent = thisIDElement.dataset.encodedContent // i.e. the "data-encoded-content" element, with auto camelCase transposition
  const thisEncodedFilename = thisIDElement.dataset.encodedFilename
  const thisFilename = decodeRFC3986URIComponent(thisEncodedFilename)
  console.log(`dataObject() starting for ID ${thisID}, type ${thissectionCode}, filename ${thisEncodedFilename}`)

  const dialog = document.getElementById('projectControlDialog')

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

  let allDialogButtons = document.getElementById('projectDialogButtons').getElementsByTagName('BUTTON')
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
  allDialogButtons = document.getElementById('projectDialogButtons').getElementsByTagName('BUTTON')
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
    button.removeEventListener(
      'click',
      function (event) {
        event.preventDefault()
        handleButtonClickGlobal(thisID, functionToInvoke, thisControlStr, thisEncodedFilename, thisEncodedContent, '', event.metaKey)
      },
      false,
    )

    // add event handler and make visible
    // if it's a relevant one for this section
    if (possibleCcontrolStrs.includes(thisControlStr)) {
      // console.log(`- displaying button ${thisControlStr}`)
      button.addEventListener(
        'click',
        function (event) {
          event.preventDefault()
          handleButtonClickGlobal(thisID, functionToInvoke, thisControlStr, thisEncodedFilename, thisEncodedContent, '', event.metaKey)
        },
        false,
      )
      // Set button's text
      // button.innerHTML = buttonDisplayString
      // Set button visible
      button.style.display = 'inline-block'
      added++
    } else {
      // console.log(`- NOT displaying button ${thisControlStr}`)
      button.style.display = 'none'
    }
  }
  console.log(`- ${String(added)} button ELs added`)

  // Actually show the dialog
  dialog.showModal()

  // Set place on the screen for dialog to appear
  const approxDialogWidth = 480 // TODO: can we do better than this?
  const approxDialogHeight = 110
  setPositionForDialog(thisOS, approxDialogWidth, approxDialogHeight, dialog, event)

  // For clicking on dialog buttons
  function handleButtonClickGlobal(id, type, controlStr, encodedFilename, encodedCurrentContent, metaModifier) {
    console.log(`Button clicked on id: ${id} for controlStr: ${controlStr}, type: ${type}, encodedFilename: ${encodedFilename}, metaModifier: ${metaModifier}`)
    console.log(`- orig content: {${encodedCurrentContent}}`)

    onClickDashboardItem({ itemID: id, type: type, controlStr: controlStr, encodedFilename: encodedFilename, encodedContent: encodedCurrentContent }) // = sendMessageToPlugin('onClickDashboardItem', ...)

    // Dismiss dialog
    closeDialog()
  }
}

//--------------------------------------------------------------------------------------
// Set place in the HTML window for dialog to appear
// Note: JGC's iPhone reports 375x812, but screen shots are 3x (1124x2436)
function setPositionForDialog(thisOS, approxDialogWidth, approxDialogHeight, dialog, event) {
  const fudgeFactor = 8 // small border (in pixels) to take account of scrollbars etc.
  const mousex = event.clientX // Horizontal
  const mousey = event.clientY // Vertical
  let x = 0
  let y = 0

  // Safari naturally leaves quite a clear area around edge of window where it will not put the dialog.
  // Note: in the future the draft spec for CSS Anchor Positioning could be helpful for positioning this dialog relative to other things
  // Note: accessing dialog.clientWidth doesn't work, as dialog is not yet drawn
  // const winHeight = window.innerHeight - fudgeFactor
  const winHeight = window.visualViewport.height
  // const winWidth = window.innerWidth - fudgeFactor
  const winWidth = window.visualViewport.width
  console.log(`Window dimensions (approx): w${winWidth} x h${winHeight}`)
  // TODO: remove after testing
  console.log(`Mouse at x${mousex}, y${mousey}`)
  console.log(`Dialog ~ w${approxDialogWidth} x h${approxDialogHeight}`)

  // WIDTH + X position
  // First deal with windows narrower than the dialog
  if (winWidth < approxDialogWidth) {
    // dialog.style.width = `${String(winWidth)}px`
    dialog.style.left = `2%`
    dialog.style.width = `96%`
    console.log(`Forcing narrower dialog to fit inside window: now centred with width 96%`)
  }
  // then deal with narrow windows
  else if (winWidth - approxDialogWidth < 100) {
    x = Math.round((winWidth - approxDialogWidth) / 2)
    dialog.style.left = `${String(x)}px`
    console.log(`Forcing narrower dialog to be centred horizontally inside window: now x${String(x)}`)
  }
  // otherwise place dialog near mouse x position, but keep within screen
  else {
    x = mousex - Math.round(approxDialogWidth / 3)
    if (x + approxDialogWidth > winWidth) {
      x = winWidth - fudgeFactor - approxDialogWidth
      console.log(`Move left: now x${String(x)}`)
    }
    if (x < fudgeFactor) {
      x = fudgeFactor
      console.log(`Off left: now x=${fudgeFactor}; width=${dialog.style.width}`)
    }
    dialog.style.left = `${String(x)}px`
  }

  // HEIGHT + Y position
  // First deal with viewport shorter than the dialog
  if (winHeight < approxDialogHeight) {
    // dialog.style.Height = `${String(winHeight)}px`
    dialog.style.top = `0`
    console.log(`Forcing shorter dialog to start inside window: now fixed to top`)
  }
  // then deal with quite short viewport
  else if (winHeight - approxDialogHeight < 100) {
    y = Math.round((winHeight - approxDialogHeight) / 2)
    dialog.style.top = `${String(y)}px`
    console.log(`Forcing shorter dialog to be centred vertically inside viewport: now y${String(y)}`)
  }
  // otherwise place dialog near mouse y position, but keep within screen
  else {
    y = mousey - Math.round(approxDialogHeight / 2)
    if (y + approxDialogHeight > winHeight) {
      y = winHeight - fudgeFactor - approxDialogHeight
      console.log(`Move up: now y${String(y)}`)
    }
    if (y < fudgeFactor) {
      y = fudgeFactor
      // dialog.style.height = `${String(winHeight - fudgeFactor)}px`
      console.log(`Off top: now y=${fudgeFactor}; height=${dialog.style.height}`)
    }
    dialog.style.top = `${String(y)}px`
  }

  console.log(`-> x${x}, y${y} / w${dialog.style.width} x h${dialog.style.height}`)
  // const winDetailsSpan = document.getElementById('winDebugDetails')
  // winDetailsSpan.innerHTML = `f${fudgeFactor} / vw${winWidth} x vh${winHeight} / x${dialog.style.left} y${dialog.style.top} w${dialog.style.width} x h${dialog.style.height}`
}

//--------------------------------------------------------------------------------------
// add various Event Listeners

/**
 * Add event listener added to all todo + checklist icons
 */
function addIconClickEventListeners() {
  // console.log('add Event Listeners to Icons ...')

  // Add event handlers for task icons
  const allTodos = document.getElementsByClassName('sectionItemTodo')
  for (const thisTodo of allTodos) {
    const itemElem = thisTodo.parentElement
    const thisId = itemElem.id
    const thisEncodedFilename = itemElem.dataset.encodedFilename
    const thisEncodedContent = itemElem.dataset.encodedContent
    // console.log('-> (', thisId, 'open', thisEncodedFilename, thisEncodedContent, 'meta?', ')')
    thisTodo.addEventListener(
      'click',
      function () {
        const metaModifier = event.metaKey
        handleIconClick(thisId, 'open', thisEncodedFilename, thisEncodedContent, metaModifier)
      },
      false,
    )
  }
  console.log(`${String(allTodos.length)} sectionItemTodo ELs added (to icons)`)

  // Add event handlers for checklist icons
  const allChecklists = document.getElementsByClassName('sectionItemChecklist')
  for (const thisChecklist of allChecklists) {
    const itemElem = thisChecklist.parentElement
    const thisId = itemElem.id
    const thisEncodedFilename = itemElem.dataset.encodedFilename
    const thisEncodedContent = itemElem.dataset.encodedContent
    // console.log('-> (', thisId, 'checklist', thisEncodedFilename, thisEncodedContent, 'meta?', ')')
    thisChecklist.addEventListener(
      'click',
      function () {
        const metaModifier = event.metaKey
        handleIconClick(thisId, 'checklist', thisEncodedFilename, thisEncodedContent, metaModifier)
      },
      false,
    )
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
  const allContentItems = document.getElementsByClassName('content')
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
      thisLink.addEventListener(
        'click',
        function (event) {
          event.preventDefault()
          handleContentClick(event, thisID, thisEncodedFilename, thisEncodedContent)
        },
        false,
      )
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
  const allReviewItems = document.getElementsByClassName('reviewProject')
  for (const reviewItem of allReviewItems) {
    const thisID = reviewItem.parentElement.id
    const thisEncodedFilename = reviewItem.parentElement.dataset.encodedFilename // i.e. the "data-encoded-review" element, with auto camelCase transposition
    // add event handler
    reviewItem.addEventListener(
      'click',
      function (event) {
        event.preventDefault()
        handleIconClick(thisID, 'review', thisEncodedFilename, '-', event.metaKey)
      },
      false,
    )
  }
  console.log(`${String(allReviewItems.length)} review ELs added`)
}

/**
 * Add an event listener to all class="PCButton" items
 */
function addCommandButtonEventListeners() {
  // Register click handlers for each 'PCButton' on the window with URL to call
  allPCButtons = document.getElementsByClassName('PCButton')
  let added = 0
  for (const button of allPCButtons) {
    // const thisURL = button.dataset.callbackUrl
    // add event handler and make visible
    console.log(`- displaying button for PCB function ${button.dataset.command}`)
    button.addEventListener(
      'click',
      function (event) {
        event.preventDefault()
        console.log(`Attempting to send plugin command ${button.dataset.command} ...`)
        const theseCommandArgs = button.dataset.commandArgs.split(',')
        sendMessageToPlugin('runPluginCommand', { pluginID: button.dataset.pluginId, commandName: button.dataset.command, commandArgs: theseCommandArgs })
      },
      false,
    )
    added++
  }
  console.log(`- ${String(added)} PCButton ELs added`)
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
      onClickDashboardItem({ itemID: id, type: metaModifier ? 'cancelTask' : 'completeTask', encodedFilename: encodedFilename, encodedContent: encodedContent })
      break
    }
    case 'checklist': {
      onClickDashboardItem({ itemID: id, type: metaModifier ? 'cancelChecklist' : 'completeChecklist', encodedFilename: encodedFilename, encodedContent: encodedContent })
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
