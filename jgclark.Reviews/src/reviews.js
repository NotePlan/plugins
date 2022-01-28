// @flow

//-----------------------------------------------------------------------------
// Commands for Reviewing project-style notes, GTD-style.
// by @jgclark
// Last updated 27.1.2022 for v0.6.0, @jgclark
//-----------------------------------------------------------------------------

// Import Helper functions
import {
  getConfigSettings,
  logPreference,
  Project,
} from './reviewHelpers'
import {
  hyphenatedDateString,
  nowLocaleDateTime,
  RE_DATE, // find dates of form YYYY-MM-DD
} from '../../helpers/dateTime'
import {
  filterFolderList,
  getFolderFromFilename
} from '../../helpers/folders'
import { displayTitle } from '../../helpers/general'
import {
  findNotesMatchingHashtags,
  getOrMakeNote,
} from '../../helpers/note'
import { getOrMakeMetadataLine } from '../../helpers/paragraph'
import {
  showMessage,
  showMessageYesNo,
} from '../../helpers/userInput'
import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'

//-----------------------------------------------------------------------------

// Settings
let filteredFolderList: Array<string> = []
const reviewListPref = 'jgclark.Review.reviewList'

//-------------------------------------------------------------------------------

/**
 * Generate human-readable lists of project notes for each tag of interest
 * and write out to note(s) in the config.folderToStore folder.
 * @author @jgclark
 */
export async function projectLists(): Promise<void> {
  const config = await getConfigSettings()
  const filteredFolderList = filterFolderList(config.foldersToIgnore)

  console.log(`starting for ${config.noteTypeTags.toString()} tags:`)

  if (config.noteTypeTags.length > 0) {
    // We have defined tag(s) to filter and group by
    for (const tag of config.noteTypeTags) {
      // handle #hashtags in the note title (which get stripped out by NP, it seems)
      const tagWithoutHash = tag.replace('#','')
      const noteTitle = `${tag} List`
      const noteTitleWithoutHash = `${tagWithoutHash} List`

      // Do the main work
      const note: ?TNote = await getOrMakeNote(noteTitleWithoutHash, config.folderToStore)
      if (note != null) {
        // Calculate the Summary list(s)
        const outputArray = await makeNoteTypeSummary(tag)
        outputArray.unshift(`# ${noteTitle}`)

        // Save the list(s) to this note
        console.log(`\twriting results to the note with filename '${note.filename}'`)
        note.content = outputArray.join('\n')
        console.log(`\twritten results to note '${noteTitle}'`)
      } else {
        await showMessage('Oops: failed to find or make project summary note', 'OK')
        console.log(
          "projectLists: error: shouldn't get here -- no valid note to write to",
        )
        return
      }
    }
  } else {
    // We will just use all notes with a @review() string, in one go     
    const noteTitle = `Review List`
    const note: ?TNote = await getOrMakeNote(noteTitle, config.folderToStore)
    if (note != null) {
      // Calculate the Summary list(s)
      const outputArray = await makeNoteTypeSummary('')
      outputArray.unshift(`# ${noteTitle}`)

      // Save the list(s) to this note
      console.log(`\twriting results to the note with filename '${note.filename}'`)
      note.content = outputArray.join('\n')
      console.log(`\twritten results to note '${noteTitle}'`)
    } else {
      await showMessage('Oops: failed to find or make project summary note', 'OK')
      console.log(
        "projectLists: error: shouldn't get here -- no valid note to write to",
      )
      return
    }
  }
}

//-------------------------------------------------------------------------------
/**
 * Generate machine-readable list of project-type notes ready for review,
 * ordered by oldest next review date.
 * This is V2, which uses reviewList pref to store the list
 * @author @jgclark
 */
