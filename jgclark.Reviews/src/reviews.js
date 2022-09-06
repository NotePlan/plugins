// @flow
//-----------------------------------------------------------------------------
// Commands for Reviewing project-style notes, GTD-style.
// by @jgclark
// Last updated 1.9.2022 for v0.8.0-beta1, @jgclark
//-----------------------------------------------------------------------------
// TODO: Try to deal with emojis
// TODO: Plumb in the HTML option

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

// Settings
const reviewListPref = 'jgclark.Reviews.reviewList'

//-------------------------------------------------------------------------------

/**
 * Log the machine-readable list of notes to review
 * @author @jgclark
 */
export function logReviewList(): void{
  logPreference(reviewListPref)
}

const reviewListCSS = [
  '',
  '/* CSS specific to reviewList() from jgclark.Reviews plugin */',
  `@font-face {
  font-family: "noteplanstate";
  src: url('noteplanstate.ttf') format('truetype');
}`, // local font
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
      // We will just use all notes with a @review() string, in one go
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

/**
 * Generate machine-readable list of project-type notes ready for review,
 * ordered by oldest next review date.
 * This is V2, which uses reviewList pref to store the list
 * @author @jgclark
 */
export async function makeReviewList(): Promise<void> {
  try {
    const config = await getReviewSettings()
    const filteredFolderList = filterFolderList(config.foldersToIgnore)
    const summaryArray = []

    logDebug(pluginJson, `makeReviewList: starting for ${config.noteTypeTags.toString()} tags:`)

    CommandBar.showLoading(true, `Generating Project Review list`)
    await CommandBar.onAsyncThread()

    const startTime = new Date()
    // Iterate over the folders ...
    // ... but ignoring any in the config.foldersToIgnore list
    for (const folder of filteredFolderList) {
      // Either we have defined tag(s) to filter and group by, or just use ''
      const tags = (config.noteTypeTags != null && config.noteTypeTags.length > 0)
        ? config.noteTypeTags
        : []

      // Get notes that include noteTag in this folder, ignoring subfolders
      const projectNotesArrArr = findNotesMatchingHashtags(tags, folder, false)
      logDebug(pluginJson, `- After findNotesMatchingHashtags, before loop`)
      const projectsReadyToReview = []
      for (const pnarr of projectNotesArrArr) {
        if (pnarr.length > 0) {
          // Get Project class representation of each note,
          // saving those which are ready for review in projectsReadyToReview array
          for (const n of pnarr) {
            const np = new Project(n)
            if (np.isReadyForReview && !config.foldersToIgnore.includes(np.folder)) {
              projectsReadyToReview.push(np)
            }
          }
        }
        // For each readyToReview note get the machine-readable summary line for it
        for (const thisProject of projectsReadyToReview) {
          summaryArray.push(thisProject.machineSummaryLine())
          // logDebug(pluginJson, `-> ${thisProject.machineSummaryLine()}`)
        }
      }
    }
    logDebug(pluginJson, `- ${Number(config.noteTypeTags.length * filteredFolderList.length)} folder/tag combinations reviewed in ${timer(startTime)}s`)
    await CommandBar.onMainThread()
    CommandBar.showLoading(false)

    // dedupe the list, in case it contains duplicates
    const dedupedArray = []
    summaryArray.forEach((element) => {
      if (!dedupedArray.includes(element)) {
        dedupedArray.push(element)
      }
    })

    // sort the list by first field
    const outputArray = dedupedArray.slice().sort((first, second) =>
      Number(first.split('\t')[0]) - Number(second.split('\t')[0]))

    // write summary to reviewList pref
    DataStore.setPreference(reviewListPref, outputArray.join('\n'))
    logInfo(pluginJson, `-> Now ${outputArray.length} lines in the reviewListPref`)
  }
  catch (error) {
    logError(pluginJson, `makeReviewList: ${error.message}`)
  }
}

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
    await makeReviewList()

    // Now offer first review
    const noteToReview = await getNextNoteToReview()
    // Open that note in editor
    if (noteToReview != null) {
      if (config.confirmNextReview) {
        const res = await showMessageYesNo(`Ready to review '${displayTitle(noteToReview)}'?`, ['OK', 'Cancel'])
        if (res === 'OK') {
          logDebug(pluginJson, `Opening '${displayTitle(noteToReview)}' note to review (from startReviews)`)
          await Editor.openNoteByFilename(noteToReview.filename)
        }
      } else {
        logDebug(pluginJson, `Opening '${displayTitle(noteToReview)}' note to review (from startReviews)`)
        await Editor.openNoteByFilename(noteToReview.filename)
      }
    } else {
      logInfo(pluginJson, '  🎉 No notes to review!')
      await showMessage('🎉 No notes to review!', 'Great', 'Reviews')
    }
  }
  catch (error) {
    logError(pluginJson, `startReviews: ${error.message}`)
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
    logDebug(pluginJson, `makeNoteTypeSummary: starting for '${noteTag}' in ${style} style`)
    const config = await getReviewSettings()
    const filteredFolderList = filterFolderList(config.foldersToIgnore)

    let noteCount = 0
    let overdue = 0
    const outputArray: Array<string> = []

    // if we want a summary broken down by folder, create list of folders
    // otherwise use a single folder
    logDebug(pluginJson, `- Processing ${filteredFolderList.length} folders`)

    // Iterate over the folders (ignoring any in the pref_foldersToIgnore list)
    CommandBar.showLoading(true, `Summarising ${noteTag} in ${filteredFolderList.length} folders`)
    await CommandBar.onAsyncThread()

    const startTime = new Date()
    for (const folder of filteredFolderList) {
      // Get notes that include noteTag in this folder, ignoring subfolders
      const notes = findNotesMatchingHashtag(noteTag, folder, false)
      if (notes.length > 0) {
        // Create array of Project class representation of each note,
        // ignoring any in a folder we want to ignore (by one of the settings)
        const projects = []
      
        for (const note of notes) {
          const np = new Project(note)
          if (!np.isArchived || config.displayArchivedProjects) {
            projects.push(np)
          } else {
            // logDebug(pluginJson, `- Ignoring ${np.title} as archived`)
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

        // iterate over this folder's notes, using Class functions
        for (const p of sortedProjects) {
          outputArray.push(p.detailedSummaryLine(style, false))
        }
        noteCount += sortedProjects.length

      } else {
        logInfo(pluginJson, `- No notes found in ${folder} for '${noteTag}'`)
      }
      CommandBar.showLoading(true, `Summarising ${noteTag} in ${filteredFolderList.length} folders`, (noteCount / filteredFolderList.length))
    }
    await CommandBar.onMainThread()
    CommandBar.showLoading(false)
    logInfo(pluginJson, `${Number(noteCount)} notes reviewed in ${timer(startTime)}s`)

    let startReviewButton = ''
    // Add summary/ies onto the start (remember: unshift adds to the very front each time)
    switch (style) {
      case 'HTML':
        startReviewButton = `<button onClick="noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=next%20project%20review">${overdue} ready for review</button>`
        // writing backwards to suit .unshift
        outputArray.unshift(Project.detailedSummaryLineHeader(style))
        outputArray.unshift('\n<table>')
        if (!config.displayGroupedByFolder) {
          outputArray.unshift(`<h3>All folders (${noteCount} notes)</h3>`)
        }
        outputArray.unshift(`<p>Total: ${noteCount} active notes${(overdue > 0) ? `, <b>${startReviewButton}</b>` : ''}. <i>Last updated: ${nowLocaleDateTime}</i></p>`)
        break

      default: // include 'markdown'
        startReviewButton = `[${overdue} ready for review](noteplan://x-callback-url/runPlugin?pluginID=jgclark.Reviews&command=next%20project%20review)`
        if (noteCount > 0) { // print just the once
          outputArray.unshift(Project.detailedSummaryLineHeader(style))
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
    logError(pluginJson, `makeNoteTypeSummary: ${error.message}`)
    return []
  }
}

//-------------------------------------------------------------------------------
/**
 * Complete current review, then jump to the next one to review
 * @author @jgclark
*/
export async function nextReview(): Promise<void> {
  try {
    logDebug(pluginJson, 'nextReview: starting')
    const config = await getReviewSettings()

    // First update @review(date) on current open note
    // eslint-disable-next-line no-unused-vars, unused-imports/no-unused-vars
    const openNote: ?TNote = await finishReview()

    // Read review list to work out what's the next one to review
    const noteToReview: ?TNote = await getNextNoteToReview()

    if (noteToReview != null) {
      if (config.confirmNextReview) {
        // Check whether to open that note in editor
        const res = await showMessageYesNo(`Ready to review '${displayTitle(noteToReview)}'?`, ['OK', 'Cancel'])
        if (res === 'OK') {
          logInfo(pluginJson, `Opening '${displayTitle(noteToReview)}' note to review`)
          await Editor.openNoteByFilename(noteToReview.filename)
        }
      } else {
        logInfo(pluginJson, `Opening '${displayTitle(noteToReview)}' note to review`)
        await Editor.openNoteByFilename(noteToReview.filename)
      }
    } else {
      logInfo(pluginJson, `🎉 No more notes to review!`)
      await showMessage('🎉 No notes to review!', 'Great', 'Reviews')
    }
  }
  catch (error) {
    logError(pluginJson, `nextReview: ${error.message}`)
  }
}

//-------------------------------------------------------------------------------
/**
 * Update the review list after completing a review
 * @author @jgclark
 * @param {TNote} note that has been reviewed
*/
export async function updateReviewListAfterReview(note: TNote): Promise<void> {
  try {
    const reviewedTitle = note.title ?? ''
    logDebug(pluginJson, `updateReviewListAfterReview: Removing '${reviewedTitle}' from review list`)

    // Get pref that contains the project list
    let reviewList = DataStore.preference(reviewListPref)
    if (reviewList === undefined) {
      logDebug(pluginJson, `Can't find pref ${reviewListPref}. Will run makeReviewList() ...`)
      await makeReviewList()
      return
    }

    // Now read contents and parse, this time as lines
    const lines = checkString(reviewList).split('\n')
    logDebug(pluginJson, `- (pref: has ${lines.length} items, starting ${lines[0]})`)
    let lineNum: number // deliberately undefined
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.match(reviewedTitle)) {
        logDebug(pluginJson, `- Found '${reviewedTitle}' in line '${line}' at line number ${i}`)
        lineNum = i
        break
      }
    }

    if (lineNum !== undefined) {
      lines.splice(lineNum, 1) // delete this one line
      DataStore.setPreference(reviewListPref, lines.join('\n'))
      logDebug(pluginJson, `- Removed line ${lineNum} from reviewList pref as its review is completed`)
    } else {
      logDebug(pluginJson, `- Couldn't find '${reviewedTitle}' to remove from review list. Will run makeReviewList ...`)
      await makeReviewList()
      return
    }
  }
  catch (error) {
    logError(pluginJson, `updateReviewListAfterReview: ${error.message}`)
  }
}

//-------------------------------------------------------------------------------
/** 
 * Work out the next note to review (if any)
 * @author @jgclark
 * @return { ?TNote } next note to review
 */
async function getNextNoteToReview(): Promise<?TNote> {
  try {
    // Get pref that contains the project list
    let reviewList = DataStore.preference(reviewListPref)
    if (reviewList === undefined) {
      logWarn(pluginJson, `getNextNoteToReview: Couldn't find pref ${reviewListPref}. Please run makeReviewList() ...`)
      await makeReviewList()
      reviewList = DataStore.preference(reviewListPref)
      return
    }
    const reviewListStr = checkString(reviewList)
    // Now read off the first line
    if (reviewListStr.length > 0) {
      const lines = reviewListStr.split('\n')
      const firstLine = lines[0]
      // logDebug(pluginJson, `pref: has ${lines.length} items, starting ${firstLine}`)
      const nextNoteTitle = firstLine.split('\t')[1] // get second field in list
      logDebug(pluginJson, `getNextNoteToReview: -> '${nextNoteTitle}'`)
      const nextNotes = DataStore.projectNoteByTitle(nextNoteTitle, true, false) ?? []
      return nextNotes[0] // return first matching note
    } else {
      logInfo(pluginJson, `getNextNoteToReview: Review list was empty.`)
      return
    }
  }
  catch (error) {
    logError(pluginJson, `getNextNoteToReview: ${error.message}`)
    return
  }
}

//-------------------------------------------------------------------------------
/** 
 * Update the @reviewed(date) in the note in the Editor to today's date.
 * @author @jgclark
 * @return { ?TNote } current note
 */
export async function finishReview(): Promise<?TNote> {
  try {
    const reviewedMentionStr = checkString(DataStore.preference('reviewedMentionStr'))
    const RE_REVIEW_MENTION = `${reviewedMentionStr}\\(${RE_DATE}\\)`
    const reviewedTodayString = `${reviewedMentionStr}(${hyphenatedDateString(new Date())})`

    let { note, paragraphs } = Editor
    // only proceed if we're in a valid Project note (with at least 2 lines)
    if (note == null || note.type === 'Calendar' || paragraphs.length < 2) {
      logWarn(pluginJson, `finishReview: We're not in a valid Project note (and with at least 2 lines). Note title = '${Editor.title ?? ''}'`)
      return
    }

    const metadataLineIndex: number = getOrMakeMetadataLine(note, `<placeholder metadata line> ${reviewedTodayString}`)
    // Re-read paragraphs, as they might have changed
    paragraphs = note.paragraphs
    let metadataPara = paragraphs[metadataLineIndex]
    const metadataLineContent: string = metadataPara.content ?? '<error>'
    logDebug(pluginJson, `finishReview starting with metadataLineIndex ${metadataLineIndex} ('${metadataLineContent}')`)

    // get list of @mentions -- more generous approach than just using metadata line
    const firstReviewedMention = Editor.note?.mentions?.find((m) =>
      m.match(RE_REVIEW_MENTION),
    ) ?? null
    if (firstReviewedMention != null) {
      // find line in currently open note containing @reviewed() mention
      for (const para of Editor.paragraphs) {
        if (para.content.match(RE_REVIEW_MENTION)) {
          metadataPara = para
          logDebug(pluginJson, `- Found existing ${reviewedMentionStr}(date) in line ${para.lineIndex}`)
        }
      }

      // replace with today's date
      const older = metadataPara.content

      const newer = older.replace(firstReviewedMention, reviewedTodayString)
      metadataPara.content = newer
      // logDebug(pluginJson, `- updating para to '${newer}'`)

      // send update to Editor
      Editor.updateParagraph(metadataPara)
    } else {
      // no existing @mention, so append to note's default metadata line
      logDebug(pluginJson, `- No matching ${reviewedMentionStr}(date) string found. Will append to line ${metadataLineIndex}.`)
      metadataPara.content = `${metadataPara.content} ${reviewedTodayString}`.trim()
      // send update to Editor
      Editor.updateParagraph(metadataPara)
      logDebug(pluginJson, `- after update ${metadataPara.content}.`)
    }
    // remove this note from the review list
    if (note != null) {
      await updateReviewListAfterReview(note)
      // return current note, to help next function
      return note
    }
  }
  catch (error) {
    logError(pluginJson, `finishReview: ${error.message}`)
    return null
  }
}
