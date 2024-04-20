// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main functions
// Last updated 6.4.2024 for v1.1.4 by @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import {
  addTaskToNoteHeading,
  addTextToNoteHeading
} from '../../jgclark.QuickCapture/src/quickCapture'
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
import {
  getDateStringFromCalendarFilename,
  isValidCalendarNoteFilename
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { displayTitle } from '@helpers/general'
import {
  makePluginCommandButton,
  showHTMLV2,
} from '@helpers/HTMLView'
import { addTrigger } from '@helpers/NPFrontMatter'
import { checkForRequiredSharedFiles } from '@helpers/NPRequiredFiles'
import { generateCSSFromTheme } from '@helpers/NPThemeToCSS'
import { isHTMLWindowOpen } from '@helpers/NPWindows'
import { getTaskPriority } from '@helpers/paragraph'
import { encodeRFC3986URIComponent } from '@helpers/stringTransforms'
import { showMessage } from '@helpers/userInput'

//-----------------------------------------------------------------
// HTML resources

const windowCustomId = `${pluginJson['plugin.id']}.main`

// Note: this "../np.Shared" path works to the flattened np.Shared structure, but it does *not* work when running the locally-written copy of the HTML output file.
export const resourceLinksInHeader = `
<!-- Tell the browser to render the page at 1x to make it work on iOS -->
<!-- And give minimum 'width=450,' to help with dialog -->
<meta name="viewport" content="width=device-width, initial-scale=1" />

<!-- Load in Dashboard-specific CSS -->
<link href="./dashboard.css" rel="stylesheet">
<link href="./dashboardDialog.css" rel="stylesheet">

<!-- Load in fontawesome assets from np.Shared (licensed for NotePlan) -->
<link href="../np.Shared/fontawesome.css" rel="stylesheet">
<link href="../np.Shared/regular.min.flat4NP.css" rel="stylesheet">
<link href="../np.Shared/solid.min.flat4NP.css" rel="stylesheet">
<link href="../np.Shared/light.min.flat4NP.css" rel="stylesheet">

<!-- Load in other scripts from np.Shared -->
<script type="text/javascript" src="../np.Shared/shortcut.js"></script>

<!-- Load in other scripts from this plugin -->
<script type="text/javascript" src="./dashboardShortcuts.js"></script>
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
<script type="text/javascript" src="./HTMLWinCommsSwitchboard.js"></script>
<script type="text/javascript" src="../np.Shared/pluginToHTMLCommsBridge.js"></script>
`

/**
 * When window is resized, send notification (now not dimensions which seem unreliable) to plugin.
 * As it continuously fires, I've added a debounce (borrowed from lodash, as best I can)
 * Note: doesn't fire on window *move* alone.
 * TODO: seems to fire immediately, which is unhelpful. So currently disabled.
 */
// const resizeListenerScript = `
// <!-- resizeListenerScript -->
// <script type="text/javascript" src="./debounce.js"></script>
// <script type="text/javascript">
// function addResizeHandler() {
//   // const rect = { x: window.screenX, y: window.screenY, width: window.innerWidth, height: window.innerHeight };
//   console.log("resize event triggered in window: inner dimensions now w"+String(window.innerWidth)+":h"+String(window.innerHeight)+"/"+String(window.outerHeight));
//   onClickDashboardItem({itemID: 'dummy', type: 'windowResized', encodedFilename: 'dummy', encodedContent: 'dummy'});
// }

// window.addEventListener("resize", debounce(addResizeHandler, 250, false), false);
// </script>
//`

/**
 * Before window is closed, attempt to send dimensions to plugin.
 * Note: currently disabled, as I don't think it was working
 */
// const unloadListenerScript = `
// <!-- unloadListenerScript -->
// <script type="text/javascript">
// window.addEventListener("beforeunload", function(){
//   const rect = { x: window.screenX, y: window.screenY, width: window.innerWidth, height: window.innerHeight };
//   console.log('beforeunload event triggered in window');
//   onClickDashboardItem({itemID: 'dummy', type: 'windowResized', encodedFilename: 'dummy', encodedContent: JSON.stringify(rect)});
// })
// </script>
// `

/**
 * Show the dashboard HTML window, _but with some pre-configured demo data_.
 */
export async function showDemoDashboard(): Promise<void> {
  // Check to stop it running on iOS
  // if (NotePlan.environment.platform === 'iOS') {
  //   logWarn(pluginJson, `Sorry: Dashboard won't run on the small screen of iPhones.`)
  //   await showMessage(`Sorry: Dashboard won't run on the small screen of iPhones`)
  //   return
  // }

  await showDashboard('manual', true)
}

/**
 * Refresh the dashboard HTML window, *if it is already open*.
 * Called by Project & Reviews plugin from updateReviewListAfterChange() and makeFullReviewList() functions.
 */
export async function refreshDashboard(): Promise<void> {
  try {
    // Only continue if dashboard is already open
    if (isHTMLWindowOpen(windowCustomId)) {
      logDebug(pluginJson, `refreshDashboard(): Dashboard is open`)
      await showDashboard('refresh')
    } else {
      logDebug(pluginJson, `refreshDashboard(): Dashboard is NOT open`)
    }
  } catch (error) {
    logError(pluginJson, `refreshDashboard(): ${error.message}`)
  }
}

/**
 * Show the generated dashboard data using native HTML.
 * The generated HTML item IDs are defined as:
 * - x-y = section x item y, used in class "sectionItemRow" div tags and onClick references
 * - "data-encoded-filename" = encoded filename of task
 * - x-yI = icon for section x item y, used in class "itemIcon" FA <i> tags under "sectionItemRow" divs
 *
 * @author @jgclark
 * @param {string?} callType (default: 'manual', 'trigger', 'refresh')
 * @param {boolean?} demoMode? if true, show the demo data, otherwise show the real data
 */
export async function showDashboard(callType: string = 'manual', demoMode: boolean = false): Promise<void> {
  try {
    // // Check to stop it running on iOS
    // if (NotePlan.environment.platform === 'iOS') {
    //   logWarn(pluginJson, `Sorry: Dashboard won't run on the small screen of iPhones.`)
    //   await showMessage(`Sorry: Dashboard won't run on the small screen of iPhones`)
    //   return
    // }

    logDebug(pluginJson, `showDashboard() started ${demoMode ? '*and will use demo data*' : ''}`)

    const shouldFocus = (callType === 'manual')
    const config = await getSettings()
    // const todaysFilenameDate = getTodaysDateUnhyphenated()
    const filterPriorityItems = DataStore.preference('Dashboard-filterPriorityItems') ?? false
    await checkForRequiredSharedFiles(pluginJson)
    let sections: Array<Section> = []
    let sectionItems: Array<SectionItem> = []

    //---------------------------------------------------
    // Gather the actual data to display

    if (demoMode) {
      ;[sections, sectionItems] = await getDemoDataForDashboard()
    } else {
      // Get live data, indicating don't do a full generate if this has been triggered from change in daily note
      const fullGenerate = callType !== 'trigger'
        ;[sections, sectionItems] = await getDataForDashboard(fullGenerate)
    }

    const outputArray: Array<string> = []
    const today = new moment().toDate()
    const dailyNoteTitle = displayTitle(DataStore.calendarNoteByDate(today, 'day'))
    const yesterdayNoteTitle = displayTitle(DataStore.calendarNoteByDate(new moment().subtract(1, 'days').toDate(), 'day'))
    const weeklyNoteTitle = displayTitle(DataStore.calendarNoteByDate(today, 'week'))
    const monthlyNoteTitle = displayTitle(DataStore.calendarNoteByDate(today, 'month'))
    const quarterlyNoteTitle = displayTitle(DataStore.calendarNoteByDate(today, 'quarter'))
    // const startReviewXCallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', 'next project review', '')

    //--------------------------------------------------------------
    // Create nice HTML display for this data

    // Main table loop
    let totalOpenItems = 0
    let totalDoneItems = 0
    // outputArray.push(`\n<table id="mainTable" style="table-layout: auto; word-wrap: break-word;">`)
    outputArray.push(`\n<div class="sections">`)
    let sectionNumber = 0
    for (const section of sections) {
      logDebug('showDashboard', `Section ${section.name} ID:${String(section.ID)} filename:${section.filename}`)
      // Special case to handle count of done items
      if (section.name === 'Done') {
        totalDoneItems = section.ID
        continue // to next loop item
      }

      // Get all items for this section
      let items = sectionItems.filter((i) => i.ID.startsWith(String(section.ID)))

      if (items.length === 0) {
        // If there are no items in first section, then add a congratulatory message
        if (sectionNumber === 0) {
          items.push({
            ID: '0-Congrats',
            type: 'congrats',
            content: `Nothing to do: take a break <i class="fa-regular fa-mug"></i>`, // earlier tried fa-party-horn
            rawContent: ``,
            filename: '',
          })
        } else {
          // don't add this section: go on to next section
          logDebug('showDashboard', `Section ${String(sectionNumber)} (${section.name}) is empty so will skip it`)
          sectionNumber++
          continue // to next loop item
        }
      }

      // Start outer section, laid out in a grid with 2 columns
      outputArray.push(`  <!---------- Section ${String(sectionNumber)}: ${section.name} --------->\n  <div class="section">`)

      // Prepare outer col 1 (section icon + title + description)
      const sectionNameWithPossibleLink = section.filename ? addNoteOpenLinkToString(section, section.name) : section.name
      outputArray.push(
        `    <div class="sectionInfo">\n      <div class="${section.sectionTitleClass} sectionName"><i class="sectionIcon ${section.FAIconClass}"></i>${sectionNameWithPossibleLink}</div>`,
      )

      if (items.length > 0) {
        let sectionDescriptionToUse = section.description

        // Now prepend a sectionNCount ID and populate it. This needs a span with an ID so that it can be updated later.
        const sectionCountID = `section${String(section.ID)}Count`
        const sectionCountSpan = `<span id="${sectionCountID}">${String(items.length)}</span>`
        // Insert count at {count} placeholder
        sectionDescriptionToUse = section.description.replace('{count}', sectionCountSpan)

        // Insert total count at {totalCount:...} placeholder
        if (sectionDescriptionToUse.match(/{totalCount:\d+}/)) {
          const resArr = sectionDescriptionToUse.match(/{totalCount:(\d+)}/)
          if (resArr && resArr.length >= 1) {
            const totalCount = Number(resArr[1])
            const sectionTotalCountID = `section${String(section.ID)}TotalCount`
            const sectionTotalCountSpan = `<span id="${sectionTotalCountID}">${String(totalCount)}</span>`
            sectionDescriptionToUse = sectionDescriptionToUse.replace(/{totalCount:\d+}/, sectionTotalCountSpan)
          }
        }

        // Add extra buttons if there are placeholders here
        if (section.description.includes('{addItems}')) {
          const durationName = (section.sectionType === 'DT') ? 'today'
            : (section.sectionType === 'W') ? 'this week'
              : (section.sectionType === 'M') ? 'this month' : '(error)'
          const PCButton1 = makePluginCommandButton(
            `<i class="fa-regular fa-circle-plus ${section.sectionTitleClass}"></i>`,
            'jgclark.Dashboard',
            'addTask',
            section.filename,
            `Add a new task to ${durationName}'s note`)
          const PCButton2 = makePluginCommandButton(
            `<i class="fa-regular fa-square-plus ${section.sectionTitleClass}"></i>`,
            'jgclark.Dashboard',
            'addChecklist',
            section.filename,
            `Add a new checklist to ${durationName}'s note`)
          sectionDescriptionToUse = sectionDescriptionToUse.replace('{addItems}', `${PCButton1}&nbsp;${PCButton2}`)
        }

        if (section.description.includes('{addItemsNextPeriod}')) {
          const durationType = (section.sectionType === 'DT') ? 'day'
            : (section.sectionType === 'W') ? 'week'
              : (section.sectionType === 'M') ? 'month' : '(error)'
          const nextPeriodFilename = DataStore.calendarNoteByDate(new moment().add(1, durationType).toDate(), durationType)?.filename
          logDebug('showDashboard', nextPeriodFilename)
          if (nextPeriodFilename) {
            const PCButton1 = makePluginCommandButton(
              `<i class="fa-regular fa-circle-arrow-right ${section.sectionTitleClass}"></i>`,
              'jgclark.Dashboard',
              'addTask',
              nextPeriodFilename,
              `Add a new task to note for next ${durationType}`)
            const PCButton2 = makePluginCommandButton(
              `<i class="fa-regular fa-square-arrow-right ${section.sectionTitleClass}"></i>`,
              'jgclark.Dashboard',
              'addChecklist',
              nextPeriodFilename,
              `Add a new checklist to note for next ${durationType}`)
            sectionDescriptionToUse = sectionDescriptionToUse.replace('{addItemsNextPeriod}', `${PCButton1}&nbsp;${PCButton2}`)
          }
        }

        if (section.description.includes('{scheduleAllYesterdayToday}')) {
          const PCButton = makePluginCommandButton(
            'All\u00A0<i class="fa-solid fa-right-long"></i>\u00A0Today',
            'jgclark.Dashboard',
            'schedule yesterday to today',
            'true', // = refresh afterwards
            'Move or schedule all open items from yesteday to today')
          sectionDescriptionToUse = sectionDescriptionToUse.replace('{scheduleAllYesterdayToday}', PCButton)
        }
        if (section.description.includes('{scheduleAllOverdueToday}')) {
          const PCButton = makePluginCommandButton(
            'All\u00A0<i class="fa-solid fa-right-long"></i>\u00A0Today',
            'jgclark.Dashboard',
            'schedule overdue to today',
            'true', // = refresh afterwards
            'Move or schedule all overdue items to today')
          sectionDescriptionToUse = sectionDescriptionToUse.replace('{scheduleAllOverdueToday}', PCButton)
        }
        if (section.description.includes('{scheduleAllTodayTomorrow}')) {
          const PCButton = makePluginCommandButton(
            'All\u00A0Today\u00A0<i class="fa-solid fa-right-long"></i>\u00A0Tomorrow',
            'jgclark.Dashboard',
            'schedule today to tomorrow',
            'true', // = refresh afterwards
            'Move or schedule all remaining open items to tomorrow')
          sectionDescriptionToUse = sectionDescriptionToUse.replace('{scheduleAllTodayTomorrow}', PCButton)
        }

        if (section.description.includes('{startReviews}')) {
          const PCButton = makePluginCommandButton(
            '<i class="fa-regular fa-play"></i>\u00A0Start\u00A0Reviews',
            'jgclark.Reviews',
            'start reviews',
            '',
            'Start reviewing your project notes')
          sectionDescriptionToUse = sectionDescriptionToUse.replace('{startReviews}', PCButton)
        }

        outputArray.push(`        <div class="sectionDescription">${sectionDescriptionToUse}`)
      }
      // Close sectionInfo
      outputArray.push(`      </div>\n    </div>\n`)

      // Start outer col 2, which is an inner grid
      outputArray.push(`    <!--- Section ${String(sectionNumber)}: ${section.name} Items Grid --->`)
      outputArray.push(`    <div class="sectionItemsGrid" id="${String(section.ID)}-Section">`)
      // outputArray.push(`     <table style="table-layout: auto; word-wrap: break-word;" id="${section.ID}-Section">`)

      let filteredOut = 0
      const filteredItems: Array<SectionItem> = []
      // If we want to, then filter some out in this section, and append an item to indicate this
      // The new 'working-on' indicator >> has priority 4, with no priority indicator as 0.
      if (filterPriorityItems) {
        let maxPriority = 0
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
            ID: `${section.ID}-Filter`,
            content: `There are also ${filteredOut} lower-priority items currently hidden`,
            rawContent: 'Filtered out',
            filename: '',
            type: 'filterIndicator',
          })
        }
      }


      for (const item of items) {
        const isItemFromCalendarNote = isValidCalendarNoteFilename(item.filename)
        const encodedFilename = encodeRFC3986URIComponent(item.filename)
        const encodedContent = encodeRFC3986URIComponent(item.content)
        // outputArray.push(`       <tr class="no-borders" id="${item.ID}">`)
        outputArray.push(`      <div class="sectionItemRow"  id="${item.ID}" data-section-type="${section.sectionType}" data-encoded-filename="${encodedFilename}" data-encoded-content="${encodedContent}">`)

        // get note title (a long-winded way because we don't have TNote, but do have note's filename)
        const itemNoteTitle = displayTitle(DataStore.projectNoteByFilename(item.filename) ?? DataStore.calendarNoteByDateString(item.filename.split('.')[0]))

        // Decide whether to reschedule or move the item: if it's a project note it must be rescheduled.
        const reschedOrMove = (!isItemFromCalendarNote) ? "resched"
          : config.rescheduleNotMove ? "resched" : "move"
        const thisNoteType = (isItemFromCalendarNote) ? "Calendar" : "Note"

        // Do main work for the item
        switch (item.type) {
          case 'open': { // open todo type
            // logDebug('showDashboard', `- adding open task: {${item.content}} / filename:${itemNoteTitle}`)
            // do inner grid icon col (col1)
            outputArray.push(`        <div class="sectionItemTodo itemIcon todo"><i id="${item.ID}I" class="todo fa-regular fa-circle"></i></div>`)

            // do inner grid details col (col 2): whole note link is clickable.
            // If context is wanted, add linked note title.
            let paraContent = ''
            if (config.includeTaskContext) {
              if ([dailyNoteTitle, yesterdayNoteTitle, weeklyNoteTitle, monthlyNoteTitle, quarterlyNoteTitle].includes(itemNoteTitle)) {
                paraContent = makeParaContentToLookLikeNPDisplayInHTML(item, itemNoteTitle, 'all', 140)
              } else {
                paraContent = makeParaContentToLookLikeNPDisplayInHTML(item, itemNoteTitle, 'append', 140)
              }
            } else {
              paraContent = makeParaContentToLookLikeNPDisplayInHTML(item, '', 'all', 140)
            }
            let itemDetails = `        <div class="sectionItemContent sectionItem">\n`
            itemDetails += `          <a class="content">${paraContent}</a>\n`
            itemDetails += `          <a class="dialogTrigger" onclick="showItemControlDialog({OS: '${NotePlan.environment.platform}', itemID:'${item.ID}', sectionType:'${section.sectionType}', reschedOrMove:'${reschedOrMove}', itemType:'task', noteType:'${thisNoteType}'})"><i class="fa-light fa-edit pad-left"></i></a>\n`
            itemDetails += `        </div>\n      </div>\n`
            outputArray.push(itemDetails)
            totalOpenItems++
            break
          }
          case 'checklist': { // open checklist type
            // logDebug('showDashboard', `- adding checklist: {${item.content}} / filename:${itemNoteTitle}`)
            // ddo inner grid icon col (col1)
            outputArray.push(`        <div class="sectionItemChecklist itemIcon todo"><i id="${item.ID}I" class="todo fa-regular fa-square"></i></div>`)

            // do inner grid details col (col 2): whole note link is clickable.
            // If context is wanted, add linked note title.
            let paraContent = ''
            // whole note link is clickable if context is wanted, and linked note title
            if (config.includeTaskContext && ![dailyNoteTitle, yesterdayNoteTitle, weeklyNoteTitle, monthlyNoteTitle, quarterlyNoteTitle].includes(itemNoteTitle)) {
              paraContent = makeParaContentToLookLikeNPDisplayInHTML(item, itemNoteTitle, 'append', 140)
            } else {
              paraContent = makeParaContentToLookLikeNPDisplayInHTML(item, itemNoteTitle, 'all', 140)
            }

            let itemDetails = `        <div class="sectionItemContent sectionItem">\n`
            itemDetails += `          <a class="content">${paraContent}</a>`
            itemDetails += `          <a class="dialogTrigger" onclick="showItemControlDialog({OS: '${NotePlan.environment.platform}', itemID:'${item.ID}', sectionType:'${section.sectionType}', reschedOrMove:'${reschedOrMove}', itemType:'checklist', noteType:'${thisNoteType}'})"><i class="fa-light fa-edit pad-left"></i></a>\n`
            itemDetails += `        </div>\n      </div>`
            outputArray.push(itemDetails)
            totalOpenItems++
            break
          }
          case 'congrats': {
            // do icon
            outputArray.push(`         <div class="itemIcon checked"><i id="${item.ID}I" class="fa-regular fa-circle-check"></i></div>`)
            // do item details
            let itemDetails = `          <div class="sectionItemContent sectionItem">\n`
            itemDetails += `            <a class="content"><i>${item.content}</i></a>`
            itemDetails += `        </div>\n      </div>`
            outputArray.push(itemDetails)
            break
          }
          // Project section items
          case 'review': {
            if (itemNoteTitle) {
              // do icon col (was col3)
              outputArray.push(`         <div id="${item.ID}I" class="reviewProject itemIcon todo"><i class="fa-regular fa-circle-play"></i></div>`) // earlier had "fa-calendar-check"

              // do item details col (was col4): review note link as internal calls
              const folderNamePart = config.includeFolderName && getFolderFromFilename(item.filename) !== '' ? `${getFolderFromFilename(item.filename)} / ` : ''
              const paraContent = `${folderNamePart}${makeNoteTitleWithOpenActionFromFilename(item, itemNoteTitle)}`

              let itemDetails = `        <div class="sectionItemContent sectionItem" data-encoded-filename="${encodedFilename}">\n`
              itemDetails += `          <a class="content">${paraContent}</a>`
              itemDetails += `          <a class="dialogTrigger" onclick="showProjectControlDialog({OS: '${NotePlan.environment.platform}', itemID:'${item.ID}', encodedTitle:'${encodeRFC3986URIComponent(itemNoteTitle)}'})"><i class="fa-light fa-edit pad-left"></i></a>\n`
              itemDetails += `        </div>\n      </div>`
              outputArray.push(itemDetails)
              totalOpenItems++
            } else {
              logError('showDashboard', `Cannot find note for '${item.content}'`)
            }
            break
          }
          case 'filterIndicator': {
            // do icon
            outputArray.push(`          <div class="todo itemIcon"><i class="fa-light fa-plus"></i></div>`)
            // do item details
            outputArray.push(`          <div class="sectionItem commentLine">${item.content}</div>\n      </div>`)
            break
          }
        }
      }

      outputArray.push(`    </div>`) // end of item
      outputArray.push(`  </div>\n`) // end of section
      sectionNumber++
    }
    outputArray.push(`  </div>`)

    // write header lines before first table
    // const headerSummary = `<div class="totalCounts"><span id="totalOpenCount">${String(totalOpenItems)}</span> open items</b>; <span id="totalDoneCount">${String(
    const headerSummary = `<div class="totalCounts"><span id="totalDoneCount">${String(
      totalDoneItems,
    )}</span> items closed</div>`

    // Write time and refresh info
    const refreshXCallbackButton = makePluginCommandButton(
      `<i class="fa-regular fa-arrow-rotate-right"></i> Refresh`,
      'jgclark.Dashboard',
      'show dashboard',
      'refresh',
      '')
    // const refresh = `<div class="lastUpdated">Last updated ${nowLocaleShortTime()} ${refreshXCallbackButton}</div>`
    const refresh = `<div class="lastUpdated">Last updated: <span id="timer"></span> ${refreshXCallbackButton}</div>`

    // Add filter checkbox
    const filterCheckbox = `<div><input type="checkbox" class="apple-switch" onchange='handleCheckboxClick(this);' name="filterPriorityItems" ${filterPriorityItems ? 'checked' : 'unchecked'
      }><label for="filterPriorityItems">Filter out lower-priority items?</label></input></div>`

    const header = `<div class="header">${refresh}\n${headerSummary}\n${filterCheckbox}</div>`
    outputArray.unshift(header)

    // Task item control dialog
    // Note: in the future the draft spec for CSS Anchor Positioning could be helpful for positioning this dialog relative to other things
    const taskDialogHTML = `
  <!----------- Single dialog that can be shown for any task-based item ----------->
  <!-- TEST: removal of this
  <script type="text/javascript">
    function updateContent() {
    console.log("Called updateContent")
    const dialogInputElem = document.getElementById("dialogItemContent")
    const updatedContent = dialogInputElem.value
    console.log("-> "+ updatedContent)
  }
  </script>
  -->

  <dialog id="itemControlDialog" class="itemControlDialog" aria-labelledby="Actions Dialog"
    aria-describedby="Actions that can be taken on items">
    <div class="dialogTitle">From <i class="pad-left pad-right fa-regular fa-file-lines"></i><b><span id="dialogItemNote">?</span></b></div>
    <div class="dialogBody">
      <div class="buttonGrid" id="itemDialogButtons">
        <div>For</div>
        <div class="dialogDescription">
          <input type="text" id="dialogItemContent" class="fullTextInput" />
          <button class="updateItemContentButton" data-control-str="update">Update</button>
        </div>
        <div>Move to</div>
        <div id="itemControlDialogMoveControls">
          <button class="PCButton" data-control-str="t">today</button>
          <button class="PCButton" data-control-str="+1d">+1d</button>
          <button class="PCButton" data-control-str="+1b">+1b</button>
          <button class="PCButton" data-control-str="+2d">+2d</button>
          <button class="PCButton" data-control-str="+0w">this week</button>
          <button class="PCButton" data-control-str="+1w">+1w</button>
          <button class="PCButton" data-control-str="+2w">+2w</button>
          <button class="PCButton" data-control-str="+0m">this month</button>
          <button class="PCButton" data-control-str="+0q">this quarter</button>
        </div>
        <div>Other controls</div>
        <div id="itemControlDialogOtherControls">
          <button class="PCButton" data-control-str="cancel">Cancel</button><!-- mainly for iOS -->
          <button class="PCButton" data-control-str="movetonote">Move to <i class="fa-regular fa-file-lines"></i></button>
          <button class="PCButton" data-control-str="priup"><i class="fa-regular fa-arrow-up"></i> Priority</button>
          <button class="PCButton" data-control-str="pridown"><i class="fa-regular fa-arrow-down"></i> Priority</button>
          <button class="PCButton" data-control-str="tog">Toggle Type</button>
          <button class="PCButton" data-control-str="ct">Complete Then</button>
          <button class="PCButton" data-control-str="unsched">Unschedule</button>
        </div>
<!--
        <div>Dialog</div>
        <div><span id="winDebugDetails"></span></div>
-->
        <div></div>
        <div><form><button id="closeButton" class="mainButton">Close</button></form></div>
      </div>
    </div>
  </dialog>
`
    outputArray.push(taskDialogHTML)

    // Project control dialog
    // Note: in the future the draft spec for CSS Anchor Positioning could be helpful for positioning this dialog relative to other things
    const projectControlDialogHTML = `
  <!----------- Single dialog that can be shown for any task-based item ----------->
  <dialog id="projectControlDialog" class="projectControlDialog" aria-labelledby="Actions Dialog"
    aria-describedby="Actions that can be taken on projects">
    <div class="dialogTitle">For <i class="pad-left pad-right fa-regular fa-file-lines"></i><b><span id="dialogProjectNote">?</span></b></div>
    <div class="dialogBody">
      <div class="buttonGrid" id="projectDialogButtons">
        <div>Project Reviews</div>
        <div id="projectControlDialogProjectControls">
          <button data-control-str="finish"><i class="fa-regular fa-calendar-check"></i> Finish Review</button>
          <button data-control-str="nr+1w"><i class="fa-solid fa-forward"></i> Skip 1w</button>
          <button data-control-str="nr+2w"><i class="fa-solid fa-forward"></i> Skip 2w</button>
          <button data-control-str="nr+1m"><i class="fa-solid fa-forward"></i> Skip 1m</button>
          <button data-control-str="nr+1q"><i class="fa-solid fa-forward"></i> Skip 1q</button>
        </div>
        <div></div>
        <div><form><button id="closeButton" class="mainButton">Close</button></form></div>
        </div>
      </div>
    </div>
  </dialog>
`
    outputArray.push(projectControlDialogHTML)

    //------------------------------------------------
    // Show in an HTML window, and save a copy as file
    // Set filename for HTML copy if _logLevel set to DEBUG
    const windowTitle = `Dashboard (${totalOpenItems} items)`
    const filenameHTMLCopy = config._logLevel === 'DEBUG' || config._logLevel === 'INFO' ? '../../jgclark.Dashboard/dashboard-grid.html' : ''

    const winOptions = {
      windowTitle: windowTitle,
      customId: windowCustomId,
      headerTags: `${resourceLinksInHeader}\n<meta name="startTime" content="${String(Date.now())}">`,
      generalCSSIn: generateCSSFromTheme(config.dashboardTheme), // either use dashboard-specific theme name, or get general CSS set automatically from current theme
      specificCSS: '', // set in separate CSS file referenced in header
      makeModal: false,
      bodyOptions: 'onload="showTimeAgo()"',
      shouldFocus: shouldFocus, // shouuld focus window?
      preBodyScript: '', // no extra pre-JS
      postBodyScript: `${`<script type="text/javascript" src="../np.Shared/encodeDecode.js"></script>
` +
        `<script type="text/javascript" src="./showTimeAgo.js"></script>` + 
        `<script type="text/javascript" src="./dashboardEvents.js"></script>
      `}${commsBridge}`,
      // + shortcutsScript
      // + resizeListenerScript
      // + unloadListenerScript
      savedFilename: filenameHTMLCopy,
      reuseUsersWindowRect: true, // do try to use user's position for this window, otherwise use following defaults ...
      width: 1000, // = default width of window (px)
      height: 500, // = default height of window (px)
      x: 409, // default, normally overriden from last position
      y: 0, // default, normally overriden from last position
    }
    await showHTMLV2(outputArray.join('\n'), winOptions)
    logDebug(`showDashboard`, `written to HTML window with shouldFocus ${String(shouldFocus)}`)

    //--------------------------------------------------------------
    // Finally, add auto-update trigger to open note if:
    // - config.autoAddTrigger says so,
    // - and if shouldFocus is true, indicating this was called by user action, not a trigger'd refresh
    // - and not in demoMode
    if (config.autoAddTrigger && shouldFocus && !demoMode) {
      const res = addTrigger(Editor, 'onEditorWillSave', 'jgclark.Dashboard', 'decideWhetherToUpdateDashboard')
      if (!res) {
        logWarn(pluginJson, 'Dashboard trigger could not be added for some reason.')
        const res = await showMessage(`Warning: Couldn't add auto-update trigger for the Dashboard for some reason.`)
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
  try {
    logDebug('addTask', `- adding to ${calNoteFilename}`)
    // const calNoteDateStr = getDateStringFromCalendarFilename(calNoteFilename, false)
    const calNoteDateStr = getDateStringFromCalendarFilename(calNoteFilename, true)
    logDebug('addTask', `= date ${calNoteDateStr}`)
    if (!calNoteDateStr) {
      throw new Error(`calNoteDateStr isn't defined`)
    }
    // V1: simple prepend
    // await prependTodoToCalendarNote('task', calNoteDateStr)
    // V2: more complex function
    const config = await getSettings()
    const textToAdd = await CommandBar.showInput('Type the task to add', `Add task '%@'`)
    await addTaskToNoteHeading(calNoteDateStr, config.newTaskSectionHeading, textToAdd)
    // trigger window refresh
    await showDashboard('refresh')
  }
  catch (err) {
    logError('addTask', `${err.message} for ${calNoteFilename}`)
  }
}

/**
 * Prepend an open checklist to 'calNoteFilename' calendar note, using text we prompt the user for
 * @param {string} calNoteFilename to prepend the task to
 */
export async function addChecklist(calNoteFilename: string): Promise<void> {
  try {
    logDebug('addTask', `- adding to ${calNoteFilename}`)
    // const calNoteDateStr = getDateStringFromCalendarFilename(calNoteFilename)
    const calNoteDateStr = getDateStringFromCalendarFilename(calNoteFilename, true)
    logDebug('addTask', `= date ${calNoteDateStr}`)
    if (!calNoteDateStr) {
      throw new Error(`calNoteDateStr isn't defined`)
    }
    // V1: simple prepend
    // await prependTodoToCalendarNote('checklist', calNoteDateStr)
    // V2: more complex function
    const config = await getSettings()
    const textRes = await CommandBar.showInput('Type the checklist to add', `Add checklist '%@'`)
    const textToAdd = '+ ' + textRes // need to fake a checklist type
    await addTextToNoteHeading(calNoteDateStr, config.newTaskSectionHeading, textToAdd)

    // trigger window refresh
    await showDashboard('refresh')
  }
  catch (err) {
    logError('addChecklist', `${err.message} for ${calNoteFilename}`)
  }
}
