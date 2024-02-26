//--------------------------------------------------------------------------------------
// addIconEventListenersScript
/**
 * Add event listener added to all todo + checklist icons
 */

console.log('add Event Listeners to Icons ...')
// Note: mouseOverEvents now disabled at user request
const addMouseOverEvents = false

function mouseenterTodoFunc() {
  // console.log('mouseenterTodo ... after '+String(event.detail)+' clicks');
  const thisID = this.firstChild.id
  // console.log('mouseenterTodo' + thisID);
  if (event.metaKey) {
    this.innerHTML = `<i id="${thisID}" class="cancelled fa-regular fa-circle-xmark">`
  } else {
    this.innerHTML = `<i id="${thisID}" class="checked fa-regular fa-circle-check">`
  }
}

function mouseenterChecklistFunc() {
  // console.log('mouseenterChecklist ... after '+String(event.detail)+' clicks');
  const thisID = this.firstChild.id
  // console.log('mouseenterChecklist' + thisID);
  if (event.metaKey) {
    this.innerHTML = `<i id="${thisID}" class="cancelled fa-regular fa-square-xmark">`
  } else {
    this.innerHTML = `<i id="${thisID}" class="checked fa-regular fa-square-check">`
  }
}

function mouseleaveTodoFunc() {
  // Need to save ID
  const thisID = this.firstChild.id
  // console.log('mouseleaveTodo' + thisID);
  this.innerHTML = `<i id="${thisID}" class="todo fa-regular fa-circle">`
}

function mouseleaveChecklistFunc() {
  // Need to save ID
  const thisID = this.firstChild.id
  // console.log('mouseleaveChecklist' + thisID);
  this.innerHTML = `<i id="${thisID}" class="todo fa-regular fa-square">`
}

// Add event handlers for task icons
const allTodos = document.getElementsByClassName("sectionItemTodo")
for (const thisTodo of allTodos) {
  thisTodo.addEventListener('click', function () {
    this.removeEventListener("mouseenter", mouseenterTodoFunc)
    this.removeEventListener("mouseleave", mouseleaveTodoFunc)
    const thisId = thisTodo.parentElement.id
    console.log(`sectionItemTodo ${thisId} clicked`)
    const thisFilename = thisTodo.id
    const metaModifier = event.metaKey
    // handleIconClick(thisId, 'open', thisFilename, thisTodo.nextElementSibling.getElementsByTagName("A")[0].innerHTML, metaModifier);
    handleIconClick(thisId, 'open', thisFilename, thisTodo.dataset.encodedContent, metaModifier)
  }, false)
  // Add mouseover-type events to hint as to what's going to happen
  if (addMouseOverEvents) {
    thisTodo.addEventListener('mouseenter', mouseenterTodoFunc, false)
    thisTodo.addEventListener('mouseleave', mouseleaveTodoFunc, false)
  }
}
console.log(`${String(allTodos.length)} sectionItemTodo ELs added (to icons)`)

// Add event handlers for checklist icons
const allChecklists = document.getElementsByClassName("sectionItemChecklist")
for (const thisChecklist of allChecklists) {
  thisChecklist.addEventListener('click', function () {
    this.removeEventListener("mouseenter", mouseenterChecklistFunc)
    this.removeEventListener("mouseleave", mouseleaveChecklistFunc)
    const thisId = thisChecklist.parentElement.id
    const thisFilename = thisChecklist.id
    const metaModifier = event.metaKey
    // handleIconClick(thisId, 'checklist', thisFilename, thisChecklist.nextElementSibling.getElementsByTagName("A")[0].innerHTML, metaModifier);
    handleIconClick(thisId, 'checklist', thisFilename, thisChecklist.dataset.encodedContent, metaModifier)
  }, false)
  // Add mouseover-type events to hint as to what's going to happen
  if (addMouseOverEvents) {
    thisChecklist.addEventListener('mouseenter', mouseenterChecklistFunc, false)
    thisChecklist.addEventListener('mouseleave', mouseleaveChecklistFunc, false)
  }
}
console.log(`${String(allChecklists.length)} sectionItemChecklist ELs added (to icons)`)


