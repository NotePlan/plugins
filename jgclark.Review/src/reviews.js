// @flow

//-----------------------------------------------------------------------------
// Commands for Reviewing project notes, GTD-style.
// by @jgclark
// v0.2.1, 30.7.2021
//-----------------------------------------------------------------------------

// TODO:s below

// Settings
const DEFAULT_REVIEW_OPTIONS = `  review: {
    folderToStore: "Summaries",
    foldersToIgnore: ["Templates", "Summaries"], // can be empty
    noteTypeTags: "#area,#project",
    displayGroupedByFolder: true,
    displayOrder: "alpha" // 'due', 'review' or 'alpha'
  },
`
let pref_noteTypeTags: string = '#project,#area'
let pref_folderToStore: string = 'Summaries'
let pref_foldersToIgnore: Array<string> = ["Templates", "Summaries"]
let pref_displayGroupedByFolder: boolean = true
let pref_displayOrder: string = 'alpha'

// Constants
const reviewListNoteTitle = '_reviews'

//-----------------------------------------------------------------------------
// Import Helper functions
import {
  RE_DATE, // find dates of form YYYY-MM-DD
  showMessage,
  showMessageYesNo,
  hyphenatedDate,
  nowLocaleDateTime,
  displayTitle,
  // calcOffsetDate,
  // relativeDateFromNumber,
} from '../../helperFunctions'

import {
  getOrMakeConfigurationSection
} from '../../nmn.Templates/src/configuration'

import {
  Project,
  returnSummaryNote,
  findNotesMatchingHashtags
} from './reviewHelpers'



//-------------------------------------------------------------------------------
// Create human-readable lists of project notes for each tag of interest
async function getConfig(): Promise<void> {
    // Get config settings from Template folder _configuration note
  const reviewConfig = await getOrMakeConfigurationSection(
    'review',
    DEFAULT_REVIEW_OPTIONS,
  )
  if (reviewConfig == null) {
    console.log("\tCouldn't find 'review' settings in _configuration note.")
    await showMessage("Couldn't find 'review' settings in _configuration note.")
    return
  }
  console.log("\tFound 'review' settings in _configuration note.")
  // now get the settings we need
  if (reviewConfig.noteTypeTags != null &&
    typeof reviewConfig.noteTypeTags === 'string') {
      pref_noteTypeTags = reviewConfig.noteTypeTags
  }
  // console.log(pref_noteTypeTags)
  if (reviewConfig.folderToStore != null &&
    typeof reviewConfig.folderToStore === 'string') {
    pref_folderToStore = reviewConfig.folderToStore
  }
  // console.log(pref_folderToStore)
  if (reviewConfig.foldersToIgnore != null) {
    // $FlowFixMe -- don't know how to make this array not just object
    pref_foldersToIgnore = reviewConfig.foldersToIgnore
  }
  // console.log(pref_foldersToIgnore)
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
}

