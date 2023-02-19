// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main functions
// Last updated 2.2.2023 for v0.1.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import moment from 'moment/min/moment-with-locales'
import { getDataForDashboard, type SectionDetails, type SectionItem } from './dataGeneration'
import { addNoteOpenLinkToString, getSettings, makeNoteTitleWithOpenAction, makeParaContentToLookLikeNPDisplayInHTML } from './dashboardHelpers'
import { toLocaleTime, getDateStringFromCalendarFilename } from '@helpers/dateTime'
import { clo, logDebug, logError, logInfo } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { createPrettyOpenNoteLink, createPrettyRunPluginLink, createRunPluginCallbackUrl, displayTitle, returnNoteLink } from '@helpers/general'
import { showHTML } from '@helpers/HTMLView'
import { getNoteType } from '@helpers/note'
import { isThisMinute } from 'date-fns'

//-----------------------------------------------------------------
// HTML resources

// Note: this "../np.Shared" path works to the flattened np.Shared structure, but it does *not* work when running the locally-written copy of the HTML output file.
export const faLinksInHeader = `
<!-- Load in fontawesome assets from np.Shared (licensed for NotePlan) -->
<link href="../np.Shared/fontawesome.css" rel="stylesheet">
<link href="../np.Shared/regular.min.flat4NP.css" rel="stylesheet">
<link href="../np.Shared/solid.min.flat4NP.css" rel="stylesheet">
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
  `.sectionItem { font-size: 0.9rem; font-weight: 500;
   padding: 2px 4px; border-bottom: 0px; }`, // reduce vertical spacing and line below
  // `td:first-child .sectionItem { padding-top: 8px 4px; }`, // not working
  '.scheduledDate { color: var(--tint-color); }', // for >dates
  '.noteTitle { color: var(--tint-color); }', // add "font-weight: 700;" to make noteTitles bold
  'a, a:visited, a:active { color: inherit; text-decoration: none; }', // all links turn off text color and underlining by default
  '.externalLink a { text-decoration: underline; }', // turn on underlining
  `.event-link {
		font-weight: 500;
		border-color: var(--bg-alt-color);
		border-radius: 3px;
    border-width: 1px;
    border-style: solid;
		padding: 0px 3px;
	}`,
  // Some headings specified from measuring the colour of NP sidebar elements
  '.sidebarDaily { font-size: 1.0rem; color: #d0703c; }',
  '.sidebarWeekly { font-size: 1.0rem; color: #be23b6; }',
  '.sidebarMonthly { font-size: 1.0rem; color: #f5528b; }',
  '.sidebarQuarterly { font-size: 1.0rem; color: #e08008; }',
  '.sidebarYearly { font-size: 1.0rem; color: #efba13; }',
  '#error { background-color: red; padding-left: 10px; }',
  // TODO: Think about proper HTML checkbox and styling
].join('\n\t')

const startReviewsCommandCall = `(function() {
    DataStore.invokePluginCommandByName("start reviews", "jgclark.Reviews");
  })()`

const makeProjectListsCommandCall = `(function() {
    DataStore.invokePluginCommandByName("show dashboard (HTML)", "jgclark.Dashboard");
  })()`

// function makeCommandCall(commandCallJSON: string): string {
//   return `<script>
//   const callCommand = () => {
//     window.webkit.messageHandlers.jsBridge.postMessage({
//       code: ${commandCallJSON},
//       onHandle: "onHandleUpdateLabel", // TODO: remove in time
//       id: "1"
//     });
//   };
// </script>`
// }

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
 * Show the generated dashboard data using native HTML.
 * @author @jgclark
 *
 * Note: this uses x-callbacks to make actions happen.
 * TODO: ideally switch to using internal links when I can get this to work:
 * - see discussion at https://discord.com/channels/763107030223290449/1007295214102269982/1016443125302034452
 * - e.g. const noteTitleWithOpenAction = `<button onclick=openNote()>${folderNamePart}${titlePart}</button>`
 */