//--------------------------------------------------------------------------------------
// addContentEventListenersScript
/**
 * Add an event listener to all content items (not the icons),
 * except ones with class 'noteTitle', as they get their own onClick definition
 * Uses [HTML data attributes](https://developer.mozilla.org/en-US/docs/Learn/HTML/Howto/Use_data_attributes)
 */
console.log('add Event Listeners to Content...')
// Add click handler to all sectionItemContent items (which already have a basic <a>...</a> wrapper)
const allContentItems = document.getElementsByClassName("sectionItemContent")
for (const contentItem of allContentItems) {
  const thisID = contentItem.parentElement.id
  const thisEncodedContent = contentItem.dataset.encodedContent // i.e. the "data-encoded-content" element, with auto camelCase transposition
  const thisEncodedFilename = contentItem.dataset.encodedFilename // contentItem.id;
  // console.log('- sIC on ' + thisID + ' / ' + thisEncodedFilename + ' / ' + thisEncodedContent);

  // add event handler to each <a> (normally only 1 per item),
  // unless it's a noteTitle, which gets its own click handler.
  const theseALinks = contentItem.getElementsByTagName("A")
  for (const thisLink of theseALinks) {
    // console.log('- A on ' + thisID + ' / ' + thisEncodedFilename + ' / ' + thisEncodedContent + ' / ' + thisLink.className);
    if (!thisLink.className.match('noteTitle')) {
      thisLink.addEventListener('click', function (event) {
        event.preventDefault()
        handleContentClick(event, thisID, thisEncodedFilename, thisEncodedContent)
      }, false)
    }
  }

  // add event handler to each "div.content" (normally only 1 per item),
  const theseDIVLinks = contentItem.getElementsByTagName("DIV")
  for (const thisLink of theseDIVLinks) {
    if (thisLink.className.match('content') && !(thisLink.className.match('tooltip'))) {
      // console.log('DIV.content on ' + thisID + ' / ' + thisEncodedFilename + ' / ' + thisLink.className);
      thisLink.addEventListener('click', function (event) {
        // event.preventDefault(); // now disabled to ensure that externalLinks etc. can fire
        handleContentClick(event, thisID, thisEncodedFilename, thisEncodedContent)
      }, false)
    }
  }
}
console.log(`${String(allContentItems.length)} sectionItem ELs added (to content links)`)


//--------------------------------------------------------------------------------------
// addReviewEventListenersScript
/**
 * Add an event listener to all <td class="review ..."> items
 */
console.log('add Event Listeners to Review items...')
// Add click handler to all 'review' class items (which already have a basic <a>...</a> wrapper)
// Using [HTML data attributes](https://developer.mozilla.org/en-US/docs/Learn/HTML/Howto/Use_data_attributes)
const allReviewItems = document.getElementsByClassName("review")
for (const reviewItem of allReviewItems) {
  const thisID = reviewItem.id
  const thisEncodedFilename = reviewItem.dataset.encodedFilename // i.e. the "data-encoded-review" element, with auto camelCase transposition
  // add event handler
  reviewItem.addEventListener('click', function (event) {
    event.preventDefault()
    handleIconClick(thisID, 'review', thisEncodedFilename, '', event.metaKey)
  }, false)
}
console.log(`${String(allReviewItems.length)} review ELs added (to review cells)`)

//--------------------------------------------------------------------------------------
// addButtonEventListenersScript
/**
 * Add an event listener to all class="moveButton", "changeDateButton", "completeThen" and "toggleType" items
 */
function findAncestor(startElement, tagName) {
  let currentElem = startElement
  while (currentElem !== document.body) {
    if (currentElem.tagName.toLowerCase() === tagName.toLowerCase()) { return currentElem }
    currentElem = currentElem.parentElement
  }
  return false
}

