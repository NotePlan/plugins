// @flow

//-----------------------------------------------------------------------------
// Commands for Reviewing project-style notes, GTD-style.
// by @jgclark
// Last updated for v0.4.5, 9.12.2021
//-----------------------------------------------------------------------------

// Settings
const DEFAULT_REVIEW_OPTIONS = `  review: {
    folderToStore: "Reviews",
    foldersToIgnore: ["@Archive", "📋 Templates", "Reviews", "Summaries"], // can be empty list
    noteTypeTags: ["#project", "#area"], // array of hashtags without spaces
    displayOrder: "alpha", // in '/project lists' the sort options  are "due" date, "review" date or "alpha"
    displayGroupedByFolder: true, // in '/project lists' whether to group the notes by folder
    displayArchivedProjects: true, // in '/project lists' whether to display project notes marked #archive
  },
`
let pref_folderToStore: string = "Reviews"
let pref_foldersToIgnore: Array<string> = ["@Archive", "📋 Templates", "Summaries", "Reviews"]
let pref_noteTypeTags: Array<string> = ["#project", "#area"]
let pref_displayOrder: string = "alpha"
let pref_displayGroupedByFolder: boolean = true
let pref_displayArchivedProjects: boolean = true

// Constants
const reviewListNoteTitle = '_reviews'
const reviewListPref = 'jgclark.Review.reviewList'

//-----------------------------------------------------------------------------
// Import Helper functions
import {
  showMessage,
  showMessageYesNo,
} from '../../helpers/userInput'
import {
  displayTitle,
} from '../../helpers/general'
import {
  RE_DATE, // find dates of form YYYY-MM-DD
  hyphenatedDateString,
  nowLocaleDateTime,
} from '../../helpers/dateTime'
import {
  getOrMakeConfigurationSection,
} from '../../nmn.Templates/src/configuration'
import {
  Project,
  getOrMakeNote,
  findNotesMatchingHashtags,
  getOrMakeMetadataLine,
} from './reviewHelpers'

//-------------------------------------------------------------------------------
// Create human-readable lists of project notes for each tag of interest
export async function getConfig(): Promise<void> {
    // Get config settings from Template folder _configuration note
  const reviewConfig = await getOrMakeConfigurationSection(
    'review',
    DEFAULT_REVIEW_OPTIONS,
    // no minimumConfig needed for this
  )
  if (reviewConfig == null) {
    console.log("\tCouldn't find 'review' settings in _configuration note.")
    await showMessage("Couldn't find 'review' settings in _configuration note.")
    return
  }
  console.log(`\tFound 'review' settings in _configuration note.`)
  // now get the settings we need
  if (reviewConfig.noteTypeTags != null) {
    // $FlowFixMe -- don't know how to make this array not just object
    pref_noteTypeTags = reviewConfig.noteTypeTags
  }
  console.log(pref_noteTypeTags.toString())
  if (reviewConfig.folderToStore != null &&
    typeof reviewConfig.folderToStore === 'string') {
    pref_folderToStore = reviewConfig.folderToStore
  }
  // console.log(pref_folderToStore)
  if (reviewConfig.foldersToIgnore != null) {
    // $FlowFixMe -- don't know how to make this array not just object
    pref_foldersToIgnore = reviewConfig.foldersToIgnore
  }
  // console.log(pref_foldersToIgnore.toString())
  if (reviewConfig.displayGroupedByFolder != null &&
    typeof reviewConfig.displayGroupedByFolder === 'boolean') {
    pref_displayGroupedByFolder = reviewConfig.displayGroupedByFolder
  }
  // console.log(pref_displayGroupedByFolder)
  if (reviewConfig.displayOrder != null &&
    typeof reviewConfig.displayOrder === 'string') {
    pref_displayOrder = reviewConfig.displayOrder
  }
  // console.log(pref_displayOrder)
  if (reviewConfig.displayArchivedProjects != null &&
    typeof reviewConfig.displayArchivedProjects === 'boolean') {
    pref_displayArchivedProjects = reviewConfig.displayArchivedProjects
  }
  // console.log(pref_displayArchivedProjects)
}

