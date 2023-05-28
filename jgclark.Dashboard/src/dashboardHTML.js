// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main functions
// Last updated 17.5.2023 for v0.4.3 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import moment from 'moment/min/moment-with-locales'
import { getDataForDashboard } from './dataGeneration'
import { getDemoDataForDashboard } from './demoDashboard'
import {
  addNoteOpenLinkToString, getSettings, getTaskPriority,
  makeParaContentToLookLikeNPDisplayInHTML,
  type SectionDetails, type SectionItem
} from './dashboardHelpers'
import { prependTodoToCalendarNote } from '@helpers/NPParagraph'
import { clo, JSP, logDebug, logError, logInfo } from '@helpers/dev'
import { getDateStringFromCalendarFilename, toLocaleTime } from '@helpers/dateTime'
import { getFolderFromFilename } from '@helpers/folders'
import { checkForRequiredSharedFiles } from '@helpers/NPRequiredFiles'
import { createPrettyOpenNoteLink, createPrettyRunPluginLink, createRunPluginCallbackUrl, displayTitle, returnNoteLink } from '@helpers/general'
import { showHTMLV2 } from '@helpers/HTMLView'
import { getNoteType } from '@helpers/note'
import { decodeRFC3986URIComponent, encodeRFC3986URIComponent } from '@helpers/stringTransforms'
import { focusHTMLWindowIfAvailable } from '@helpers/NPWindows'

//-----------------------------------------------------------------
// HTML resources

const windowCustomId = 'Dashboard'

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
 * Attempt to add a key listener added to all checklist items
 * TODO: Not yet working.
 */
const shiftKeyListenerScript = `
<!-- shiftKeyListenerScript -->
<script type="text/javascript">
document.getElementById("mainTable").addEventListener("load", addShiftKeyEventHandlersFunc);
function addShiftKeyEventHandlersFunc() {
  let allTasksChecklists = document.getElementsByClassName("todo");
  for (let i=0; i<allTasksChecklists.length; i++) {
    allTasksChecklists[i].addEventListener('click', function() {
      console.log('shiftKey held? '+String(event.shiftKey))
    }, false);
  }
  console.log('shiftKey ELs added');
}
</script>
`

const checkboxClickListenerScript = `
<script type="text/javascript">
function handleCheckboxClick(cb) {
  // TODO: Do the real work here. Need to figure out how to keep and communicate the variable -- make it not a setting?
  console.log("Checkbox for " + cb.name + " clicked, new value = " + cb.checked);
  onChangeCheckbox(cb.name, cb.checked);
}
</script>
`
/**
 * Prevent clicking on a link from also opening the HTML page in the default browser.
 * Applied to all items that have a 'sectionItem' class
 * Example from https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault:
 * const checkbox = document.querySelector("#id-checkbox");
 * checkbox.addEventListener("click", checkboxClick, false);
 * function checkboxClick(event) {
 *   let warn = "preventDefault() won't let you check this!<br>";
 *   document.getElementById("output-box").innerHTML += warn;
 *   event.preventDefault();
 * }
 */
// FIXME: fix why this isn't firing
// Try this?
//   const nodes = document.childNodes;
//   const nodeArray = [...nodes];

const preventClicksPropagatingScript = `
<!-- preventClicksPropagatingScript -->
<script type="text/javascript">
document.getElementById("mainTable").addEventListener("load", addPreventDefaultEventHandlersFunc);
function addPreventDefaultEventHandlersFunc() {
  const allLinks = document.getElementsByClassName("sectionItem");
  console.log("Attempting to add "+String(allLinks.length)+" preventClicksPropagating ELs");
  for (let i=0; i<allLinks.length; i++) {
    event.preventDefault();
  }
  console.log('-> preventClicksPropagating ELs added');
}
</script>
`

/**
 * When window is resized, send dimensions to plugin. Note: doesn't fire on window *move* alone.
 */
// FIXME: fix why this is giving 0 height
const resizeListenerScript = `
<!-- resizeListenerScript -->
<script type="text/javascript">
window.addEventListener("resize", function(){
  const rect = { x: window.screenX, y: window.screenY, width: window.innerWidth, height: window.outerHeight };
  console.log("resize event triggered in window: inner dimensions now w"+String(window.innerWidth)+":h"+String(window.innerHeight)+"/"+String(window.outerHeight));
  onClickDashboardItem('dummy', 'windowResized', 'dummy', JSON.stringify(rect));
})
</script >
`

/**
 * Before window is closed, attempt to send dimensions to plugin.
 * TODO: not working yet
 */
