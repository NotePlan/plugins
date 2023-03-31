// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main functions
// Last updated 31.3.2023 for v0.3.x by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import moment from 'moment/min/moment-with-locales'
import { getDataForDashboard } from './dataGeneration'
import { getDemoDashboardData } from './demoDashboard'
import {
  addNoteOpenLinkToString, checkForRequiredSharedFiles, getSettings,
  makeParaContentToLookLikeNPDisplayInHTML,
  type SectionDetails, type SectionItem
} from './dashboardHelpers'
import { toLocaleTime, getDateStringFromCalendarFilename } from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo } from '@helpers/dev'
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
    // FIXME: Commented out for now as API bug on focusing window
    // if (!forceRefresh && focusHTMLWindowIfAvailable(windowCustomID)) {
    //   return
    // }

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

      // Get all items for this section
      const items = sectionItems.filter((i) => i.ID.startsWith(String(section.ID)))

      if (items.length === 0 && sectionNumber > 0) {
        // don't add this section: go on to next section
        logDebug('showDashboardHTML', `Section ${String(sectionNumber)} (${section.name}) is empty so will skip it`)
        sectionNumber++
        continue // to next loop item
      }

      // Prepare col 1 (section icon)
      outputArray.push(` <tr>\n  <td><span class="${section.sectionTitleClass}"><i class="${section.FAIconClass}"></i></td>`)

      // Prepare col 2 (section title)
      // First prepend a sectionNCount ID and populate it. This needs an ID so that it can be updated later.
      const sectionCountID = `section${String(section.ID)}Count`
      const sectionCountPrefix = `<span id="${sectionCountID}">${String(items.length)}</span>`
      if (items.length > 0) {
        outputArray.push(`  <td><span class="sectionName ${section.sectionTitleClass}" style="max-width: 14rem;">${section.name}</span><br /><span class="sectionDescription">${sectionCountPrefix} ${section.description}</span></td>`)
      } else {
        // add a simpler version of the line
        outputArray.push(`  <td><span class="sectionName ${section.sectionTitleClass}" style="max-width: 14rem;">${section.name}</span>`)
      }

      // Start col 3: table of items in this section
      outputArray.push(`  <td>`)
      outputArray.push(`  <div class="multi-cols">`)
      // Now start a nested table for cols 3/4 (to simplify logic and CSS)
      outputArray.push(`   <table style="table-layout: auto; word-wrap: break-word;">`)

      // If there are no items in section 1, then add a congratulatory message
      if (items.length === 0) {
        items.push({ ID: '0-0C', type: 'congrats', content: `Nothing to do: take a break! <i class="fa-regular fa-face-party fa-face-sleeping"></i>`, rawContent: ``, filename: '' })
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
            // do col3
            outputArray.push(
              `     <td id="${item.ID}A" class="todo sectionItem no-borders" onClick="onClickDashboardItem('${item.ID}','${item.type}','${encodedFilename}','${encodedRawContent}')"><i id="${item.ID}I" class="fa-regular fa-circle"></i></td>`,
            )

            // do col 4: whole note link is clickable.
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

            // do col 4: whole note link is clickable
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
            // TODO: why aren't icons appearing here?
            const cell4 = `     <td class="sectionItem noborders">${item.content} </td>\n    </tr>`
            outputArray.push(cell4)
            break
          }
          case 'review': {
            if (itemNoteTitle) {
              // do col 3 icon
              outputArray.push(`      <td class="todo sectionItem no-borders" onClick="onClickDashboardItem('${item.ID}','review','${encodedFilename}','')"><i class="fa-solid fa-calendar-check"></i></td>`)

              // do col 4: review note link as internal calls
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
      resourceLinksInHeader,
      outputArray.join('\n'),
      '', // get general CSS set automatically
      '',
      false, // = not modal window
      '', // no extra JS
      commsBridge,
      filenameHTMLCopy,
      config.windowWidth > 0 ? config.windowWidth : 1000, // = width of window
      config.windowHeight > 0 ? config.windowHeight : 500, // = height of window
      windowCustomID
    ) // set width; max height
    logDebug(`makeDashboard`, `written to HTML window`)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
