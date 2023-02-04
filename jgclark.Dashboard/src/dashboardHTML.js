// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main functions
// Last updated 2.2.2023 for v0.1.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import moment from 'moment/min/moment-with-locales'
import {
  getDataForDashboard,
  type SectionDetails,
  type SectionItem
} from './dataGeneration'
import {
  getSettings,
  makeNoteTitleWithOpenAction,
  makeParaContentToLookLikeNPDisplayInHTML
} from './dashboardHelpers'
import {
  toLocaleTime,
  getDateStringFromCalendarFilename,
} from '@helpers/dateTime'
import { clo, logDebug, logError, logInfo } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import {
  createPrettyOpenNoteLink,
  createPrettyRunPluginLink,
  createRunPluginCallbackUrl,
  displayTitle,
  returnNoteLink,
} from '@helpers/general'
import { showHTML } from '@helpers/HTMLView'

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
  'a, a:visited, a:active { color: inherit }', // note links: turn off text color
  '.sectionName { font-size: 1.0rem; font-weight: 700; }', // make noteTitles bold
  `.sectionItem { font-size: 0.9rem; font-weight: 500;
   padding: 2px 4px; border-bottom: 0px; }`, // reduce vertical spacing and line below
  // `td:first-child .sectionItem { padding-top: 8px 4px; }`, // not working
  '.scheduledDate { color: var(--tint-color); }', // for >dates
  '.noteTitle { color: var(--tint-color); }', // add "font-weight: 700;" to make noteTitles bold
  '.noteTitle a { text-decoration: none; }', // turn off underlining
  `.event-link {
		font-weight: 500;
		border-color: var(--bg-alt-color);
		border-radius: 3px;
    border-width: 1px;
    border-style: solid;
		padding: 0px 3px;
	}`
  // TODO: Think about proper HTML checkbox and styling
].join('\n\t')

const startReviewsCommandCall = (`(function() {
    DataStore.invokePluginCommandByName("start reviews", "jgclark.Reviews");
  })()`
)

const makeProjectListsCommandCall = (`(function() {
    DataStore.invokePluginCommandByName("show dashboard (HTML)", "jgclark.Dashboard");
  })()`
)

function makeCommandCall(commandCallJSON: string): string {
  return `<script>
  const callCommand = () => {
    window.webkit.messageHandlers.jsBridge.postMessage({
      code: ${commandCallJSON},
      onHandle: "onHandleUpdateLabel", // TODO: remove in time
      id: "1"
    });
  };
</script>`
}

