// @flow

//-----------------------------------------------------------------------------
// Commands for working with project, seen in NotePlan notes.
// by @jgclark
// v0.3.0, 21.8.2021
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Import Helper functions
import {
  // applyNamedTemplate,
  insertNamedTemplate,
} from '../../nmn.Templates/src/index'
import {
  hyphenatedDateString,
} from '../../helpers/dateTime'
import {
  updateReviewListAfterReview,
} from './reviews'
import {
  getOrMakeMetadataLine,
} from './reviewHelpers'

//-------------------------------------------------------------------------------
// Create a new project
export async function addProject(): Promise<void> {
  
  // NB: WAITING: Update when @EduardMe adds a native date picker
  console.log(`\naddProject(very basic version):`)

  // Simply apply daily template, using Template system
  await insertNamedTemplate('New Project Template')
}

//-------------------------------------------------------------------------------
// Update the @reviewed(date) in the note in the Editor to today's date
export async function completeProject(): Promise<void> {
  console.log(`\ncompleteProject():`)
  const completedMentionString = '@completed'
  const completedTodayString = `${completedMentionString}(${hyphenatedDateString(new Date())})`

  // only proceed if we're in a valid Project note (with at least 2 lines)
  if (Editor.note == null || Editor.note.type === 'Calendar' || Editor.paragraphs?.length < 2 ) {
    return
  }

  const metadataLine = getOrMakeMetadataLine()
  // append to note's default metadata line
  console.log(
    `\twill append ${completedTodayString} string to line ${metadataLine}`,
  )
  const metadataPara = Editor.note?.paragraphs[metadataLine]
  if (metadataPara == null) {
    return
  }
  const metaPara = metadataPara
  metaPara.content += ` ${completedTodayString}`
  // send update to Editor
  Editor.updateParagraph(metaPara)
  // remove this note from the review list
  // $FlowIgnore[incompatible-call]
  await updateReviewListAfterReview(Editor.note)
 }
