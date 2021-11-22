// @flow
// -----------------------------------------------------------------------------
// Plugin to help move selected paragraphs to other notes
// Jonathan Clark
// v0.5.1, 3.10.2021
// -----------------------------------------------------------------------------

import {
  parasToText,
  calcSmartPrependPoint,
} from '../../helpers/paragraph'
import { allNotesSortedByChanged } from '../../helpers/note'
import { todaysDateISOString } from '../../helpers/dateTime'
import { chooseHeading } from '../../helpers/userInput'
import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'


//--------------------------------------------------------------------------------------------------------------------
// Settings
const DEFAULT_FILER_OPTIONS = `  filer: {
    addDateBacklink: true, // whether to insert date link in place of the moved text
  },
`

let pref_addDateBacklink = true

// -----------------------------------------------------------------------------

/**
 * Move text to a different note. 
 * TODO(@EduardMe): doesn't work when the destination daily note doesn't already exist.
 *   Waiting for better date picker from Eduard before working further on this.
 * 
 * This is how we identify what we're moving (in priority order):
 * - current selection
 * - current heading + its following section
 * - current line
 * - current line (plus any indented paragraphs)
 * @author @jgclark
 */
export async function fileParas(): Promise<void> {
  const { content, selectedParagraphs, note } = Editor
  if (content == null || selectedParagraphs == null || note == null) {
    // No note open, or no paragraph selection (perhaps empty note), so don't do anything.
    console.log('fileParas: warning: No note open.')
    return
  }

  // Get config settings from Template folder _configuration note
  const filerConfig = await getOrMakeConfigurationSection(
    'filer',
    DEFAULT_FILER_OPTIONS,
    // no minimum config
  )
  // for once it doesn't matter if filerConfig returns null (though it shouldn't)
  // $FlowIgnore[incompatible-use]
  pref_addDateBacklink = filerConfig.addDateBacklink ?? true
  // console.log(pref_addDateBacklink)

  const allParas = Editor.paragraphs
  const selection = Editor.selection
  if (selection == null) {
    return
  }
  const range = Editor.paragraphRangeAtCharacterIndex(selection.start)
  console.log(`\nfileParas: selection ${JSON.stringify(range)}`)

  // Work out what paragraph number this selected para is
  let firstSelParaIndex = 0
  for (let i = 0; i < allParas.length; i++) {
    const p = allParas[i]
    if (p.contentRange?.start === range.start) {
      firstSelParaIndex = i
      break
    }
  }
  console.log(`  First para index: ${firstSelParaIndex}`)

  let parasToMove: Array<TParagraph> = []
  if (selectedParagraphs.length > 1) {
    // we have a selection of paragraphs, so use them
    parasToMove = [...selectedParagraphs]
    console.log(`  Found ${parasToMove.length} selected paras`)
  } else {
    // we have just one paragraph selected -- the current one
    const para = selectedParagraphs[0]
    // paraDetails(para)
    console.log(
      `  Para '${para.content}' type: ${para.type}, index: ${firstSelParaIndex}`,
    )
    // if this is a heading, find the rest of the sections
    if (para.type === 'title') {
      // includes all heading levels
      const thisHeadingLevel = para.headingLevel
      console.log(`  Found heading level ${thisHeadingLevel}`)
      parasToMove.push(para) // make this the first line to move
      // Work out how far this section extends. (NB: headingRange doesn't help us here.)
      for (let i = firstSelParaIndex + 1; i < allParas.length; i++) {
        const p = allParas[i]
        if (p.type === 'title' && p.headingLevel <= thisHeadingLevel) {
          break
        } // stop as new heading of same or higher level
        parasToMove.push(p)
      }
      console.log(`  Found ${parasToMove.length} heading section lines`)
    } else {
      // This isn't a heading.
      // Now see if there are following indented lines to move as well
      const startingIndentLevel = para.indents
      console.log(
        `  Found single line with indent level ${startingIndentLevel}`,
      )
      parasToMove.push(para)
      for (let i = firstSelParaIndex + 1; i < allParas.length; i++) {
        const p = allParas[i]
        if (p.indents <= startingIndentLevel) {
          // stop as this para is same or less indented than the starting line
          break
        }
        parasToMove.push(p)
      }
      console.log(`  Found ${parasToMove.length - 1} indented paras`)
    }
  }

  // If this is a calendar note we've moving from, and the user wants to
  // create a date backlink, then append backlink to the first para in parasToMove
  if (pref_addDateBacklink && note.type === 'Calendar') {
    parasToMove[0].content = `${parasToMove[0].content} >${todaysDateISOString}`
  }

  // There's no API function to work on multiple paragraphs,
  // or one to insert an indented paragraph, so we need to convert the paragraphs
  // to a raw text version which we can include
  const parasAsText = parasToText(parasToMove)

  // Decide where to move to
  // Ask for the note we want to add the paras
  const notes = allNotesSortedByChanged()

  const res = await CommandBar.showOptions(
    notes.map((n) => n.title ?? 'untitled'),
    `Select note to move ${parasToMove.length} lines to`,
  )
  const destNote = notes[res.index]

  // Ask to which heading to add the paras
  const headingToFind = (await chooseHeading(destNote, true)).toString() // don't know why this coercion is required for flow

  console.log(`  Moving to note: ${destNote.title ?? 'untitled'} under heading: '${headingToFind}'`)

  // Add to new location
  // Currently there's no API function to deal with multiple paragraphs, but we can
  // insert a raw text string
  // Add text directly under the heading in the note
  // note.addParagraphBelowHeadingTitle(parasToMove, 'empty', heading.content, false, false);
  const destNoteParas = destNote.paragraphs
  let insertionIndex = null
  if (headingToFind === destNote.title || headingToFind.includes('(top of note)')) { // i.e. the first line in project or calendar note
    insertionIndex = calcSmartPrependPoint(destNote)
    console.log(`  -> top of note, line ${insertionIndex}`)
  } else if (headingToFind.includes('(bottom of note)')) {
    insertionIndex = destNoteParas.length + 1
    console.log(`  -> bottom of note, line ${insertionIndex}`)
  } else {
    for (let i = 0; i < destNoteParas.length; i++) {
      const p = destNoteParas[i]
      if (p.content.trim() === headingToFind && p.type === 'title') {
        insertionIndex = i + 1
        break
      }
    }
    console.log(`  -> other heading, line ${String(insertionIndex)}`)
  }
  if (insertionIndex === null) {
    console.log(`  Error: insertionIndex is null. Stopping.`)
    return
  }
  // console.log(`  Inserting at index ${insertionIndex}`)
  await destNote.insertParagraph(parasAsText, insertionIndex, 'empty')

  // delete from existing location
  // console.log(`  About to remove ${parasToMove.length} paras (parasToMove)`)
  note.removeParagraphs(parasToMove)
}
