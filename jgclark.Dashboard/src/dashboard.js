// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main functions
// Last updated 8.1.2023 for v0.1.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import moment from 'moment/min/moment-with-locales'
// import { getSettings, type noteHelpersConfigType } from './noteHelpers'
import {
  toLocaleDateString,
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
import { RE_SYNC_MARKER } from '@helpers/paragraph'
import { getReferencedParagraphs } from '@helpers/NPNote'

//-----------------------------------------------------------------
// Data types

type SectionDetails = {
  ID: number,
  name: string,
  description: string,
  FAIconClass: string,
  FAIconColor: string,
}
type SectionItem = {
  ID: number,
  content: string,
  filename: string,
  type: ParagraphType | string,
}

//-----------------------------------------------------------------
// Settings

const pluginID = 'jgclark.Dashboard' // is this needed?

const fullReviewListFilename = 'full-review-list.md'
// TODO: improve
const config: any = {}
config._logLevel = 'DEBUG'

//-----------------------------------------------------------------
// HTML resources

const faLinksInHeader = `
<!-- Load in fontawesome assets (licensed for NotePlan) -->
<link href="css/fontawesome.css" rel="stylesheet">
<link href="css/regular.min.css" rel="stylesheet">
<link href="css/light.min.css" rel="stylesheet">
<link href="css/solid.min.css" rel="stylesheet">
<!-- <link href="css/duotone.css" rel="stylesheet"> -->
`
const dashboardCSS: string = [
  '\n/* CSS specific to showDashboard() from jgclark.Dashboard plugin */\n',
  'table { font-size: 0.9rem;', // make text a little smaller
  '  border-collapse: collapse;', // always!
  '  border: 0px none;',
  '  empty-cells: show; }',
  // 'i.fa-solid, i.fa-light, i.fa-regular { padding-right: 6px; }', // add space after 
  'th { text-align: left; vertical-align: bottom; padding: 8px; border: 0px none; }', // no borders
  // 'tr.new-section-header { color: var(--h3-color); padding-top: 1.0rem; font-size: 1.0rem; font-weight: bold; background-color: var(--bg-main-color); border-top: 1px solid var(--tint-color); border-bottom: 1px solid var(--tint-color); }',
  'td { text-align: left; vertical-align: top; padding: 8px 4px; border: 0px none; }', // no borders
  // 'table tr:first-child, table tr:last-child { border-top: solid 1px var(--bg-alt-color); }', // TEST: after sub-table, can remove. // turn on top and bottom border (from theme CSS)
  'table tr { border-top: solid 1px var(--tint-color); border-bottom: solid 1px var(--tint-color); }', // line between rows, not columns
  '.no-borders { border-top: none 0px; border-bottom: none 0px; }', // turn off all borders
  'a, a:visited, a:active { color: inherit }', // note links: turn off text color
  '.sectionName { font-size: 1.0rem; font-weight: 700; }', // make noteTitles bold
  `.sectionItem { font-size: 0.9rem; font-weight: 500;
   padding: 3px 4px; border-bottom: 0px; }`, // reduce vertical spacing and line below
  // `td:first-child .sectionItem { padding-top: 8px 4px; }`, // not working
  '.noteTitle { font-weight: 700; color: var(--tint-color)}', // make noteTitles bold
  // TODO: Think about proper HTML checkbox and styling
].join('\n\t')

const startReviewsCommandCall = (`(function() {
    DataStore.invokePluginCommandByName("start reviews", "jgclark.Reviews");
  })()`
)

const makeProjectListsCommandCall = (`(function() {
    DataStore.invokePluginCommandByName("show dashboard", "jgclark.Dashboard");
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

function makeDashboard(): [Array<SectionDetails>, Array<SectionItem>] {
  try {
    // Get any settings

    // Set up data structure to receive sections and their items
    const sections: Array<SectionDetails> = []
    const sectionItems: Array<SectionItem> = []
    let sectionCount = 0
    const today = new Date()

    // Get list of open tasks/checklists from daily note
    const currentDailyNote = DataStore.calendarNoteByDate(today, 'day')
    if (currentDailyNote) {
      const thisFilename = currentDailyNote.filename
      // logDebug('makeDashboard', `${displayTitle(currentDailyNote)} ${String(currentDailyNote.paragraphs.length)}`)
      const openParas = currentDailyNote.paragraphs.filter((p) => ["open", "checklist"].includes(p.type))
      openParas.map((p) => sectionItems.push({ ID: sectionCount, content: p.content, filename: thisFilename, type: p.type }))
      sections.push({ ID: sectionCount, name: 'Today', description: `from daily note for ${toLocaleDateString(today)}`, FAIconClass: "fa-regular fa-calendar-star", FAIconColor: "#d0703c" })
      sectionCount++

      // TODO: Include context for sub-tasks/checklist

      // FIXME: Get list of open tasks/checklists scheduled to today from other notes
      const refParas = currentDailyNote ? getReferencedParagraphs(currentDailyNote, false) : []
      if (refParas) {
        // $FlowFixMe[incompatible-use]
        refParas.map((p) => sectionItems.push({ ID: sectionCount, content: p.content, filename: p.note.filename, type: p.type }))
        sections.push({ ID: sectionCount, name: 'Today', description: `scheduled to today from other notes`, FAIconClass: "fa-regular fa-clock", FAIconColor: "#d0703c" })
        sectionCount++
      }
    }

    // Get list of open tasks/checklists from weekly note
    const currentWeeklyNote = DataStore.calendarNoteByDate(today, 'week')
    if (currentWeeklyNote) {
      const thisFilename = currentWeeklyNote.filename
      const dateStr = getDateStringFromCalendarFilename(currentWeeklyNote.filename)
      // logDebug('makeDashboard', `${displayTitle(currentWeeklyNote)} ${String(currentWeeklyNote.paragraphs.length)}`)
      const openParas = currentWeeklyNote.paragraphs.filter((p) => ["open", "checklist"].includes(p.type))
      openParas.map((p) => sectionItems.push({ ID: sectionCount, content: p.content, filename: thisFilename, type: p.type }))
      sections.push({ ID: sectionCount, name: 'This Week', description: `from weekly note ${dateStr}`, FAIconClass: "fa-regular fa-calendar-week", FAIconColor: "#be23b6" })
      sectionCount++

      // Get list of open tasks/checklists scheduled to today from other notes
      const refParas = currentWeeklyNote ? getReferencedParagraphs(currentWeeklyNote, false) : []
      if (refParas) {
        // $FlowFixMe[incompatible-use]
        refParas.map((p) => sectionItems.push({ ID: sectionCount, content: p.content, filename: p.note.filename, type: p.type }))
        sections.push({ ID: sectionCount, name: 'This week', description: `scheduled to this week from other notes`, FAIconClass: "fa-regular fa-clock", FAIconColor: "#be23b6" })
        sectionCount++
      }
    }

    // If Reviews plugin has produced a review list file, then show the overdue things from it
    if (true) {
      // TODO ...

      // refParas.map((p) => sectionItems.push({ ID: sectionCount, content: p.content, type: p.type }))
      sectionItems.push({ ID: sectionCount, content: '', filename: 'CCC Areas/Services.md', type: 'note' }) // Example for testing only
      sectionItems.push({ ID: sectionCount, content: '', filename: 'CCC Projects/Annual Church Meetings 2023.md', type: 'note' }) // Example for testing only

      sections.push({ ID: sectionCount, name: 'Projects', description: `projects ready to review`, FAIconClass: "fa-regular fa-calendar-check", FAIconColor: "#bc782e" }) // or "fa-solid fa-calendar-arrow-down" ?
      sectionCount++
    }

    logDebug(pluginJson, `makeDashboard finished, with ${String(sections.length)} sections and ${String(sectionItems.length)} items`)
    return [sections, sectionItems]
  }
  catch (error) {
    logError(pluginJson, error.message)
    return [[], []] // for completeness
  }
}

export function logDashboard(): void {
  try {
    const [sections, sectionItems] = makeDashboard()

    // Log results
    for (const section of sections) {
      const thisSectionItems = sectionItems.filter((i) => i.ID === section.ID)
      console.log(`${section.name} (${section.FAIconClass})`)
      console.log(`(${String(thisSectionItems.length)} ${section.description})`)
      for (const item of thisSectionItems) {
        console.log(`- ${item.ID} ${item.content}`)
      }
    }
  }
  catch (error) {
    logError('pluginJson', error.message)
  }
}

export async function showDashboard(): Promise<void> {
  try {
    const [sections, sectionItems] = makeDashboard()
    const outputArray: Array<string> = []
    const startReviewXCallbackURL = createRunPluginCallbackUrl("jgclark.Reviews", "next project review", "") // "noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=next%20project%20review"
    const refreshXCallbackURL = createRunPluginCallbackUrl("jgclark.Dashboard", "show dashboard", "") // `noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=show%20dashboard&arg0=`
    const refreshXCallbackButton = `<span class="fake-button"><a class="button" href="${refreshXCallbackURL}"><i class="fa-solid fa-arrow-rotate-right"></i>&nbsp;Refresh</a></span>` // https://fontawesome.com/icons/arrow-rotate-right?s=solid&f=classic

    // Create nice HTML display for this data
    // write lines before first table
    // outputArray.push(`<h1>${windowTitle}</h1>`)
    outputArray.push(`<p>Dashboard last updated: ${toLocaleDateString(new Date())} ${refreshXCallbackButton}</p>`)

    // Main table loop
    let totalItems = 0
    outputArray.push(`<table style="table-layout: auto; word-wrap: break-word;">`)
    // outputArray.push(` <colgroup><col /><col style="min-width: 10em; max-width: 14em;"><col /><col /></colgroup>`) // doesn't work as hoped
    for (const section of sections) {
      const items = sectionItems.filter((i) => i.ID === section.ID)
      if (items.length > 0) {
        outputArray.push(` <tr>\n  <td><span style="font-size: 1.0rem; color: ${section.FAIconColor};"><i class="${section.FAIconClass}"></i></td>`)
        // outputArray.push(` <tr>\n  <td rowspan=${items.length}><span style="font-size: 1.0rem; color: ${section.FAIconColor};"><i class="${section.FAIconClass}"></i></td>`)
        outputArray.push(`  <td><span class="sectionName" style="max-width: 12rem; color: ${section.FAIconColor};">${section.name}</span><br />${String(items.length)} ${section.description}</td>`)
        // outputArray.push(`  <td rowspan=${items.length}><span class="sectionName" style="max-width: 12rem; color: ${section.FAIconColor};">${section.name}</span><br />${String(items.length)} ${section.description}</td>`)

        outputArray.push(`  <td>`)
        outputArray.push(`   <table style="table-layout: auto; word-wrap: break-word;">`)
        for (const item of items) {
          // if (c !== 0) outputArray.push(` <tr>`)
          outputArray.push(`   <tr class="no-borders">`)

          const thisNote = DataStore.projectNoteByFilename(item.filename)
          switch (item.type) {
            // Using a nested table for cols 3/4 to simplify logic and CSS
            case 'open': {
              const paraContent = makeParaContentToLookLikeNPDisplay(item.content)
              outputArray.push(`    <td class="todo sectionItem no-borders"><i class="fa-regular fa-circle"></i></td>`)
              let cell3 = `   <td class="sectionItem">${paraContent}`
              if (thisNote) {
                // Method 1: make [[notelinks]] via x-callbacks
                const titlePart = displayTitle(thisNote)
                const titlePartEncoded = encodeURIComponent(titlePart)
                const noteTitleWithOpenAction = `<span class="noteTitle"><a href="noteplan://x-callback-url/openNote?noteTitle=${titlePartEncoded}">${titlePart}</a></span>`
                cell3 += '  [' + noteTitleWithOpenAction + ']'
              }
              cell3 += `</td></tr>`
              outputArray.push(cell3)
              totalItems++
              break
            }
            case 'checklist': {
              const paraContent = makeParaContentToLookLikeNPDisplay(item.content)
              outputArray.push(`    <td class="todo sectionItem no-borders"><i class="fa-regular fa-square"></i></td>`)
              let cell3 = `   <td class="sectionItem">${paraContent}`
              if (thisNote) {
                // Method 1: make [[notelinks]] via x-callbacks
                const titlePart = displayTitle(thisNote)
                const titlePartEncoded = encodeURIComponent(titlePart)
                const noteTitleWithOpenAction = `<span class="noteTitle"><a href="noteplan://x-callback-url/openNote?noteTitle=${titlePartEncoded}">${titlePart}</a></span>`
                cell3 += '  [' + noteTitleWithOpenAction + ']'
              }
              cell3 += `</td></tr>`
              outputArray.push(cell3)
              totalItems++
              break
            }
            case 'note': {
              if (thisNote) {
                // Method 1: make [[notelinks]] via x-callbacks
                const includeFolderName = true
                const folderNamePart = includeFolderName ? getFolderFromFilename(item.filename) + ' / ' : ''
                const titlePart = displayTitle(thisNote)
                const titlePartEncoded = encodeURIComponent(titlePart)
                const noteTitleWithOpenAction = `${folderNamePart}<span class="noteTitle"><a href="noteplan://x-callback-url/openNote?noteTitle=${titlePartEncoded}">${titlePart}</a></span>`

                // Method 2: internal links -- haven't made this work yet
                // see discussion at https://discord.com/channels/763107030223290449/1007295214102269982/1016443125302034452
                // const noteTitleWithOpenAction = `<button onclick=openNote()>${folderNamePart}${titlePart}</button>`

                const startReviewButton = `<span class="fake-button"><a class="button" href="${startReviewXCallbackURL}"><i class="fa-solid fa-calendar-check"></i> Review</a></span>`
                outputArray.push(`    <td class="sectionItem no-borders"><i class="fa-regular fa-file-lines"></i></td>`)
                outputArray.push(`    <td class="sectionItem"><span class="">${noteTitleWithOpenAction}</span> ${startReviewButton}</td></tr>`)
                totalItems++
              }
              else {
                logError('makeDashboard', `Cannot find note for '${item.content}'`)
              }
              break
            }
          }
          // c++
        }
        outputArray.push(`   </table>`)
        outputArray.push(` </td></tr>`)
      }
    }
    outputArray.push(`</table>`)

    // Show in an HTML window, and save a copy as file
    // Set filename for HTML copy if _logLevel set to DEBUG
    const windowTitle = `Dashboard (${totalItems} items)`
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
      760, 1000) // set width; max height
    logDebug(`makeDashboard`, `written to HTML window`)
  }
  catch (error) {
    logError('pluginJson', error.message)
  }
}
/**
 * Alter the para.content to display suitably in HTML to mimic NP native display of markdown (as best we can)
 * @author @jgclark
 * @param {string} original 
 * @returns {string} 
 */
export function makeParaContentToLookLikeNPDisplay(original: string): string {
  try {
    let output = original

    // Replace sync indicator with icon
    let captures = output.match(RE_SYNC_MARKER)
    if (captures) {
      // clo(res, 'results from RE_SYNC_MARKER match:')
      output = output.replace(captures[0], '<i class="fa-solid fa-asterisk" style="color: #71b3c0;"></i>')
    }

    // Simplify markdown links
    captures = output.match(/\[([^\]]+)\]\((.+)\)/)
    if (captures) {
      // clo(captures, 'results from MD link matches:')
      output = output.replace(`[${captures[1]}](${captures[2]})`, `<a href="${captures[2]}">${captures[1]}</a>`)
    }

    // TODO: Simplify NP event links

    // TODO: hashtag with .hashtag style
    // captures = output.match(/(\s|^|\"|\'|\(|\[|\{)(?!#[\d[:punct:]]+(\s|$))(#([^[:punct:]\s]|[\-_\/])+?\(.*?\)|#([^[:punct:]\s]|[\-_\/])+)/) // regex from @EduardMe's file
    captures = output.match(/(\s|^|\"|\(|\)|\')(#\w+)/) // very simple version
    if (captures) {
      clo(captures, 'results from hashtag matches:')
      output = output.replace(captures[2], `<span class="hashtag">${captures[2]}</span>`)
    }

    // TODO: mentions with .attag style
    // captures = output.match(/(\s|^|\"|\'|\(|\[|\{)(?!@[\d[:punct:]]+(\s|$))(@([^[:punct:]\s]|[\-_\/])+?\(.*?\)|@([^[:punct:]\s]|[\-_\/])+)/) // regex from @EduardMe's file
    captures = output.match(/(\s|^|\"|\(|\)\')(@[\w\d\.\-\(\)]+)/) // very simple version
    if (captures) {
      clo(captures, 'results from mention matches:')
      output = output.replace(captures[2], `<span class="attag">${captures[2]}</span>`)
    }

    return output
  }
  catch (error) {
    logError('pluginJson', error.message)
    return ''
  }
}
