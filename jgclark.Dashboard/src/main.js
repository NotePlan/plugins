// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main functions
// Last updated 22.9.2023 for v0.6.2 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import moment from 'moment/min/moment-with-locales'
import { getDataForDashboard } from './dataGeneration'
import { getDemoDataForDashboard } from './demoDashboard'
import {
  addNoteOpenLinkToString,
  getSettings,
  makeNoteTitleWithOpenActionFromFilename,
  makeParaContentToLookLikeNPDisplayInHTML,
  type Section,
  type SectionItem,
} from './dashboardHelpers'
import { getDateStringFromCalendarFilename, getTodaysDateUnhyphenated, isValidCalendarNoteFilename } from '@helpers/dateTime'
import { nowLocaleShortTime } from '@helpers/NPdateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { unsetPreference } from '@helpers/NPdev'
import { getFolderFromFilename } from '@helpers/folders'
import { addTrigger } from '@helpers/NPFrontMatter'
import { getTaskPriority } from '@helpers/paragraph'
import { prependTodoToCalendarNote } from '@helpers/NPParagraph'
import { checkForRequiredSharedFiles } from '@helpers/NPRequiredFiles'
import { createPrettyOpenNoteLink, createPrettyRunPluginLink, createRunPluginCallbackUrl, displayTitle, returnNoteLink } from '@helpers/general'
import { showHTMLV2 } from '@helpers/HTMLView'
import { getNoteType } from '@helpers/note'
import { decodeRFC3986URIComponent, encodeRFC3986URIComponent } from '@helpers/stringTransforms'
import {
  applyRectToWindow,
  closeWindowFromCustomId,
  focusHTMLWindowIfAvailable,
  getLiveWindowRectFromWin,
  getStoredWindowRect,
  getWindowFromCustomId,
  rectToString,
} from '@helpers/NPWindows'
import { showMessage } from '@helpers/userInput'

//-----------------------------------------------------------------
// HTML resources

const windowCustomId = pluginJson['plugin.id'] + '.main'

// Note: this "../np.Shared" path works to the flattened np.Shared structure, but it does *not* work when running the locally-written copy of the HTML output file.
export const resourceLinksInHeader = `
<!-- Load in Dashboard-specific CSS -->
<link href="dashboard.css" rel="stylesheet">

<!-- Load in fontawesome assets from np.Shared (licensed for NotePlan) -->
<link href="../np.Shared/fontawesome.css" rel="stylesheet">
<link href="../np.Shared/regular.min.flat4NP.css" rel="stylesheet">
<link href="../np.Shared/solid.min.flat4NP.css" rel="stylesheet">
<link href="../np.Shared/light.min.flat4NP.css" rel="stylesheet">
`

const encodeDecodeScript = `
<!-- encode+decode script -->
<script type="text/javascript" src="../np.Shared/encodeDecode.js"></script>
`

const commsBridge = `
<!-- commsBridge scripts -->
<script type="text/javascript" src="../np.Shared/pluginToHTMLErrorBridge.js"></script>
<script>
/* you must set this before you import the CommsBridge file */
const receivingPluginID = "jgclark.Dashboard"; // the plugin ID of the plugin which will receive the comms from HTML
// That plugin should have a function NAMED onMessageFromHTMLView (in the plugin.json and exported in the plugin's index.js)
// this onMessageFromHTMLView will receive any arguments you send using the sendToPlugin() command in the HTML window

/* the onMessageFromPlugin function is called when data is received from your plugin and needs to be processed. this function
   should not do the work itself, it should just send the data payload to a function for processing. The onMessageFromPlugin function
   below and your processing functions can be in your html document or could be imported in an external file. The only
   requirement is that onMessageFromPlugin (and receivingPluginID) must be defined or imported before the pluginToHTMLCommsBridge
   be in your html document or could be imported in an external file */
</script>
<script type="text/javascript" src="./commsSwitchboard.js"></script>
<script type="text/javascript" src="../np.Shared/pluginToHTMLCommsBridge.js"></script>
`

/**
 * Add event listener added to all todo + checklist icons
 * Note: now not used, as on onClick is included in the HTML directly when generating the page.
 */