//-------------------------------------------------------------------------------
// Create human-readable lists of project notes for each tag of interest
export async function projectLists(): Promise<void> {
  await getConfig()
  console.log(`\nprojectLists() for ${pref_noteTypeTags.toString()} tags:`)

  if (pref_noteTypeTags.length > 0) {
    // We have defined tag(s) to filter and group by
    // $FlowFixMe[incompatible-type]
    for (const tag of pref_noteTypeTags) {
      // handle #hashtags in the note title (which get stripped out by NP, it seems)
      const tagWithoutHash = tag.replace('#','')
      const noteTitle = `${tag} List`
      const noteTitleWithoutHash = `${tagWithoutHash} List`

      // Do the main work
      const note: ?TNote = await getOrMakeNote(noteTitleWithoutHash, pref_folderToStore)
      if (note != null) {
        // Calculate the Summary list(s)
        const outputArray = makeNoteTypeSummary(tag)
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
    const note: ?TNote = await getOrMakeNote(noteTitle, pref_folderToStore)
    if (note != null) {
      // Calculate the Summary list(s)
      const outputArray = makeNoteTypeSummary('')
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
// Create machine-readable note listing project notes ready for review,
// ordered by oldest next review date
// V2, using reviewList pref
export async function startReviews() {
  await getConfig()
  // Get or make _reviews note
  // const reviewsNote: ?TNote = await getOrMakeNote(reviewListNoteTitle, pref_folderToStore)
  // if (reviewsNote == null) {
  //   showMessage(`Oops: failed to find or make _reviews note`, 'OK')
  //   console.log(`\nstartReviews: error: can't get or make summary _reviews note`)
  //   return
  // }

  console.log(`\nstartReviews():`)

  // Temporary check to see if we can delete an absolete '_reviews' file.
  deleteOldListFile()

  const summaryArray = []
  // create list of folders
  const folderList = DataStore.folders
  console.log(`  Processing ${folderList.length} folders`)
  // Iterate over the folders ...
  for (const folder of folderList) {
    if (pref_foldersToIgnore.includes(folder)) {
      // ... but ignoring any in the pref_foldersToIgnore list
      console.log(`\tFolder '${folder}' ignored due to config`)
      continue
    }

    // Either we have defined tag(s) to filter and group by, or just use ''
    const tags = (pref_noteTypeTags != null && pref_noteTypeTags.length > 0)
      ? pref_noteTypeTags
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
          if (np.isReadyForReview && !pref_foldersToIgnore.includes(np.folder)) {
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
  // sort the list
  const outputArray = summaryArray.slice().sort(
    // $FlowIgnore[unsafe-addition]
    (first, second) => first.split('\t')[0] - second.split('\t')[0]) // order by first field

  // write summary to reviewList pref
  DataStore.setPreference(reviewListPref, outputArray.join('\n'))
  console.log(`\twritten ${summaryArray.length} summary lines to reviewList pref`)

  // Now trigger first review
  const noteToReview = await getNextNoteToReview()
  // Open that note in editor
  if (noteToReview != null) {
    const res = await showMessageYesNo(`Ready to review '${displayTitle(noteToReview)}'?`, ['OK', 'Cancel'])
    if (res === 'OK') {
      Editor.openNoteByFilename(noteToReview.filename)
    }
  } else {
    console.log('🎉 No notes to review!')
    await showMessage('🎉 No notes to review!')
  }
}

//-------------------------------------------------------------------------------
// Return summary of notes that contain a particular tag, for all
// relevant folders
function makeNoteTypeSummary(noteTag: string): Array<string> {
  console.log(`\nmakeNoteTypeSummary for '${noteTag}'`)

  let noteCount = 0
  let overdue = 0
  const outputArray: Array<string> = []

  // if we want a summary broken down by folder, create list of folders
  // otherwise use a single folder
  const folderList = pref_displayGroupedByFolder ? DataStore.folders : ['/']
  // console.log(`  Processing ${folderList.length} folders`)
  // Iterate over the folders ...
  for (const folder of folderList) {
    if (pref_foldersToIgnore.includes(folder)) {
      // ... but ignoring any in the pref_foldersToIgnore list
      console.log(`\tFolder '${folder}' ignored due to config`)
      continue
    }
    // Get notes that include noteTag in this folder, ignoring subfolders
    const notes = findNotesMatchingHashtags(noteTag, folder, false)
    if (notes.length > 0) {
      // Create array of Project class representation of each note,
      // ignoring any in a folder we want to ignore (by one of the settings)
      const projects = []
      for (const note of notes) {
        const np = new Project(note)
        if (!pref_foldersToIgnore.includes(np.folder)) {
          if (!np.isArchived || pref_displayArchivedProjects) {
            projects.push(np)
          } else {
            console.log(`\t    Ignoring ${np.title} as archived and don't want to show them`)
          }
        }
        if (np.nextReviewDays != null && np.nextReviewDays < 0) {
          overdue += 1
        }
      }
      // sort this array by key set in pref_displayOrder
      let sortedProjects = []
      // NB: the Compare function needs to return negative, zero, or positive values. 
      switch (pref_displayOrder) {
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
      if (pref_displayGroupedByFolder) {
        outputArray.push(`### ${folder} (${sortedProjects.length} notes)`)
      }
      // iterate over this folder's notes, using Class functions
      for (const p of sortedProjects) {
        outputArray.push(p.detailedSummaryLine())
      }
      noteCount += sortedProjects.length
    }
  }
  // console.log(`\tFinished makeNoteTypeSummary main loop for '${noteTag}'`)
  // Add summary/ies onto the start (remember: unshift adds to the very front each time)
  if (noteCount > 0) {
    outputArray.unshift(`_Key:\tTitle\t# open / complete / waiting tasks / next review date / due date_`)
  }
  outputArray.unshift(`Total: **${noteCount} active notes**${(overdue > 0) ? `, ${overdue} ready for review` : ''}`)
  outputArray.unshift(`Last updated: ${nowLocaleDateTime}`)
  if (!pref_displayGroupedByFolder) {
    outputArray.unshift(`### All folders (${noteCount} notes)`)
  }
  return outputArray
}

//-------------------------------------------------------------------------------
// Complete current review, then jump to the next one to review
// V2: now using preference not note
export async function nextReview() {
  console.log('\nnextReview')
  // First update @review(date) on current open note
  const openNote: ?TNote = await completeReview()

  // NB: The following is now done in completeReview() ...
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
      Editor.openNoteByFilename(noteToReview.filename)
    }
  } else {
    console.log('nextReview: 🎉 No more notes to review!')
    await showMessage('🎉 No more notes to review!')
  }
}

//-------------------------------------------------------------------------------
// Update the review list after completing a review
// V2: now using preference not note
export async function updateReviewListAfterReview(note: TNote) {
  const thisTitle = note.title ?? ''
  console.log(`updateReviewListAfterReview V2 for '${thisTitle}'`)

  // Get pref that contains the project list
  const reviewList = DataStore.preference(reviewListPref)
  if (reviewList === undefined) {
    console.log(`updateReviewListAfterReview V2: warning: can't find pref jgclark.Review.reviewList`)
    return
  }

  // Now read contents and parse, this time as lines
  const lines = reviewList.split('\n')
  // console.log(`\t(pref: has ${lines.length} items, starting ${lines[0]})`)
  // $FlowFixMe
  let lineNum: number // deliberately undefined
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.match(thisTitle)) {
      // console.log(`\tFound '${thisTitle}' in line '${line}' at line number ${i}`)
      lineNum = i
      break
    }
  }

  if (lineNum !== undefined) {
    lines.splice(lineNum, 1) // delete this one line
    DataStore.setPreference(reviewListPref, lines.join('\n'))
    // console.log(`\tRemoved line ${lineNum} from reviewList pref as its review is completed`)
  } else {
    console.log(`\tInfo: couldn't find '${thisTitle}' to remove from review list`)
    return
  }
}

//-------------------------------------------------------------------------------
// Work out the next note to review (if any)
// V2: now using preference not note
async function getNextNoteToReview(): Promise<?TNote> {
  console.log(`\ngetNextNoteToReview V2`)

  // Get pref that contains the project list
  const reviewList = DataStore.preference(reviewListPref)
  if (reviewList === undefined) {
    await showMessage(`Oops: I now can't find my pref`, 'OK')
    console.log(`getNextNoteToReview: error: can't find pref jgclark.Review.reviewList`)
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
    console.log(`info: review list was empty`)
    return
  }
}

//-------------------------------------------------------------------------------
// Update the @reviewed(date) in the note in the Editor to today's date
export async function completeReview(): Promise<?TNote> {
  const reviewMentionString = '@reviewed'
  const RE_REVIEW_MENTION = `${reviewMentionString}\\(${RE_DATE}\\)`
  const reviewedTodayString = `@reviewed(${hyphenatedDateString(new Date())})`

  // only proceed if we're in a valid Project note (with at least 2 lines)
  if (Editor.note == null || Editor.note.type === 'Calendar' || Editor.paragraphs?.length < 2 ) {
    return
  }

  const metadataLine = getOrMakeMetadataLine()
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
    
    const metaPara = Editor.paragraphs[metadataLine]
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
      `\tInfo: no matching ${reviewMentionString}(date) string found. Will append to line 1`,
    )
    metadataPara = Editor.note?.paragraphs[metadataLine]
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