export async function startReviews(): Promise<void> {
  const config = await getConfigSettings()
  const filteredFolderList = filterFolderList(config.foldersToIgnore)

  // Temporary check to see if we can delete an absolete '_reviews' file.
  deleteOldListFile() // TODO: Delete me in time

  const summaryArray = []
  
  CommandBar.showLoading(true, `Generating review list`)
  await CommandBar.onAsyncThread()

  // Iterate over the folders ...
  // ... but ignoring any in the config.foldersToIgnore list
  for (const folder of filteredFolderList) {
    // Either we have defined tag(s) to filter and group by, or just use ''
    const tags = (config.noteTypeTags != null && config.noteTypeTags.length > 0)
      ? config.noteTypeTags
      : []
    for (const tag of tags) {
      // Get notes that include noteTag in this folder, ignoring subfolders
      const notes = findNotesMatchingHashtags(tag, folder, false)
      const projectsReadyToReview = []
      if (notes.length > 0) {
        // Get Project class representation of each note,
        // saving those which are ready for review in projectsReadyToReview array
        for (const n of notes) {
          const np = new Project(n)
          if (np.isReadyForReview && !config.foldersToIgnore.includes(np.folder)) {
            projectsReadyToReview.push(np)
          }
        }
      }
      // For each readyToReview note get the machine-readable summary line for it
      for (const thisProject of projectsReadyToReview) {
        summaryArray.push(thisProject.machineSummaryLine())
        // console.log(thisProject.machineSummaryLine())
      }
    }
  }
  await CommandBar.onMainThread()
  CommandBar.showLoading(false)
  // sort the list by first field
  // $FlowIgnore[unsafe-addition]
  const outputArray = summaryArray.slice().sort((first, second) => first.split('\t')[0] - second.split('\t')[0])

  // write summary to reviewList pref
  DataStore.setPreference(reviewListPref, outputArray.join('\n'))
  logPreference(reviewListPref)

  // Now trigger first review
  const noteToReview = await getNextNoteToReview()
  // Open that note in editor
  if (noteToReview != null) {
    const res = await showMessageYesNo(`Ready to review '${displayTitle(noteToReview)}'?`, ['OK', 'Cancel'])
    if (res === 'OK') {
      await Editor.openNoteByFilename(noteToReview.filename)
    }
  } else {
    console.log('🎉 No notes to review!')
    await showMessage('🎉 No notes to review!')
  }
}

//-------------------------------------------------------------------------------
/** 
 * Return summary of notes that contain a particular tag, for all relevant folders
 * @author @jgclark
 * 
 * @param {string} noteTag - hashtag to look for
 * @return {Array<string>} summary lines to write out to a note
 */