const addIconEventListenersScript = `
<!-- addIconEventListenersScript -->
<script type="text/javascript">
console.log('add Event Listeners to Icons ...');

function mouseenterTodoFunc() {
	// console.log('mouseenterTodo ... after '+String(event.detail)+' clicks');
	if (event.metaKey) {
		this.innerHTML = '<i class="cancelled fa-regular fa-circle-xmark">';
	} else {
		this.innerHTML = '<i class="checked fa-regular fa-circle-check">';
	}
}

function mouseenterChecklistFunc() {
	// console.log('mouseenterChecklist ... after '+String(event.detail)+' clicks');
	if (event.metaKey) {
		this.innerHTML = '<i class="cancelled fa-regular fa-square-xmark">';
	} else {
		this.innerHTML = '<i class="checked fa-regular fa-square-check">';
	}
}

function mouseleaveTodoFunc() {
	this.innerHTML = '<i class="todo fa-regular fa-circle">';
}

function mouseleaveChecklistFunc() {
	this.innerHTML = '<i class="todo fa-regular fa-square">';
}

// Add event handlers for task icons
let allTodos = document.getElementsByClassName("sectionItemTodo");
for (const thisTodo of allTodos) {
	thisTodo.addEventListener('click', function () {
    this.removeEventListener("mouseenter", mouseenterTodoFunc);
    this.removeEventListener("mouseleave", mouseleaveTodoFunc);
    let thisId = thisTodo.parentElement.id;
    console.log('sectionItemTodo ' + thisId + ' clicked');
    let thisFilename = thisTodo.id;
    let metaModifier = event.metaKey;
    // handleIconClick(thisId, 'open', thisFilename, thisTodo.nextElementSibling.getElementsByTagName("A")[0].innerHTML, metaModifier);
    handleIconClick(thisId, 'open', thisFilename, thisTodo.dataset.encodedContent, metaModifier);
  }, false);
	// Add mouseover-type events to hint as to what's going to happen
	thisTodo.addEventListener('mouseenter', mouseenterTodoFunc, false);
	thisTodo.addEventListener('mouseleave', mouseleaveTodoFunc, false);
}
console.log(String(allTodos.length) + ' sectionItemTodo ELs added (to icons)');

// Add event handlers for checklist icons
let allChecklists = document.getElementsByClassName("sectionItemChecklist");
for (const thisChecklist of allChecklists) {
	thisChecklist.addEventListener('click', function () {
    this.removeEventListener("mouseenter", mouseenterChecklistFunc);
    this.removeEventListener("mouseleave", mouseleaveChecklistFunc);
    let thisId = thisChecklist.parentElement.id;
    let thisFilename = thisChecklist.id;
    let metaModifier = event.metaKey;
    // handleIconClick(thisId, 'checklist', thisFilename, thisChecklist.nextElementSibling.getElementsByTagName("A")[0].innerHTML, metaModifier);
    handleIconClick(thisId, 'checklist', thisFilename, thisChecklist.dataset.encodedContent, metaModifier);
  }, false);
	// Add mouseover-type events to hint as to what's going to happen
	thisChecklist.addEventListener('mouseenter', mouseenterChecklistFunc, false);
	thisChecklist.addEventListener('mouseleave', mouseleaveChecklistFunc, false);
}
console.log(String(allChecklists.length) + ' sectionItemChecklist ELs added (to icons)');
</script>
`

/**
 * Add an event listener to all content items (not the icons),
 * except ones with class 'noteTitle', as they get their own onClick definition
 * Uses [HTML data attributes](https://developer.mozilla.org/en-US/docs/Learn/HTML/Howto/Use_data_attributes)
 */
const addContentEventListenersScript = `
<!-- addContentEventListenersScript -->
<script type="text/javascript">
console.log('add Event Listeners to Content...');
// Add click handler to all sectionItemContent items (which already have a basic <a>...</a> wrapper)
let allContentItems = document.getElementsByClassName("sectionItemContent");
for (const contentItem of allContentItems) {
  const thisID = contentItem.parentElement.id;
  const thisEncodedContent = contentItem.dataset.encodedContent; // i.e. the "data-encoded-content" element, with auto camelCase transposition
  const thisEncodedFilename = contentItem.dataset.encodedFilename; // contentItem.id;
  console.log('- sIC on ' + thisID + ' / ' + thisEncodedFilename + ' / ' + thisEncodedContent);

  // add event handler to each <a> (normally only 1 per item),
  // unless it's a noteTitle, which gets its own click handler.
  const theseALinks = contentItem.getElementsByTagName("A");
  for (const thisLink of theseALinks) {
    console.log('- A on ' + thisID + ' / ' + thisEncodedFilename + ' / ' + thisEncodedContent + ' / ' + thisLink.className);
    if (!thisLink.className.match('noteTitle')) {
      thisLink.addEventListener('click', function (event) {
        event.preventDefault();
        handleContentClick(event, thisID, thisEncodedFilename, thisEncodedContent);
      }, false);
    }
  }

  // add event handler to each "div.content" (normally only 1 per item),
  const theseDIVLinks = contentItem.getElementsByTagName("DIV");
  for (const thisLink of theseDIVLinks) {
    if (thisLink.className.match('content') && !(thisLink.className.match('tooltip')))  {
      console.log('DIV.content on ' + thisID + ' / ' + thisEncodedFilename + ' / ' + thisLink.className);
      thisLink.addEventListener('click', function (event) {
        // event.preventDefault(); // now disabled to ensure that externalLinks etc. can fire
        handleContentClick(event, thisID, thisEncodedFilename, thisEncodedContent);
      }, false);
    }
  }
}
console.log(String(allContentItems.length) + ' sectionItem ELs added (to content links)');
</script>
`

/**
 * Add an event listener to all <td class="review ..."> items
 */
