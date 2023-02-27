// @flow
//-----------------------------------------------------------------------------
// Commands for producing Project lists
// WARNING: Have the contents -> reviews.js?
// by @jgclark
// Last updated 12.2.2023 for v0.9.0-betas, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import fm from 'front-matter'
import {
  getReviewSettings,
  logPreference,
  Project,
} from './reviewHelpers'
import { checkString } from '@helpers/checkType'
import {
  hyphenatedDateString,
  RE_DATE,
  toLocaleDateTimeString
} from '@helpers/dateTime'
import {
  nowLocaleShortDateTime,
} from '@helpers/NPdateTime'
import {
  clo, JSP, logDebug, logError, logInfo, logWarn,
  timer
} from '@helpers/dev'
import {
  getFilteredFolderList,
} from '@helpers/folders'
import { displayTitle } from '@helpers/general'
import {
  makeSVGPercentRing,
  redToGreenInterpolation,
  showHTML
} from '@helpers/HTMLView'
import {
  findNotesMatchingHashtag,
  findNotesMatchingHashtags,
  getOrMakeNote,
} from '@helpers/note'
import {
  showMessage,
  showMessageYesNo,
} from '@helpers/userInput'
import { makeFullReviewList } from "./reviews";

//-----------------------------------------------------------------------------

const fullReviewListFilename = 'full-review-list.md'

const faLinksInHeader = `
  <!-- Load in fontawesome assets (licensed for NotePlan) -->
  <link href="css/fontawesome.css" rel="stylesheet">
  <link href="css/regular.css" rel="stylesheet">
  <link href="css/solid.css" rel="stylesheet">
  <!-- <link href="css/duotone.css" rel="stylesheet"> -->
`

export const reviewListCSS: string = [
  '\n/* CSS specific to reviewList() from jgclark.Reviews plugin */\n',
  'body { padding: 0rem 0.25rem; }', // a little breathing room around whole content
  'table { font-size: 1.0rem;', // had been on 0.9rem to make text a little smaller
  '  border-collapse: collapse;', // always!
  '  empty-cells: show;}',
  'p { margin-block-start: 0.5rem; margin-block-end: 0.5rem; }',
  'a, a:visited, a:active { color: inherit; text-decoration-line: none }', // turn off special colouring and underlining for links -- turn on later when desired
  '.sticky-box-top-middle { position: sticky; top: 0px; background-color: var(--bg-alt-color); border: 1px solid var(--tint-color); line-height: 1.8rem; margin: auto; padding: 4px; align: middle; text-align: center; }', // Keep a header stuck to top middle of window
  'th { text-align: left; vertical-align: bottom; padding: 4px; border-left: 0px solid var(--tint-color); border-right: 0px solid var(--tint-color); border-bottom: 1px solid var(--tint-color); }', // removed L-R borders for now
  'tr.section-header-row { column-span: all; vertical-align: bottom; background-color: var(--bg-main-color); border-top: none; border-bottom: 1px solid var(--tint-color); }',
  '.section-header { color: var(--h3-color); font-size: 1.0rem; font-weight: bold; padding-top: 1.0rem; }',
  'tbody td { background-color: var(--bg-alt-color); padding: 2px; border-left: 0px solid var(--tint-color); border-right: 0px solid var(--tint-color); }', // removed L-R borders for now
  'table tbody tr:first-child { border-top: 1px solid var(--tint-color); }', // turn on top border for tbody
  'table tbody tr:last-child { border-bottom: 1px solid var(--tint-color); }', // turn on bottom border for tbody
  'table tr td:first-child, table tr th:first-child { border-left: 0px; }', // turn off outer table right borders
  'table tr td:last-child, table tr th:last-child { border-right: 0px; }', // turn off outer table right borders
  '.noteTitle { font-weight: 700; text-decoration: none; }', // make noteTitles bold
  '.multi-cols { column-count: 3; column-width: 30rem; column-gap: 2rem; column-rule: 1px dotted var(--tint-color); }', // allow multi-column flow: set max columns and min width, and some other bits and pieces
  'i.fa-solid, i.fa-regular { color: var(--tint-color); }', // set fa icon colour to tint color
  // '.fix-top-right { position: absolute; top: 1.7rem; right: 1rem; }', // a top-right fixed position
  '.checkbox { font-family: "noteplanstate"; font-size: 1.4rem; }', // make checkbox display larger, and like in the app
  '.np-task-state { font-family: "noteplanstate"; }', // use special 'noteplanstate' font
  '.percent-ring { width: 2rem; height: 2rem; }', // Set size of percent-display rings
  '.percent-ring-circle { transition: 0.5s stroke-dashoffset; transform: rotate(-90deg); transform-origin: 50% 50%; }', // details of ring-circle that can be set in CSS
  '.circle-percent-text { font-family: "Avenir Next"; font-size: 2.2rem; font-weight: 600; color: var(--fg-main-color); }', // details of ring text that can be set in CSS
  '.circle-icon { font-size: 1.9rem; }', // details for icon that can be set in CSS, including font size
  `/* Tooltip block */
  .tooltip { position: relative; display: inline-block; }
  /* Tooltip text */
  .tooltip .tooltiptext { visibility: hidden; width: 150px; font-weight: "400"; font-style: "normal"; color: var(--fg-main-color); background-color: var(--bg-alt-color); border: 1px solid var(--tint-color); text-align: center; padding: 5px 0; border-radius: 6px; position: absolute; z-index: 1; bottom: 150%; left: 50%; margin-left: -75px; opacity: 0; transition: opacity 0.6s; }
  /* Fade in tooltip */
  .tooltip:hover .tooltiptext { opacity: 1; position: absolute; z-index: 1; }
  /* Make an arrow from tooltip */
  .tooltip .tooltiptext::after { content: ""; position: absolute; top: 100%; /* At the bottom of the tooltip */ left: 50%; margin-left: -5px; border: 5px solid; border-color: var(--tint-color) transparent transparent transparent; }
  /* Show the tooltip text when you mouse over the tooltip container */
  .tooltip:hover .tooltiptext { visibility: visible; }`
].join('\n\t')

