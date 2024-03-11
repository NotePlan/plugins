// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main functions
// Last updated 7.1.2024 for v0.8.1 by @jgclark
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
import {
  getDateStringFromCalendarFilename,
  getTodaysDateUnhyphenated,
  isValidCalendarNoteFilename
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { createPrettyOpenNoteLink, createPrettyRunPluginLink, createRunPluginCallbackUrl, displayTitle, returnNoteLink } from '@helpers/general'
import { showHTMLV2 } from '@helpers/HTMLView'
import { getNoteType } from '@helpers/note'
import { nowLocaleShortTime } from '@helpers/NPdateTime'
import { unsetPreference } from '@helpers/NPdev'
import { addTrigger } from '@helpers/NPFrontMatter'
import { getTaskPriority } from '@helpers/paragraph'
import { prependTodoToCalendarNote } from '@helpers/NPParagraph'
import { checkForRequiredSharedFiles } from '@helpers/NPRequiredFiles'
import { generateCSSFromTheme } from '@helpers/NPThemeToCSS'
import { isHTMLWindowOpen } from '@helpers/NPWindows'
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
<link href="dashboardHoverControls.css" rel="stylesheet">

<!-- Load in fontawesome assets from np.Shared (licensed for NotePlan) -->
<link href="../np.Shared/fontawesome.css" rel="stylesheet">
<link href="../np.Shared/regular.min.flat4NP.css" rel="stylesheet">
<link href="../np.Shared/solid.min.flat4NP.css" rel="stylesheet">
<link href="../np.Shared/light.min.flat4NP.css" rel="stylesheet">
`

/**
 * Script to add Cmd+R shortcut to refresh dashboard. (Meta=Cmd here.)
 */
const shortcutsScript = `
<!-- shortcuts script -->
<script type="text/javascript" src="./shortcut.js"></script>
<script>
shortcut.add("meta+r", function() {
  console.log("Shortcut cmd+s triggered");
  sendMessageToPlugin('refresh', { itemID: '', type: '', filename: '', rawContent: '' })
});
</script>
`

/**
 * Script to do fully-featured encoding/decoding for strings passed in URIs
 */
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
<script type="text/javascript" src="./HTMLWinCommsSwitchboard.js"></script>
<script type="text/javascript" src="../np.Shared/pluginToHTMLCommsBridge.js"></script>
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
 * The HTML item IDs are defined as:
 * - x-y = section x item y, used in <tr> tags and onClick references
 * - <filename> = encoded filename of task, used in both 'col 3' <td> tags
 * - x-yI = icon for section x item y, used in 'col 3' <i> tag
 *
 * @author @jgclark
 * @param {string?} callType (default: 'manual', 'trigger', 'refresh')
 * @param {boolean?} demoMode? if true, show the demo data, otherwise show the real data
 */
export async function showDashboard(callType: string = 'manual', demoMode: boolean = false): Promise<void> {
  try {
    // Check to stop it running on iOS
    if (NotePlan.environment.platform === 'iOS') {
      logWarn(pluginJson, `Sorry: Dashboard won't run on the small screen of iPhones.`)
      await showMessage(`Sorry: Dashboard won't run on the small screen of iPhones`)
      return
    }

    logDebug(pluginJson, `showDashboard() started ${demoMode ? '*and will use demo data*' : ''}`)

    const shouldFocus = (callType === 'manual')
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
    const startReviewXCallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', 'next project review', '')

    //--------------------------------------------------------------
    // Create nice HTML display for this data

    // Main table loop
    let totalOpenItems = 0
    let totalDoneItems = 0
    outputArray.push(`\n<table id="mainTable" style="table-layout: auto; word-wrap: break-word;">`)
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
          logDebug('showDashboard', `Section ${String(sectionNumber)} (${section.name}) is empty so will skip it`)
          sectionNumber++
          continue // to next loop item
        }
      }

      // Prepare col 1 (section icon + title + description)
      // Now prepend a sectionNCount ID and populate it. This needs a span with an ID so that it can be updated later.
      const sectionCountID = `section${String(section.ID)}Count`
      const sectionCountSpan = `<span id="${sectionCountID}">${String(items.length)}</span>`
      const sectionNameWithPossibleLink = section.filename ? addNoteOpenLinkToString(section, section.name) : section.name
      outputArray.push(
        ` <tr>\n  <td style="min-width:8rem; max-width: 10rem;"><p class="${section.sectionTitleClass} sectionName"><i class="${section.FAIconClass} pad-right"></i>${sectionNameWithPossibleLink}</p>`,
      )

      if (items.length > 0) {
        const sectionDescriptionWithCountSpan = section.description.replace('{count}', sectionCountSpan)
        outputArray.push(`   <p class="sectionDescription">${sectionDescriptionWithCountSpan}`)

        if (['DT', 'W', 'M', 'Q', 'Y'].includes(section.sectionType)) {
          // Add 'add task' and 'add checklist' icons
          // TODO: add info tooltip
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
            ID: section.ID + '-Filter',
            content: `There are also ${filteredOut} lower-priority items currently hidden.`,
            rawContent: 'Filtered out',
            filename: '',
            type: 'filterIndicator',
          })
        }
      }

      for (const item of items) {
        const isItemFromCalendarNote = isValidCalendarNoteFilename(item.filename)
        let encodedFilename = encodeRFC3986URIComponent(item.filename)
        let encodedContent = encodeRFC3986URIComponent(item.content)
        let reviewNoteCount = 0 // count of note-review items
        outputArray.push(`       <tr class="no-borders" id="${item.ID}">`)

        // get note title (a long-winded way because we don't have TNote, but do have note's filename)
        const itemNoteTitle = displayTitle(DataStore.projectNoteByFilename(item.filename) ?? DataStore.calendarNoteByDateString(item.filename.split('.')[0]))

        // Work out the extra controls that are relevant for this task, and set up as tooltips
        const possibleControlTypes = [
          { displayString: '→today', controlStr: 't', sectionTypes: ['DY', 'W', 'M', 'Q', 'OVERDUE'] }, // special controlStr to indicate change to '>today'
          { displayString: '+1d', controlStr: '+1d', sectionTypes: ['DT', 'DY', 'W', 'M', 'OVERDUE'] },
          { displayString: '+1b', controlStr: '+1b', sectionTypes: ['DT', 'DY', 'W', 'M', 'OVERDUE'] },
          { displayString: '→w', controlStr: '+0w', sectionTypes: ['DT', 'DY', 'M', 'OVERDUE'] },
          { displayString: '+1w', controlStr: '+1w', sectionTypes: ['DT', 'DY', 'W', 'OVERDUE'] },
          { displayString: '→m', controlStr: '+0m', sectionTypes: ['DT', 'DY', 'W', 'Q', 'OVERDUE'] },
          { displayString: '+1m', controlStr: '+1m', sectionTypes: ['M', 'OVERDUE'] },
          { displayString: '→q', controlStr: '+0q', sectionTypes: ['M'] },
          { displayString: 'pri', controlStr: 'pri', sectionTypes: ['DT', 'DY', 'W', 'M', 'Q', 'OVERDUE', 'TAG'] },
          { displayString: '◯/☐', controlStr: 'tog', sectionTypes: ['OVERDUE', 'DT', 'DY', 'W', 'M', 'Q', 'TAG'] },
          { displayString: '✓then', controlStr: 'ct', sectionTypes: ['OVERDUE', 'TAG'] },
          // Just for Project lines
          { displayString: '✓review', controlStr: 'reviewed', sectionTypes: ['PROJ'] },
          { displayString: 'skip +1w', controlStr: 'skip+1w', sectionTypes: ['PROJ'] },
          { displayString: 'skip +2w', controlStr: 'skip+2w', sectionTypes: ['PROJ'] },
          { displayString: 'skip +1m', controlStr: 'skip+1m', sectionTypes: ['PROJ'] },
          { displayString: 'skip +1q', controlStr: 'skip+1q', sectionTypes: ['PROJ'] },
        ]
        if (!isItemFromCalendarNote) {
          // Only relevant for referenced items
          possibleControlTypes.push({ displayString: '≯', controlStr: 'unsched', sectionTypes: ['DT', 'DY', 'W', 'M', 'Q', 'OVERDUE', 'TAG'] })
        }

        const controlTypesForThisSection = possibleControlTypes.filter((t) => t.sectionTypes.includes(section.sectionType))
        let tooltipContent = ''
        if (controlTypesForThisSection.length > 0) {
          tooltipContent = `\n           <span class="hoverExtraControls" data-date-string="${encodedFilename}">` // now always pass filename of item, even if it is same as section.filename

          // only want control types relevant for this section
          for (const ct of controlTypesForThisSection) {
            const buttonType = (ct.controlStr === 'tog')
              ? "toggleTypeButton"
              : (ct.controlStr === 'ct')
                ? "completeThenButton"
                : (ct.controlStr === 'pri')
                  ? "priorityButton"
                  : (ct.controlStr === 'unsched')
                    ? "unscheduleButton"
                    : (ct.controlStr === 'reviewed')
                      ? "reviewFinishedButton"
                      : (ct.controlStr.startsWith('nr'))
                        ? "nextReviewButton"
                        : (isItemFromCalendarNote && !config.rescheduleNotMove)
                          ? "moveButton"
                          : "changeDateButton"
            tooltipContent += `<button class="${buttonType} hoverControlButton" data-control-str="${ct.controlStr}">${ct.displayString}</button>`
          }
          tooltipContent += '</span>'
        }

        // Do main work for the item
        switch (item.type) {
          case 'open': { // open todo type
            // logDebug('showDashboard', `- adding open task: {${item.content}} / filename:${itemNoteTitle}`)
            // do icon col (was col3)
            outputArray.push(
              `         <td id="${encodedFilename}" class="sectionItemTodo sectionItem no-borders" data-encoded-content="${encodedContent}"><i id="${item.ID}I" class="todo fa-regular fa-circle"></i></td>`,
            )

            // do col 4: whole note link is clickable.
            // If context is wanted, and linked note title
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
            const cell4 = `         <td class="sectionItemContent sectionItem" data-encoded-filename="${encodedFilename}" data-encoded-content="${encodedContent}">\n          <div class="avoidColumnBreakHere tooltip"><a class="content">${paraContent}</a>${tooltipContent}\n          </div>\n         </td>\n       </tr>`
            outputArray.push(cell4)
            totalOpenItems++
            break
          }
          case 'checklist': { // open checklist type
            // logDebug('showDashboard', `- adding checklist: {${item.content}} / filename:${itemNoteTitle}`)
            // do icon col (was col3)
            outputArray.push(
              `         <td id="${encodedFilename}" class="sectionItemChecklist sectionItem no-borders" data-encoded-content="${encodedContent}"><i id="${item.ID}I" class="todo fa-regular fa-square"></i></td>`,
            )

            // do item details col (was col4):
            let paraContent = ''
            // whole note link is clickable if context is wanted, and linked note title
            if (config.includeTaskContext && ![dailyNoteTitle, yesterdayNoteTitle, weeklyNoteTitle, monthlyNoteTitle, quarterlyNoteTitle].includes(itemNoteTitle)) {
              paraContent = makeParaContentToLookLikeNPDisplayInHTML(item, itemNoteTitle, 'append', 140)
            } else {
              paraContent = makeParaContentToLookLikeNPDisplayInHTML(item, itemNoteTitle, 'all', 140)
            }

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
          // Project section items
          case 'review': {
            if (itemNoteTitle) {
              // do icon col (was col3)
              outputArray.push(
                `         <td id="${item.ID}I" class="review sectionItem no-borders"><i class="fa-solid fa-calendar-check"></i></td>`,
              )

              // do item details col (was col4): review note link as internal calls
              const folderNamePart = config.includeFolderName && getFolderFromFilename(item.filename) !== '' ? getFolderFromFilename(item.filename) + ' / ' : ''
              // Before adding buttons via tooltips
              // let cell4 = `         <td id="${item.ID}" class="sectionItem">${folderNamePart}<a class="noteTitle" data-encoded-filename="${encodedFilename}">${itemNoteTitle}</a></td>\n       </tr>`
              let cell4 = `         <td id="${item.ID}" data-encoded-filename="${encodedFilename}" class="sectionItem">\n          <div class="avoidColumnBreakHere tooltip">${folderNamePart}${makeNoteTitleWithOpenActionFromFilename(item, itemNoteTitle)}${tooltipContent}\n          </div>\n         </td>\n       </tr>`
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
            let cell4 = `          <td class="sectionItem commentLine">${item.content}</td>\n       </tr>`
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
    const refreshXCallbackURL = createRunPluginCallbackUrl('jgclark.Dashboard', 'show dashboard', 'refresh')
    const refreshXCallbackButton = `<span class="fake-button"><a class="button" href="${refreshXCallbackURL}"><i class="fa-solid fa-arrow-rotate-right"></i>&nbsp;Refresh</a></span>`
    // Note: can't use a real HTML button, as it needs to live inside a form to activate. It will work in Safari, but not in NP. Grrr. So will use one of my 'fake buttons' instead.

    // Add filter checkbox
    const filterCheckbox = `<span style="float: right;"><input type="checkbox" class="apple-switch" onchange='handleCheckboxClick(this);' name="filterPriorityItems" ${filterPriorityItems ? 'checked' : 'unchecked'
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
      generalCSSIn: generateCSSFromTheme(config.dashboardTheme), // either use dashboard-specific theme name, or get general CSS set automatically from current theme
      specificCSS: '', // set in separate CSS file referenced in header
      makeModal: false,
      shouldFocus: shouldFocus, // shouuld focus window?
      preBodyScript: '', // no extra pre-JS
      postBodyScript: encodeDecodeScript +
        commsBridge +
        shortcutsScript +
        `<script type="text/javascript" src="./dashboardEvents.js"></script>
      `,
      // addIconEventListenersScript +
      // addContentEventListenersScript +
      // addButtonEventListenersScript +
      // addReviewEventListenersScript +
      // + clickHandlersScript
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
  try {
    logDebug('addTask', `- adding to ${calNoteFilename}`)
    const calNoteDateStr = getDateStringFromCalendarFilename(calNoteFilename)
    logDebug('addTask', `= date ${calNoteDateStr}`)
    if (!calNoteDateStr) {
      throw new Error(`calNoteDateStr isn't defined`)
    }
    await prependTodoToCalendarNote('task', calNoteDateStr)
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
    const calNoteDateStr = getDateStringFromCalendarFilename(calNoteFilename)
    logDebug('addTask', `= date ${calNoteDateStr}`)
    if (!calNoteDateStr) {
      throw new Error(`calNoteDateStr isn't defined`)
    }
    logInfo('addChecklist', `- adding checklist to ${calNoteDateStr} from ${calNoteFilename}`) // TODO: in time turn me down to Debug
    await prependTodoToCalendarNote('checklist', calNoteDateStr)
    // trigger window refresh
    await showDashboard('refresh')
  }
  catch (err) {
    logError('addChecklist', `${err.message} for ${calNoteFilename}`)
  }
}

/**
 * Special command to resize dashboard window size to default
 * Note: remove when Eduard finds the bug that means I needed to add this
 */
export async function resetDashboardWinSize(): Promise<void> {
  unsetPreference('WinRect_Dashboard')
  closeWindowFromCustomId(pluginJson['plugin.id'])
  await showDashboard('refresh', false)
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
