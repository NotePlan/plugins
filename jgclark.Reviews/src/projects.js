// @flow

//-----------------------------------------------------------------------------
// Commands for working with Project and Area notes, seen in NotePlan notes.
// by @jgclark
// Last updated 3.1.2022 for v0.5.0+ (removing undocumented function)
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Import Helper functions
import {
  updateReviewListAfterReview,
} from './reviews'
import {
  getOrMakeMetadataLine,
} from './reviewHelpers'
import {
  hyphenatedDateString,
} from '../../helpers/dateTime'
import {
  getOrMakeNote
} from '../../helpers/note'
import {
  getFolderFromFilename
} from '../../helpers/folders'
import {
  getInput
} from '../../helpers/userInput'
import {
  insertNamedTemplate,
} from '../../nmn.Templates/src/index'

//-------------------------------------------------------------------------------
// Add @completed(<today's date>) to the current note in the Editor
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
