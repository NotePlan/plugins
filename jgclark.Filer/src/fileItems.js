// @flow
// -----------------------------------------------------------------------------
// Plugin to help move selected selectedParagraphs to other notes
// Jonathan Clark
// v0.6.0, 9.12.2021
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
    useExtendedBlockDefinition: false
  },
`

// -----------------------------------------------------------------------------

/**
 * Move text to a different note. 
 * TODO(@EduardMe): doesn't work when the destination daily note doesn't already exist.
 * TODO: Waiting for better date picker from Eduard before working further on this.
 * 
 * This is how we identify what we're moving (in priority order):
 * - current selection
 * - current heading + its following section
 * - current line
 * - current line (plus any paragraphs directly following). NB: the Setting
 *   'useExtendedBlockDefinition' decides whether these directly following paragaphs
 *   have to be indented (false) or can take all following lines at same level until next
 *   empty line as well.
 * @author @jgclark
 */
export async function fileParas(): Promise<void> {
  console.log(`\nfileParas`)
  const { content, selectedParagraphs, note } = Editor
  if (content == null || selectedParagraphs == null || note == null) {
    // No note open, or no selectedParagraph selection (perhaps empty note), so don't do anything.
    console.log('warning: No note open, so stopping.')
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
  const pref_addDateBacklink = !!filerConfig.addDateBacklink ?? true // !! ensures first item is boolean
  console.log(pref_addDateBacklink)
  // $FlowIgnore[incompatible-use]
  const pref_useExtendedBlockDefinition = !!filerConfig.useExtendedBlockDefinition ?? false // !! ensures first item is boolean
  console.log(pref_useExtendedBlockDefinition)

  const allParas = Editor.selectedParagraphs
  const selection = Editor.selection
  if (selection == null) {
    console.log('warning: No selection found, so stopping.')
    return
  }
  const range = Editor.paragraphRangeAtCharacterIndex(selection.start)
  console.log(`selection: ${JSON.stringify(range)}`)

  // Work out what selectedParagraph number this selected selectedPara is
  let firstSelParaIndex = 0
  for (let i = 0; i < allParas.length; i++) {
    const p = allParas[i]
    if (p.contentRange?.start === range.start) {
      firstSelParaIndex = i
      break
    }
  }
  console.log(`  First selectedPara index: ${firstSelParaIndex}`)

  let parasInBlock: Array<TParagraph> = []
  if (selectedParagraphs.length > 1) {
    // we have a selection of selectedParagraphs, so use them
    parasInBlock = [...selectedParagraphs]
    console.log(`  Found ${parasInBlock.length} selected selectedParas`)
  } else {
    parasInBlock = getParagraphBlock(allParas, firstSelParaIndex, pref_useExtendedBlockDefinition)
  }

  // If this is a calendar note we've moving from, and the user wants to
  // create a date backlink, then append backlink to the first selectedPara in parasInBlock
  if (pref_addDateBacklink && note.type === 'Calendar') {
    parasInBlock[0].content = `${parasInBlock[0].content} >${todaysDateISOString}`
  }

  // There's no API function to work on multiple selectedParagraphs,
  // or one to insert an indented selectedParagraph, so we need to convert the selectedParagraphs
  // to a raw text version which we can include
  const selectedParasAsText = parasToText(parasInBlock)

  // Decide where to move to
  // Ask for the note we want to add the selectedParas
  const notes = allNotesSortedByChanged()

  const res = await CommandBar.showOptions(
    notes.map((n) => n.title ?? 'untitled'),
    `Select note to move ${parasInBlock.length} lines to`,
  )
  const destNote = notes[res.index]

  // Ask to which heading to add the selectedParas
  const headingToFind = (await chooseHeading(destNote, true)).toString() // don't know why this coercion is required for flow

  console.log(`  Moving to note: ${destNote.title ?? 'untitled'} under heading: '${headingToFind}'`)

  // Add to new location
  // Currently there's no API function to deal with multiple selectedParagraphs, but we can
  // insert a raw text string
  // Add text directly under the heading in the note
  // note.addParagraphBelowHeadingTitle(parasInBlock, 'empty', heading.content, false, false);
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
  await destNote.insertParagraph(selectedParasAsText, insertionIndex, 'empty')

  // delete from existing location
  // console.log(`  About to remove ${parasInBlock.length} selectedParas (parasInBlock)`)
  note.removeParagraphs(parasInBlock)
}

/**
 * Get the set of paragraphs that make up this block based on the current paragraph.
 * This is how we identify the block:
 * - current line, plus any indented paragraphs that directly follow it
 * - current line, plus if this line is a heading, its following section
 * NB: the plugin setting 'useExtendedBlockDefinition' decides whether the directly following
 *   paragaphs have to be further indented or can take all following lines at same level until next
 *   empty line as well. Default is false.
 * @author @jgclark
 * @param {[TParagraph]} allParas - all selectedParas in the note
 * @param {number} selectedParaIndex - the index of the current Paragraph
 * @param {boolean} useExtendedBlockDefinition - ???
 * @return {[TParagraph]} the set of selectedParagraphs in the block
 */
export function getParagraphBlock(
  allParas: $ReadOnlyArray<TParagraph>,
  selectedParaIndex: number,
  useExtendedBlockDefinition: boolean
): Array<TParagraph> {
  const parasInBlock: Array<TParagraph> = []
  const selectedPara = allParas[selectedParaIndex]
  // selectedParaDetails(selectedPara)
  console.log(
    `  Para '${selectedPara.content}' type: ${selectedPara.type}, index: ${selectedParaIndex}`,
  )
  // if this is a heading, find the rest of its section
  if (selectedPara.type === 'title') {
    // includes all heading levels
    const thisHeadingLevel = selectedPara.headingLevel
    console.log(`  Found heading level ${thisHeadingLevel}`)
    parasInBlock.push(selectedPara) // make this the first line to move
    // Work out how far this section extends. (NB: headingRange doesn't help us here.)
    for (let i = selectedParaIndex + 1; i < allParas.length; i++) {
      const p = allParas[i]
      if (p.type === 'title' && p.headingLevel <= thisHeadingLevel) {
        break
      } // stop as new heading of same or higher level
      parasInBlock.push(p)
    }
    console.log(`  Found ${parasInBlock.length} heading section lines`)
  } else {
    // This isn't a heading.
    // Now see if there are following indented lines to move as well
    const startingIndentLevel = selectedPara.indents
    console.log(
      `  Found single line with indent level ${startingIndentLevel}`,
    )
    parasInBlock.push(selectedPara)
    for (let i = selectedParaIndex + 1; i < allParas.length; i++) {
      const p = allParas[i]
      if (useExtendedBlockDefinition) {
        // include line unless we hit a new heading, an empty line, or a less-indented line
        // TODO:
        // TODO: also thing about horizontal rules and lower priority headings
      } 
      else if (p.indents <= startingIndentLevel) {
        // stop as this selectedPara is same or less indented than the starting line
        break
      }
      parasInBlock.push(p)
    }
    console.log(`  Found ${parasInBlock.length - 1} indented selectedParas`)
  }
  return parasInBlock
}