export async function showDashboardHTML(): Promise<void> {
  try {
    const config = await getSettings()
    const [sections, sectionItems] = await getDataForDashboard()
    const outputArray: Array<string> = []
    const dailyNoteTitle = displayTitle(DataStore.calendarNoteByDate(new Date(), 'day'))
    const weeklyNoteTitle = displayTitle(DataStore.calendarNoteByDate(new Date(), 'week'))
    const startReviewXCallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', 'next project review', '')

    // Create nice HTML display for this data.
    // Main table loop
    let totalOpenItems = 0
    let totalDoneItems: number
    outputArray.push(`\n<table style="table-layout: auto; word-wrap: break-word;">`)
    for (const section of sections) {
      const items = sectionItems.filter((i) => i.ID === section.ID)
      if (items.length > 0) {
        // Prepare col 1 (section icon)
        outputArray.push(` <tr>\n  <td><span class="${section.sectionTitleClass}"><i class="${section.FAIconClass}"></i></td>`)

        // Prepare col 2 (section title)
        outputArray.push(`  <td><span class="sectionName ${section.sectionTitleClass}" style="max-width: 12rem;">${section.name}</span><br />${section.description}</td>`)

        // Start col 3: table of items in this section
        outputArray.push(`  <td>`)
        outputArray.push(`   <table style="table-layout: auto; word-wrap: break-word;">`)
        let lineNo = 0
        for (const item of items) {
          let reviewNoteCount = 0 // count of note-review items
          const lineID = `${section.ID}-${lineNo}`
          outputArray.push(`   <tr class="no-borders" id=${lineID}>`)

          // Long-winded way to get note title, as we don't have TNote available
          const itemNoteTitle = displayTitle(DataStore.projectNoteByFilename(item.filename) ?? DataStore.calendarNoteByDateString(item.filename.split('.')[0]))
          // logDebug('item.filename', item.filename) // OK
          switch (item.type) {
            // Using a nested table for cols 3/4 to simplify logic and CSS
            case 'open': {
              outputArray.push(
                `    <td class="todo sectionItem no-borders" onClick="onClickStatus('${item.filename}',${item.lineIndex},'${item.type}','${lineID}')"><i class="fa-regular fa-circle"></i></td>`,
              )
              // Output type A: append clickable note link
              // let cell3 = `   <td class="sectionItem">${paraContent}`
              // if (itemNoteTitle !== weeklyNoteTitle) {
              //   // Method 1: make [[notelinks]] via x-callbacks
              //   // const title = displayTitle(thisNote)
              //   const noteTitleWithOpenAction = makeNoteTitleWithOpenAction(itemNoteTitle)
              //   // If context is wanted, and linked note title
              //   if (config.includeTaskContext) {
              //     cell3 += noteTitleWithOpenAction
              //   }
              // }
              // cell3 += `</td></tr>`

              // Output type B: whole note link is clickable
              // If context is wanted, and linked note title
              let paraContent = ''
              if (config.includeTaskContext) {
                if (itemNoteTitle === dailyNoteTitle || itemNoteTitle === weeklyNoteTitle) {
                  paraContent = makeParaContentToLookLikeNPDisplayInHTML(item.content, itemNoteTitle, 'all')
                } else {
                  paraContent = makeParaContentToLookLikeNPDisplayInHTML(item.content, itemNoteTitle, 'append')
                }
              } else {
                paraContent = makeParaContentToLookLikeNPDisplayInHTML(item.content)
              }
              const cell3 = `   <td class="sectionItem">${paraContent}</td>`
              outputArray.push(cell3)
              totalOpenItems++
              break
            }
            case 'checklist': {
              outputArray.push(`    <td class="todo sectionItem no-borders"><i class="fa-regular fa-square"></i></td>`)
              // const paraContent = makeParaContentToLookLikeNPDisplayInHTML(item.content)
              // Output type A: append clickable note link
              // let cell3 = `   <td class="sectionItem">${paraContent}`
              // if (itemNoteTitle !== weeklyNoteTitle) {
              //   // Make [[notelinks]] via x-callbacks
              //   // const title = displayTitle(thisNote)
              //   const noteTitleWithOpenAction = makeNoteTitleWithOpenAction(itemNoteTitle)
              //   // If context is wanted, and linked note title
              //   if (config.includeTaskContext) {
              //     cell3 += noteTitleWithOpenAction
              //   }
              // }
              // cell3 += `</td></tr>`

              // Output type B: whole note link is clickable
              // If context is wanted, and linked note title
              let paraContent = ''
              if (config.includeTaskContext) {
                if (itemNoteTitle === dailyNoteTitle || itemNoteTitle === weeklyNoteTitle) {
                  paraContent = makeParaContentToLookLikeNPDisplayInHTML(item.content, itemNoteTitle, 'all')
                } else {
                  paraContent = makeParaContentToLookLikeNPDisplayInHTML(item.content, itemNoteTitle, 'append')
                }
              } else {
                paraContent = makeParaContentToLookLikeNPDisplayInHTML(item.content)
              }
              const cell3 = `   <td class="sectionItem">${paraContent}</td>`
              outputArray.push(cell3)
              totalOpenItems++
              break
            }
            case 'review-note': {
              if (itemNoteTitle) {
                // do col 3 icon
                outputArray.push(`    <td class="sectionItem noteTitle no-borders"><i class="fa-regular fa-file-lines"></i></td>`) // col 3

                // do col 4
                // Make [[notelinks]] via x-callbacks
                const folderNamePart = config.includeFolderName ? getFolderFromFilename(item.filename) + ' / ' : ''
                const titlePart = itemNoteTitle // displayTitle(thisNote)
                const titlePartEncoded = encodeURIComponent(titlePart)

                // TODO: Use createPrettyOpenNoteLink() here?
                const noteTitleWithOpenAction = `${folderNamePart}<span class="noteTitle"><a href="noteplan://x-callback-url/openNote?noteTitle=${titlePartEncoded}">${titlePart}</a></span>`
                let cell4 = `    <td class="sectionItem"><span class="">${noteTitleWithOpenAction}</span>`
                // if (reviewNoteCount === 0) { // FIXME: on first item only
                // TODO: make specific to that note
                const startReviewButton = `<span class="fake-button"><a class="button" href="${startReviewXCallbackURL}"><i class="fa-solid fa-calendar-check"></i> Start Reviews</a></span>`
                cell4 += ` ${startReviewButton}`
                // }
                cell4 += `</td></tr>`
                outputArray.push(cell4)
                totalOpenItems++
                reviewNoteCount++
              } else {
                logError('makeDashboard', `Cannot find note for '${item.content}'`)
              }
              break
            }
          }
          lineNo++
        }
        outputArray.push(`   </table>`)
        outputArray.push(` </td></tr>`)
      } else {
        // If this is the 'Done' section that recover the count
        if (section.name === 'Done') {
          totalDoneItems = Number(section.description)
        }
      }
    }
    outputArray.push(`</table>`)

    // write lines before first table
    // Write time and refresh info TODO: as a fixed block at top R of window
    const refreshXCallbackURL = createRunPluginCallbackUrl('jgclark.Dashboard', 'show dashboard (HTML)', '')
    const refreshXCallbackButton = `<span class="fake-button"><a class="button" href="${refreshXCallbackURL}"><i class="fa-solid fa-arrow-rotate-right"></i>&nbsp;Refresh</a></span>`

    const summaryStatStr =
      totalDoneItems && !isNaN(totalDoneItems) ? `<b>${String(totalOpenItems)} items</b> open; ${String(totalDoneItems)} closed` : `<b>${String(totalOpenItems)} items</b> open`
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
      commsBridge /* makeCommandCall(startReviewsCommandCall), */,
      filenameHTMLCopy,
      780,
      800,
    ) // set width; max height
    logDebug(`makeDashboard`, `written to HTML window`)
  } catch (error) {
    logError(pluginJson, `${error.name} ${error.message}`)
  }
}