const addReviewEventListenersScript = `
<!-- addReviewEventListenersScript -->
<script type="text/javascript">
console.log('add Event Listeners to Review items...');
// Add click handler to all 'review' class items (which already have a basic <a>...</a> wrapper)
// Using [HTML data attributes](https://developer.mozilla.org/en-US/docs/Learn/HTML/Howto/Use_data_attributes)
let allReviewItems = document.getElementsByClassName("review");
for (const reviewItem of allReviewItems) {
  const thisID = reviewItem.id;
  const thisEncodedFilename = reviewItem.dataset.encodedFilename; // i.e. the "data-encoded-review" element, with auto camelCase transposition
  // add event handler
  reviewItem.addEventListener('click', function (event) {
    event.preventDefault();
    handleIconClick(thisID, 'review', thisEncodedFilename, '', event.metaKey);
  }, false);
}
console.log(String(allReviewItems.length) + ' review ELs added (to review cells)');
</script>
`

/**
 * Add an event listener to all class="moveButton" and "changeDateButton" items
 */
const addButtonEventListenersScript = `
<!-- addButtonEventListenersScript -->
<script type="text/javascript">
function findAncestor(startElement, tagName) {
  let currentElem = startElement;
  while (currentElem != document.body) {
    if (currentElem.tagName.toLowerCase() == tagName.toLowerCase()) { return currentElem; }
    currentElem = currentElem.parentElement;
  }
  return false;
}

// Add click handler to all hoverExtraControls' buttons
// Using [HTML data attributes](https://developer.mozilla.org/en-US/docs/Learn/HTML/Howto/Use_data_attributes)
let allMoveButtons = document.getElementsByClassName("moveButton");
for (const button of allMoveButtons) {
  // const thisTD = button.parentElement.parentElement.parentElement;
  const thisTD = findAncestor(button, 'TD');
  const thisID = thisTD.parentElement.id;
  const thisControlStr = button.dataset.controlStr;
  const thisEncodedContent = thisTD.dataset.encodedContent; // i.e. the "data-encoded-content" element, with auto camelCase transposition
  // console.log('-', thisID, thisControlStr, thisEncodedContent);
  const thisFilename = button.parentElement.dataset.dateString;
  // add event handler
  button.addEventListener('click', function (event) {
    event.preventDefault();
    handleButtonClick(thisControlStr, 'moveFromCalToCal', thisFilename, thisEncodedContent); // , event.metaKey
  }, false);
}
console.log(String(allMoveButtons.length) + ' moveButton ELs added');

let allChangeDateButtons = document.getElementsByClassName("changeDateButton");
for (const button of allChangeDateButtons) {
  // const thisTD = button.parentElement.parentElement.parentElement;
  const thisTD = findAncestor(button, 'TD');
  const thisID = thisTD.parentElement.id;
  const thisControlStr = button.dataset.controlStr;
  const thisEncodedContent = thisTD.dataset.encodedContent; // i.e. the "data-encoded-content" element, with auto camelCase transposition
  const thisEncodedFilename = thisTD.dataset.encodedFilename;
  // add event handler
  button.addEventListener('click', function (event) {
    event.preventDefault();
    handleButtonClick(thisControlStr, 'updateTaskDate', thisEncodedFilename, thisEncodedContent); // , event.metaKey
  }, false);
}
console.log(String(allChangeDateButtons.length) + ' dateChangeButton ELs added');
</script>
`

/**
 * Handle various clicks
 */
const clickHandlersScript = `
<!-- clickHandlersScript -->
<script type="text/javascript">

// For clicking on item icons
function handleIconClick(id, itemType, filename, content, metaModifier) {
  console.log('handleIconClick( ' + id + ' / ' + itemType + ' / ' + filename + '/ {' + content + '} / ' + String(metaModifier)+ ' )');
  const encodedFilename = filename; // already encoded at this point. Was: encodeRFC3986URIComponent(filename);
  const encodedContent = content; // already encoded at this point. Was: encodeRFC3986URIComponent(content);

  switch(itemType) {
    case 'open': {
      onClickDashboardItem( { itemID: id, type: (metaModifier) ? 'cancelTask' : 'completeTask', encodedFilename: encodedFilename, encodedContent: encodedContent } );
      break;
    }
    case 'checklist': {
      onClickDashboardItem( { itemID: id, type: (metaModifier) ? 'cancelChecklist' : 'completeChecklist', encodedFilename: encodedFilename, encodedContent: encodedContent } );
      break;
    }
    case 'review': {
      onClickDashboardItem( { itemID: id, type: 'showNoteInEditorFromFilename', encodedFilename: encodedFilename, encodedContent: '' } );
      break;
    }
    default: {
      console.error('- unknown itemType: ' + paraType);
      break;
    }
  }
}

// For clicking on main 'paragraph content'
function handleContentClick(event, id, filename, content) {
  console.log('handleContentClick( ' + id + ' / ' + filename + ' / ' +content + ' ) for event currentTarget: ' + event.currentTarget);
  const encodedFilename = filename; // already encoded at this point. Was: encodeRFC3986URIComponent(filename);
  const encodedContent = content; // already encoded at this point. Was: encodeRFC3986URIComponent(content);
	// onClickDashboardItem( { itemID: id, type: 'showNoteInEditorFromFilename', encodedFilename: encodedFilename, encodedContent: encodedContent } );
	onClickDashboardItem( { itemID: id, type: 'showLineInEditorFromFilename', encodedFilename: encodedFilename, encodedContent: encodedContent } ); // TEST: change from openNote.. to openLine...
}

// For clicking on checkbox
function handleCheckboxClick(cb) {
  console.log("Checkbox for " + cb.name + " clicked, new value = " + cb.checked);
  onChangeCheckbox(cb.name, cb.checked);
}

// For clicking on button in hoverExtraControls
function handleButtonClick(id, controlStr, filename, content) {
  console.log("Button clicked on id: " + id + " for controlStr " + controlStr + ". filename: " + filename + " content: {" + content +"}");
  onClickDashboardItem( { itemID: id, type: controlStr, encodedFilename: filename, encodedContent: content } );
}
</script>
`

