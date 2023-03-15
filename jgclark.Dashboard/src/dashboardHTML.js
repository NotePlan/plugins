// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main functions
// Last updated 10.3.2023 for v0.3.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import moment from 'moment/min/moment-with-locales'
import { getDataForDashboard } from './dataGeneration'
import { getDemoDashboardData } from './demoDashboard'
import {
  addNoteOpenLinkToString, checkForRequiredSharedFiles, getSettings, makeNoteTitleWithOpenAction, makeParaContentToLookLikeNPDisplayInHTML,
  type SectionDetails, type SectionItem
} from './dashboardHelpers'
import { toLocaleTime, getDateStringFromCalendarFilename } from '@helpers/dateTime'
import { clo, logDebug, logError, logInfo } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { createPrettyOpenNoteLink, createPrettyRunPluginLink, createRunPluginCallbackUrl, displayTitle, returnNoteLink } from '@helpers/general'
import { showHTML } from '@helpers/HTMLView'
import { getNoteType } from '@helpers/note'
import { decodeRFC3986URIComponent, encodeRFC3986URIComponent } from '@helpers/stringTransforms'
import { focusHTMLWindowIfAvailable } from '@helpers/NPWindows'
// import { isThisMinute } from 'date-fns'

//-----------------------------------------------------------------
// HTML resources

const windowCustomID = 'Dashboard'

// Note: this "../np.Shared" path works to the flattened np.Shared structure, but it does *not* work when running the locally-written copy of the HTML output file.
export const faLinksInHeader = `
<!-- Load in fontawesome assets from np.Shared (licensed for NotePlan) -->
<link href="../np.Shared/fontawesome.css" rel="stylesheet">
<link href="../np.Shared/regular.min.flat4NP.css" rel="stylesheet">
<link href="../np.Shared/solid.min.flat4NP.css" rel="stylesheet">
<link href="../np.Shared/light.min.flat4NP.css" rel="stylesheet">
`

export const dashboardCSS: string = [
  '\n/* CSS specific to showDashboard() from jgclark.Dashboard plugin */\n',
  'table { font-size: 0.9rem;', // make text a little smaller
  '  border-collapse: collapse;', // always!
  '  border: 0px none;',
  '  empty-cells: show; }',
  // 'i.fa-solid, i.fa-light, i.fa-regular { padding-right: 6px; }', // add space after
  'th { text-align: left; vertical-align: bottom; padding: 8px; border: 0px none; }', // no borders
  // 'tr.new-section-header { color: var(--h3-color); padding-top: 1.0rem; font-size: 1.0rem; font-weight: bold; background-color: var(--bg-main-color); border-top: 1px solid var(--tint-color); border-bottom: 1px solid var(--tint-color); }',
  'td { text-align: left; vertical-align: top; padding: 8px 4px; border: 0px none; }', // no borders
  // turn on top and bottom border (from theme CSS)
  'table tr { border-top: solid 1px var(--tint-color); border-bottom: solid 1px var(--tint-color); }', // line between rows, not columns
  '.no-borders { border-top: none 0px; border-bottom: none 0px; }', // turn off all borders
  '.sectionName { font-size: 1.0rem; font-weight: 700; }', // make noteTitles bold
  '.sectionIcon { font-size: 1.0rem; font-weight: 400; }',
  `.sectionItem { font-size: 0.9rem; font-weight: 500;
   padding: 2px 4px; border-bottom: 0px; }`, // reduce vertical spacing and line below
  // `td:first-child .sectionItem { padding-top: 8px 4px; }`, // not working
  '.scheduledDate { color: var(--tint-color); }', // for >dates
  'a, a:visited, a:active { color: inherit; text-decoration: none; cursor: pointer; }', // all links turn off text color and underlining by default
  'a:hover { text-decoration: underline; text-decoration-color: var(--tint-color); }', // show note links when mouse-over-ing them
  '.externalLink a, a:hover { text-decoration: underline; cursor: pointer; }', // turn on underlining
  `.event-link {
		font-weight: 500;
		border-color: var(--bg-alt-color);
		border-radius: 3px;
    border-width: 1px;
    border-style: solid;
		padding: 0px 3px;
	}`,
  '.noteTitle { color: var(--tint-color) !important; }', // add "font-weight: 700;" to make noteTitles bold
  // allow multi-column flow: set max columns and min width, and some other bits and pieces
  '.multi-cols { column-count: 3; column-width: 25rem; column-gap: 1rem; column-rule: 1px dotted var(--tint-color); }',
  // Class to fade out an item, from https://stackoverflow.com/a/20910008
  `.fadeOutAndHide { visibility: hidden; opacity: 0; transition: visibility 0s 2s, opacity 2s linear; }`,
  // `.strikeoutTask { text-decoration: line-through; text-decoration-color: var(--tint-color) }`,
  // Some headings specified from measuring the colour of NP sidebar elements
  '.sidebarDaily { font-size: 1.0rem; color: #d0703c; }',
  '.sidebarWeekly { font-size: 1.0rem; color: #be23b6; }',
  '.sidebarMonthly { font-size: 1.0rem; color: #f5528b; }',
  '.sidebarQuarterly { font-size: 1.0rem; color: #e08008; }',
  '.sidebarYearly { font-size: 1.0rem; color: #efba13; }',
  '#error { background-color: red; padding-left: 10px; }',
  // TODO: Think about proper HTML checkbox and styling
].join('\n\t')