// Add click handler to all hoverExtraControls' buttons
// Using [HTML data attributes](https://developer.mozilla.org/en-US/docs/Learn/HTML/Howto/Use_data_attributes)

console.log('Add click handlers to all hoverExtraControls buttons')
const allMoveButtons = document.getElementsByClassName("moveButton")
for (const button of allMoveButtons) {
  // const thisTD = button.parentElement.parentElement.parentElement;
  const thisTD = findAncestor(button, 'TD')
  const thisID = thisTD.parentElement.id
  const thisControlStr = button.dataset.controlStr
  const thisEncodedContent = thisTD.dataset.encodedContent // i.e. the "data-encoded-content" element, with auto camelCase transposition
  // console.log('-', thisID, thisControlStr, thisEncodedContent);
  const thisFilename = button.parentElement.dataset.dateString
  // add event handler
  button.addEventListener('click', function (event) {
    event.preventDefault()
    handleButtonClick(thisID, 'moveFromCalToCal', thisControlStr, thisFilename, thisEncodedContent) // , event.metaKey
  }, false)
}
console.log(`${String(allMoveButtons.length)} move button ELs added`)

const allChangeDateButtons = document.getElementsByClassName("changeDateButton")
for (const button of allChangeDateButtons) {
  // const thisTD = button.parentElement.parentElement.parentElement;
  const thisTD = findAncestor(button, 'TD')
  const thisID = thisTD.parentElement.id
  const thisControlStr = button.dataset.controlStr
  const thisEncodedContent = thisTD.dataset.encodedContent // i.e. the "data-encoded-content" element, with auto camelCase transposition
  const thisEncodedFilename = thisTD.dataset.encodedFilename
  // add event handler
  button.addEventListener('click', function (event) {
    event.preventDefault()
    handleButtonClick(thisID, 'updateTaskDate', thisControlStr, thisEncodedFilename, thisEncodedContent) // , event.metaKey
  }, false)
}
console.log(`${String(allChangeDateButtons.length)} dateChangeButton ELs added`)

const allCompleteThenButtons = document.getElementsByClassName("completeThenButton")
for (const button of allCompleteThenButtons) {
  const thisTD = findAncestor(button, 'TD')
  const thisID = thisTD.parentElement.id
  // console.log('- CT on' + thisID);
  // const thisControlStr = button.dataset.controlStr
  const thisEncodedContent = thisTD.dataset.encodedContent // i.e. the "data-encoded-content" element, with auto camelCase transposition
  const thisEncodedFilename = thisTD.dataset.encodedFilename
  // add event handler
  button.addEventListener('click', function (event) {
    event.preventDefault()
    handleButtonClick(thisID, 'completeTaskThen', '', thisEncodedFilename, thisEncodedContent) // , event.metaKey
  }, false)
}
console.log(`${String(allCompleteThenButtons.length)} completeThenButton ELs added`)

const allToggleTypeButtons = document.getElementsByClassName("toggleTypeButton")
for (const button of allToggleTypeButtons) {
  const thisTD = findAncestor(button, 'TD')
  const thisID = thisTD.parentElement.id
  // console.log('- TT on' + thisID);
  // const thisControlStr = button.dataset.controlStr
  const thisEncodedContent = thisTD.dataset.encodedContent // i.e. the "data-encoded-content" element, with auto camelCase transposition
  const thisEncodedFilename = thisTD.dataset.encodedFilename
  // add event handler
  button.addEventListener('click', function (event) {
    event.preventDefault()
    handleButtonClick(thisID, 'toggleType', '', thisEncodedFilename, thisEncodedContent)
  }, false)
}
console.log(`${String(allToggleTypeButtons.length)} toggleTypeButton ELs added`)