//-------------------------------------------------------------------------------
// Create human-readable lists of project notes for each tag of interest
export async function projectLists(): Promise<void> {
  getConfig()
  console.log(`\nprojectLists with pref_noteTypeTags = '${pref_noteTypeTags}':`)

  if (pref_noteTypeTags != null && pref_noteTypeTags !== '') {
    // We have defined tag(s) to filter and group by
    const tags = pref_noteTypeTags.split(',')

    for (const tag of tags) {
      // Do the main work
      const tagName = tag.slice(1) // remove leading # character
      const noteTitle = `'${tagName}' notes summary`
      const note: ?TNote = await returnSummaryNote(noteTitle, pref_folderToStore)
      if (note != null) {
        // Calculate the Summary list(s)
        const outputArray = makeNoteTypeSummary(tag)
        outputArray.unshift(`# ${noteTitle}`)

        // Save the list(s) to this note
        console.log(`\twriting results to the note with filename '${note.filename}'`)
        note.content = outputArray.join('\n')
        console.log(`\twritten results to note '${noteTitle}'`)
      } else {
        showMessage('Oops: failed to find or make project summary note', 'OK')
        console.log(
          "projectLists: error: shouldn't get here -- no valid note to write to",
        )
        return
      }
    }
  } else {
    // We will just use all notes with a @review() string, in one go     
    const noteTitle = `Review notes summary`
    const note: ?TNote = await returnSummaryNote(noteTitle, pref_folderToStore)
    if (note != null) {
      // Calculate the Summary list(s)
      const outputArray = makeNoteTypeSummary('')
      outputArray.unshift(`# ${noteTitle}`)

      // Save the list(s) to this note
      console.log(`\twriting results to the note with filename '${note.filename}'`)
      note.content = outputArray.join('\n')
      console.log(`\twritten results to note '${noteTitle}'`)
    } else {
      showMessage('Oops: failed to find or make project summary note', 'OK')
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
export async function startReviews() {
  getConfig()
  // Get or make _reviews note
  const reviewsNote: ?TNote = await returnSummaryNote(reviewListNoteTitle, pref_folderToStore)
  if (reviewsNote == null) {
    showMessage(`Oops: failed to find or make _reviews note`, 'OK')
    console.log(`\nstartReviews: error: can't get or make summary _reviews note`)
    return
  }

  console.log(`\nstartReviews:`)
  const summaryArray = []
  if (pref_noteTypeTags != null && pref_noteTypeTags !== '') {
    // We have defined tag(s) to filter and group by
    const tags = pref_noteTypeTags.split(',')
    for (const tag of tags) {
      // Read in all relevant notes, making Project objects
      const notes = findNotesMatchingHashtags(tag)
      const projectsReadyToReview = []
      if (notes.length > 0) {
        // Get Project class representation of each note,
        // saving those which are ready for review in array
        for (const n of notes) {
          const np = new Project(n)
          // TODO: somewhere here ignore ones from certain folders
          if (np.isReadyForReview) {
            projectsReadyToReview.push(np)
          }
        }
      }
      // For each readyToReview note get the machine-readable summary line for it
      for (const np of projectsReadyToReview) {
        summaryArray.push(np.basicSummaryLine())
        // console.log(np.basicSummaryLine())
      }
    }
  } else {
    // TODO: merge into the above if clause
    // We will just use all notes with a @review() string, in one go
    // Read in all relevant notes, making Project objects
    const notes = findNotesMatchingHashtags('')
    const projectsReadyToReview = []
    if (notes.length > 0) {
      // Get Project class representation of each note,
      // saving those which are ready for review in array
      for (const n of notes) {
        const np = new Project(n)
        // TODO: somewhere here ignore ones from certain folders
        if (np.isReadyForReview) {
          projectsReadyToReview.push(np)
        }
      }
    }
    // For each readyToReview note get the machine-readable summary line for it
    for (const np of projectsReadyToReview) {
      summaryArray.push(np.basicSummaryLine())
      // console.log(np.basicSummaryLine())
    }
  }
  // sort the list
  const outputArray = summaryArray.slice().sort(
    // $FlowIgnore[unsafe-addition]
    (first, second) => first.split('\t')[0] - second.split('\t')[0]) // order by first field
    
  // write summary to _reviews notes
  outputArray.push("```")
  outputArray.unshift("```")
  outputArray.unshift("---")
  outputArray.unshift(`Last updated: ${nowLocaleDateTime}`)
  outputArray.unshift(`_NB: Do not edit manually. This is a machine-readable list of notes to review, used by \`/start review\` and \`/next review\` Plugin commands._`)
  outputArray.unshift(`# _reviews`)
  reviewsNote.content = outputArray.join('\n')
  console.log(`\twritten ${summaryArray.length} summary lines to note '${reviewListNoteTitle}'`)

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
  // console.log(`${folderList.length} folders`)
  // Iterate over the folders, ignoring any in the pref_foldersToIgnore list
  for (const folder of folderList) {
    if (pref_foldersToIgnore.includes(folder)) {
      continue
    }
    // Get notes that include noteTag in this folder, ignoring subfolders
    const notes = findNotesMatchingHashtags(noteTag, folder, false)
    if (notes.length > 0) {
      // Create array of Project class representation of each note,
      // ignoring any marked as .isArchived
      const projects = []
      // TODO: somewhere here ignore ones from certain folders
      for (const note of notes) {
        const np = new Project(note)
        if (!np.isArchived) {
          projects.push(np)
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
export async function nextReview() {
  console.log('\nnextReview')
  // First update @review(date) on current open note
  const openNote: ?TNote = await completeReview()

  if (openNote != null) {
    // Then update @review(date) in review list note
    await updateReviewListWithComplete(openNote)
  }

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
async function updateReviewListWithComplete(note: TNote) {
  const thisTitle = note.title ?? ''
  console.log(`updateReviewListWithComplete for '${thisTitle}'`)

  // Get note that contains the project list (or create if not found)
  const reviewNote: ?TNote = await returnSummaryNote(reviewListNoteTitle, pref_folderToStore)
  if (reviewNote == null) {
    showMessage(`Oops: I now can't find summary note _reviews`, 'OK')
    console.log(`getNextNoteToReview: error: can't find summary note _reviews`)
    return
  }

  // Now read contents and parse, this time as paragraphs
  const paras = reviewNote.paragraphs
  let inCodeblock = false
  let lineNum: number = -1 // i.e. an invalid number
  for (let i = 1; i < paras.length; i++) {
    const pc = paras[i].content
    if (pc.match('```')) { inCodeblock = !inCodeblock } // toggle state
    if (pc.match(thisTitle) && inCodeblock) {
      // console.log(`\tFound '${thisTitle}' in line '${pc}' at line ${i}`)
      lineNum = i
      break
    }
  }
  if (lineNum >= 1) {
    console.log(`\tRemove line ${lineNum} as its review is completed`)
    reviewNote.removeParagraph(paras[lineNum])
  } else {
    console.log(`\tWarning: _reviews' codeblock unexpectedly missing or empty`)
    return
  }
}

//-------------------------------------------------------------------------------
// Work out the next note to review (if any)
async function getNextNoteToReview(): Promise<?TNote> {
  console.log(`\ngetNextNoteToReview`)

  // Get note that contains the project list (or create if not found)
  const note: ?TNote = await returnSummaryNote(reviewListNoteTitle, pref_folderToStore)
  if (note == null) {
    showMessage(`Oops: I now can't find summary note _reviews`, 'OK')
    console.log(`getNextNoteToReview: error: can't find summary note _reviews`)
    return
  }

  // Now read contents and parse
  // Get first code block and read into array
  const firstCodeBlock = note.content?.split('\n```')[1]
  // console.log(firstCodeBlock)
  if (firstCodeBlock != null && firstCodeBlock !== '') {
    const firstCodeBlockLines = firstCodeBlock.split('\n')
    if (firstCodeBlockLines.length >= 1) {
      const nextNoteTitle = firstCodeBlockLines[1].split('\t')[1] // ignore first line as it will be ```
      console.log(`\tNext project note to review = '${nextNoteTitle}'`)
      const nextNotes = DataStore.projectNoteByTitle(nextNoteTitle, true, false) ?? []
      return nextNotes[0]
    } else {
      return
    }
  } else {
    console.log(`info: _reviews note codeblock was empty`)
    return
  }
}

//-------------------------------------------------------------------------------
// Update the @reviewed(date) in the note in the Editor to today's date
export async function completeReview(): Promise<?TNote> {
  const reviewMentionString = '@reviewed'
  const RE_REVIEW_MENTION = `${reviewMentionString}\\(${RE_DATE}\\)`
  const reviewedTodayString = `${reviewMentionString}(${hyphenatedDate(new Date())})`

  // TODO: Ideally add a check for project completion, and react accordingly

  // only proceed if we're in a valid Project note (with at least 2 lines)
  if (Editor.note == null || Editor.note.type === 'Calendar' || Editor.paragraphs?.length < 2 ) {
    return
  }

  let metadataPara: ?TParagraph

  // get list of @mentions
  const firstReviewedMention = Editor.note?.mentions.find((m) =>
    m.match(RE_REVIEW_MENTION),
  )
  if (firstReviewedMention != null) {
    // find line in currently open note containing @reviewed() mention
    const firstMatch = firstReviewedMention
    // which line is this in?
    for (const para of Editor.paragraphs) {
      if (para.content.match(RE_REVIEW_MENTION)) {
        metadataPara = para
        console.log(
          `\tFound existing ${reviewMentionString}(date) in line ${para.lineIndex}`,
        )
      }
    }
    if (metadataPara == null) {
      // If no metadataPara found, then insert one straight after the title
      console.log(
      `\tCan't find an existing metadata line, so will insert a new second line for it`,
      )
      Editor.insertParagraph('', 1, 'empty')
      metadataPara = Editor.paragraphs[1]
    }
    const metaPara = metadataPara
    // replace with today's date
    const older = metaPara.content
    const newer = older.replace(firstMatch, reviewedTodayString)
    metaPara.content = newer
    console.log(`\tupdating para to '${newer}'`)

    // send update to Editor
    await Editor.updateParagraph(metaPara)
  } else {
    // no existing mention, so append to note's default metadata line
    console.log(
      `\tno matching ${reviewMentionString}(date) string found. Will append to line 1`,
    )
    const metadataPara = Editor.note?.paragraphs[1]
    if (metadataPara == null) {
      return null
    }
    const metaPara = metadataPara
    metaPara.content += ` ${reviewedTodayString}`
    // send update to Editor
    await Editor.updateParagraph(metaPara)
  }
  // return current note, to help next function
  return Editor.note
}