const unloadListenerScript = `
<!-- unloadListenerScript -->
<script type="text/javascript">
window.addEventListener("beforeunload", function(){
  const rect = { x: window.screenX, y: window.screenY, width: window.innerWidth, height: window.innerHeight };
  console.log('beforeunload event triggered in window');
  onClickDashboardItem('dummy', 'windowResized', 'dummy', JSON.stringify(rect));
})
</script>
`

/**
 * Show the dashboard HTML window, _but with some pre-configured demo data_.
 */
export async function showDemoDashboardHTML(): Promise<void> {
  await showDashboardHTML(true)
}

/**
 * Show the generated dashboard data using native HTML.
 * The HTML item IDs are defined as:
 * - x-y = section x item y, used in <tr> tags and onClick references
 * - x-yA = href link for section x item y, used in 'col 3' <td> tags
 * - x-yI = icon for section x item y, used in 'col 3' <td> tags
 *
 * @author @jgclark
 * @param {boolean?} showDemoData - if true, show the demo data, otherwise show the real data
 */
export async function showDashboardHTML(demoMode: boolean = false): Promise<void> {
  try {
    const config = await getSettings()
    let filterPriorityItems = DataStore.preference('Dashboard-filterPriorityItems') ?? false
    await checkForRequiredSharedFiles(pluginJson)
    let sections: Array<SectionDetails> = []
    let sectionItems: Array<SectionItem> = []

    if (demoMode) {
      [sections, sectionItems] = await getDemoDataForDashboard()
    } else {
      [sections, sectionItems] = await getDataForDashboard()
    }

    logDebug('showDashboardHTML', `Starting with ${String(sections.length)} sections and ${String(sectionItems.length)} items`)

    const outputArray: Array<string> = []
    const dailyNoteTitle = displayTitle(DataStore.calendarNoteByDate(new Date(), 'day'))
    const weeklyNoteTitle = displayTitle(DataStore.calendarNoteByDate(new Date(), 'week'))
    const monthlyNoteTitle = displayTitle(DataStore.calendarNoteByDate(new Date(), 'month'))
    const quarterlyNoteTitle = displayTitle(DataStore.calendarNoteByDate(new Date(), 'quarter'))
    const startReviewXCallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', 'next project review', '')

    // Create nice HTML display for this data.

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
          items.push({ ID: '0-0C', type: 'congrats', content: `Nothing to do: take a break! <i class="fa-regular fa-face-party fa-face-sleeping"></i>`, rawContent: ``, filename: '' })
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
      const sectionNameWithPossibleLink = (section.filename)
        ? addNoteOpenLinkToString(section, section.name)
        : section.name
      outputArray.push(` <tr>\n  <td style="min-width:7rem; max-width: 9rem;"><p class="${section.sectionTitleClass} sectionName"><i class="${section.FAIconClass} pad-right"></i>${sectionNameWithPossibleLink}</p>`)

      if (items.length > 0) {
        outputArray.push(`   <p class="sectionDescription">${sectionCountPrefix} ${section.description}`)

        if (section.filename !== '') {
          // Add 'add task' and 'add checklist' icons
          // TODO: add tooltip
          const xcbAddTask = createRunPluginCallbackUrl('jgclark.Dashboard', 'addTask', [section.filename])
          outputArray.push(`     <span><a href="${xcbAddTask}"><i class="fa-regular fa-circle-plus ${section.sectionTitleClass}"></i></a></span>`)
          const xcbAddChecklist = createRunPluginCallbackUrl('jgclark.Dashboard', 'addChecklist', [section.filename])
          outputArray.push(`     <span><a href="${xcbAddChecklist}"><i class="fa-regular fa-square-plus ${section.sectionTitleClass}"></i></a></span>`)
        }
      }
      // close col1
      outputArray.push(`    </p>\n   </td>`)

      // // Prepare col 1 (section icon)
      // outputArray.push(` <tr>\n  <td><span class="${section.sectionTitleClass}"><i class="${section.FAIconClass}"></i></td>`)

      // // Prepare col 2 (section title)
      // // First prepend a sectionNCount ID and populate it. This needs a span with an ID so that it can be updated later.
      // const sectionCountID = `section${String(section.ID)}Count`
      // const sectionCountPrefix = `<span id="${sectionCountID}">${String(items.length)}</span>`
      // const sectionNameWithPossibleLink = (section.filename)
      //   ? addNoteOpenLinkToString(section, section.name)
      //   : section.name
      // if (items.length > 0) {
      //   outputArray.push(`  <td><span class="sectionName ${section.sectionTitleClass}" style="max-width: 14rem;">${sectionNameWithPossibleLink}</span><br /><span class="sectionDescription">${sectionCountPrefix} ${section.description}</span></td>`)
      // } else {
      //   // add a simpler version of the line
      //   outputArray.push(`  <td><span class="sectionName ${section.sectionTitleClass}" style="max-width: 14rem;">${sectionNameWithPossibleLink}</span></td>`)
      // }

      // Start col 2: table of items in this section
      outputArray.push(`  <td>`)
      outputArray.push(`  <div class="multi-cols">`)
      // Now start a nested table for cols 3/4 (to simplify logic and CSS)
      outputArray.push(`   <table style="table-layout: auto; word-wrap: break-word;">`)

      let filteredOut = 0
      const filteredItems: Array<SectionItem> = []
      // If we want to, then filtered some out in this section, and append an item to indicate this
      if (filterPriorityItems) {
        let maxPriority = 0
        for (const item of items) {
          const thisItemPriority = getTaskPriority(item.content)
          if (thisItemPriority > maxPriority) {
            maxPriority = thisItemPriority
          }
        }
        for (const item of items) {
          const thisItemPriority = getTaskPriority(item.content)
          if (maxPriority === 0 || thisItemPriority >= maxPriority) {
            filteredItems.push(item)
          } else {
            filteredOut++
          }
        }
        if (filteredOut > 0) {
          items = filteredItems
          items.push({
            ID: 'dayfilteredOut',
            content: `There are also ${filteredOut} lower-priority items not yet shown.`,
            rawContent: 'Filtered out',
            filename: '',
            type: 'filterIndicator'
          })
        }
      }

      for (const item of items) {
        let encodedFilename = encodeRFC3986URIComponent(item.filename)
        let encodedRawContent = encodeRFC3986URIComponent(item.rawContent)
        let reviewNoteCount = 0 // count of note-review items
        outputArray.push(`    <tr class="no-borders" id="${item.ID}">`)

        // Long-winded way to get note title, as we don't have TNote, but do have note's filename
        const itemNoteTitle = displayTitle(DataStore.projectNoteByFilename(item.filename) ?? DataStore.calendarNoteByDateString((item.filename).split(".")[0]))

        // Do main work for the item
        switch (item.type) {
          case 'open': {
            // do icon col (was col3)
            outputArray.push(
              `     <td id="${item.ID}A" class="todo clickTarget sectionItem no-borders" onClick="onClickDashboardItem('${item.ID}','${item.type}','${encodedFilename}','${encodedRawContent}')"><i id="${item.ID}I" class="fa-regular fa-circle"></i></td>`,
            )

            // do col 4: whole note link is clickable.
            // If context is wanted, and linked note title
            let paraContent = ''
            if (config.includeTaskContext) {
              if (itemNoteTitle === dailyNoteTitle || itemNoteTitle === weeklyNoteTitle || itemNoteTitle === monthlyNoteTitle || itemNoteTitle === quarterlyNoteTitle) {
                paraContent = makeParaContentToLookLikeNPDisplayInHTML(item, itemNoteTitle, 'all')
              } else {
                paraContent = makeParaContentToLookLikeNPDisplayInHTML(item, itemNoteTitle, 'append')
              }
            } else {
              paraContent = makeParaContentToLookLikeNPDisplayInHTML(item)
            }
            const cell4 = `     <td class="sectionItem">${paraContent}</td>\n    </tr>`
            outputArray.push(cell4)
            totalOpenItems++
            break
          }
          case 'checklist': {
            // do icon col (was col3)
            outputArray.push(`     <td class="todo clickTarget sectionItem no-borders" onClick="onClickDashboardItem('${item.ID}','${false ? 'checklistCancel' : 'checklist'}','${encodedFilename}','${encodedRawContent}')"><i class="fa-regular fa-square"></i></td>`)

            // do item details col (was col4): whole note link is clickable
            // If context is wanted, and linked note title
            let paraContent = ''
            if (config.includeTaskContext) {
              if (itemNoteTitle === dailyNoteTitle || itemNoteTitle === weeklyNoteTitle) {
                logDebug('showDashboardHTML', `- adding checklist taskContent for ${itemNoteTitle} ?= ${weeklyNoteTitle}`)
                paraContent = makeParaContentToLookLikeNPDisplayInHTML(item, itemNoteTitle, 'all')
              } else {
                paraContent = makeParaContentToLookLikeNPDisplayInHTML(item, itemNoteTitle, 'append')
              }
            } else {
              paraContent = makeParaContentToLookLikeNPDisplayInHTML(item)
            }
            const cell4 = `     <td class="sectionItem">${paraContent}</td>\n    </tr>`
            outputArray.push(cell4)
            totalOpenItems++
            break
          }
          case 'congrats': {
            const cell3 = `     <td class="checked sectionItem noborders"><i class="fa-regular fa-circle-check"></i></td>`
            outputArray.push(cell3)
            const cell4 = `     <td class="sectionItem noborders">${item.content} </td>\n    </tr>`
            outputArray.push(cell4)
            break
          }
          case 'review': {
            if (itemNoteTitle) {
              // do icon col (was col3)
              outputArray.push(`      <td class="todo sectionItem no-borders" onClick="onClickDashboardItem('${item.ID}','review','${encodedFilename}','')"><i class="fa-solid fa-calendar-check"></i></td>`)

              // do item details col (was col4): review note link as internal calls
              const folderNamePart = config.includeFolderName && (getFolderFromFilename(item.filename) !== '') ? getFolderFromFilename(item.filename) + ' / ' : ''
              let cell4 = `      <td class="sectionItem">${folderNamePart}<a class="noteTitle" href="" onClick = "onClickDashboardItem('${item.ID}','showNoteInEditorFromFilename','${encodedFilename}','${encodedRawContent}')">${itemNoteTitle}</a>`
              // TODO: make specific to that note
              cell4 += `</td>\n    </tr>`
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
            outputArray.push(`      <td class="todo sectionItem no-borders"><i class="fa-light fa-angle-right"></i></td>`)
            // do item details
            let cell4 = `      <td class="sectionItem lowerPriority">${item.content}</td>\n    </tr>`
            outputArray.push(cell4)
            break
          }
        }
      }

      outputArray.push(`   </table>`)
      outputArray.push(`  </div>`)
      outputArray.push(`  </td>\n </tr>`)
      sectionNumber++
    }
    outputArray.push(`</table>`)

    // write lines before first table
    // Write time and refresh info
    const refreshXCallbackURL = createRunPluginCallbackUrl('jgclark.Dashboard', 'show dashboard', '')
    const refreshXCallbackButton = `<span class="fake-button"><a class="button" href="${refreshXCallbackURL}"><i class="fa-solid fa-arrow-rotate-right"></i>&nbsp;Refresh</a></span>`

    let summaryStatStr = `<b><span id="totalOpenCount">${String(totalOpenItems)}</span> open items</b>; `
    summaryStatStr += `<span id="totalDoneCount">${String(totalDoneItems)}</span> closed`
    outputArray.unshift(`<p>${summaryStatStr}. Last updated: ${toLocaleTime(new Date())} ${refreshXCallbackButton}</p>`)
    // Add filter checkbox
    // TODO: here's a fancier one to experiment with
    const temp = `
    <label class="toggler-wrapper style-1">
          <input type="checkbox" >
          <div class="toggler-slider">
            <div class="toggler-knob"></div>
          </div>
        </label>`
    outputArray.unshift(`<div style="float: right;"><input type="checkbox" onchange='handleCheckboxClick(this);' name="filterPriorityItems" ${filterPriorityItems ? "checked" : "unchecked"}><label for="filterPriorityItems">Filter out lower-priority items?</label></div>`)

    // Show in an HTML window, and save a copy as file
    // Set filename for HTML copy if _logLevel set to DEBUG
    const windowTitle = `Dashboard (${totalOpenItems} items)`
    const filenameHTMLCopy = config._logLevel === 'DEBUG' ? '../../jgclark.Dashboard/dashboard.html' : ''

    const winOptions = {
      windowTitle: windowTitle,
      headerTags: resourceLinksInHeader,
      generalCSSIn: '', // get general CSS set automatically
      specificCSS: '', // set in separate CSS file instead
      makeModal: false, // = not modal window
      preBodyScript: '', // no extra pre-JS
      postBodyScript: commsBridge + preventClicksPropagatingScript + checkboxClickListenerScript, // + resizeListenerScript, //+ unloadListenerScript,
      savedFilename: filenameHTMLCopy,
      reuseUsersWindowRect: true, // do try to use user's position for this window, otherwise use following defaults ...
      width: 1000, // = default width of window (px)
      height: 500, // = default height of window (px)
      customId: windowCustomId,
      shouldFocus: false, // shouuld not focus, if Window already exists
      // x
      // y
    }
    await showHTMLV2(outputArray.join('\n'), winOptions)
    // await showHTML(
    //   windowTitle,
    //   resourceLinksInHeader,
    //   outputArray.join('\n'),
    //   '', // get general CSS set automatically
    //   '',
    //   false, // = not modal window
    //   '', // no extra JS
    //   commsBridge + postLoadScripts + checkboxClickListenerScript,
    //   filenameHTMLCopy,
    //   config.windowWidth > 0 ? config.windowWidth : 1000, // = width of window
    //   config.windowHeight > 0 ? config.windowHeight : 500, // = height of window
    //   // windowCustomId,
    //   // false // shouuld not focus, if Window already exists
    // ) // set width; max height
    logDebug(`makeDashboard`, `written to HTML window`)
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