/**
 * When window is resized, send notification (now not dimensions which seem unreliable) to plugin.
 * As it continuously fires, I've added a debounce (borrowed from lodash, as best I can)
 * Note: doesn't fire on window *move* alone.
 * TODO: seems to fire immediately, which is unhelpful. So currently disabled.
 */
const resizeListenerScript = `
<!-- resizeListenerScript -->
<script type="text/javascript" src="./debounce.js"></script>
<script type="text/javascript">
function addResizeHandler() {
  // const rect = { x: window.screenX, y: window.screenY, width: window.innerWidth, height: window.innerHeight };
  console.log("resize event triggered in window: inner dimensions now w"+String(window.innerWidth)+":h"+String(window.innerHeight)+"/"+String(window.outerHeight));
  onClickDashboardItem({itemID: 'dummy', type: 'windowResized', encodedFilename: 'dummy', encodedContent: 'dummy'});
}

window.addEventListener("resize", debounce(addResizeHandler, 250, false), false);
</script>
`

/**
 * Before window is closed, attempt to send dimensions to plugin.
 * Note: currently disabled, as I don't think it was working
 */
const unloadListenerScript = `
<!-- unloadListenerScript -->
<script type="text/javascript">
window.addEventListener("beforeunload", function(){
  const rect = { x: window.screenX, y: window.screenY, width: window.innerWidth, height: window.innerHeight };
  console.log('beforeunload event triggered in window');
  onClickDashboardItem({itemID: 'dummy', type: 'windowResized', encodedFilename: 'dummy', encodedContent: JSON.stringify(rect)});
})
</script>
`

/**
 * Show the dashboard HTML window, _but with some pre-configured demo data_.
 */
export async function showDemoDashboardHTML(): Promise<void> {
  // Check to stop it running on iOS
  if (NotePlan.environment.platform === 'iOS') {
    logWarn(pluginJson, `Sorry: Dashboard won't run on the small screen of iPhones.`)
    await showMessage(`Sorry: Dashboard won't run on the small screen of iPhones`)
    return
  }

  await showDashboardHTML(true, true)
}

/**
 * Show the generated dashboard data using native HTML.
 * The HTML item IDs are defined as:
 * - x-y = section x item y, used in <tr> tags and onClick references
 * - <filename> = encoded filename of task, used in both 'col 3' <td> tags
 * - x-yI = icon for section x item y, used in 'col 3' <i> tag
 *
 * @author @jgclark
 * @param {boolean?} shouldFocusWindow? (default: true)
 * @param {boolean?} showDemoData? if true, show the demo data, otherwise show the real data
 */
