// @flow
//-----------------------------------------------------------------------------
// Commands for producing Project lists
// by @jgclark
// Last updated 13.9.2022 for v0.8.0-beta, @jgclark
//-----------------------------------------------------------------------------

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
} from '@helpers/dateTime'
import { logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import {
  filterFolderList,
} from '@helpers/folders'
import { displayTitle } from '@helpers/general'
import { showHTML } from '@helpers/HTMLView'
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

const reviewListCSS = [
  '',
  '/* CSS specific to reviewList() from jgclark.Reviews plugin */',
  `@font-face {
  font-family: "noteplanstate";
  src: url('noteplanstate.ttf') format('truetype');
}`, // local font that needs to be in the plugin's bundle
  'table { font-size: 0.9rem;', // make text a little smaller
  '\tborder-collapse: collapse;', // always!
  '\tempty-cells: show; }',
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
  'a:hover { }', // perhaps use hover for note links
  'button { font-size: 1.0rem; font-weight: bold; }',
  '.checkbox { font: "noteplanstate", font-size: 1.4rem; }', // make checkbox display larger, and like in the app
  '.percent-ring { width: 2rem; height: 2rem; }', // Set size of percent-display rings
  '.percent-ring-circle { transition: 0.5s stroke-dashoffset; transform: rotate(-90deg); transform-origin: 50% 50%; }', // details of ring-circle that can be set in CSS
  '.circle-percent-text { font-size: 2.2rem; color: --fg-main-color; }', // details of ring text that can be set in CSS
  '.circle-char-text { font-size: 1.9rem; font-family: "noteplanstate" }' // details of ring text that can be set in CSS, including font, locally set above
].join('\n\t')

const setPercentRingJSFunc = `
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
  `
/**
 * Decide which of the project list outputs to call.
 */
export async function makeProjectLists(): Promise<void> {
  const config = await getReviewSettings()
  if (config.outputStyle === 'Rich' && NotePlan.environment.buildVersion >= 845) {
    await makeProjectListsHTML()
  } else {
    await makeProjectListsMarkdown()
  }
}

/**
 * Generate human-readable lists of project notes for each tag of interest
 * using temporary HTML output. 
 * Note: Requires NP 3.6.2 (build 844) or greater.
 * @author @jgclark
 */
export async function makeProjectListsHTML(): Promise<void> {
  try {
    // Check to see if we're running v3.6.2, build 844) or later
    if (NotePlan.environment.buildVersion <= 844) {
      await showMessage('Sorry: need to be running NP 3.6.2 or later', 'Shame', "Sorry, Dave, I can't do that")
      return
    }

    const style = 'HTML'

    const config = await getReviewSettings()
    logDebug(pluginJson, `makeProjectListsHTML: starting for ${config.noteTypeTags.toString()} tags:`)

    if (config.noteTypeTags.length > 0) {
      // We have defined tag(s) to filter and group by
      for (const tag of config.noteTypeTags) {
        // handle #hashtags in the note title (which get stripped out by NP, it seems)
        const tagWithoutHash = tag.replace('#', '')
        const noteTitle = `${tag} Review List`
        const noteTitleWithoutHash = `${tagWithoutHash} List.HTML`

        // Do the main work
        // Calculate the Summary list(s)
        const outputArray = await makeNoteTypeSummary(tag, style)

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
          '',
          noteTitleWithoutHash) // not giving window dimensions
        logDebug(pluginJson, `- written results to HTML`)
      }
    } else {
      // We will just use all eligible project notes in one group
      const title = `Review List`
      const noteTitle = `Review List.HTML`
      // Calculate the Summary list(s)
      const outputArray = await makeNoteTypeSummary('', style)

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
 */
export async function makeProjectListsMarkdown(): Promise<void> {
  try {
    const style = 'markdown'
    const config = await getReviewSettings()
    logDebug(pluginJson, `makeProjectLists: starting for ${config.noteTypeTags.toString()} tags:`)

    if (config.noteTypeTags.length > 0) {
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
          const outputArray = await makeNoteTypeSummary(tag, style)
          outputArray.unshift(`# ${noteTitle}`)

          // Save the list(s) to this note
          note.content = outputArray.join('\n')
          logDebug(pluginJson, `- written results to note '${noteTitle}'`)
          // Open the note in a new window
          await Editor.openNoteByFilename(note.filename, true, 0, 0, false)
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
        const outputArray = await makeNoteTypeSummary('', style)
        outputArray.unshift(`# ${noteTitle}`)

        // Save the list(s) to this note
        note.content = outputArray.join('\n')
        logInfo(pluginJson, `written results to note '${noteTitle}'`)
        // Open the note in a new window
        // TODO: Ideally not open another copy of the note if its already open. But API doesn't support this yet.
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
 * @author @jgclark
 * 
 * @param {string} noteTag - hashtag to look for
 * @param {string} style - 'markdown' or 'HTML'
 * @returns {Array<string>} summary lines to write out to a note
 */
async function makeNoteTypeSummary(noteTag: string, style: string): Promise<Array<string>> {
  try {
    logDebug('makeNoteTypeSummary', `Starting for '${noteTag}' in ${style} style`)
    const config = await getReviewSettings()
    const filteredFolderList = filterFolderList(config.foldersToIgnore)
    logDebug('makeNoteTypeSummary', `- for ${filteredFolderList.length} folders: '${String(filteredFolderList)}'`)

    let noteCount = 0
    let overdue = 0
    const outputArray: Array<string> = []

    // if we want a summary broken down by folder, create list of folders
    // otherwise use a single folder

    // Iterate over the folders (ignoring any in the pref_foldersToIgnore list)
    CommandBar.showLoading(true, `Summarising ${noteTag} in ${filteredFolderList.length} folders`)
    await CommandBar.onAsyncThread()

    const startTime = new Date()
    let c = 0
    for (const folder of filteredFolderList) {
      // Get notes that include noteTag in this folder, ignoring subfolders
      // and ignoring projects with '#archive' if wanted
      const notes = findNotesMatchingHashtag(noteTag, folder, false, config.displayArchivedProjects ? '' : '#archive')
      if (notes.length > 0) {
        logDebug('makeNoteTypeSummary', `${notes.length} found in ${folder} (index ${c})).`)

        // Create array of Project class representation of each note,
        // ignoring any in a folder we want to ignore (by one of the settings)
        const projects = []

        for (const note of notes) {
          const np = new Project(note)
          // Further check to see whether to exclude archived projects
          if (!np.isArchived || config.displayArchivedProjects) {
            projects.push(np)
          } else {

            logDebug('makeNoteTypeSummary', `${np.title} as archived`)
          }
          if (np.nextReviewDays != null && np.nextReviewDays < 0) {
            overdue += 1
          }
        }
        // sort this array by key set in config.displayOrder
        let sortedProjects = []
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
        logDebug('makeNoteTypeSummary', `0 notes found in ${folder} for '${noteTag}'. Will remove it from folder list (index ${c}).`)
        filteredFolderList.splice(c, 1)
        c--
        logDebug('makeNoteTypeSummary', `- filteredFolderList length now ${filteredFolderList.length}`)
      }
      CommandBar.showLoading(true, `Summarising ${noteTag} in ${filteredFolderList.length} folders`, (noteCount / filteredFolderList.length))
      c++
    }
    await CommandBar.onMainThread()
    CommandBar.showLoading(false)
    logDebug('makeNoteTypeSummary', `${noteCount} notes reviewed in ${timer(startTime)}s`)

    let startReviewButton = ''
    // Add summary/ies onto the start (remember: unshift adds to the very front each time)
    switch (style) {
      case 'HTML':
        startReviewButton = `<button onClick="noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=next%20project%20review">${overdue} ready for review</button>`
        // writing backwards to suit .unshift
        outputArray.unshift(Project.detailedSummaryLineHeader(style, config.displayDates, config.displayProgress))
        outputArray.unshift('\n<table>')
        if (!config.displayGroupedByFolder) {
          outputArray.unshift(`<h3>All folders (${noteCount} notes)</h3>`)
        }
        outputArray.unshift(`<p>Total: ${noteCount} active notes${(overdue > 0) ? `, <b>${startReviewButton}</b>` : ''}. <i>Last updated: ${nowLocaleDateTime}</i></p>`)
        break

      default: // include 'markdown'
        startReviewButton = `[${overdue} ready for review](noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=next%20project%20review)`
        if (noteCount > 0) { // print just the once
          outputArray.unshift(Project.detailedSummaryLineHeader(style, config.displayDates, config.displayProgress))
        }
        outputArray.unshift(`Total: ${noteCount} active notes${(overdue > 0) ? `, **${startReviewButton}**` : ''}. _Last updated: ${nowLocaleDateTime}_`)
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
