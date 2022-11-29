// @flow
//-----------------------------------------------------------------------------
// Commands for producing Project lists
// by @jgclark
// Last updated 17.11.2022 for v0.8.0+, @jgclark
//-----------------------------------------------------------------------------
// FIXME: button again ... use the DataStore.invokePluginCommandByName method ?
// TODO: add option for kicking off /overdue for the note?
// TODO: Ignore all @folders automatically

import pluginJson from "../plugin.json"
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
import { clo, JSP, logDebug, logError, logInfo, logWarn, overrideSettingsWithStringArgs, timer } from '@helpers/dev'
import {
  getFilteredFolderList,
} from '@helpers/folders'
import { displayTitle } from '@helpers/general'
import { makeSVGPercentRing, redToGreenInterpolation, showHTML } from '@helpers/HTMLView'
import {
  findNotesMatchingHashtag,
  findNotesMatchingHashtags,
  getOrMakeNote,
} from '@helpers/note'
import { getOrMakeMetadataLine } from '@helpers/NPparagraph'
import {
  showMessage,
  showMessageYesNo,
} from '@helpers/userInput'

//-----------------------------------------------------------------------------

export const reviewListCSS: string = [
  '\n/* CSS specific to reviewList() from jgclark.Reviews plugin */\n',
  `@font-face { font-family: "noteplanstate"; src: url('noteplanstate.ttf') format('truetype'); }`, // local font that needs to be in the plugin's bundle
  'table { font-size: 0.9rem;', // make text a little smaller
  '  border-collapse: collapse;', // always!
  '  empty-cells: show; }',
  '.sticky-row { position: sticky; top: 0; }', // Keep a header stuck to top of window
  'th { text-align: left; padding: 4px; border-left: 0px solid --tint-color; border-right: 0px solid --tint-color; border-bottom: 1px solid --tint-color; }', // // removed L-R borders for now
  'th td:first-child {text-align: center;}',
  'td.new-section-header { color: --h3-color; padding-top: 1.0rem; font-size: 1.0rem; font-weight: bold }',
  'td { padding: 4px; border-left: 0px solid --tint-color; border-right: 0px solid --tint-color; }', // removed L-R borders for now
  // 'table tbody tr:first-child { border-top: 1px solid --tint-color; }', // turn on tbody section top border -- now set in main CSS
  // 'table tbody tr:last-child { border-bottom: 1px solid --tint-color; }', // turn on tbody section bottom border -- now set in main CSS
  'table tr td:first-child, table tr th:first-child { border-left: 0px; }', // turn off outer table right borders
  'table tr td:last-child, table tr th:last-child { border-right: 0px; }', // turn off outer table right borders
  'a, a:visited, a:active { color: inherit }', // note links: turn off text color
  // 'a:hover { }', // perhaps use hover for note links
  // 'button { font-size: 1.0rem; font-weight: 500; }',
  // '.top-right-fix { position: fixed; top: 3rem; right: 2rem; }', // a top-right fixed position, even when scrolled
  '.noteTitle { font-weight: 700; }', // make noteTitles bold
  '.checkbox { font-family: "noteplanstate"; font-size: 1.4rem; }', // make checkbox display larger, and like in the app
  '.percent-ring { width: 2rem; height: 2rem; }', // Set size of percent-display rings
  '.percent-ring-circle { transition: 0.5s stroke-dashoffset; transform: rotate(-90deg); transform-origin: 50% 50%; }', // details of ring-circle that can be set in CSS
  '.circle-percent-text { font-family: "Avenir Next"; font-size: 2.2rem; font-weight: 700; color: --fg-main-color; }', // details of ring text that can be set in CSS
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
 * Decide which of the project list outputs to call (or more than one) based on x-callback args or config.outputStyle.
 * Now includes support for calling from x-callback, using simple "a=b;x=y" version of settings and values that will override ones in the user's settings.
 */
export async function makeProjectLists(argsIn?: string | null = null): Promise<void> {
  try {
    let args = argsIn?.toString() || ''
    logDebug('makeProjectLists', `starting with args <${args}>`)
    let config = await getReviewSettings()
    if (args !== '') {
      config = overrideSettingsWithStringArgs(config, args)
      clo(config, 'Review settings updated with args:')
    } else {
      clo(config, 'Review settings with no args:')
    }

    // Call the relevant function with the updated config
    if (config.outputStyle.match(/rich/i) && NotePlan.environment.buildVersion >= 845) {
      await makeProjectListsHTML(config)
    }
    if (config.outputStyle.match(/markdown/i)) {
      await makeProjectListsMarkdown(config)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export function redisplayProjectListHTML(): void {
  // Placeholder for now
}

export function redisplayProjectListMarkdown(): void {
  // Placeholder for now
}

/**
 * Generate human-readable lists of project notes for each tag of interest using HTML output. 
 * Note: Requires NP 3.7.0 (build 844) or greater.
 * @author @jgclark
 * @param {any} config - from settings (and any passed args)
 */
export async function makeProjectListsHTML(config: any): Promise<void> {
  try {
    // Check to see if we're running v3.6.2, build 844) or later
    if (NotePlan.environment.buildVersion <= 844) {
      await showMessage('Sorry: need to be running NP 3.6.2 or later', 'Shame', "Sorry, Dave, I can't do that.")
      return
    }

    const style = 'HTML'

    logDebug(pluginJson, `makeProjectListsHTML: starting for ${config.noteTypeTags.toString()} tags`)

    if (config.noteTypeTags.length > 0) {
      // We have defined tag(s) to filter and group by
      // Need to change a single string (1 tag) to an array (multiple tags)
      if (typeof config.noteTypeTags === 'string') config.noteTypeTags = [config.noteTypeTags]
      for (const tag of config.noteTypeTags) {
        // handle #hashtags in the note title (which get stripped out by NP, it seems)
        const tagWithoutHash = tag.replace('#', '')
        const noteTitle = `${tag} Review List`
        const noteTitleWithoutHash = `${tagWithoutHash}_list.html`

        // Do the main work
        // Calculate the Summary list(s)
        const outputArray = await makeNoteTypeSummary(tag, style, config)
        outputArray.unshift(`<h1>${noteTitle}</h1>`)

        // Display the list(s) as HTML
        logDebug(pluginJson, `- writing results to HTML output ...`)
        await showHTML(
          noteTitle,
          '', // no extra header tags
          outputArray.join('\n'),
          '', // = set general CSS from current theme
          reviewListCSS,
          false, // = not modal window
          setPercentRingJSFunc,
          makeCommandCall(startReviewsCommandCall),
          noteTitleWithoutHash) // not giving window dimensions
        logDebug(pluginJson, `- written results to HTML`)
      }
    } else {
      // We will just use all eligible project notes in one group
      const title = `Review List`
      const noteTitle = `Review List.html`
      // Calculate the Summary list(s)
      const outputArray = await makeNoteTypeSummary('', style, config)
      outputArray.unshift(`<h1>${noteTitle}</h1>`)

      // Show the list(s) as HTML, and save a copy as file
      logDebug(pluginJson, `- writing results to HTML output ...`)
      await showHTML(title,
        '', // no extra header tags
        outputArray.join('\n'),
        '', // get general CSS set automatically
        reviewListCSS,
        false, // = not modal window
        '',
        '',
        noteTitle) // not giving window dimensions
      logDebug(pluginJson, `written results to HTML`)
    }
  }
  catch (error) {
    logError(pluginJson, `makeProjectLists: ${error.message}`)
  }
}

/**
 * Generate human-readable lists of project notes in markdown for each tag of interest
 * and write out to note(s) in the config.folderToStore folder.
 * @author @jgclark
 * @param {any} config - from settings (and any passed args)
 */
export async function makeProjectListsMarkdown(config: any): Promise<void> {
  try {
    const style = 'markdown'
    logDebug(pluginJson, `makeProjectLists: starting for ${config.noteTypeTags.toString()} tags`)

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
          const outputArray = await makeNoteTypeSummary(tag, style, config)
          outputArray.unshift(`# ${noteTitle}`)

          // Save the list(s) to this note
          note.content = outputArray.join('\n')
          logDebug(pluginJson, `- written results to note '${noteTitle}'`)
          // Open the note in a new window
          // TODO(@EduardMe): Ideally not open another copy of the note if its already open. But API doesn't support this yet.
          await Editor.openNoteByFilename(note.filename, true, 0, 0, false, false)
        } else {
          await showMessage('Oops: failed to find or make project summary note', 'OK')
          logError(pluginJson, "Shouldn't get here -- no valid note to write to!")
          return
        }
      }
    } else {
      // We will just use all notes with a @review() string, in one go     
      const noteTitle = `Review List`
      const note: ?TNote = await getOrMakeNote(noteTitle, config.folderToStore)
      if (note != null) {
        // Calculate the Summary list(s)
        const outputArray = await makeNoteTypeSummary('', style, config)
        outputArray.unshift(`# ${noteTitle}`)

        // Save the list(s) to this note
        note.content = outputArray.join('\n')
        logInfo(pluginJson, `written results to note '${noteTitle}'`)
        // Open the note in a new window
        // TODO(@EduardMe): Ideally not open another copy of the note if its already open. But API doesn't support this yet.
        await Editor.openNoteByFilename(note.filename, true, 0, 0, false, false)
      } else {
        await showMessage('Oops: failed to find or make project summary note', 'OK')
        logError(pluginJson, "Shouldn't get here -- no valid note to write to!")
        return
      }
    }
  }
  catch (error) {
    logError(pluginJson, `makeProjectLists: ${error.message}`)
  }
}

//-------------------------------------------------------------------------------
/** 
 * Return summary of notes that contain a particular tag, for all relevant folders
 * TODO: Change to write to intermediate TSV file in data/ folder that will be used by one/more renderers.
 * @author @jgclark
 * 
 * @param {string} noteTag - hashtag to look for
 * @param {string} style - 'markdown' or 'HTML'
 * @param {any} config - from settings (and any passed args)
 * @returns {Array<string>} summary lines to write out to a note
 */
async function makeNoteTypeSummary(noteTag: string, style: string, config: any): Promise<Array<string>> {
  try {
    logDebug('makeNoteTypeSummary', `Starting for '${noteTag}' in ${style} style`)

    const filteredFolderList = getFilteredFolderList(config.foldersToIgnore)
    logDebug('makeNoteTypeSummary', `- for ${filteredFolderList.length} folders: '${String(filteredFolderList)}'`)

    let noteCount = 0
    let overdue = 0
    const outputArray: Array<string> = []

    // if we want a summary broken down by folder, create list of folders
    // otherwise use a single folder

    // Iterate over the folders (ignoring any in the pref_foldersToIgnore list)
    const fflInitLength = filteredFolderList.length
    CommandBar.showLoading(true, `Summarising ${noteTag} in ${fflInitLength} folders`)
    await CommandBar.onAsyncThread()

    const startTime = new Date()
    let processed = 0
    for (let fflCounter = 0; fflCounter < filteredFolderList.length; fflCounter++) {
      const folder = filteredFolderList[fflCounter]
      // Get notes that include noteTag in this folder, ignoring subfolders
      // and ignoring projects with '#archive' if wanted
      const notes = findNotesMatchingHashtag(noteTag, folder, false, config.displayArchivedProjects ? '' : '#archive')
      if (notes.length > 0) {
        logDebug('makeNoteTypeSummary', `${notes.length} found in ${folder} (index ${fflCounter})).`)

        // Create array of Project class representation of each note,
        // ignoring any in a folder we want to ignore (by one of the settings)
        const projects = []

        for (const note of notes) {
          const np = new Project(note)
          // Further check to see whether to exclude archived projects
          if (!np.isArchived || config.displayArchivedProjects) {
            projects.push(np)
          } else {
            logDebug('makeNoteTypeSummary', `${np.title} ignored as it is archived`)
          }
          if (np.nextReviewDays != null && np.nextReviewDays < 0) {
            overdue += 1
          }
        }
        // sort this array by key set in config.displayOrder
        let sortedProjects: Array<Project> = []
        // NB: the Compare function needs to return negative, zero, or positive values. 
        switch (config.displayOrder) {
          case 'due': {
            sortedProjects = projects.sort(
              (first, second) => (first.dueDays ?? 0) - (second.dueDays ?? 0))
            break
          }
          case 'review': {
            sortedProjects = projects.sort(
              (first, second) => (first.nextReviewDays ?? 0) - (second.nextReviewDays ?? 0))
            break
          }
          default: { // = title
            sortedProjects = projects.sort(
              (first, second) => (first.title ?? '').localeCompare(second.title ?? ''))
            break
          }
        }

        // Write new folder header
        // FIXME: Sort better displauy for / root
        if (config.displayGroupedByFolder) {
          if (style === 'markdown') {
            outputArray.push(`### ${(folder !== '' ? folder : '/')} (${sortedProjects.length} notes)`)
          } else {
            outputArray.push(`</tbody>\n\n<tr><td class="new-section-header" colspan="100%">${(folder !== '' ? folder : '/')} (${sortedProjects.length} notes)</td></tr>\n<tbody>`)
          }
        }

        // iterate over this folder's notes, using the Class's functions
        for (const p of sortedProjects) {
          outputArray.push(p.detailedSummaryLine(style, false, config.displayDates, config.displayProgress))
        }
        noteCount += sortedProjects.length

      } else {
        logDebug('makeNoteTypeSummary', `0 notes found in ${fflCounter}=${folder} for '${noteTag}'. Will remove it from folder list.`)
        filteredFolderList.splice(fflCounter, 1)
        fflCounter--
      }
      processed++
      CommandBar.showLoading(true, `Summarising ${noteTag} in ${fflInitLength} folders`, (processed / fflInitLength))
    }
    await CommandBar.onMainThread()
    CommandBar.showLoading(false)
    logDebug('makeNoteTypeSummary', `${processed} notes reviewed in ${timer(startTime)}s`)

    // Add summary/ies and 'start review' and 'refresh' buttons onto the start (remember: unshift adds to the very front each time)
    let startReviewButton = ''
    let refreshXCallbackButton = ''
    let args = ''
    const nowDateTime = toLocaleDateTimeString(new Date())
    switch (style) {
      case 'HTML':
        // Create the HTML for the 'start review button'
        // - Version 1: does work inside Safari, but not for some reason in a NP view. Eduard doesn't know why.
        // startReviewButton = `<button onClick="noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews\&command=next%20project%20review">Start reviewing ${overdue} ready for review</button>`
        // - Version 2: using x-callback: does work in NP, but doesn't look like a button
        startReviewButton = `<a class="button" href="noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=next%20project%20review">Start reviewing ${overdue} ready for review</a>`
        // - Version 3: using proper link to the internal function FIXME: doesn't yet work
        // startReviewButton = `<button onclick=callCommand()>Start reviewing ${overdue} ready for review</button>`

        // Add (pseduo-)button for Refresh
        args = encodeURIComponent(`noteTypeTags=${noteTag};outputStyle=Rich`)
        refreshXCallbackButton = `<a href="noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=project%20lists&arg0=${args}">🔄 Refresh</a>`

        // writing backwards to suit .unshift
        outputArray.unshift(Project.detailedSummaryLineHeader(style, config.displayDates, config.displayProgress))
        outputArray.unshift('\n<table>')
        if (!config.displayGroupedByFolder) {
          outputArray.unshift(`<h3>All folders (${noteCount} notes)</h3>`)
        }
        outputArray.unshift(`<p>Total ${noteCount} active notes${(overdue > 0) ? `: <span class="fake-button">${startReviewButton}</span>` : '.'} Last updated: ${nowDateTime} <span class="fake-button">${refreshXCallbackButton}</span></p>`)

        // TODO: in time make a 'timeago' relative display, e.g. using https://www.jqueryscript.net/time-clock/Relative-Timestamps-Update-Plugin-timeago.html or https://theprogrammingexpert.com/javascript-count-up-timer/
        break

      default: // include 'markdown'
        startReviewButton = `[Start reviewing ${overdue} ready for review](noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=next%20project%20review)`
        args = encodeURIComponent(`noteTypeTags=${noteTag};outputStyle=Markdown`)
        refreshXCallbackButton = `[🔄 Refresh](noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=project%20lists&arg0=${args})`

        if (noteCount > 0) { // print just the once
          outputArray.unshift(Project.detailedSummaryLineHeader(style, config.displayDates, config.displayProgress))
        }
        outputArray.unshift(`Total ${noteCount} active notes${(overdue > 0) ? `: **${startReviewButton}**` : '.'} Last updated: ${nowDateTime} ${refreshXCallbackButton}`)
        if (!config.displayGroupedByFolder) {
          outputArray.unshift(`### All folders (${noteCount} notes)`)
        }
        break
    }
    // Close out HTML table
    if (style === 'HTML') {
      outputArray.push('</tbody>')
      outputArray.push('</table>')
    }
    return outputArray
  }
  catch (error) {
    logError('makeNoteTypeSummary', `${error.message}`)
    return []
  }
}