const commsBridge = `
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
 * Show the dashboard HTML window, _but with some pre-configured demo data_.
 */
export async function showDemoDashboardHTML(): Promise<void> {
  await showDashboardHTML(true, true)
}

/**
 * Show the generated dashboard data using native HTML.
 * The HTML item IDs are defined as:
 * - x-y = section x item y, used in <tr> tags and onClick references
 * - x-yA = href link for section x item y, used in 'col 3' <td> tags
 * - x-yI = icon for section x item y, used in 'col 3' <td> tags
 * 
 * @author @jgclark
 * @param {boolean?} forceRefresh - if true, refresh the window even if the window is already open
 * @param {boolean?} showDemoData - if true, show the demo data, otherwise show the real data
 */
export async function showDashboardHTML(forceRefresh: boolean = false, demoMode: boolean = false): Promise<void> {
  try {

    // First try just focussing the existing dashboard window if it's open
    if (!forceRefresh && focusHTMLWindowIfAvailable(windowCustomID)) {
      return
    }

    const config = await getSettings()
    await checkForRequiredSharedFiles()
    let sections: Array<SectionDetails> = []
    let sectionItems: Array<SectionItem> = []

    if (demoMode) {
      [sections, sectionItems] = getDemoDashboardData()
    } else {
      [sections, sectionItems] = await getDataForDashboard()
    }

    logDebug('showDashboardHTML', `Starting with ${String(sections.length)} sections and ${String(sectionItems.length)} items`)

    const outputArray: Array<string> = []
    const dailyNoteTitle = displayTitle(DataStore.calendarNoteByDate(new Date(), 'day'))
    const weeklyNoteTitle = displayTitle(DataStore.calendarNoteByDate(new Date(), 'week'))
    const startReviewXCallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', 'next project review', '')

    // Create nice HTML display for this data.
    // Main table loop
    let totalOpenItems = 0
    let totalDoneItems = 0
    outputArray.push(`\n<table style="table-layout: auto; word-wrap: break-word;">`)
    let sectionNumber = 0
    for (const section of sections) {
      // Special case to handle count of done items
      if (section.name === 'Done') {
        logDebug('showDashboardHTML', `Section ${section.name} has ID ${String(section.ID)}`)
        totalDoneItems = section.ID
        continue // to next loop item
      }

      const items = sectionItems.filter((i) => i.ID.startsWith(String(section.ID)))
      // if (items.length > 0) {
      // Prepare col 1 (section icon)
      outputArray.push(` <tr>\n  <td><span class="${section.sectionTitleClass}"><i class="${section.FAIconClass}"></i></td>`)

      // Prepare col 2 (section title)
      // First prepend a sectionNCount ID and populate it
      const sectionCountID = `section${String(section.ID)}Count`
      const sectionCountPrefix = `<span id="${sectionCountID}">${String(items.length)}</span>`
      if (items.length > 0) {
        outputArray.push(`  <td><span class="sectionName ${section.sectionTitleClass}" style="max-width: 12rem;">${section.name}</span><br />${sectionCountPrefix} ${section.description}</td>`)
      } else {
        outputArray.push(`  <td><span class="sectionName ${section.sectionTitleClass}" style="max-width: 12rem;">${section.name}</span>`)
      }

      // Start col 3: table of items in this section
      outputArray.push(`  <td>`)
      outputArray.push(`  <div class="multi-cols">`)
      outputArray.push(`   <table style="table-layout: auto; word-wrap: break-word;">`)

      // If there are no items in section 1, then add a congratulatory message
      if (sectionNumber === 0 && items.length === 0) {
        items.push({ ID: '0-0C', type: 'congrats', content: `Nothing to do: take a break! <i class="fa-regular fa-face-party fa-face-sleeping"></i>`, rawContent: ``, filename: '' })
      }
        for (const item of items) {
          let encodedFilename = encodeRFC3986URIComponent(item.filename)
          let encodedRawContent = encodeRFC3986URIComponent(item.rawContent)
          let reviewNoteCount = 0 // count of note-review items
          outputArray.push(`    <tr class="no-borders" id="${item.ID}">`)

          // Long-winded way to get note title, as we don't have TNote, but do have note's filename
          const itemNoteTitle = displayTitle(DataStore.projectNoteByFilename(item.filename) ?? DataStore.calendarNoteByDateString((item.filename).split(".")[0]))

          switch (item.type) {
            // Using a nested table for cols 3/4 to simplify logic and CSS
            case 'open': {
              // do col3
              outputArray.push(
                `     <td id="${item.ID}A" class="todo sectionItem no-borders" onClick="onClickDashboardItem('${item.ID}','${item.type}','${encodedFilename}','${encodedRawContent}')"><i id="${item.ID}I" class="fa-regular fa-circle"></i></td>`,
              )

              // do col 4
              // Output type A: append clickable note link
              // let cell4 = `   <td class="sectionItem">${paraContent}`
              // if (itemNoteTitle !== weeklyNoteTitle) {
              //   // Method 1: make [[notelinks]] via x-callbacks
              //   // const title = displayTitle(thisNote)
              //   const noteTitleWithOpenAction = makeNoteTitleWithOpenAction(itemNoteTitle)
              //   // If context is wanted, and linked note title
              //   if (config.includeTaskContext) {
              //     cell4 += noteTitleWithOpenAction
              //   }
              // }
              // cell4 += `</td></tr>`

              // Output type B: whole note link is clickable
              // If context is wanted, and linked note title
              let paraContent = ''
              if (config.includeTaskContext) {
                if (itemNoteTitle === dailyNoteTitle || itemNoteTitle === weeklyNoteTitle) {
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
              // do col 3 icon
              outputArray.push(`     <td class="todo sectionItem no-borders" onClick="onClickDashboardItem('${item.ID}','${item.type}','${encodedFilename}','${encodedRawContent}')"><i class="fa-regular fa-square"></i></td>`)

              // do col 4
              // const paraContent = makeParaContentToLookLikeNPDisplayInHTML(item.content)
              // Output type A: append clickable note link
              // let cell4 = `   <td class="sectionItem">${paraContent}`
              // if (itemNoteTitle !== weeklyNoteTitle) {
              //   // Make [[notelinks]] via x-callbacks
              //   // const title = displayTitle(thisNote)
              //   const noteTitleWithOpenAction = makeNoteTitleWithOpenAction(itemNoteTitle)
              //   // If context is wanted, and linked note title
              //   if (config.includeTaskContext) {
              //     cell4 += noteTitleWithOpenAction
              //   }
              // }
              // cell4 += `</td></tr>`

              // Output type B: whole note link is clickable
              // If context is wanted, and linked note title
              let paraContent = ''
              if (config.includeTaskContext) {
                if (itemNoteTitle === dailyNoteTitle || itemNoteTitle === weeklyNoteTitle) {
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
              // TODO: why aren't icons appearing here?
              const cell4 = `     <td class="sectionItem noborders">${item.content} </td>\n    </tr>`
              outputArray.push(cell4)
              break
            }
            case 'review': {
              if (itemNoteTitle) {
                // do col 3 icon
                outputArray.push(`      <td class="todo sectionItem no-borders" onClick="onClickDashboardItem('${item.ID}','review','${encodedFilename}','')"><i class="fa-solid fa-calendar-check"></i></td>`) 

                // do col 4
                const folderNamePart = config.includeFolderName && (getFolderFromFilename(item.filename) !== '') ? getFolderFromFilename(item.filename) + ' / ' : ''

                // Method A: [[notelinks]] via x-callbacks
                // const itemNoteTitleEncoded = encodeURIComponent(itemNoteTitle)
                // const noteTitleWithOpenAction = `${folderNamePart}<span class="noteTitle"><a href="noteplan://x-callback-url/openNote?noteTitle=${itemNoteTitleEncoded}">${itemNoteTitle}</a></span>`
                // let cell4 = `     <td class="sectionItem"><span class="">${noteTitleWithOpenAction}</span>`
                // Method B: internal calls
                let cell4 = `      <td class="sectionItem">${folderNamePart}<a class="noteTitle" href="" onClick = "onClickDashboardItem('${item.ID}','showNoteInEditor','${encodedFilename}','${encodedRawContent}')">${itemNoteTitle}</a>`
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
          }
        }
      outputArray.push(`   </table>`)
      outputArray.push(`  </div>`)
      outputArray.push(`  </td>\n </tr>`)
      // }
    }
    outputArray.push(`</table>`)

    // write lines before first table
    // Write time and refresh info
    const refreshXCallbackURL = createRunPluginCallbackUrl('jgclark.Dashboard', 'show dashboard (HTML)', '')
    const refreshXCallbackButton = `<span class="fake-button"><a class="button" href="${refreshXCallbackURL}"><i class="fa-solid fa-arrow-rotate-right"></i>&nbsp;Refresh</a></span>`

    let summaryStatStr = `<b><span id="totalOpenCount">${String(totalOpenItems)}</span> open items</b>; `
    summaryStatStr += `<span id="totalDoneCount">${String(totalDoneItems)}</span> closed`
    outputArray.unshift(`<p>${summaryStatStr}. Last updated: ${toLocaleTime(new Date())} ${refreshXCallbackButton}</p>`)
    outputArray.unshift(`<p id="error"></p>`)

    // Show in an HTML window, and save a copy as file
    // Set filename for HTML copy if _logLevel set to DEBUG
    const windowTitle = `Dashboard (${totalOpenItems} items)`
    const filenameHTMLCopy = config._logLevel === 'DEBUG' ? '../../jgclark.Dashboard/dashboard.html' : ''
    await showHTML(
      windowTitle,
      faLinksInHeader, // no extra header tags
      outputArray.join('\n'),
      '', // get general CSS set automatically
      dashboardCSS,
      false, // = not modal window
      '', // no extra JS
      commsBridge,
      filenameHTMLCopy,
      1000, // = width of window
      500, // = height of window
      windowCustomID
    ) // set width; max height
    logDebug(`makeDashboard`, `written to HTML window`)
  } catch (error) {
    logError(pluginJson, `${error.name} ${error.message}`)
  }
}