//-----------------------------------------------------------------

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
    const startReviewXCallbackURL = createRunPluginCallbackUrl("jgclark.Reviews", "next project review", "")

    // Create nice HTML display for this data.
    // Main table loop
    let totalOpenItems = 0
    let totalDoneItems: number
    outputArray.push(`\n<table style="table-layout: auto; word-wrap: break-word;">`)
    // outputArray.push(` <colgroup><col /><col style="min-width: 10em; max-width: 14em;"><col /><col /></colgroup>`) // doesn't work as hoped
    for (const section of sections) {
      const items = sectionItems.filter((i) => i.ID === section.ID)
      if (items.length > 0) {
        outputArray.push(` <tr>\n  <td><span style="font-size: 1.0rem; color: ${section.FAIconColor};"><i class="${section.FAIconClass}"></i></td>`)
        // outputArray.push(` <tr>\n  <td rowspan=${items.length}><span style="font-size: 1.0rem; color: ${section.FAIconColor};"><i class="${section.FAIconClass}"></i></td>`)
        outputArray.push(`  <td><span class="sectionName" style="max-width: 12rem; color: ${section.FAIconColor};">${section.name}</span><br />${section.description}</td>`)
        // outputArray.push(`  <td rowspan=${items.length}><span class="sectionName" style="max-width: 12rem; color: ${section.FAIconColor};">${section.name}</span><br />${String(items.length)} ${section.description}</td>`)

        outputArray.push(`  <td>`)
        outputArray.push(`   <table style="table-layout: auto; word-wrap: break-word;">`)
        for (const item of items) {
          let reviewNoteCount = 0 // count of note-review items
          outputArray.push(`   <tr class="no-borders">`)

          const thisNote = DataStore.projectNoteByFilename(item.filename)
          switch (item.type) {
            // Using a nested table for cols 3/4 to simplify logic and CSS
            case 'open': {
              const paraContent = makeParaContentToLookLikeNPDisplayInHTML(item.content)
              outputArray.push(`    <td class="todo sectionItem no-borders"><i class="fa-regular fa-circle"></i></td>`)
              let cell3 = `   <td class="sectionItem">${paraContent}`
              if (thisNote) {
                // Method 1: make [[notelinks]] via x-callbacks
                const title = displayTitle(thisNote)
                const noteTitleWithOpenAction = makeNoteTitleWithOpenAction(title)
                // TODO(finish): If context is wanted, and linked note title
                if (config.includeTaskContext) {
                  cell3 += noteTitleWithOpenAction
                }
              }
              cell3 += `</td></tr>`
              outputArray.push(cell3)
              totalOpenItems++
              break
            }
            case 'checklist': {
              const paraContent = makeParaContentToLookLikeNPDisplayInHTML(item.content)
              outputArray.push(`    <td class="todo sectionItem no-borders"><i class="fa-regular fa-square"></i></td>`)
              let cell3 = `   <td class="sectionItem">${paraContent}`
              if (thisNote) {
                // Make [[notelinks]] via x-callbacks
                const titlePart = displayTitle(thisNote)
                const titlePartEncoded = encodeURIComponent(titlePart)
                const noteTitleWithOpenAction = `<span class="noteTitle"><a href="noteplan://x-callback-url/openNote?noteTitle=${titlePartEncoded}">${titlePart}</a></span>`
                // TODO(finish): If context is wanted, and linked note title
                if (config.includeTaskContext) {
                  cell3 += '  [' + noteTitleWithOpenAction + ']'
                }
              }
              cell3 += `</td></tr>`
              outputArray.push(cell3)
              totalOpenItems++
              break
            }
            case 'review-note': {
              if (thisNote) {
                // do col 3 icon
                outputArray.push(`    <td class="sectionItem noteTitle no-borders"><i class="fa-regular fa-file-lines"></i></td>`) // col 3

                // do col 4
                // Make [[notelinks]] via x-callbacks
                const folderNamePart = config.includeFolderName ? getFolderFromFilename(item.filename) + ' / ' : ''
                const titlePart = displayTitle(thisNote)
                const titlePartEncoded = encodeURIComponent(titlePart)

                // TODO: Use createPrettyOpenNoteLink() here?
                const noteTitleWithOpenAction = `${folderNamePart}<span class="noteTitle"><a href="noteplan://x-callback-url/openNote?noteTitle=${titlePartEncoded}">${titlePart}</a></span>`
                // const noteTitleWithOpenAction = `${folderNamePart}<span class="noteTitle"><a href="noteplan://x-callback-url/openNote?noteTitle=${titlePartEncoded}">${titlePart}</a></span>`
                let cell4 = `    <td class="sectionItem"><span class="">${noteTitleWithOpenAction}</span>`
                if (reviewNoteCount === 0) { // FIXME: on first item only
                  // TODO: make specific to that note
                  const startReviewButton = `<span class="fake-button"><a class="button" href="${startReviewXCallbackURL}"><i class="fa-solid fa-calendar-check"></i> Start Reviews</a></span>`
                  cell4 += ` ${startReviewButton}`
                }
                cell4 += `</td></tr>`
                outputArray.push(cell4)
                totalOpenItems++
                reviewNoteCount++
              }
              else {
                logError('makeDashboard', `Cannot find note for '${item.content}'`)
              }
              break
            }
          }
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
    const refreshXCallbackURL = createRunPluginCallbackUrl("jgclark.Dashboard", "show dashboard (HTML)", "")
    const refreshXCallbackButton = `<span class="fake-button"><a class="button" href="${refreshXCallbackURL}"><i class="fa-solid fa-arrow-rotate-right"></i>&nbsp;Refresh</a></span>`

    const summaryStatStr = (totalDoneItems && !isNaN(totalDoneItems)) ? `<b>${String(totalOpenItems)} items</b> open; ${String(totalDoneItems)} closed` : `<b>${String(totalOpenItems)} items</b> open`

    outputArray.unshift(`<p>${summaryStatStr}. Last updated: ${toLocaleTime(new Date())} ${refreshXCallbackButton}</p>`)

    // TODO: Add a % circle completion? Requires done info as well.

    // Show in an HTML window, and save a copy as file
    // Set filename for HTML copy if _logLevel set to DEBUG
    const windowTitle = `Dashboard (${totalOpenItems} items)`
    const filenameHTMLCopy = (config._logLevel === 'DEBUG') ? 'dashboard.html' : ''
    await showHTML(windowTitle,
      faLinksInHeader, // no extra header tags
      outputArray.join('\n'),
      '', // get general CSS set automatically
      dashboardCSS,
      false, // = not modal window
      '', // no extra JS
      makeCommandCall(startReviewsCommandCall),
      filenameHTMLCopy,
      780, 800) // set width; max height
    logDebug(`makeDashboard`, `written to HTML window`)
  }
  catch (error) {
    logError(pluginJson, `${error.name} ${error.message}`)
  }
}