const startReviewsCommandCall = (`(function() {
    DataStore.invokePluginCommandByName("start reviews", "jgclark.Reviews");
  })()`
)

const makeProjectListsCommandCall = (`(function() {
    DataStore.invokePluginCommandByName("project lists", "jgclark.Reviews");
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

export const setPercentRingJSFunc: string = `<script>
  /**
   * Sets the value of a SVG percent ring.
   * @param {number} percent The percent value to set.
   */
  function setPercentRing(percent, ID) {
    let svg = document.getElementById(ID);
    let circle = svg.querySelector('circle');
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    circle.style.strokeDasharray = String(circumference) + ' ' + String(circumference);
    circle.style.strokeDashoffset = String(circumference);

    const offset = circumference - percent / 100 * circumference;
    circle.style.strokeDashoffset = offset;  // Set to negative for anti-clockwise.

    // let text = svg.querySelector('text');
    // text.textContent = String(percent); // + '%';
  }
  </script>
  `

/**
 * Generate human-readable lists of project notes for each tag of interest using HTML output. 
 * Note: Requires NP 3.7.0 (build 844) or greater.
 * @author @jgclark
 * @param {any} config - from settings (and any passed args)
 * @param {boolean} renderOnly render only? If true, won't regenerate data, but just read from full-review-list
 */
export async function renderProjectListsHTML(config: any, renderOnly: boolean = false): Promise<void> {
  try {
    // Check to see if we're running v3.6.2, build 844) or later
    if (NotePlan.environment.buildVersion <= 844) {
      await showMessage('Sorry: need to be running NP 3.6.2 or later', 'Shame', "Sorry, Dave, I can't do that.")
      return
    }

    logDebug('renderProjectListsHTML', `starting for ${config.noteTypeTags.toString()} tags and renderOnly: ${String(renderOnly)}`)

    if (!renderOnly) {
      await makeFullReviewList()
    }
    if (config.noteTypeTags.length === 0) {
      throw new Error('No noteTypeTags passed to display')
    }

    // Need to change a single string (1 tag) to an array (multiple tags)
    if (typeof config.noteTypeTags === 'string') config.noteTypeTags = [config.noteTypeTags]

    // Currently we can only display 1 HTML Window at a time, so need to include all tags in a single view. TODO: in time this can hopefully change.
    const windowTitle = `Review List`
    // Set filename for HTML copy if _logLevel set to DEBUG
    const filenameHTMLCopy = (config._logLevel === 'DEBUG') ? 'review_list.html' : ''
    // String array to save all output
    let outputArray = []

    // Set up x-callback URLs for various commands, to be styled into pseudo-buttons
    // TODO: switch to using DW's latest getCallbackCodeString() here
    const refreshXCallbackURL = `noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=project%20lists&arg0=`
    const startReviewXCallbackURL = "noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=next%20project%20review"
    const reviewedXCallbackURL = "noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=finish%20project%20review&arg0="
    const nextReviewXCallbackURL = "noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=next%20project%20review&arg0="
    const pauseXCallbackURL = "noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=pause%20project%20toggle&arg0="
    const completeXCallbackURL = "noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=complete%20project&arg0="
    const cancelXCallbackURL = "noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=cancel%20project&arg0="
    const nowDateTime = toLocaleDateTimeString(new Date())

    // Create the HTML for the 'start review button'
    // - Version 1: does work inside Safari, but not for some reason in a NP view. Eduard doesn't know why.
    // startReviewButton = `<button onClick="noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews\&command=next%20project%20review">Start reviewing ${overdue} ready for review</button>`
    // - Version 2: using x-callback: does work in NP, but doesn't look like a button
    // const startReviewButton = `<span class="fake-button"><a class="button" href="${startReviewXCallbackURL}">Start reviewing ${overdue} ready for review</a></span>`
    const startReviewButton = `<span class="fake-button"><a class="button" href="${startReviewXCallbackURL}"><i class="fa-solid fa-forward"></i>\u00A0Start reviews</a></span>`
    // - Version 3: using proper link to the internal function FIXME: doesn't yet work
    // startReviewButton = `<button onclick=callCommand()>Start reviewing ${overdue} ready for review</button>`

    // Add (pseduo-)buttons for various commands
    // Note: From memory, \u00A0 is the more universal way of specifiying non-breaking space "&nbsp;"
    const refreshXCallbackButton = `<span class="fake-button"><a class="button" href="${refreshXCallbackURL}"><i class="fa-solid fa-arrow-rotate-right"></i>\u00A0Refresh</a></span>` // https://fontawesome.com/icons/arrow-rotate-right?s=solid&f=classic
    const reviewedXCallbackButton = `<span class="fake-button"><a class="button" href="${reviewedXCallbackURL}"><i class="fa-regular fa-calendar-check"></i>\u00A0Mark\u00A0as\u00A0Reviewed</a></span>` // calendar-pen = https://fontawesome.com/icons/calendar-pen
    const nextReviewXCallbackButton = `<span class="fake-button tooltip"><a class="button" href="${nextReviewXCallbackURL}"><i class="fa-regular fa-calendar-check"></i>\u00A0+\u00A0<i class="fa-solid fa-calendar-arrow-down"></i>\u00A0Next\u00A0Review</a><span class="tooltiptext">Mark open project note as reviewed, and start next review</span></span>`
    const pauseXCallbackButton = `<span class="fake-button"><a class="button" href="${pauseXCallbackURL}">Toggle\u00A0<i class="fa-solid fa-play-pause"></i>\u00A0Pause</a></span>`
    const completeXCallbackButton = `<span class="fake-button tooltip"><a class="button" href="${completeXCallbackURL}"><i class="fa-solid fa-check"></i>\u00A0Complete</a><span class="tooltiptext">Complete the currently open Project note</span></span>`  // previously included NP complete 'a' glyph <span class="np-task-state">a</span>
    const cancelXCallbackButton = `<span class="fake-button tooltip"><a class="button" href="${cancelXCallbackURL}"><i class="fa-regular fa-xmark"></i>\u00A0Cancel</a><span class="tooltiptext">Cancel the currently open Project note</span></span>` // https://fontawesome.com/icons/xmark?s=regular&f=classic // previously included NP cancel 'c' glyph <span class="np-task-state">c</span>

    // write lines before first table
    outputArray.push(`<h1>${windowTitle}</h1>`)
    // Add a sticky area for buttons
    // TODO: when possible remove comment to bring Pause back into use
    const controlButtons = `${refreshXCallbackButton} <b>Reviews</b>: ${startReviewButton} ${reviewedXCallbackButton} ${nextReviewXCallbackButton} <b>Projects</b>: ${pauseXCallbackButton} ${completeXCallbackButton} ${cancelXCallbackButton}`
    outputArray.push(`<div class="sticky-box-top-middle">${controlButtons}</div>`)

    // Make the Summary list, for each noteTag in turn
    let tagCount = 0
    for (const thisTag of config.noteTypeTags) {
      // Get main summary lines
      const [thisSummaryLines, noteCount, overdue] = await generateReviewSummaryLines(thisTag, 'Rich', config)

      // Write out all relevant HTML
      outputArray.push(`<h2>${thisTag}: ${noteCount} notes, ${overdue} ready for review</h2>`)
      if (!config.displayGroupedByFolder) {
        outputArray.push(`<h3>All folders (${noteCount} notes)</h3>`)
      }
      outputArray.push(`<p>Last updated: ${nowDateTime}</p>`)
      outputArray.push(`<div class="multi-cols">`)

      // Start constructing table (if there any results)
      outputArray.push('\n<table>')
      if (noteCount > 0) {
        // In some cases, include colgroup to help massage widths a bit
        if (config.displayDates) {
          outputArray.push(`<thead>
<colgroup>
\t<col style="width: 3rem">
\t<col>
\t<col style="width: 5em">
\t<col style="width: 5em">
</colgroup>
`)
        }
        else if (config.displayProgress) {
          outputArray.push(`<thead>
<colgroup>
\t<col style="width: 3rem">
\t<col>
</colgroup>
`)
        } else {
          outputArray.push(`<thead>
<colgroup>
\t<col style="width: 3rem">
\t<col>
</colgroup>
`)
        }
        outputArray.push('<tbody>')
        outputArray.push(thisSummaryLines.join('\n'))
        outputArray.push('</tbody>')
        outputArray.push('</table>')
      }
      tagCount++
    }
    outputArray.push(`</div>`)

    // TODO: in time make a 'timeago' relative display, e.g. using MOMENT moment.duration(-1, "minutes").humanize(true); // a minute ago
    // or https://www.jqueryscript.net/time-clock/Relative-Timestamps-Update-Plugin-timeago.html or https://theprogrammingexpert.com/javascript-count-up-timer/

    // Show the list as HTML, and save a copy as file
    await showHTML(
      windowTitle,
      faLinksInHeader,
      outputArray.join('\n'),
      '',         // = get general CSS set automatically
      reviewListCSS,
      false,      // = not modal window
      setPercentRingJSFunc,
      makeCommandCall(startReviewsCommandCall),
      filenameHTMLCopy,
      812, 1200)  // set width; max height
    logDebug('renderProjectListsHTML', `- written results to HTML window and file`)
    // }
  }
  catch (error) {
    logError('renderProjectListsHTML', error.message)
  }
}

/**
 * Generate human-readable lists of project notes in markdown for each tag of interest
 * and write out to note(s) in the config.folderToStore folder.
 * @author @jgclark
 * @param {any} config - from settings (and any passed args)
 * @param {boolean} redisplayOnly if not already open?
 */
export async function renderProjectListsMarkdown(config: any, redisplayOnly: boolean = true): Promise<void> {
  try {
    logDebug('renderProjectListsMarkdown', `Starting for ${config.noteTypeTags.toString()} tags and redisplayOnly: ${String(redisplayOnly)}`)

    // Set up x-callback URLs for various commands, to be styled into pseudo-buttons
    // TODO: switch to using DW's getCallbackCodeString() here
    const startReviewXCallbackURL = "noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=next%20project%20review"
    const reviewedXCallbackURL = "noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=finish%20project%20review&arg0="
    const nextReviewXCallbackURL = "noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=next%20project%20review&arg0="
    const pauseXCallbackURL = "noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=pause%20project%20toggle&arg0="
    const completeXCallbackURL = "noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=complete%20project&arg0="
    const cancelXCallbackURL = "noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=cancel%20project&arg0="
    const reviewedXCallbackButton = `[Mark as Reviewed](${reviewedXCallbackURL})`
    const nextReviewXCallbackButton = `[Finish + Next Review](${nextReviewXCallbackURL})`
    const pauseXCallbackButton = `[Toggle Pausing Project](${pauseXCallbackURL})` // Note: not currently used
    const completeXCallbackButton = `[Complete Project](${completeXCallbackURL})`
    const cancelXCallbackButton = `[Cancel Project](${cancelXCallbackURL})`
    const nowDateTime = nowLocaleShortDateTime


    if (config.noteTypeTags.length > 0) {
      if (typeof config.noteTypeTags === 'string') config.noteTypeTags = [config.noteTypeTags]
      // We have defined tag(s) to filter and group by
      for (const tag of config.noteTypeTags) {
        // handle #hashtags in the note title (which get stripped out by NP, it seems)
        const tagWithoutHash = tag.replace('#', '')
        const noteTitle = `${tag} Review List`
        const noteTitleWithoutHash = `${tagWithoutHash} Review List`

        // Do the main work
        const note: ?TNote = await getOrMakeNote(noteTitleWithoutHash, config.folderToStore)
        if (note != null) {
          // TODO: switch to using DW's getCallbackCodeString() here
          const refreshXCallbackURL = `noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=project%20lists&arg0=` + encodeURIComponent(`noteTypeTags=${tag}`)

          // Calculate the Summary list(s)
          const [outputArray, noteCount, overdue] = await generateReviewSummaryLines(tag, 'Markdown', config)
          const startReviewButton = `[Start reviewing ${overdue} ready for review](${startReviewXCallbackURL})`
          const refreshXCallbackButton = `[🔄 Refresh](${refreshXCallbackURL})`
          if (noteCount > 0) { // print header just the once (if any notes)
            // Note: can't put reviewed/complete/cancel buttons here yet, because there's no way to be clear about which project they refer to. TODO: find a way round this in time.

            outputArray.unshift(`Total ${noteCount} active notes${(overdue > 0) ? `: **${startReviewButton}**` : '.'} Last updated: ${nowDateTime} ${refreshXCallbackButton}`)
            if (!config.displayGroupedByFolder) {
              outputArray.unshift(`### All folders (${noteCount} notes)`)
            }
            outputArray.unshift(`# ${noteTitle}`)

            // Save the list(s) to this note
            note.content = outputArray.join('\n')
            logDebug('renderProjectListsMarkdown', `- written results to note '${noteTitle}'`)
            // Open the note in a new window (if wanted)
            if (redisplayOnly) {
              // TODO(@EduardMe): Ideally not open another copy of the note if its already open. But API doesn't support this yet.
              await Editor.openNoteByFilename(note.filename, true, 0, 0, false, false)
            }
          }
        } else {
          await showMessage('Oops: failed to find or make project summary note', 'OK')
          logError('renderProjectListsMarkdown', "Shouldn't get here -- no valid note to write to!")
          return
        }
      }
    } else {
      // We will just use all notes with a @review() string, in one go     
      const noteTitle = `Review List`
      const note: ?TNote = await getOrMakeNote(noteTitle, config.folderToStore)
      if (note != null) {
        // Calculate the Summary list(s)
        const [outputArray, noteCount, overdue] = await generateReviewSummaryLines('', 'Markdown', config)
        const startReviewButton = `[Start reviewing ${overdue} ready for review](${startReviewXCallbackURL})`
        // TODO: switch to using DW's getCallbackCodeString() here
        const refreshXCallbackURL = `noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=project%20lists&arg0=`
        const refreshXCallbackButton = `[🔄 Refresh](${refreshXCallbackURL})`

        if (noteCount > 0) { // print header just the once (if any notes)
          // Note: can't put reviewed/complete/cancel buttons here yet, because there's no way to be clear about which project they refer to. TODO: find a way round this in time.
          // TODO: should there be something here?
        }
        if (!config.displayGroupedByFolder) {
          outputArray.unshift(`### All folders (${noteCount} notes)`)
        }
        outputArray.unshift(`Total ${noteCount} active notes${(overdue > 0) ? `: **${startReviewButton}**` : '.'} Last updated: ${nowDateTime} ${refreshXCallbackButton}`)
        outputArray.unshift(`# ${noteTitle}`)

        // Save the list(s) to this note
        note.content = outputArray.join('\n')
        logInfo('renderProjectListsMarkdown', `- written results to note '${noteTitle}'`)
        // Open the note in a new window (if wanted)
        if (redisplayOnly) {
          // TODO(@EduardMe): Ideally not open another copy of the note if its already open. But API doesn't support this yet.
          await Editor.openNoteByFilename(note.filename, true, 0, 0, false, false)
        }
      } else {
        await showMessage('Oops: failed to find or make project summary note', 'OK')
        logError('renderProjectListsMarkdown', "Shouldn't get here -- no valid note to write to!")
        return
      }
    }
  }
  catch (error) {
    logError('renderProjectListsMarkdown', error.message)
  }
}

