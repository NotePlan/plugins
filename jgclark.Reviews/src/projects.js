// @flow

//-----------------------------------------------------------------------------
// Commands for working with Project and Area notes, seen in NotePlan notes.
// by @jgclark
// Last updated 21.1.2022 for v0.5.2, @jgclark
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Import Helper functions
import { updateReviewListAfterReview } from './reviews'
import { hyphenatedDateString } from '../../helpers/dateTime'
import { getFolderFromFilename } from '../../helpers/folders'
import {
  displayTitle,
  titleAsLink,
} from '../../helpers/general'
import { getOrMakeNote } from '../../helpers/note'
import { getOrMakeMetadataLine } from '../../helpers/paragraph'
import {
  getInput,
  showMessageYesNo
} from '../../helpers/userInput'
import { insertNamedTemplate } from '../../nmn.Templates/src/index'
import { getOverlappingDaysInIntervals } from 'date-fns'

//-------------------------------------------------------------------------------
/**
 * Close a Project/Area note by
 * - adding @completed(<today's date>) to the current note in the Editor
 * - add '#archive' flag to metadata line
 * - remove from this plugin's review list
 * - add to a yearly 'Completed Projects' list in the Summaries folder (if present)
 * - offer to move it to the @Archive
 * @author @jgclark
 */
export async function completeProject(): Promise<void> {
  const completedMentionString = '@completed'
  // TODO: make proper settings
  const pref_SummaryFolder = 'Summaries'
  const pref_completedListHeading = 'Completed Projects/Areas'
  // only proceed if we're in a valid Project note (with at least 2 lines)
  const { note, filename } = Editor
  if (note == null || note.type === 'Calendar' || Editor.paragraphs?.length < 2) {
    console.log(`Warning: not in a valid Project note.`)
    return
  }

  const todayStr = hyphenatedDateString(new Date())
  const yearStr = todayStr.substring(0, 4)
  const completedTodayString = `${completedMentionString}(${todayStr})`
  const metadataLine = getOrMakeMetadataLine()

  // add '#archive' and '@completed(date)' to note's default metadata line
  console.log(`\twill append ${completedTodayString} string to line ${metadataLine}`)
  const metadataPara = note.paragraphs[metadataLine]
  if (metadataPara == null) {
    return
  }
  const metaPara = metadataPara
  metaPara.content = `#archive ${metaPara.content} ${completedTodayString}`
  // send update to Editor
  Editor.updateParagraph(metaPara)

  // remove this note from the review list
  await updateReviewListAfterReview(note)

  // Now add to the Summary note for this year (if present)
  if (DataStore.folders.includes('Summaries')) {
    const lineToAdd = `${titleAsLink(note)} completed ${todayStr}`
    const summaryNote = await getOrMakeNote(yearStr, pref_SummaryFolder)
    if (summaryNote != null) {
      console.log(`Will add '${lineToAdd}' to note '${summaryNote.filename}'`)
      // FIXME(EduardMe): there's a bug in the API
      summaryNote.addParagraphBelowHeadingTitle(
        lineToAdd,
        'list',
        pref_completedListHeading,
        true, // append
        true  // do create heading if not found already
      )
    }
  }

  // Offer to move it to the @Archive
  if (filename != null &&
    (await showMessageYesNo('Shall I move this note to the Archive?', ['Yes', 'No'])) === 'Yes') {
    const newFilename = DataStore.moveNote(filename, '@Archive')
  }
}
