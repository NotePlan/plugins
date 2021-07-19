// @flow

//-----------------------------------------------------------------------------
// Supporting GTD Reviews
// by @jgclark
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// User settings: TODO: move to proper preferences system
const pref_metadataLineIndex = 1
const pref_noteTypeTags = '#area' // or #area, #archive etc.

//-----------------------------------------------------------------------------
// Helper functions
import {
  RE_DATE, // find dates of form YYYY-MM-DD
  showMessage,
  // chooseOption,
  // todaysDateISOString,
  // getYearMonthDate,
  hyphenatedDate,
} from '../../helperFunctions'

import { returnSummaryNote } from './noteTypeSummary'

//-------------------------------------------------------------------------------
// Complete current review, then jump to the next one to review
export async function nextReview() {
  // First update @review(date) on current open note
  const openNote: ?TNote = await editorSetReviewDate()

  if (openNote == null) {
    showMessage('Please open a note first', 'OK')
    return
  }

  // Then update @review(date) in review list note
  await updateReviewListWithComplete(openNote)

  // Read review list to work out what's the next one to review
  const noteToReview: ?TNote = await getNextNoteToReview()

  // Open that note in editor
  if (noteToReview != null) {
    Editor.openNoteByFilename(noteToReview.filename)
  } else {
    console.log('nextReview: 🎉 No more notes to review!')
    await showMessage('🎉 No more notes to review!')
  }
}

//-------------------------------------------------------------------------------
// Update the review list after completing a review
async function updateReviewListWithComplete(note: TNote) {
  if (note == null || note.type === 'Calendar') {
    console.log(
      'completeReviewUpdateList: error: called with null or Calendar note type',
    )
  }
  console.log(`completeReviewUpdateList for '${note.title ?? ''}'`)

  // TODO: does this need to be async?
}

//-------------------------------------------------------------------------------
// Work out the next note to review (if any)
export async function getNextNoteToReview(): Promise<?TNote> {
  console.log(`getNextNoteToReview`)
  // TODO: does this need to be async?

  // Get note that contains the project list (or create if not found)
  // TODO: work through next pref being single or plural
  const note: ?TNote = await returnSummaryNote(pref_noteTypeTags)
  if (note != null) {
    showMessage(`Oops: I now can't find summary note for ${pref_noteTypeTags}`, 'OK')
    console.log(`getNextNoteToReview: error: can't find summary note for ${pref_noteTypeTags}`)
    return
  }
  // Check date on project list: if its more than (say) 3 days old, offer to recreate it
  // TODO
  // console.log(`\tFound existing summary note, ... days old`)

  // Now read contents and parse
  console.log(`\tAbout to read summary note ${note.title}`)

  // Select those which are overdue, and order
  console.log(`\tFound ... overdue project notes`)

  // Trigger review of that note
  console.log(`\tTriggering review of project note ...`)
}

//-------------------------------------------------------------------------------
// Update the @reviewed(date) in the note in the Editor to today's date
export async function editorSetReviewDate(): Promise<?TNote> {
  const reviewMentionString = '@reviewed'
  const RE_REVIEW_MENTION = `${reviewMentionString}\\(${RE_DATE}\\)`
  const reviewedTodayString = `${reviewMentionString}(${hyphenatedDate(
    new Date(),
  )})`

  // only proceed if we're in a valid Project note (with at least 2 lines)
  if (Editor.note == null || Editor.note.type === 'Calendar' || Editor.paragraphs?.length < 2 ) {
    return undefined
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
      // What if Editor.paragraphs is an empty array?
      return null
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
      `\tno matching ${reviewMentionString}(date) string found. Will append to line ${pref_metadataLineIndex}`,
    )
    const metadataPara = Editor.note?.paragraphs[pref_metadataLineIndex]
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