async function makeNoteTypeSummary(noteTag: string): Promise<Array<string>> {
  console.log(`makeNoteTypeSummary for '${noteTag}'`)
  const config = await getConfigSettings()
  const filteredFolderList = filterFolderList(config.foldersToIgnore)

  let noteCount = 0
  let overdue = 0
  const outputArray: Array<string> = []

  // if we want a summary broken down by folder, create list of folders
  // otherwise use a single folder
  const folderList = config.displayGroupedByFolder ? DataStore.folders : ['/']
  // console.log(`  Processing ${folderList.length} folders`)

  // Iterate over the folders (ignoring any in the pref_foldersToIgnore list)
  CommandBar.showLoading(true, `Summarising ${noteTag} in ${filteredFolderList.length} folders`)
  await CommandBar.onAsyncThread()
  for (const folder of filteredFolderList) {
    // Get notes that include noteTag in this folder, ignoring subfolders
    const notes = findNotesMatchingHashtags(noteTag, folder, false)
    if (notes.length > 0) {
      // Create array of Project class representation of each note,
      // ignoring any in a folder we want to ignore (by one of the settings)
      const projects = []
      
      for (const note of notes) {
        const np = new Project(note)
        if (!np.isArchived || config.displayArchivedProjects) {
          projects.push(np)
        } else {
          console.log(`\t    Ignoring ${np.title} as archived and don't want to show them`)
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
        default: {
          sortedProjects = projects.sort(
            (first, second) => (first.title ?? '').localeCompare(second.title ?? ''))
          break
        }
      }
      if (config.displayGroupedByFolder) {
        outputArray.push(`### ${(folder !== '' ? folder : '/')} (${sortedProjects.length} notes)`)
      }
      // iterate over this folder's notes, using Class functions
      for (const p of sortedProjects) {
        outputArray.push(p.detailedSummaryLine(false))
      }
      noteCount += sortedProjects.length
    } else {
      console.log(`No notes found for '${noteTag}'`)
    }
    CommandBar.showLoading(true, `Summarising ${noteTag} in ${filteredFolderList.length} folders`, (noteCount / filteredFolderList.length))
  }
  await CommandBar.onMainThread()
  CommandBar.showLoading(false)

  // Add summary/ies onto the start (remember: unshift adds to the very front each time)
  if (noteCount > 0) {
    outputArray.unshift(`_Key:\tTitle\t# open / complete / waiting tasks / next review date / due date_`)
  }
  outputArray.unshift(`Total: **${noteCount} active notes**${(overdue > 0) ? `, ${overdue} ready for review` : ''}`)
  outputArray.unshift(`Last updated: ${nowLocaleDateTime}`)
  if (!config.displayGroupedByFolder) {
    outputArray.unshift(`### All folders (${noteCount} notes)`)
  }
  return outputArray
}

//-------------------------------------------------------------------------------
/**
 * Complete current review, then jump to the next one to review
 * V2: now using preference not a special note.
*/
export async function nextReview(): Promise<void> {
  console.log('\nnextReview')
  // First update @review(date) on current open note
  const openNote: ?TNote = await finishReview()

  // NB: The following is now done in finishReview() ...
  // if (openNote != null) {
  //   // Then update @review(date) in review list note
  //   await updateReviewListAfterReview(openNote)
  // }

  // Read review list to work out what's the next one to review
  const noteToReview: ?TNote = await getNextNoteToReview()

  // Offer to open that note in editor
  if (noteToReview != null) {
    const res = await showMessageYesNo(`Ready to review '${displayTitle(noteToReview)}'?`, ['OK', 'Cancel'])
    if (res === 'OK') {
      await Editor.openNoteByFilename(noteToReview.filename)
    }
  } else {
    console.log('nextReview: 🎉 No more notes to review!')
    await showMessage('🎉 No more notes to review!')
  }
}

//-------------------------------------------------------------------------------
/**
 * Update the review list after completing a review
 * V2: now using preference not note
 * @author @jgclark
 * 
 * @param {TNote} note that has been reviewed
*/
export async function updateReviewListAfterReview(note: TNote): Promise<void> {
  const reviewedTitle = note.title ?? ''
  console.log(`\twill remove '${reviewedTitle}' from list`)

  // Get pref that contains the project list
  const reviewList = DataStore.preference(reviewListPref)
  if (reviewList === undefined) {
    console.log(`\twarning: can't find pref jgclark.Review.reviewList. Suggest re-running '/start reviews'`)
    return
  }

  // Now read contents and parse, this time as lines
  const lines = reviewList.split('\n')
  // console.log(`\t(pref: has ${lines.length} items, starting ${lines[0]})`)
  // $FlowFixMe
  let lineNum: number // deliberately undefined
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.match(reviewedTitle)) {
      // console.log(`\tFound '${reviewedTitle}' in line '${line}' at line number ${i}`)
      lineNum = i
      break
    }
  }

  if (lineNum !== undefined) {
    lines.splice(lineNum, 1) // delete this one line
    DataStore.setPreference(reviewListPref, lines.join('\n'))
    // console.log(`\tRemoved line ${lineNum} from reviewList pref as its review is completed`)
  } else {
    console.log(`\tInfo: couldn't find '${reviewedTitle}' to remove from review list`)
    return
  }
}

//-------------------------------------------------------------------------------
/** 
 * Work out the next note to review (if any)
 * V2: now using preference not note
 * @author @jgclark

 * @return { ?TNote } next note to review
 */
