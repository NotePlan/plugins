// @flow
//-----------------------------------------------------------------------------
// Commands for Reviewing project-style notes, GTD-style.
// by @jgclark
// Last updated 27.2.2023 for v0.9.2, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import {
  checkForWantedResources,
  logAvailableSharedResources,
  logProvidedSharedResources
} from "../../np.Shared/src/index.js"
import fm from 'front-matter'
import moment from 'moment/min/moment-with-locales'
import {
  getReviewSettings,
  logPreference,
  makeFakeButton,
  Project,
} from './reviewHelpers'
import { checkString } from '@helpers/checkType'
import {
  getJSDateStartOfToday,
  getTodaysDateHyphenated,
  hyphenatedDateString,
  RE_DATE,
  // toLocaleDateTimeString,
} from '@helpers/dateTime'
import {
  // nowLocaleDateTime,
  nowLocaleShortDateTime,
} from '@helpers/NPdateTime'
import {
  clo, JSP, logDebug, logError, logInfo, logWarn,
  overrideSettingsWithStringArgs,
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
import { findStartOfActivePartOfNote } from '@helpers/paragraph'
import { getOrMakeMetadataLine } from '@helpers/NPparagraph'
import { fieldSorter, sortListBy } from '@helpers/sorting'
import {
  showMessage,
  showMessageYesNo,
} from '@helpers/userInput'
import { logWindows } from '@helpers/NPWindows'

//-----------------------------------------------------------------------------

// Settings
const reviewListPref = 'jgclark.Reviews.reviewList'
const fullReviewListFilename = 'full-review-list.md'
const fullReviewJSONFilename = 'full-review-list.json'
const pluginID = 'jgclark.Reviews'

//-------------------------------------------------------------------------------

const faLinksInHeader = `
  <!-- Load in fontawesome assets (licensed for NotePlan) -->
  <link href="../np.Shared/fontawesome.css" rel="stylesheet">
  <link href="../np.Shared/regular.min.flat4NP.css" rel="stylesheet">
  <link href="../np.Shared/solid.min.flat4NP.css" rel="stylesheet">
  <link href="../np.Shared/light.min.flat4NP.css" rel="stylesheet">
`

export const reviewListCSS: string = [
  '\n/* CSS specific to reviewList() from jgclark.Reviews plugin */\n',
  'body { padding: 0rem 0.25rem; }', // a little breathing room around whole content
  'table { font-size: 1.0rem;', // had been on 0.9rem to make text a little smaller
  '  border-collapse: collapse;', // always!
  '  width: 100%;', // keep wide to avoid different table widths
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
  '.noteTitle a:hover { text-decoration: underline; }', // make noteTitle links underlined on mouse hover
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
  .tooltip .tooltiptext { visibility: hidden; width: 180px; font-weight: 400; font-style: normal; line-height: 1.0rem; color: var(--fg-main-color); background-color: var(--bg-alt-color); border: 1px solid var(--tint-color); text-align: center; padding: 5px 0; border-radius: 6px; position: absolute; z-index: 1; bottom: 120%; left: 50%; margin-left: -90px; opacity: 0; transition: opacity 0.4s; }
  /* Fade in tooltip */
  .tooltip:hover .tooltiptext { opacity: 1; position: absolute; z-index: 1; }
  /* Make an arrow under tooltip */
  .tooltip .tooltiptext::after { content: ""; position: absolute; top: 100%; /* At the bottom of the tooltip */ left: 50%; margin-left: -5px; border: 8px solid; border-color: var(--tint-color) transparent transparent transparent; }
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

    // Test to see if we have the font resources we want
    // await logProvidedSharedResources()
    // await logAvailableSharedResources(pluginID)
    if (!(await checkForWantedResources(pluginID))) {
      logError(pluginJson, `Sorry, I can't find the font resources I need to continue.`)
      await showMessage(`Sorry, I can't find the font resources I need to continue. Please check you have installed the 'Shared Resources' plugin, and then try again.`)
      return
    } else {
      const wantedFilenames = ["fontawesome.css", "regular.min.flat4NP.css", "solid.min.flat4NP.css", "fa-regular-400.woff2", "fa-solid-900.woff2"]
      const numFoundFilenames = await checkForWantedResources(pluginID, wantedFilenames)
      if (Number(numFoundFilenames) < wantedFilenames.length) {
        logWarn(pluginJson, `Sorry, I can only find ${String(numFoundFilenames)} of the ${String(wantedFilenames.length)} wanted shared resource files`)
      }
    }

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

    // Add (pseduo-)buttons for various commands
    // Note: this is not a real button, bcause at the time I started this real < button > wouldn't work in NP HTML views, and Eduard didn't know why.
    // TODO: Version 3: using proper link to the internal function using HTMLView::getCallbackCodeString() instead
    // Useful fontawesome icons include:
    // https://fontawesome.com/icons/play
    // https://fontawesome.com/icons/forward
    // https://fontawesome.com/icons/forward-step
    // https://fontawesome.com/icons/play-pause
    // https://fontawesome.com/icons/calendar-pen
    // https://fontawesome.com/icons/check
    // https://fontawesome.com/icons/xmark
    const refreshXCallbackButton = makeFakeButton(`<i class="fa-solid fa-arrow-rotate-right"></i>\u00A0Refresh`, 'project lists', '', 'Recalculate project lists and update this window') //`<span class="fake-button"><a class="button" href="${refreshXCallbackURL}"><i class="fa-solid fa-arrow-rotate-right"></i>\u00A0Refresh</a></span>`
    const startReviewButton = makeFakeButton(`<i class="fa-solid fa-forward"></i>\u00A0Start reviews`, 'next project', '', 'Opens the next project to review in the NP editor') // `<span class="fake-button"><a class="button" href="${startReviewXCallbackURL}"><i class="fa-solid fa-forward"></i>\u00A0Start reviews</a></span>`
    const reviewedXCallbackButton = makeFakeButton(`<i class="fa-regular fa-calendar-check"></i>\u00A0Mark\u00A0as\u00A0Reviewed`, 'finish project review', '', `Update the ${checkString(DataStore.preference('reviewedMentionStr'))}() date for the Project you're currently editing`) //`<span class="fake-button"><a class="button" href="${reviewedXCallbackURL}"><i class="fa-regular fa-calendar-check"></i>\u00A0Mark\u00A0as\u00A0Reviewed</a></span>`
    const nextReviewXCallbackButton = makeFakeButton(`<i class="fa-regular fa-calendar-check"></i>\u00A0+\u00A0<i class="fa-solid fa-calendar-arrow-down"></i>\u00A0Next\u00A0Review`, 'next project review', '', `Finish review of currently open Project and start the next review`) // `<span class="fake-button tooltip"><a class="button" href="${nextReviewXCallbackURL}"><i class="fa-regular fa-calendar-check"></i>\u00A0+\u00A0<i class="fa-solid fa-calendar-arrow-down"></i>\u00A0Next\u00A0Review</a><span class="tooltiptext">Mark open project note as reviewed, and start next review</span></span>`
    const pauseXCallbackButton = makeFakeButton(`Toggle\u00A0<i class="fa-solid fa-play-pause"></i>\u00A0Pause`, 'pause project toggle', '', 'Pause the currently open Project note') // `<span class="fake-button"><a class="button" href="${pauseXCallbackURL}">Toggle\u00A0<i class="fa-solid fa-play-pause"></i>\u00A0Pause</a></span>`
    const completeXCallbackButton = makeFakeButton(`Toggle\u00A0<i class="fa-solid fa-check"></i>\u00A0Complete`, 'complete project', '', 'Complete the currently open Project note') // `<span class="fake-button tooltip"><a class="button" href="${completeXCallbackURL}"><i class="fa-solid fa-check"></i>\u00A0Complete</a><span class="tooltiptext">Complete the currently open Project note</span></span>`  // previously used NP complete 'a' glyph <span class="np-task-state">a</span>
    const cancelXCallbackButton = makeFakeButton(`Toggle\u00A0<i class="fa-solid fa-xmark"></i>\u00A0Cancel`, 'cancel project', '', 'Cancel the currently open Project note') // `<span class="fake-button tooltip"><a class="button" href="${cancelXCallbackURL}"><i class="fa-regular fa-xmark"></i>\u00A0Cancel</a><span class="tooltiptext">Cancel the currently open Project note</span></span>` // previously used NP cancel 'c' glyph <span class="np-task-state">c</span>

    // write lines before first table
    outputArray.push(`<h1>${windowTitle}</h1>`)
    // Add a sticky area for buttons
    // TODO: when possible remove comment to bring Pause back into use
    const controlButtons = `${refreshXCallbackButton} \n<b>Reviews</b>: ${startReviewButton} \n${reviewedXCallbackButton} \n${nextReviewXCallbackButton}\n<br />\n<b>Projects</b>: ${pauseXCallbackButton} \n${completeXCallbackButton} \n${cancelXCallbackButton}`
    outputArray.push(`<div class="sticky-box-top-middle">\n${controlButtons}\n</div>\n`)

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
      outputArray.push(`<p>Last updated: ${nowLocaleShortDateTime()}</p>`)
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
\t<col style="width: 6em">
\t<col style="width: 6em">
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

    logWindows()

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
    // TODO: could switch to using DW's getCallbackCodeString() here
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
    const nowDateTime = nowLocaleShortDateTime()

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
      await makeFullReviewList(true)
      reviewListContents = DataStore.loadData(fullReviewListFilename, true)
      if (!reviewListContents) {
        // If still no luck, throw an error
        throw new Error('full-review-list note empty or missing')
      }
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
        const folderPart = (config.hideTopLevelFolder)
          ? folder.split('/').slice(-1) // just last part
          : folder
        if (style.match(/rich/i)) {
          // $FlowFixMe
          outputArray.push(`<thead>\n <tr class="section-header-row">  <td colspan=2 class="h3 section-header">${folderPart}</td>`)
          if (config.displayDates) {
            outputArray.push(`  <td>Next Review</td><td>Due Date</td>`)
          }
          else if (config.displayProgress) {
            outputArray.push(`  <td>Progress</td>`)
          }
          outputArray.push(` </tr>\n</thead>\n`)
        }
        else if (style.match(/markdown/i)) {
          // $FlowFixMe
          outputArray.push(`### ${folderPart}`)
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

/**
 * Log the machine-readable list of project-type notes
 * @author @jgclark
 */
export function logFullReviewList(): void {
  const content = DataStore.loadData(fullReviewListFilename, true) ?? `<error reading ${fullReviewListFilename}>`
  console.log(`Contents of ${fullReviewListFilename}:\n${content}`)
}

/**
 * Generate machine-readable list of all project-type notes,
 * ordered by the setting 'displayOrder', optionally also pre-ordered by 'folder'.
 * This is V3, which uses Plugins/data/jgclark.Reviews/full-review-list.md to store the list
 * @author @jgclark
 */
export async function makeFullReviewList(runInForeground: boolean = false): Promise<void> {
  try {
    const config = await getReviewSettings()
    logDebug('makeFullReviewList', `Starting for ${config.noteTypeTags.toString()} tags:`)

    // Get list of folders, excluding @specials and our foldersToIgnore setting
    const filteredFolderList = getFilteredFolderList(config.foldersToIgnore, true)

    if (runInForeground) {
      CommandBar.showLoading(true, `Generating full Project Review list`)
      await CommandBar.onAsyncThread()
    }

    // Iterate over the folders ...
    // ... but ignoring any in the config.foldersToIgnore list
    const projectInstances = []
    for (const folder of filteredFolderList) {
      // Either we have defined tag(s) to filter and group by, or just use ''
      const tags = (config.noteTypeTags != null && config.noteTypeTags.length > 0)
        ? config.noteTypeTags
        : []

      // Get notes that include noteTag in this folder, ignoring subfolders
      const projectNotesArrArr = findNotesMatchingHashtags(tags, folder, false)
      for (const pnarr of projectNotesArrArr) {
        if (pnarr.length > 0) {
          // Get Project class representation of each note.
          // Save those which are ready for review in projectsReadyToReview array
          for (const n of pnarr) {
            const np = new Project(n)
            // Further check to see whether to exclude archived projects
            // TODO: This will need thought -- does it still make sense?
            // if (config.displayArchivedProjects) {
              projectInstances.push(np)
            // }
          }
        }
      }
    }
    if (runInForeground) {
      await CommandBar.onMainThread()
      CommandBar.showLoading(false)
    }

    // Get machineSummaryLine for each of the projectInstances
    let reviewLines = []
    let lineArrayObjs = []
    logDebug('makeFullReviewList', `- Starting loop for ${projectInstances.length} projectInstances`)
    for (const p of projectInstances) {
      const mSL = p.machineSummaryLine()
      reviewLines.push(mSL)
      const mSLFields = mSL.split('\t')
      lineArrayObjs.push({
        'reviewDays': mSLFields[0],
        'dueDays': mSLFields[1],
        'title': mSLFields[2],
        'folder': mSLFields[3],
        'tags': mSLFields[4],
      })
    }

    // sort the output list by the fields we want, and add frontmatter
    const outputArray = sortAndFormFullReviewList(reviewLines, config)

    // write summary to full-review-list file
    DataStore.saveData(outputArray.join('\n'), fullReviewListFilename, true)
    logDebug(`makeFullReviewList`, `- written ${outputArray.length} lines to ${fullReviewListFilename}`)
    // logFullReviewList()
  }
  catch (error) {
    logError(pluginJson, `makeFullReviewList: ${error.message}`)
  }
}

/**
 * Take a set of machineSummaryLines, sort them according to config, and then add frontmatter
 * @param {Array<string>} linesIn 
 * @param {any} config 
 * @returns {Array<string>} outputArray
 */
function sortAndFormFullReviewList(linesIn: Array<string>, config: any): Array<string> {
  try {
    logDebug('sortAndFormFullReviewList', `Starting with ${linesIn.length} lines`)
    const outputArray = []
    const lineArrayObjs = []

    // Method 3: use DW fieldSorter() function
    // Requires turning each TSV line into an Object (above)
    const sortingSpecification = []
    if (config.displayGroupedByFolder) {
      sortingSpecification.push('folder')
    }
    switch (config.displayOrder) {
      case 'review': {
        sortingSpecification.push('reviewDays')
        break
      }
      case 'due': {
        sortingSpecification.push('dueDays')
        break
      }
      case 'title': {
        sortingSpecification.push('title')
        break
      }
    }

    // turn each TSV string into an object
    for (const line of linesIn) {
      const fields = line.split('\t')
      lineArrayObjs.push({
        'reviewDays': fields[0],
        'dueDays': fields[1],
        'title': fields[2],
        'folder': fields[3],
        'tags': fields[4],
      })
    }

    // Method 2: use lodash _.orderBy() function
    // Requires turning each TSV line into an Object (above)
    // Note: Crashes for some reason neither DW or I can understand.
    // clo(lineArrayObjs, "Before orderBy")
    // if (lineArrayObjs) {
    //   lineArrayObjs = orderBy(lineArrayObjs, ['folder', 'reviewDays'], ['asc', 'asc'])
    //   clo(lineArrayObjs, "After orderBy")
    // }
    // // turn lineArrayObjs back to a TSV string
    // for (let lineObj of lineArrayObjs) {
    //   outputArray.push(lineObj.reviewDays + '\t' + lineObj.dueDays + '\t' + lineObj.title + '\t' + lineObj.folder + '\t' + lineObj.tags)
    // }

    logDebug('sortAndFormFullReviewList', `- sorting by ${String(sortingSpecification)} ...`)
    // FIXME: not working somewhere round here.
    const sortedlineArrayObjs = sortListBy(lineArrayObjs, sortingSpecification)

    // turn each lineArrayObj back to a TSV string
    for (let lineObj of sortedlineArrayObjs) {
      outputArray.push(lineObj.reviewDays + '\t' + lineObj.dueDays + '\t' + lineObj.title + '\t' + lineObj.folder + '\t' + lineObj.tags)
    }

    // Write some metadata to start
    outputArray.unshift("---")
    outputArray.unshift(`key: reviewDays\tdueDays\ttitle\tfolder\ttags`)
    outputArray.unshift(`date: ${moment().format()}`)
    outputArray.unshift("title: full-review-list")
    outputArray.unshift("---")

    return outputArray
  }
  catch (error) {
    logError('sortAndFormFullReviewList', error.message)
    return [] // for completeness
  }
}

// --------------------------------------------------------------------

/**
 * Start a series of project reviews.
 * This starts by generating a new machine-readable list of project-type notes ready
 * for review, ordered by oldest next review date.
 * Then offers to load the first note to review.
 * @author @jgclark
 */
export async function startReviews(): Promise<void> {
  try {
    const config = await getReviewSettings()

    // Make/update list of projects ready for review
    await makeFullReviewList(true)

    // Now offer first review
    const noteToReview = await getNextNoteToReview()
    // Open that note in editor
    if (noteToReview != null) {
      if (config.confirmNextReview) {
        const res = await showMessageYesNo(`Ready to review '${displayTitle(noteToReview)}'?`, ['OK', 'Cancel'])
        if (res !== 'OK') {
          return
        }
      }
      logInfo('startReviews', `Opening '${displayTitle(noteToReview)}' note to review ...`)
      await Editor.openNoteByFilename(noteToReview.filename)
    } else {
      logInfo('startReviews', '🎉 No notes to review!')
      await showMessage('🎉 No notes to review!', 'Great', 'Reviews')
    }
  }
  catch (error) {
    logError('startReviews', error.message)
  }
}

//-------------------------------------------------------------------------------
/**
 * Complete current review, then open the next one to review in the Editor.
 * @author @jgclark
*/
export async function nextReview(): Promise<void> {
  try {
    const config = await getReviewSettings()
    const currentNote = Editor.note
    if (currentNote != null && currentNote.type == 'Notes') {
      logInfo(pluginJson, `nextReview: Starting for ${displayTitle(currentNote)}`)

      // First update @review(date) on current open note
      // Also updates the full-review-list
      const openNote: ?TNote = await finishReview()
    } else {
      logWarn('nextReview', `- There's no project note in the Editor to finish reviewing, so will just go to next review.`)
    }

    // Read review list to work out what's the next one to review
    const noteToReview: ?TNote = await getNextNoteToReview()
    if (noteToReview != null) {
      if (config.confirmNextReview) {
        // Check whether to open that note in editor
        const res = await showMessageYesNo(`Ready to review '${displayTitle(noteToReview)}'?`, ['OK', 'Cancel'])
        if (res !== 'OK') {
          return
        }
      }
      logInfo('nextReview', `- Opening '${displayTitle(noteToReview)}' as nextReview note ...`)
      await Editor.openNoteByFilename(noteToReview.filename)
    } else {
      logInfo('nextReview', `- 🎉 No more notes to review!`)
      await showMessage('🎉 No notes to review!', 'Great', 'Reviews')
    }
  }
  catch (error) {
    logError('nextReview', error.message)
  }
}

//-------------------------------------------------------------------------------
/**
 * Update the full-review-list after completing a review or completing/cancelling a whole project.
 * Note: Called by functions nextReview, completeProject, cancelProject.
 * @author @jgclark
 * @param {string} title of note that has been reviewed
 * @param {boolean} simplyDelete the project line?
 * @param {any} config
 * @param {string?} updatedMachineSummaryLine to write to full-review-list (optional)
 * @param {boolean?} updateDisplay? (default true)
*/
export async function updateReviewListAfterChange(reviewedTitle: string, simplyDelete: boolean, configIn: any, updatedMachineSummaryLine: string = '', updateDisplay: boolean = true): Promise<void> {
  try {
    if (reviewedTitle === '') {
      throw new Error('Empty title passed')
    }
    logInfo('updateReviewListAfterChange', `Updating full-review-list for '${reviewedTitle}' -> ${String(simplyDelete)} / '${updatedMachineSummaryLine}'`)

    // Get contents of full-review-list
    let reviewListContents = DataStore.loadData(fullReviewListFilename, true)
    if (!reviewListContents) {
      // Try to make the full-review-list
      await makeFullReviewList(true)
      reviewListContents = DataStore.loadData(fullReviewListFilename, true)
      if (!reviewListContents) {
        // If still no luck, throw an error
        throw new Error('full-review-list note empty or missing')
      }
    }
    const fileLines = reviewListContents.split('\n')

    // Use front-matter library to get past frontmatter
    const fmObj = fm(reviewListContents)
    let reviewLines = fmObj.body.split('\n')
    // const firstLineAfterFrontmatter = fmObj.bodyBegin - 1

    // Find right line to update
    let thisLineNum: number = NaN
    let thisTitle = ''
    // for (let i = firstLineAfterFrontmatter; i < fileLines.length; i++) {
    for (let i = 0; i < reviewLines.length; i++) {
      // const line = fileLines[i]
      const line = reviewLines[i]
      // check for title match just using field 3
      const titleField = line.split('\t')[2] ?? ''
      if (titleField === reviewedTitle) {
        thisLineNum = i
        thisTitle = reviewedTitle
        logDebug('updateReviewListAfterChange', `- Found '${reviewedTitle}' to update from '${line}' at line number ${i}`)
        break
      }
    }

    // update (or delete) the note's summary in the full-review-list
    // Note: this was ?always? failing at one point
    if (isNaN(thisLineNum)) {
      logWarn('updateReviewListAfterChange', `- Can't find '${reviewedTitle}' to update in full-review-list. Will run makeFullReviewList ...`)
      await makeFullReviewList(false)
      return
    } else {
      if (simplyDelete) {
        // delete line 'thisLineNum'
        reviewLines.splice(thisLineNum, 1)
        const outputLines = sortAndFormFullReviewList(reviewLines, configIn)
        DataStore.saveData(outputLines.join('\n'), fullReviewListFilename, true) // OK to here
        logDebug('updateReviewListAfterChange', `- Deleted '${reviewedTitle}' from line number ${thisLineNum}`)
      } else {
        // update this line in the full-review-list
        reviewLines[thisLineNum] = updatedMachineSummaryLine
        // re-form the file
        const outputLines = sortAndFormFullReviewList(reviewLines, configIn)
        DataStore.saveData(outputLines.join('\n'), fullReviewListFilename, true)
        logDebug('updateReviewListAfterChange', `- Updated '${reviewedTitle}'  line number ${thisLineNum}`)
      }
    }

    // Now we can refresh the rendered views as well
    if (updateDisplay) {
      await renderProjectLists()
    }
  }
  catch (error) {
    logError('updateReviewListAfterChange', error.message)
  }
}

//-------------------------------------------------------------------------------
/** 
 * Work out the next note to review (if any).
 * It assumes the full-review-list is sorted by nextReviewDate (earliest to latest).
 * Note: there is now a multi-note variant of this in jgclark.Dashboard/src/dataGeneration.js
 * @author @jgclark
 * @return { ?TNote } next note to review
 */
async function getNextNoteToReview(): Promise<?TNote> {
  try {
    logDebug('getNextNoteToReview', `Started`)

    // Get contents of full-review-list
    let reviewListContents = DataStore.loadData(fullReviewListFilename, true)
    if (!reviewListContents) {
      // Try to make the full-review-list
      await makeFullReviewList(true)
      reviewListContents = DataStore.loadData(fullReviewListFilename, true)
      if (!reviewListContents) {
        // If still no luck, throw an error
        throw new Error('full-review-list note empty or missing')
      }
    }
    const fileLines = reviewListContents.split('\n')

    // Use front-matter library to get past frontmatter
    const fmObj = fm(reviewListContents)
    const reviewLines = fmObj.body.split('\n')

    // Now read from the top until we find a line with a negative value in the first column (nextReviewDays)
    for (let i = 0; i < reviewLines.length; i++) {
      const thisLine = reviewLines[i]
      const nextReviewDays = Number(thisLine.split('\t')[0]) ?? NaN // get first field = nextReviewDays
      const nextNoteTitle = thisLine.split('\t')[2] // get third field = title
      if (nextReviewDays <= 0) {
        logDebug('getNextNoteToReview', `- Next to review -> '${nextNoteTitle}'`)
        const nextNotes = DataStore.projectNoteByTitle(nextNoteTitle, true, false) ?? []
        return nextNotes[0] // return first matching note
      }
    }

    // If we get here then there are no projects needed for review
    logInfo('getNextNoteToReview', `- No notes left due for review 🎉`)
    return
  }
  catch (error) {
    logError(pluginJson, `getNextNoteToReview: ${error.message}`)
    return
  }
}

//-------------------------------------------------------------------------------
/** 
 * Update the @reviewed(date) in the note in the Editor to today's date, and update the full-review-list too
 * @author @jgclark
 * @return { ?TNote } current note
 */
export async function finishReview(): Promise<?TNote> {
  try {
    const reviewedMentionStr = checkString(DataStore.preference('reviewedMentionStr'))
    const RE_REVIEWED_MENTION_STR = `${reviewedMentionStr}\\(${RE_DATE}\\)`
    const reviewedTodayString = `${reviewedMentionStr}(${getTodaysDateHyphenated()})`
    logDebug('finishReview', reviewedTodayString)

    // only proceed if we're in a valid Project note (with at least 2 lines)
    if (Editor.note == null || Editor.note.type === 'Calendar' || Editor.note.paragraphs.length < 2) {
      logWarn('finishReview', `- We're not in a valid Project note (and with at least 2 lines). Note title = '${Editor.title ?? ''}'`)
      return
    }
    const thisNote = Editor.note

    // To try to work around a problem with updateParagraph() seeming not to flush before the following call, will not try creating the Project equivalent of the note straight away.
    const thisNoteAsProject = new Project(thisNote)

    const metadataLineIndex: number = getOrMakeMetadataLine(thisNote, `<placeholder metadata line> ${reviewedTodayString}`)
    // Re-read paragraphs, as they might have changed
    let metadataPara = thisNote.paragraphs[metadataLineIndex]
    if (!metadataPara) {
      throw new Error(`Couldn't get or make metadataPara for ${displayTitle(thisNote)}`)
    }
    const origMetadataLineContent: string = metadataPara.content
    logDebug(pluginJson, `finishReview: starting with for '${displayTitle(thisNote)}' with metadataLineIndex ${metadataLineIndex} ('${origMetadataLineContent}')`)

    // get first '@reviewed()' on metadata line
    const firstReviewedMention = thisNote.mentions?.find((m) =>
      m.match(RE_REVIEWED_MENTION_STR),
    ) ?? null
    if (firstReviewedMention != null) {
      logDebug('finishReview', `- Found existing ${firstReviewedMention} in line ${metadataLineIndex}`)

      // replace with today's date
      const older = origMetadataLineContent
      const newer = older.replace(firstReviewedMention, reviewedTodayString)
      metadataPara.content = newer
      logDebug('finishReview', `- Updating metadata para to '${newer} and updating reviewedDate in Project()`)
      thisNoteAsProject.reviewedDate = getJSDateStartOfToday()
      thisNoteAsProject.calcDurations()
    } else {
      // no existing @reviewed(date), so append to note's default metadata line
      logDebug('finishReview', `- No matching ${reviewedMentionStr}(date) string found. Will append to line ${metadataLineIndex}.`)
      metadataPara.content = `${origMetadataLineContent} ${reviewedTodayString}`.trimRight()
    }
    // send update to Editor
    thisNote.updateParagraph(metadataPara)
    DataStore.updateCache(Editor.note, true)
    logDebug('finishReview', `- After update ${metadataPara.content}.`)

    // update this note in the review list
    const config = await getReviewSettings()
    const updatedMachineSummaryLine = thisNoteAsProject.machineSummaryLine()
    logDebug('finishReview', `- updatedMachineSummaryLine = '${updatedMachineSummaryLine}'`)
    await updateReviewListAfterChange(thisNote.title ?? '', false, config, updatedMachineSummaryLine, true)
    return thisNote
  }
  catch (error) {
    logError('finishReview', `${error.message}`)
    return null
  }
}

//---------------------------------------------------------------------
// Moved following from projectLists.js to avoid circular dependency
//---------------------------------------------------------------------

/**
 * Decide which of the project list outputs to call (or more than one) based on x-callback args or config.outputStyle.
 * Now includes support for calling from x-callback, using simple "a=b;x=y" version of settings and values that will override ones in the user's settings.
 * @param {string | null} arguments list of form "a=b;x=y"
 */
export async function makeProjectLists(argsIn?: string | null = null): Promise<void> {
  try {
    let args = argsIn?.toString() || ''
    logDebug(pluginJson, `makeProjectLists: starting with args <${args}>`)
    let config = await getReviewSettings()
    if (args !== '') {
      config = overrideSettingsWithStringArgs(config, args)
      // clo(config, 'Review settings updated with args:')
    } else {
      // clo(config, 'Review settings with no args:')
    }

    // If more than a day old re-calculate the full-review-list
    // Note: now updated to always run
    // Using frontmatter library: https://github.com/jxson/front-matter
    // const fileContent = DataStore.loadData(fullReviewListFilename, true) ?? `<error reading ${fullReviewListFilename}>`
    // const fmObj = fm(fileContent)
    // const listUpdatedDate = fmObj.attributes.date
    // const bodyBegin = fmObj.bodyBegin
    // const listUpdatedMoment = new moment(listUpdatedDate)
    // const timeDiff = moment().diff(listUpdatedMoment, 'hours')
    // if (timeDiff >= 24) {
      await makeFullReviewList(true)
    // }

    // Call the relevant function with the updated config
    if (config.outputStyle.match(/rich/i) && NotePlan.environment.buildVersion >= 845) {
      await renderProjectListsHTML(config, true)
    }
    if (config.outputStyle.match(/markdown/i)) {
      await renderProjectListsMarkdown(config, true)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Render the project list, according to the chosen output style.
 * Note: this does not re-calculate the data.
 * @author @jgclark
 */
export async function renderProjectLists(): Promise<void> {
  try {
    logDebug('renderProjectLists', `Started`)
    const config = await getReviewSettings()

    // If we want Markdown display, call the relevant function with config, but don't open up the display window unless already open.
    if (config.outputStyle.match(/markdown/i)) {
      await renderProjectListsMarkdown(config, true)
    }
    if (config.outputStyle.match(/rich/i)) {
      await renderProjectListsHTML(config, true)
    }
  }
  catch (error) {
    logError('renderProjectLists', error.message)
  }
}

/**
 * Re-display the project list from saved HTML file, if available, or if not then render the project list.
 * Note: this does not re-calculate the data.
 * @author @jgclark
 */
export async function redisplayProjectListHTML(): Promise<void> {
  try {
    // Currently only 1 HTML window is allowed
    logWindows()
    // Re-load the saved HTML if it's available.
    const config = await getReviewSettings()
    if (config._logLevel === 'DEBUG') {
      // Try loading HTML saved copy
      const windowTitle = `Review List`
      const filenameHTMLCopy = 'review_list.html'
      const savedHTML = DataStore.loadData(filenameHTMLCopy, true) ?? ''
      if (savedHTML !== '') {
        await showHTML(windowTitle,
          '', // no extra header tags
          savedHTML,
          '', // get general CSS set automatically
          '', // CSS in HTML
          false, // = not modal window
          '',
          '',
          '',
          812, 1200) // set width; max height
        logDebug('redisplayProjectListHTML', `Displayed HTML from saved file ${filenameHTMLCopy}`)
        return
      }
      logDebug('redisplayProjectListHTML', `Couldn't read HTML from saved file ${filenameHTMLCopy}, so will render afresh`)
      await renderProjectListsHTML()
    }
  }
  catch (error) {
    logError('redisplayProjectListHTML', error.message)
  }
}
