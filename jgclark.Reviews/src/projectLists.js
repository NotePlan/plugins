// @flow
//-----------------------------------------------------------------------------
// Commands for producing Project lists
// by @jgclark
// Last updated 14.10.2022 for v0.9.0, @jgclark
//-----------------------------------------------------------------------------
// FIXME: button again ... use the DataStore.invokePluginCommandByName method ?
// TODO: ? add option for kicking off @DW's /overdue for the note?
// TODO: Ignore all @folders automatically
// FIXME: wrong HTML Refresh button code

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
  nowLocaleDateTime,
  RE_DATE,
  toLocaleDateTimeString
} from '@helpers/dateTime'
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

//-----------------------------------------------------------------------------

const fullReviewListFilename = 'full-review-list.md'

export const reviewListCSS: string = [
  '\n/* CSS specific to reviewList() from jgclark.Reviews plugin */\n',
  `@font-face { font-family: "noteplanstate"; src: url('noteplanstate.ttf') format('truetype'); }`, // local font that needs to be in the plugin's bundle
  'table { font-size: 0.9rem;', // make text a little smaller
  '  border-collapse: collapse;', // always!
  '  empty-cells: show; }',
  '.sticky-row { position: sticky; top: 0; }', // Keep a header stuck to top of window
  'th { text-align: left; padding: 4px; border-left: 0px solid var(--tint-color); border-right: 0px solid var(--tint-color); border-bottom: 1px solid var(--tint-color); }', // // removed L-R borders for now
  'th td:first-child {text-align: center;}',
  'td.new-section-header { color: var(--h3-color); padding-top: 1.0rem; font-size: 1.0rem; font-weight: bold }',
  'td { padding: 4px; border-left: 0px solid var(--tint-color); border-right: 0px solid var(--tint-color); }', // removed L-R borders for now
  // 'table tbody tr:first-child { border-top: 1px solid var(--tint-color); }', // turn on tbody section top border -- now set in main CSS
  // 'table tbody tr:last-child { border-bottom: 1px solid var(--tint-color); }', // turn on tbody section bottom border -- now set in main CSS
  'table tr td:first-child, table tr th:first-child { border-left: 0px; }', // turn off outer table right borders
  'table tr td:last-child, table tr th:last-child { border-right: 0px; }', // turn off outer table right borders
  'a, a:visited, a:active { color: inherit }', // note links: turn off text color
  // 'a:hover { }', // perhaps use hover for note links
  // 'button { font-size: 1.0rem; font-weight: 500; }',
  // '.top-right-fix { position: fixed; top: 3rem; right: 2rem; }', // a top-right fixed position, even when scrolled
  '.noteTitle { font-weight: 700; }', // make noteTitles bold
  '.checkbox { font-family: "noteplanstate"; font-size: 1.4rem; }', // make checkbox display larger, and like in the app
  '.np-task-state { font-family: "noteplanstate"; }', // use special 'noteplanstate' font
  '.percent-ring { width: 2rem; height: 2rem; }', // Set size of percent-display rings
  '.percent-ring-circle { transition: 0.5s stroke-dashoffset; transform: rotate(-90deg); transform-origin: 50% 50%; }', // details of ring-circle that can be set in CSS
  '.circle-percent-text { font-family: "Avenir Next"; font-size: 2.2rem; font-weight: 600; color: var(--fg-main-color); }', // details of ring text that can be set in CSS
  '.circle-char-text { font-size: 1.9rem; font-family: "noteplanstate" }' // details of ring text that can be set in CSS, including font, locally set above
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
 * @param {boolean} openOutputWindow if not already open? Note: Currently can't honour this request.
 */
export async function renderProjectListsHTML(config: any, openOutputWindow: boolean = true): Promise<void> {
  try {
    // Check to see if we're running v3.6.2, build 844) or later
    if (NotePlan.environment.buildVersion <= 844) {
      await showMessage('Sorry: need to be running NP 3.6.2 or later', 'Shame', "Sorry, Dave, I can't do that.")
      return
    }

    logDebug('renderProjectListsHTML', `starting for ${config.noteTypeTags.toString()} tags and openOutputWindow: ${String(openOutputWindow)}`)

    if (config.noteTypeTags.length > 0) {
      // We have defined tag(s) to filter and group by
      // Need to change a single string (1 tag) to an array (multiple tags)
      if (typeof config.noteTypeTags === 'string') config.noteTypeTags = [config.noteTypeTags]

      // FIXME: This needs to collect all tags before showHTML call
      for (const tag of config.noteTypeTags) {
        // handle #hashtags in the note title (which get stripped out by NP, it seems)
        const tagWithoutHash = tag.replace('#', '')
        const windowTitle = `${tag} Review List`
        const filenameHTMLCopy = `${tagWithoutHash}_list.html`

        // Make the Summary list(s)
        const outputArray = await generateReviewSummaryLines(tag, 'Rich', config)
        outputArray.unshift(`<h1>${windowTitle}</h1>`)

        // Display the list(s) as HTML
        // TODO: when possible from the API, honour the 'openOutputWindow' direction
        await showHTML(
          windowTitle,
          '', // no extra header tags
          outputArray.join('\n'),
          '', // = set general CSS from current theme
          reviewListCSS,
          false, // = not modal window
          setPercentRingJSFunc,
          makeCommandCall(startReviewsCommandCall),
          filenameHTMLCopy,
          1800, 9999) // set width; max height
        logDebug('renderProjectListsHTML', `- written results to HTML`)
      }
    } else {
      // We will just use all eligible project notes in one group
      const windowTitle = `Review List`
      const filenameHTMLCopy = `review_list.html`

      // Make the Summary list
      const outputArray = await generateReviewSummaryLines('', 'Rich', config)
      outputArray.unshift(`<h1>${windowTitle}</h1>`)

      // Show the list as HTML, and save a copy as file
      await showHTML(windowTitle,
        '', // no extra header tags
        outputArray.join('\n'),
        '', // get general CSS set automatically
        reviewListCSS,
        false, // = not modal window
        setPercentRingJSFunc,
        makeCommandCall(startReviewsCommandCall),
        filenameHTMLCopy,
        1800, 9999) // set width; max height
      logDebug('renderProjectListsHTML', `- written results to HTML window and file`)
    }
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
 * @param {boolean} openOutputWindow if not already open?
 */
export async function renderProjectListsMarkdown(config: any, openOutputWindow: boolean = true): Promise<void> {
  try {
    logDebug('renderProjectListsMarkdown', `Starting for ${config.noteTypeTags.toString()} tags and openOutputWindow: ${String(openOutputWindow)}`)

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
          // Calculate the Summary list(s)
          const outputArray = await generateReviewSummaryLines(tag, 'Markdown', config)
          outputArray.unshift(`# ${noteTitle}`)

          // Save the list(s) to this note
          note.content = outputArray.join('\n')
          logDebug('renderProjectListsMarkdown', `- written results to note '${noteTitle}'`)
          // Open the note in a new window (if wanted)
          if (openOutputWindow) {
            // TODO(@EduardMe): Ideally not open another copy of the note if its already open. But API doesn't support this yet.
            await Editor.openNoteByFilename(note.filename, true, 0, 0, false, false)
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
        const outputArray = await generateReviewSummaryLines('', 'Markdown', config)
        outputArray.unshift(`# ${noteTitle}`)

        // Save the list(s) to this note
        note.content = outputArray.join('\n')
        logInfo('renderProjectListsMarkdown', `- written results to note '${noteTitle}'`)
        // Open the note in a new window (if wanted)
        if (openOutputWindow) {
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
 * Return summary of notes that contain a particular tag, for all relevant folders, in 'Markdown' or 'Rich' style
 * V2: Changed to read from the TSV file 'data/full-review-list.md' folder rather than calcuate from scratch.
 * @author @jgclark
 * 
 * @param {string} noteTag - hashtag to look for
 * @param {string} style - 'Markdown' or 'Rich'
 * @param {any} config - from settings (and any passed args)
 * @returns {Array<string>} output summary lines
 */
async function generateReviewSummaryLines(noteTag: string, style: string, config: any): Promise<Array<string>> {
  try {
    logDebug('generateReviewSummaryLines', `Starting for tag(s) '${noteTag}' in ${style} style`)

    let noteCount = 0
    let overdue = 0
    const outputArray: Array<string> = []

    // V1 approach

    // const filteredFolderList = getFilteredFolderList(config.foldersToIgnore)
    // logDebug('generateReviewSummaryLines', `- for ${filteredFolderList.length} folders: '${String(filteredFolderList)}'`)
    // if we want a summary broken down by folder, create list of folders
    // otherwise use a single folder

    // // Iterate over the folders (ignoring any in the pref_foldersToIgnore list)
    // const fflInitLength = filteredFolderList.length
    // CommandBar.showLoading(true, `Summarising ${noteTag} in ${fflInitLength} folders`)
    // await CommandBar.onAsyncThread()

    // const startTime = new Date()
    // let processed = 0
    // for (let fflCounter = 0; fflCounter < filteredFolderList.length; fflCounter++) {
    //   const folder = filteredFolderList[fflCounter]
    //   // Get notes that include noteTag in this folder, ignoring subfolders
    //   // and ignoring projects with '#archive' if wanted
    //   const notes = findNotesMatchingHashtag(noteTag, folder, false, config.displayArchivedProjects ? '' : '#archive')
    //   if (notes.length > 0) {
    //     logDebug('generateReviewSummaryLines', `${notes.length} found in ${folder} (index ${fflCounter})).`)

    //     // Create array of Project class representation of each note,
    //     // ignoring any in a folder we want to ignore (by one of the settings)
    //     const projects = []

    //     for (const note of notes) {
    //       const np = new Project(note)
    //       // Further check to see whether to exclude archived projects
    //       if (!np.isArchived || config.displayArchivedProjects) {
    //         projects.push(np)
    //       } else {
    //         logDebug('generateReviewSummaryLines', `${np.title} ignored as it is archived`)
    //       }
    //       // Count up the number of notes to review
    //       if (np.isActive && np.nextReviewDays != null && np.nextReviewDays <= 0) {
    //         overdue += 1
    //       }
    //     }
    //     // sort this array by key set in config.displayOrder
    //     let sortedProjects = []
    //     // NB: the Compare function needs to return negative, zero, or positive values.
    //     switch (config.displayOrder) {
    //       case 'due': {
    //         sortedProjects = projects.sort(
    //           (first, second) => (first.dueDays ?? 0) - (second.dueDays ?? 0))
    //         break
    //       }
    //       case 'review': {
    //         sortedProjects = projects.sort(
    //           (first, second) => (first.nextReviewDays ?? 0) - (second.nextReviewDays ?? 0))
    //         break
    //       }
    //       default: { // = title
    //         sortedProjects = projects.sort(
    //           (first, second) => (first.title ?? '').localeCompare(second.title ?? ''))
    //         break
    //       }
    //     }
    //
    //     // Write new folder header
    //     if (config.displayGroupedByFolder) {
    //       if (style === 'Markdown') {
    //         outputArray.push(`### ${(folder !== '' ? folder : '(root folder)')} (${sortedProjects.length} notes)`)
    //       } else {
    //         outputArray.push(`</tbody>\n\n<tr><td class="new-section-header" colspan="100%">${(folder !== '' ? folder : '(root folder)')} (${sortedProjects.length} notes)</td></tr>\n<tbody>`)
    //       }
    //     }

    //     // iterate over this folder's notes, using the Class's functions
    //     for (const p of sortedProjects) {
    //       outputArray.push(p.detailedSummaryLine(style, false, config.displayDates, config.displayProgress))
    //     }
    //     noteCount += sortedProjects.length

    //   } else {
    //     logDebug('generateReviewSummaryLines', `0 notes found in ${fflCounter}=${folder} for '${noteTag}'. Will remove it from folder list.`)
    //     filteredFolderList.splice(fflCounter, 1)
    //     fflCounter--
    //   }
    //   processed++
    //   CommandBar.showLoading(true, `Summarising ${noteTag} in ${fflInitLength} folders`, (processed / fflInitLength))
    // }
    // await CommandBar.onMainThread()
    // CommandBar.showLoading(false)
    // logDebug('generateReviewSummaryLines', `${processed} notes reviewed in ${timer(startTime)}s`)

    // V2 Approach

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

    // Now ignore frontmatter and sort rest by days before next review (first column), ignoring those for a different noteTag than we're after.
    const fmObj = fm(reviewListContents)
    const reviewLines = fmObj.body.split('\n').filter((f) => f.match(noteTag))

    // Split each TSV line into its parts
    let lastFolder = ''
    for (let thisLine of reviewLines) {
      const fields = thisLine.split('\t')
      // logDebug('generateReviewSummaryLines', `  - ${fields.length} fields`)
      const title = fields[2]
      const folder = (fields[3] !== '' ? fields[3] : '(root folder)')
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
          outputArray.push(`</tbody>\n\n<tr><td class="new-section-header" colspan="100%">${folder}</td></tr>\n<tbody>`)
        }
        else if (style.match(/markdown/i)) {
          outputArray.push(`### ${folder}`)
        }
      }

      outputArray.push(out)
      noteCount++

      lastFolder = folder
    }

    // Set up x-callback URLs for various commands, to be styled into pseudo-buttons
    const startReviewXCallbackURL = "noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=next%20project%20review"
    const reviewedXCallbackURL = "noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=finish%20project%20review&arg0="
    const nextReviewXCallbackURL = "noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=next%20project%20review&arg0="
    const completeXCallbackURL = "noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=complete%20project&arg0="
    const cancelXCallbackURL = "noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=cancel%20project&arg0="
    const refreshXCallbackURL = `noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=project%20lists&arg0=` + encodeURIComponent(`noteTypeTags=${noteTag};outputStyle=${style}`)
    const nowDateTime = toLocaleDateTimeString(new Date())

    if (style.match(/rich/i)) {
      // Create the HTML for the 'start review button'
      // - Version 1: does work inside Safari, but not for some reason in a NP view. Eduard doesn't know why.
      // startReviewButton = `<button onClick="noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews\&command=next%20project%20review">Start reviewing ${overdue} ready for review</button>`
      // - Version 2: using x-callback: does work in NP, but doesn't look like a button
      const startReviewButton = `<span class="fake-button"><a class="button" href="${startReviewXCallbackURL}">Start reviewing ${overdue} ready for review</a></span>`
      // - Version 3: using proper link to the internal function FIXME: doesn't yet work
      // startReviewButton = `<button onclick=callCommand()>Start reviewing ${overdue} ready for review</button>`

      // Add (pseduo-)buttons for various commands
      // Webdings: refresh icon ~ glyph 80
      const refreshXCallbackButton = `<span class="fake-button"><a class="button" href="${refreshXCallbackURL}">🔄 Refresh</a></span>`
      const reviewedXCallbackButton = `<span class="fake-button"><a class="button" href="${reviewedXCallbackURL}">Finish Project Review</a></span>`
      const nextReviewXCallbackButton = `<span class="fake-button"><a class="button" href="${nextReviewXCallbackURL}">Finish + Next Review</a></span>`
      const completeXCallbackButton = `<span class="fake-button"><a class="button" href="${completeXCallbackURL}"><span class="np-task-state">a</span> Complete Project</a></span>` // includes NP complete 'a' glyph
      const cancelXCallbackButton = `<span class="fake-button"><a class="button" href="${cancelXCallbackURL}"><span class="np-task-state">c</span> Cancel Project</a></span>` // includes NP cancel 'c' glyph

      // writing backwards to suit .unshift
      outputArray.unshift(`<p>For project note in main window: ${reviewedXCallbackButton} ${nextReviewXCallbackButton} ${completeXCallbackButton} ${cancelXCallbackButton}</p>`)
      outputArray.unshift(Project.detailedSummaryLineHeader(style, config.displayDates, config.displayProgress))
      outputArray.unshift('\n<table>')
      if (!config.displayGroupedByFolder) {
        outputArray.unshift(`<h3>All folders (${noteCount} notes)</h3>`)
      }
      outputArray.unshift(`<p>Total ${noteCount} active notes${(overdue > 0) ? `: ${startReviewButton}` : '.'} Last updated: ${nowDateTime} <span class="fake-button">${refreshXCallbackButton}</span></p>`)

      // TODO: in time make a 'timeago' relative display, e.g. using MOMENT moment.duration(-1, "minutes").humanize(true); // a minute ago
      // or https://www.jqueryscript.net/time-clock/Relative-Timestamps-Update-Plugin-timeago.html or https://theprogrammingexpert.com/javascript-count-up-timer/

      // Close out HTML table
      outputArray.push('</tbody>')
      outputArray.push('</table>')
    }
    else if (style.match(/markdown/i)) {
      const startReviewButton = `[Start reviewing ${overdue} ready for review](${startReviewXCallbackURL})`
      const refreshXCallbackButton = `[🔄 Refresh](${refreshXCallbackURL})`
      const reviewedXCallbackButton = `[Finish Project Review](${reviewedXCallbackURL})`
      const nextReviewXCallbackButton = `[Finish + Next Review](${nextReviewXCallbackURL})`
      const completeXCallbackButton = `[Complete Project](${completeXCallbackURL})`
      const cancelXCallbackButton = `[Cancel Project](${cancelXCallbackURL})`

      if (noteCount > 0) { // print header just the once (if any notes)
        // Note: can't put reviewed/complete/cancel buttons here yet, because there's no way to be clear about which project they refer to. TODO: find a way round this in time.
        // outputArray.unshift(`${reviewedXCallbackButton} ${nextReviewXCallbackButton} ${completeXCallbackButton} ${cancelXCallbackButton}`)
        outputArray.unshift(Project.detailedSummaryLineHeader(style, config.displayDates, config.displayProgress))
      }
      outputArray.unshift(`Total ${noteCount} active notes${(overdue > 0) ? `: **${startReviewButton}**` : '.'} Last updated: ${nowDateTime} ${refreshXCallbackButton}`)
      if (!config.displayGroupedByFolder) {
        outputArray.unshift(`### All folders (${noteCount} notes)`)
      }
    }
    return outputArray
  }
  catch (error) {
    logError('generateReviewSummaryLines', `${error.message}`)
    return [] // for completeness
  }
}