//-------------------------------------------------------------------------------
/** 
 * Return summary of notes that contain a specified tag, for all relevant folders, in 'Markdown' or 'Rich' style.
 * V2: Changed to read from the TSV file 'data/full-review-list.md' folder rather than calcuate from scratch.
 * V3: Now doesn't handle output before the main list(s) start. That is now done in the calling function.
 * @author @jgclark
 * 
 * @param {string} noteTag - hashtag to look for
 * @param {string} style - 'Markdown' or 'Rich'
 * @param {any} config - from settings (and any passed args)
 * @returns {Array<string>} output summary lines
 * @returns {number} number of notes
 * @returns {number} number of overdue notes (ready to review)
 */
async function generateReviewSummaryLines(noteTag: string, style: string, config: any): Promise<[Array<string>, number, number]> {
  try {
    logDebug('generateReviewSummaryLines', `Starting for tag(s) '${noteTag}' in ${style} style`)

    const filteredFolderList = getFilteredFolderList(config.foldersToIgnore)
    logDebug('generateReviewSummaryLines', `- for ${filteredFolderList.length} folders: '${String(filteredFolderList)}'`)

    let noteCount = 0
    let overdue = 0
    const outputArray: Array<string> = []

    // V2 Approach  (V1 now deleted)

    // Read each line in full-review-list
    let reviewListContents = DataStore.loadData(fullReviewListFilename, true)
    if (!reviewListContents) {
      // Try to make the full-review-list
      // TODO: Currently needed to comment this out, to avoid circular dependency
      // await makeFullReviewList(true)
      // reviewListContents = DataStore.loadData(fullReviewListFilename, true)
      // if (!reviewListContents) {
      // If still no luck, throw an error
      throw new Error('full-review-list note empty or missing')
      // }
    }

    // Ignore its frontmatter and sort rest by days before next review (first column), ignoring those for a different noteTag than we're after.
    const fmObj = fm(reviewListContents)
    const reviewLines = fmObj.body.split('\n').filter((f) => f.match(noteTag))

    // Split each TSV line into its parts
    let lastFolder = ''
    for (let thisLine of reviewLines) {
      const fields = thisLine.split('\t')
      // logDebug('generateReviewSummaryLines', `  - ${fields.length} fields`)
      const title = fields[2]
      const folder = (fields[3] !== '' ? fields[3] : '(root folder)') // root is a special case
      const notes = DataStore.projectNoteByTitle(title)
      if (notes == null || notes.length === 0) {
        logWarn('generateReviewSummaryLines', `No note found matching title '${title}'; skipping.`)
        continue // go on to next line
      }
      const thisProject = new Project(notes[0])

      const out = thisProject.detailedSummaryLine(style, false, config.displayDates, config.displayProgress)

      // Add to number of notes to review (if appropriate)
      if (!thisProject.isPaused && thisProject.nextReviewDays != null && !isNaN(thisProject.nextReviewDays) && thisProject.nextReviewDays <= 0) {
        overdue += 1
      }

      // Write new folder header (if change of folder)
      if (config.displayGroupedByFolder && (lastFolder !== folder)) {
        if (style.match(/rich/i)) {
          outputArray.push(`<thead>\n <tr class="section-header-row">  <td colspan=2 class="h3 section-header">${folder}</td>`)
          if (config.displayDates) {
            outputArray.push(`  <td>Next Review</td><td>Due Date</td>`)
          }
          else if (config.displayProgress) {
            outputArray.push(`  <td>Progress</td>`)
          }
          outputArray.push(` </tr>\n</thead>\n`)
        }
        else if (style.match(/markdown/i)) {
          outputArray.push(`### ${folder}`)
        }
      }

      outputArray.push(out)
      noteCount++

      lastFolder = folder
    }
    return [outputArray, noteCount, overdue]
  }
  catch (error) {
    logError('generateReviewSummaryLines', `${error.message}`)
    return [[], NaN, NaN] // for completeness
  }
}
