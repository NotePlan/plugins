// @flow

//-----------------------------------------------------------------------------
// Supporting GTD Reviews
// by Jonathan Clark
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// User settings: TODO: move to proper preferences system, when available in NP
const pref_metadataLineIndex = 1

//-----------------------------------------------------------------------------
// Helper functions
import {
  RE_DATE, // find dates of form YYYY-MM-DD
  RE_TIME, // find '12:23' with optional '[ ][AM|PM|am|pm]'
  showMessage,
  // chooseOption,
  // monthsAbbrev,
  // todaysDateISOString,
  // getYearMonthDate,
  // monthNameAbbrev,
  // withinDateRange,
  // dateStringFromCalendarFilename,
  // unhyphenateDateString,
  hyphenatedDate,
  // filenameDateString,
} from '../../helperFunctions'


//-------------------------------------------------------------------------------
// Complete current review, then jump to the next one to review
export async function nextReview() {
  // First update @review(date) on current open note
  console.log('nextReview: stage 1')
  const openNote = await editorSetReviewDate()
  
  // Then update @review(date) in review list note
  console.log('nextReview: stage 2')
  await updateReviewListWithComplete(openNote)

  // Read review list to work out what's the next one to review
  console.log('nextReview: stage 3')
  const noteToReview: TNote = await getNextNoteToReview()

  // Open that note in editor
  if (noteToReview !== undefined) {
    console.log('nextReview: stage 4')
    Editor.openNoteByFilename(noteToReview.filename)
  } else {
    console.log("nextReview: 🎉 No more notes to review!")
    await showMessage("🎉 No more notes to review!")
  }
}

//-------------------------------------------------------------------------------
// Complete current review, then jump to the next one to review
async function updateReviewListWithComplete(note: TNote) {
  if (note == null || note.type === 'Calendar') {
    console.log('completeReviewUpdateList: error: called with null or Calendar note type')
  }
  console.log(`completeReviewUpdateList for '${note.title}'`)


  // TODO: does this need to be async?
}

//-------------------------------------------------------------------------------
// Complete current review, then jump to the next one to review
export async function getNextNoteToReview(): Promise<?TNote> {
  console.log(`getNextNoteToReview`)


  // TODO: does this need to be async?
}


//-------------------------------------------------------------------------------
// Update the @reviewed(date) in the note in the Editor to today's date
export async function editorSetReviewDate(): Promise<?TNote> {
  const reviewMentionString = '@reviewed'
  const RE_REVIEW_MENTION = `${reviewMentionString}\\(${RE_DATE}\\)`
  const reviewedTodayString = `${reviewMentionString}(${hyphenatedDate(new Date())})`

  // only proceed if we're in a valid Project note // TODO: Need a minimum length too?
  if (Editor.note == null || Editor.note.type === 'Calendar') {
    return undefined
  }

  let metadataPara: TParagraph
  
  // get list of @mentions
  const reviewedMentions = Editor.note?.mentions.filter((m) => m.match(RE_REVIEW_MENTION))
  if (reviewedMentions != null && reviewedMentions.length > 0) {
    // find line in currently open note containing @reviewed() mention
    const firstMatch = reviewedMentions[0]
    // which line is this in?
    const ps = Editor.paragraphs // TODO: Need a default here
    for (let i = 0; i < ps.length; i++) {
      if (ps[i].content.match(RE_REVIEW_MENTION)) {
        metadataPara = ps[i]
        console.log(`\tFound existing ${reviewMentionString}(date) in line ${i}`)
      }
    }
    // replace with today's date
    const older = metadataPara.content
    const newer = older.replace(firstMatch, reviewedTodayString)
    metadataPara.content = newer
    console.log(`\tupdating para to '${newer}'`)
  } else {
    // no existing mention, so append to note's default metadata line
    console.log(`\tno matching ${reviewMentionString}(date) string found. Will append to line ${pref_metadataLineIndex}`)
    const metadataPara = Editor.note?.paragraphs[pref_metadataLineIndex]
    metadataPara.content += ` ${reviewedTodayString}`
  }
  // send update to Editor
  await Editor.updateParagraph(metadataPara)
  // return current note, to help next function
  return Editor.note
}