export async function showDashboardHTML(shouldFocus: boolean = true, demoMode: boolean = false): Promise<void> {
  try {
    // Check to stop it running on iOS
    if (NotePlan.environment.platform === 'iOS') {
      logWarn(pluginJson, `Sorry: Dashboard won't run on the small screen of iPhones.`)
      await showMessage(`Sorry: Dashboard won't run on the small screen of iPhones`)
      return
    }

    const config = await getSettings()
    const todaysFilenameDate = getTodaysDateUnhyphenated()
    let filterPriorityItems = DataStore.preference('Dashboard-filterPriorityItems') ?? false
    await checkForRequiredSharedFiles(pluginJson)
    let sections: Array<Section> = []
    let sectionItems: Array<SectionItem> = []

    //---------------------------------------------------
    // Main preparation Work

    if (demoMode) {
      ;[sections, sectionItems] = await getDemoDataForDashboard()
    } else {
      ;[sections, sectionItems] = await getDataForDashboard()
    }

    // logDebug('showDashboardHTML', `Starting with ${String(sections.length)} sections and ${String(sectionItems.length)} items`)

    const outputArray: Array<string> = []
    const dailyNoteTitle = displayTitle(DataStore.calendarNoteByDate(new Date(), 'day'))
    const weeklyNoteTitle = displayTitle(DataStore.calendarNoteByDate(new Date(), 'week'))
    const monthlyNoteTitle = displayTitle(DataStore.calendarNoteByDate(new Date(), 'month'))
    const quarterlyNoteTitle = displayTitle(DataStore.calendarNoteByDate(new Date(), 'quarter'))
    const startReviewXCallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', 'next project review', '')

    //--------------------------------------------------------------
    // Create nice HTML display for this data

    // Main table loop
    let totalOpenItems = 0
    let totalDoneItems = 0
    outputArray.push(`\n<table id="mainTable" style="table-layout: auto; word-wrap: break-word;">`)
    let sectionNumber = 0
    for (const section of sections) {
      logDebug('showDashboardHTML', `Section ${section.name} ID:${String(section.ID)} filename:${section.filename}`)
      // Special case to handle count of done items
      if (section.name === 'Done') {
        totalDoneItems = section.ID
        continue // to next loop item
      }

      // Get all items for this section
      let items = sectionItems.filter((i) => i.ID.startsWith(String(section.ID)))

      if (items.length === 0) {
        if (sectionNumber === 0) {
          // If there are no items in first section, then add a congratulatory message
          items.push({
            ID: '0-Congrats',
            type: 'congrats',
            content: `Nothing to do: take a break! <i class="fa-regular fa-face-party fa-face-sleeping"></i>`,
            rawContent: ``,
            filename: '',
          })
        } else {
          // don't add this section: go on to next section
          logDebug('showDashboardHTML', `Section ${String(sectionNumber)} (${section.name}) is empty so will skip it`)
          sectionNumber++
          continue // to next loop item
        }
      }

      // Prepare col 1 (section icon + title + description)
      // Now prepend a sectionNCount ID and populate it. This needs a span with an ID so that it can be updated later.
      const sectionCountID = `section${String(section.ID)}Count`
      const sectionCountPrefix = `<span id="${sectionCountID}">${String(items.length)}</span>`
      const sectionNameWithPossibleLink = section.filename ? addNoteOpenLinkToString(section, section.name) : section.name
      outputArray.push(
        ` <tr>\n  <td style="min-width:8rem; max-width: 10rem;"><p class="${section.sectionTitleClass} sectionName"><i class="${section.FAIconClass} pad-right"></i>${sectionNameWithPossibleLink}</p>`,
      )

      if (items.length > 0) {
        outputArray.push(`   <p class="sectionDescription">${sectionCountPrefix} ${section.description}`)

        if (['Today', 'This week', 'This month', 'This quarter', 'This year'].includes(section.name)) {
          // Add 'add task' and 'add checklist' icons
          // TODO: add tooltip
          const xcbAddTask = createRunPluginCallbackUrl('jgclark.Dashboard', 'addTask', [section.filename])
          outputArray.push(`    <a href="${xcbAddTask}"><i class="fa-regular fa-circle-plus ${section.sectionTitleClass}"></i></a>`)
          const xcbAddChecklist = createRunPluginCallbackUrl('jgclark.Dashboard', 'addChecklist', [section.filename])
          outputArray.push(`    <a href="${xcbAddChecklist}"><i class="fa-regular fa-square-plus ${section.sectionTitleClass}"></i></a>`)
        }
      }
      // Close col 1
      outputArray.push(`   </p>\n  </td>`)

      // Start col 2+3 = embedded table of items for this section
      outputArray.push(`  <td>`)
      outputArray.push(`   <div class="multi-cols">`)
      outputArray.push(`     <table style="table-layout: auto; word-wrap: break-word;" id="${section.ID}-Section">`)

      let filteredOut = 0
      const filteredItems: Array<SectionItem> = []
      // If we want to, then filter some out in this section, and append an item to indicate this
      // Count newer 'working-on' indicator as priority 0, with no priority indicator as -1
      if (filterPriorityItems) {
        let maxPriority = -1
        for (const item of items) {
          const thisPriority = getTaskPriority(item.content)
          if (thisPriority > maxPriority) {
            maxPriority = thisPriority
          }
        }
        for (const item of items) {
          const thisPriority = getTaskPriority(item.content)
          if (maxPriority === 0 || thisPriority >= maxPriority) {
            filteredItems.push(item)
          } else {
            filteredOut++
          }
        }
        if (filteredOut > 0) {
          items = filteredItems
          items.push({
            ID: section.ID + '-Filter',
            content: `There are also ${filteredOut} lower-priority items not shown.`,
            rawContent: 'Filtered out',
            filename: '',
            type: 'filterIndicator',
          })
        }
      }

      for (const item of items) {
        let encodedFilename = encodeRFC3986URIComponent(item.filename)
        let encodedContent = encodeRFC3986URIComponent(item.content)
        let reviewNoteCount = 0 // count of note-review items
        outputArray.push(`       <tr class="no-borders" id="${item.ID}">`)

        // Long-winded way to get note title, as we don't have TNote, but do have note's filename
        const itemNoteTitle = displayTitle(DataStore.projectNoteByFilename(item.filename) ?? DataStore.calendarNoteByDateString(item.filename.split('.')[0]))

        // Work out the extra controls that are relevant for this task, and set up as tooltips
        const possibleControlTypes = [
          { displayString: '→today', controlStr: 't', sectionDateTypes: ['W', 'M', 'Q'] }, // special controlStr to indicate change to '>today'
          { displayString: '+1d', controlStr: '+1d', sectionDateTypes: ['D', 'W', 'M'] },
          { displayString: '+1b', controlStr: '+1b', sectionDateTypes: ['D', 'W', 'M'] },
          { displayString: '→wk', controlStr: '+0w', sectionDateTypes: ['D', 'M'] },
          { displayString: '+1w', controlStr: '+1w', sectionDateTypes: ['D', 'W'] },
          { displayString: '→mon', controlStr: '+0m', sectionDateTypes: ['D', 'W', 'Q'] },
          { displayString: '+1m', controlStr: '+1m', sectionDateTypes: ['M'] },
          { displayString: '→qtr', controlStr: '+0q', sectionDateTypes: ['M'] },
        ]
        const controlTypesForThisSection = possibleControlTypes.filter((t) => t.sectionDateTypes.includes(section.dateType))
        let tooltipContent = ''
        if (controlTypesForThisSection.length > 0) {
          tooltipContent = `\n           <span class="hoverExtraControls" data-date-string="${section.filename}">`
          // only want control types relevant for this section
          for (const ct of controlTypesForThisSection) {
            // tooltipContent += `\n/<!-- ${ct.controlStr} / ${ct.sectionDateTypes.join('')} / ${section.dateType} / ${item.filename} / ${section.filename} -->\n`
            if (ct.sectionDateTypes.includes(section.dateType)) {
              // if (item.filename === section.filename) {
              if (isValidCalendarNoteFilename(item.filename)) {
                tooltipContent += `<button class="moveButton" data-control-str="${ct.controlStr}">${ct.displayString}</button>`
              } else {
                logDebug('dashboardHTML', `- This needs to be updateTaskDate ${item.filename} as its not a calendar note`)
                tooltipContent += `<button class="changeDateButton" data-control-str="${ct.controlStr}">${ct.displayString}</button>`
              }
            }
          }
          tooltipContent += '</span>'
        }

        // Do main work for the item
        switch (item.type) {
          case 'open': {
            logDebug('showDashboardHTML', `- adding open taskContent for ${item.content} / ${itemNoteTitle}`)
            // do icon col (was col3)
            outputArray.push(
              `         <td id="${encodedFilename}" class="sectionItemTodo sectionItem no-borders" data-encoded-content="${encodedContent}"><i id="${item.ID}I" class="todo fa-regular fa-circle"></i></td>`,
            )

            // do col 4: whole note link is clickable.
            // If context is wanted, and linked note title
            let paraContent = ''
            if (config.includeTaskContext) {
              if ([dailyNoteTitle, weeklyNoteTitle, monthlyNoteTitle, quarterlyNoteTitle].includes(itemNoteTitle)) {
                paraContent = makeParaContentToLookLikeNPDisplayInHTML(item, itemNoteTitle, 'all', 140)
              } else {
                paraContent = makeParaContentToLookLikeNPDisplayInHTML(item, itemNoteTitle, 'append', 140)
              }
            } else {
              paraContent = makeParaContentToLookLikeNPDisplayInHTML(item, '', 'all', 140)
            }
            // const cell4 = `         <td class="sectionItemContent sectionItem" data-encoded-filename="${encodedFilename}" data-encoded-content="${encodedContent}">\n          <div class="content avoidColumnBreakHere tooltip">${paraContent}${tooltipContent}\n          </div>\n         </td>\n       </tr>`
            const cell4 = `         <td class="sectionItemContent sectionItem" data-encoded-filename="${encodedFilename}" data-encoded-content="${encodedContent}">\n          <div class="avoidColumnBreakHere tooltip"><a class="content">${paraContent}</a>${tooltipContent}\n          </div>\n         </td>\n       </tr>`
            outputArray.push(cell4)
            totalOpenItems++
            break
          }
          case 'checklist': {
            logDebug('showDashboardHTML', `- adding checklist taskContent for ${item.content} / ${itemNoteTitle}`)
            // do icon col (was col3)
            outputArray.push(
              `         <td id="${encodedFilename}" class="sectionItemChecklist sectionItem no-borders" data-encoded-content="${encodedContent}"><i id="${item.ID}I" class="todo fa-regular fa-square"></i></td>`,
            )

            // do item details col (was col4):
            let paraContent = ''
            // whole note link is clickable if context is wanted, and linked note title
            if (config.includeTaskContext && ![dailyNoteTitle, weeklyNoteTitle, monthlyNoteTitle, quarterlyNoteTitle].includes(itemNoteTitle)) {
              paraContent = makeParaContentToLookLikeNPDisplayInHTML(item, itemNoteTitle, 'append', 140)
            } else {
              paraContent = makeParaContentToLookLikeNPDisplayInHTML(item, itemNoteTitle, 'all', 140)
            }

            // const cell4 = `         <td class="sectionItemContent sectionItem" data-encoded-filename="${encodedFilename}" data-encoded-content="${encodedContent}">\n          <div class="content avoidColumnBreakHere tooltip">${paraContent}${tooltipContent}\n          </div>\n         </td>\n       </tr>`
            const cell4 = `         <td class="sectionItemContent sectionItem" data-encoded-filename="${encodedFilename}" data-encoded-content="${encodedContent}">\n          <div class="avoidColumnBreakHere tooltip"><a class="content">${paraContent}</a>${tooltipContent}\n          </div>\n         </td>\n       </tr>`
            outputArray.push(cell4)
            totalOpenItems++
            break
          }
          case 'congrats': {
            const cell3 = `          <td class="checked sectionItem noborders"><i class="fa-regular fa-circle-check"></i></td>`
            outputArray.push(cell3)
            const cell4 = `         <td class="sectionItem noborders">${item.content} </td>\n       </tr>`
            outputArray.push(cell4)
            break
          }
          case 'review': {
            if (itemNoteTitle) {
              // do icon col (was col3)
              outputArray.push(
                `         <td id="${item.ID}I" class="review sectionItem no-borders" data-encoded-filename="${encodedFilename}"><i class="fa-solid fa-calendar-check"></i></td>`,
              )

              // do item details col (was col4): review note link as internal calls
              const folderNamePart = config.includeFolderName && getFolderFromFilename(item.filename) !== '' ? getFolderFromFilename(item.filename) + ' / ' : ''
              // let cell4 = `         <td id="${item.ID}" class="sectionItem">${folderNamePart}<a class="noteTitle" data-encoded-filename="${encodedFilename}">${itemNoteTitle}</a></td>\n       </tr>`
              let cell4 = `         <td id="${item.ID}" class="sectionItem">${folderNamePart}${makeNoteTitleWithOpenActionFromFilename(item, itemNoteTitle)}</td>\n       </tr>`
              outputArray.push(cell4)
              totalOpenItems++
              reviewNoteCount++
            } else {
              logError('makeDashboard', `Cannot find note for '${item.content}'`)
            }
            break
          }
          case 'filterIndicator': {
            // do icon col
            outputArray.push(`          <td class="todo sectionItem no-borders"><i class="fa-light fa-plus"></i></td>`)
            // do item details
            let cell4 = `          <td class="sectionItem lowerPriority">${item.content}</td>\n       </tr>`
            outputArray.push(cell4)
            break
          }
        }
      }

      outputArray.push(`      </table>`)
      outputArray.push(`    </div>`)
      outputArray.push(`   </td>\n </tr>`)
      sectionNumber++
    }
    outputArray.push(`</table>`)

    // write header lines before first table
    const summaryStatStr = `<b><span id="totalOpenCount">${String(totalOpenItems)}</span> open items</b>; <span id="totalDoneCount">${String(
      totalDoneItems,
    )}</span> closed. Last updated ${nowLocaleShortTime()}`

    // Write time and refresh info
    const refreshXCallbackURL = createRunPluginCallbackUrl('jgclark.Dashboard', 'show dashboard', '')
    const refreshXCallbackButton = `<span class="fake-button"><a class="button" href="${refreshXCallbackURL}"><i class="fa-solid fa-arrow-rotate-right"></i>&nbsp;Refresh</a></span>`
    // Now using a proper button, not a fake one. But it needs to live inside a form to activate.
    // FIXME: works in Safari, but not in NP. Grrr.
    // const refreshXCallbackButton = `<form action="${refreshXCallbackURL}" style="display: inline;"><button class="mainButton" type="submit"></form><i class="fa-solid fa-arrow-rotate-right"></i> Refresh</button>`

    // Add filter checkbox
    const filterCheckbox = `<span style="float: right;"><input type="checkbox" class="apple-switch" onchange='handleCheckboxClick(this);' name="filterPriorityItems" ${
      filterPriorityItems ? 'checked' : 'unchecked'
    }><label for="filterPriorityItems">Filter out lower-priority items?</label></input></span>\n`

    const header = `<div class="body space-under">${summaryStatStr}\n${refreshXCallbackButton}\n${filterCheckbox}</div>`
    outputArray.unshift(header)

    //------------------------------------------------
    // Show in an HTML window, and save a copy as file
    // Set filename for HTML copy if _logLevel set to DEBUG
    const windowTitle = `Dashboard (${totalOpenItems} items)`
    const filenameHTMLCopy = config._logLevel === 'DEBUG' || config._logLevel === 'INFO' ? '../../jgclark.Dashboard/dashboard.html' : ''

    const winOptions = {
      windowTitle: windowTitle,
      customId: windowCustomId,
      headerTags: resourceLinksInHeader,
      generalCSSIn: '', // get general CSS set automatically
      specificCSS: '', // set in separate CSS file referenced in header
      makeModal: false,
      shouldFocus: shouldFocus, // shouuld focus window?
      preBodyScript: '', // no extra pre-JS
      postBodyScript:
        encodeDecodeScript +
        commsBridge +
        addIconEventListenersScript +
        addContentEventListenersScript +
        addButtonEventListenersScript +
        addReviewEventListenersScript +
        clickHandlersScript, // + resizeListenerScript, // + unloadListenerScript,
      savedFilename: filenameHTMLCopy,
      reuseUsersWindowRect: true, // do try to use user's position for this window, otherwise use following defaults ...
      width: 1000, // = default width of window (px)
      height: 500, // = default height of window (px)
      x: 409, // default, normally overriden from last position
      y: 0, // default, normally overriden from last position
    }
    await showHTMLV2(outputArray.join('\n'), winOptions)
    logDebug(`makeDashboard`, `written to HTML window with shouldFocus ${String(shouldFocus)}`)

    //--------------------------------------------------------------
    // Finally, add auto-update trigger to open note if:
    // - config.autoAddTrigger says so,
    // - and if shouldFocus is true, indicating this was called by user action, not a trigger'd refresh
    // - and not in demoMode
    if (config.autoAddTrigger && shouldFocus && !demoMode) {
      const res = addTrigger(Editor, 'onEditorWillSave', 'jgclark.Dashboard', 'decideWhetherToUpdateDashboard')
      if (!res) {
        logWarn(pluginJson, 'Dashboard trigger could not be added for some reason.')
        const res2 = await showMessage(`Warning: Couldn't add auto-update trigger for the Dashboard for some reason.`)
      }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Prepend an open task to 'calNoteFilename' calendar note, using text we prompt the user for
 * @param {string} calNoteFilename to prepend the task to
 */
export async function addTask(calNoteFilename: string): Promise<void> {
  const calNoteDateStr = getDateStringFromCalendarFilename(calNoteFilename)
  logDebug('addTask', `- adding task to ${calNoteDateStr} from ${calNoteFilename}`)
  await prependTodoToCalendarNote('task', calNoteDateStr)
  // trigger window refresh
  await showDashboardHTML()
}

/**
 * Prepend an open checklist to 'calNoteFilename' calendar note, using text we prompt the user for
 * @param {string} calNoteFilename to prepend the task to
 */
export async function addChecklist(calNoteFilename: string): Promise<void> {
  const calNoteDateStr = getDateStringFromCalendarFilename(calNoteFilename)
  logDebug('addChecklist', `- adding task to ${calNoteDateStr} from ${calNoteFilename}`)
  await prependTodoToCalendarNote('checklist', calNoteDateStr)
  // trigger window refresh
  await showDashboardHTML()
}

/**
 * Special command to resize dashboard window size to default
 * Note: remove when Eduard finds the bug that means I needed to try this
 */
export async function resetDashboardWinSize(): Promise<void> {
  unsetPreference('WinRect_Dashboard')
  closeWindowFromCustomId(pluginJson['plugin.id'])
  await showDashboardHTML(true, false)
}

//------------------------------------------------------------------------------
/**
 * Details of HTML structure for section 0 items
   TR class:no-borders id:0-0
     TD class:sectionItemTodo sectionItem id=<filename> data-encoded-content
     TD class:sectionItemContent sectionItem: data-encoded-content, data-encoded-filename
       DIV class:content tooltip
         SPAN class:priority1
           [A class:noteTitle sectionItem onClick=...showNoteInEditorFromFilename...]
         SPAN class:hoverExtraControls data-date-string
           BUTTON class:changeDateButton
           BUTTON class:changeDateButton
           BUTTON class:changeDateButton
           BUTTON class:changeDateButton

       <tr class="no-borders" id="0-3">
         <td id="CCC%20Areas%2FServices.md" class="sectionItemTodo sectionItem no-borders" data-encoded-content="%21%20Reply%20to%20Becky%20P%20with%20final%20details%20%3E2023-08-25"><i id="0-3I" class="todo fa-regular fa-circle"></i></td>

         <td class="sectionItemContent sectionItem" data-encoded-filename="CCC%20Areas%2FServices.md" data-encoded-content="%21%20Reply%20to%20Becky%20P%20with%20final%20details%20%3E2023-08-25">

          <div class="content avoidColumnBreakHere tooltip"><span class="priority1"> Reply to Becky P with final details <a class="noteTitle sectionItem" onClick="onClickDashboardItem({itemID: '0-3', type: 'showNoteInEditorFromFilename', encodedFilename: 'CCC%20Areas%2FServices.md', encodedContent: ''})"><i class="fa-regular fa-file-lines"></i> Services</a></span>

           <span class="hoverExtraControls" data-date-string="20230825.md"><button class="changeDateButton" data-control-str="+1d">+1d</button><button class="changeDateButton" data-control-str="+1b">+1b</button><button class="changeDateButton" data-control-str="+0w">→wk</button><button class="changeDateButton" data-control-str="+1w">+1w</button><button class="changeDateButton" data-control-str="+0m">→mon</button></span>
          </div>
         </td>
       </tr>
 */