async function getNextNoteToReview(): Promise<?TNote> {
  // Get pref that contains the project list
  const reviewList = DataStore.preference(reviewListPref)
  if (reviewList === undefined) {
    await showMessage(`Oops: I now can't find my pref. Try re-running '/start reviews' command.`, 'OK')
    console.log(`\terror: can't find pref jgclark.Review.reviewList`)
    return
  }

  // Now read off the first line
  if (reviewList.length > 0) {
    const lines = reviewList.split('\n')
    const firstLine = lines[0]
    // console.log(`pref: has ${lines.length} items, starting ${firstLine}`)
    const nextNoteTitle = firstLine.split('\t')[1] // get second field in list
    console.log(`\tNext project note to review = '${nextNoteTitle}'`)
    const nextNotes = DataStore.projectNoteByTitle(nextNoteTitle, true, false) ?? []
    return nextNotes[0] // return first matching note
  } else {
    console.log(`\tInfo: review list was empty. Try re-running '/start reviews' command.`)
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
  const reviewMentionString = '@reviewed'
  const RE_REVIEW_MENTION = `${reviewMentionString}\\(${RE_DATE}\\)`
  const reviewedTodayString = `@reviewed(${hyphenatedDateString(new Date())})`

  // only proceed if we're in a valid Project note (with at least 2 lines)
  if (Editor.note == null || Editor.note.type === 'Calendar' || Editor.paragraphs?.length < 2) {
    console.log(`Warning: we're not in a valid Project note (with at least 2 lines).`)
    return
  }

  const metadataLineNum = getOrMakeMetadataLine(Editor.note)
  let metadataPara: ?TParagraph

  // get list of @mentions
  const firstReviewedMention = Editor.note?.mentions.find((m) =>
    m.match(RE_REVIEW_MENTION),
  )
  if (firstReviewedMention != null) {
    // find line in currently open note containing @reviewed() mention
    for (const para of Editor.paragraphs) {
      if (para.content.match(RE_REVIEW_MENTION)) {
        metadataPara = para
        console.log(
          `\tFound existing ${reviewMentionString}(date) in line ${para.lineIndex}`,
        )
      }
    }
    
    const metaPara = Editor.paragraphs[metadataLineNum]
    // replace with today's date
    const older = metaPara.content
    const newer = older.replace(firstReviewedMention, reviewedTodayString)
    metaPara.content = newer
    // console.log(`\tupdating para to '${newer}'`)

    // send update to Editor
    Editor.updateParagraph(metaPara)
  } else {
    // no existing mention, so append to note's default metadata line
    console.log(
      `\tInfo: no matching ${reviewMentionString}(date) string found. Will append to line ${metadataLineNum}`,
    )
    metadataPara = Editor.note?.paragraphs[metadataLineNum]
    if (metadataPara == null) {
      return null
    }
    const metaPara = metadataPara
    metaPara.content += ` ${reviewedTodayString}`
    // send update to Editor
    Editor.updateParagraph(metaPara)
  }
  // remove this note from the review list
  // $FlowIgnore[incompatible-call]
  await updateReviewListAfterReview(Editor.note)

  // return current note, to help next function
  return Editor.note
}

//-------------------------------------------------------------------------------
// To help transition from the previous method which used a machine-readable
// file '_reviews' for persistent storage, this will remove it if found.
// TODO: remove this after some months, as no longer needed
function deleteOldListFile(): void {
  const notes = DataStore.projectNoteByTitle('_reviews', false, false) ?? [] // don't link in Trash
  const reviewListNoteTitle = '_reviews'
  if (notes?.length > 0) {
    const reviewNote = notes[0]
    // Following doesn't seem to work
    // const temp = DataStore.moveNote(reviewListNoteTitle, "@Trash")
    // So try to rename instead
    const titlePara = reviewNote.paragraphs[0]
    const firstLinePara = reviewNote.paragraphs[1]
    titlePara.content = `PLEASE DELETE ME: _reviews`
    reviewNote.updateParagraph(titlePara)
    firstLinePara.content = `**This note has now been replaced by a newer preference mechanism.** It can now safely be deleted.`
    reviewNote.updateParagraph(firstLinePara)
    console.log(`Info: the old '${reviewListNoteTitle}' note has been updated to say it is no longer needed to operate the Review plugin commands.`)
  }
}