const allPriorityButtons = document.getElementsByClassName("priorityButton")
for (const button of allPriorityButtons) {
  const thisTD = findAncestor(button, 'TD')
  const thisID = thisTD.parentElement.id
  // console.log('- P on' + thisID);
  // const thisControlStr = button.dataset.controlStr
  const thisEncodedContent = thisTD.dataset.encodedContent // i.e. the "data-encoded-content" element, with auto camelCase transposition
  const thisEncodedFilename = thisTD.dataset.encodedFilename
  // add event handler
  button.addEventListener('click', function (event) {
    event.preventDefault()
    handleButtonClick(thisID, 'cyclePriorityState', '', thisEncodedFilename, thisEncodedContent)
  }, false)
}
console.log(`${String(allPriorityButtons.length)} priorityButton ELs added`)

const allUnscheduleButtons = document.getElementsByClassName("unscheduleButton")
for (const button of allUnscheduleButtons) {
  const thisTD = findAncestor(button, 'TD')
  const thisID = thisTD.parentElement.id
  // console.log('- U on' + thisID);
  // const thisControlStr = button.dataset.controlStr
  const thisEncodedContent = thisTD.dataset.encodedContent // i.e. the "data-encoded-content" element, with auto camelCase transposition
  const thisEncodedFilename = thisTD.dataset.encodedFilename
  // add event handler
  button.addEventListener('click', function (event) {
    event.preventDefault()
    handleButtonClick(thisID, 'unscheduleItem', '', thisEncodedFilename, thisEncodedContent)
  }, false)
}
console.log(`${String(allUnscheduleButtons.length)} unscheduleButton ELs added`)

const allNextReviewButtons = document.getElementsByClassName("nextReviewButton")
for (const button of allNextReviewButtons) {
  const thisTD = findAncestor(button, 'TD')
  const thisID = thisTD.parentElement.id
  // console.log('- PNR on' + thisID);
  const thisControlStr = button.dataset.controlStr
  const thisEncodedFilename = thisTD.dataset.encodedFilename
  // add event handler
  button.addEventListener('click', function (event) {
    event.preventDefault()
    handleButtonClick(thisID, 'setNextReviewDate', thisControlStr, thisEncodedFilename, '')
  }, false)
}
console.log(`${String(allNextReviewButtons.length)} nextReviewButton ELs added`)

const allReviewFinishedButtons = document.getElementsByClassName("reviewFinishedButton")
for (const button of allReviewFinishedButtons) {
  const thisTD = findAncestor(button, 'TD')
  const thisID = thisTD.parentElement.id
  // console.log('- PRF on' + thisID);
  const thisControlStr = button.dataset.controlStr
  const thisEncodedFilename = thisTD.dataset.encodedFilename
  // add event handler
  button.addEventListener('click', function (event) {
    event.preventDefault()
    handleButtonClick(thisID, 'reviewFinished', thisControlStr, thisEncodedFilename, '')
  }, false)
}
console.log(`${String(allReviewFinishedButtons.length)} reviewFinishedButton ELs added`)

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
      break;
    }
    case 'checklist': {
      onClickDashboardItem({ itemID: id, type: (metaModifier) ? 'cancelChecklist' : 'completeChecklist', encodedFilename: encodedFilename, encodedContent: encodedContent })
      break;
    }
    case 'review': {
      onClickDashboardItem({ itemID: id, type: 'showNoteInEditorFromFilename', encodedFilename: encodedFilename, encodedContent: '' })
      break;
    }
    default: {
      console.error(`- unknown itemType: ${paraType}`)
      break;
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

// For clicking on button in hoverExtraControls
function handleButtonClick(id, type, controlStr, filename, origContent) {
  console.log(`Button clicked on id: ${id} for controlStr: ${controlStr}, type: ${type}, filename: ${filename}`)
  // re-gather the content part, as it might just have changed
  const thisIDTRElement = document.getElementById(id)
  const tdElements = thisIDTRElement.getElementsByTagName('TD')
  const encodedCurrentContent = tdElements[0].getAttribute('data-encoded-content')
  // console.log("- got data-encoded-content: {" + encodedCurrentContent + "}");
  onClickDashboardItem({ itemID: id, type: type, controlStr: controlStr, encodedFilename: filename, encodedContent: encodedCurrentContent }) // = sendMessageToPlugin('onClickDashboardItem', ...)
}
