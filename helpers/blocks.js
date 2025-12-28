// @flow
//-----------------------------------------------------------------------------
// Helpers for working with blocks of paragraphs
//-----------------------------------------------------------------------------

import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import { trimString } from '@helpers/dataManipulation'
import { isTitleWithEqualOrLowerHeadingLevel } from '@helpers/headings'
import { findEndOfActivePartOfNote, findStartOfActivePartOfNote } from '@helpers/paragraph'
import { isOpenOrScheduled } from '@helpers/utils'

//----------------------------------------------------------------------------
// Constants

const BREAK_PARA_TYPES: Array<string> = ['empty', 'separator', 'title']

//----------------------------------------------------------------------------

/**
 * Breaks an array of objects into "blocks" based on the specified block types
 * The resulting array of blocks will be an array of arrays, where each block is an array of TParagraphs
 * Blocks are broken based on the following block types: 'empty', 'separator',
 * or a 'title'.headingLevel <= the last title level in the block
 * Separators and empty lines are included as their own blocks
 * @author @dwertheimer
 *
 * @param {Array<TParagraph>} array - The array of objects to break into blocks.
 * @return {Array<Array<TParagraph>>} An array of blocks, where each block is an array of objects.
 */
export function breakParagraphsIntoBlocks(array: Array<TParagraph>): Array<Array<TParagraph>> {
  const breakParaTypes = ['empty', 'separator']
  const blocks = []
  let currentBlock: Array<TParagraph> = []
  let lowestHeadingLevel = Infinity

  for (const item of array) {
    const isTitleChange = currentBlock.length > 0 && isTitleWithEqualOrLowerHeadingLevel(item, lowestHeadingLevel)
    if (isBreakParaType(item, breakParaTypes)) {
      currentBlock.length ? blocks.push(currentBlock, [item]) : blocks.push([item])
      currentBlock = [] // Reset the current block
      lowestHeadingLevel = Infinity // Reset the lowest heading level
    } else if (isTitleChange) {
      blocks.push(currentBlock)
      currentBlock = [item]
      lowestHeadingLevel = item.headingLevel
    } else {
      currentBlock.push(item) // Add the item to the current block
      if (item.headingLevel < lowestHeadingLevel) {
        lowestHeadingLevel = item.headingLevel
      }
    }
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock) // Add the last block
  }

  return blocks
}

/**
 * Checks if an item's type is one of the specified breakParaTypes.
 * @author @dwertheimer
 * 
 * @param {TParagraph} item - The object to check.
 * @param {Array<string>} breakParaTypes - An array of block types to check against, default = BREAK_PARA_TYPES
 * @return {boolean} True if the item's type is in breakParaTypes, false otherwise.
 */
export function isBreakParaType(item: TParagraph, breakParaTypes: Array<string> = BREAK_PARA_TYPES): boolean {
  return breakParaTypes.includes(item.type)
}

/**
 * Get the set of paragraphs that make up this block based on the current paragraph.
 * This is how we identify the block:
 * - current line, plus any children (indented paragraphs) that directly follow it
 * - if this line is a heading, then the current line and its following section
 * - if 'useTightBlockDefinition' is false (the default), then section finishes at the next same-level heading
 * - if 'useTightBlockDefinition' is true, then section finishes at the next empty line, same-level heading or horizontal line.
 *
 * If 'includeFromStartOfSection' is true (and it is by default false), then it can include more lines, working as if the cursor is on the preceding heading line, and then using the same rules as above.
 * - Note: the title line of a note is not included in 'includeFromStartOfSection', as it makes no sense to move the title of a note.
 * @author @jgclark
 * @tests available in jest file
 *
 * @param {Array<TParagraph>} allParas - all selectedParas in the note
 * @param {number} selectedParaIndex - the index of the current Paragraph
 * @param {boolean} includeFromStartOfSection
 * @param {boolean} useTightBlockDefinition
 * @returns {Array<TParagraph>} the set of selectedParagraphs in the block
 */
export function getParagraphBlock(
  note: CoreNoteFields,
  selectedParaIndex: number,
  includeFromStartOfSection: boolean = false,
  useTightBlockDefinition: boolean = false,
): Array<TParagraph> {
  const parasInBlock: Array<TParagraph> = [] // to hold set of paragraphs in block to return
  const startActiveLineIndex = findStartOfActivePartOfNote(note)
  const allParas = note.paragraphs
  const lastLineIndex = allParas.length - 1
  let startLine = selectedParaIndex
  let selectedPara = allParas[startLine]
  logDebug(
    `NPParagraph / getParagraphBlock`,
    `Starting at lineIndex ${selectedParaIndex} with start active/last line = ${startActiveLineIndex}/${lastLineIndex} with ${String(includeFromStartOfSection)}/${String(
      useTightBlockDefinition,
    )}: '${trimString(selectedPara.content, 50)}'`,
  )

  if (includeFromStartOfSection) {
    // First look earlier to find earlier lines up to a blank line or horizontal rule;
    // include line unless we hit a new heading, an empty line, or a less-indented line.
    for (let i = selectedParaIndex; i >= startActiveLineIndex; i--) {
      const p = allParas[i]
      // logDebug(`NPParagraph / getParagraphBlock`, `  ${i} / ${p.type} / ${trimString(p.content, 50)}`)
      if (p.type === 'separator') {
        // logDebug(`NPParagraph / getParagraphBlock`, `   - ${i}: Found separator line`)
        startLine = i + 1
        break
      } else if (p.content === '') {
        // logDebug(`NPParagraph / getParagraphBlock`, `  - ${i}: Found blank line`)
        startLine = i + 1
        break
      } else if (p.type === 'title' && p.headingLevel === 1) {
        // logDebug(`NPParagraph / getParagraphBlock`, `  - ${i}: Found title`)
        startLine = i + 1
        break
      } else if (p.type === 'title' && p.headingLevel > 1) {
        // logDebug(`NPParagraph / getParagraphBlock`, `  - ${i}: Found other heading`)
        startLine = i
        break
      }
      // If it's the last iteration and we get here, then we had a continuous block, so make that
      if (i === startActiveLineIndex) {
        // logDebug(`NPParagraph / getParagraphBlock`, `  - ${i}: Found start of active part of note`)
        startLine = i
      }
    }
    // logDebug(`NPParagraph / getParagraphBlock`, `For includeFromStartOfSection worked back and will now start at line ${startLine}`)
  }
  selectedPara = allParas[startLine]

  // if the first line is a heading, find the rest of its section
  if (selectedPara.type === 'title') {
    // includes all heading levels
    const thisHeadingLevel = selectedPara.headingLevel
    // logDebug(`NPParagraph / getParagraphBlock`, `- Block starts line ${startLine} at heading '${selectedPara.content}' level ${thisHeadingLevel}`)
    parasInBlock.push(selectedPara) // make this the first line to move
    // Work out how far this section extends. (NB: headingRange doesn't help us here.)
    // logDebug(`NPParagraph / getParagraphBlock`, `- Scanning forward through rest of note ...`)
    for (let i = startLine + 1; i <= lastLineIndex; i++) {
      const p = allParas[i]
      if (p.type === 'title' && p.headingLevel <= thisHeadingLevel) {
        // logDebug(`NPParagraph / getParagraphBlock`, `  - ${i}: Found new heading of same or higher level: "${p.content}" -> stopping`)
        break
      } else if (useTightBlockDefinition && p.type === 'separator') {
        // logDebug(`NPParagraph / getParagraphBlock`, `  - ${i}: Found HR: "${p.content}" -> stopping`)
        break
      } else if (useTightBlockDefinition && p.content === '') {
        // logDebug(`NPParagraph / getParagraphBlock`, `  - ${i}: Found blank line -> stopping`)
        break
      }
      // logDebug(`NPParagraph / getParagraphBlock`, `  - Adding to results: line[${i}]: ${p.type}: "${trimString(p.content, 50)}"`)
      parasInBlock.push(p)
    }
    // logDebug(`NPParagraph / getParagraphBlock`, `- Found ${parasInBlock.length} heading section lines`)
  } else {
    // This isn't a heading
    const startingIndentLevel = selectedPara.indents
    // logDebug(`NPParagraph / getParagraphBlock`, `Found single line with indent level ${startingIndentLevel}. Now scanning forward through rest of note ...`)
    parasInBlock.push(selectedPara)

    // See if there are following indented lines to move as well
    for (let i = startLine + 1; i <= lastLineIndex; i++) {
      const p = allParas[i]
      // logDebug(`NPParagraph / getParagraphBlock`, `  ${i} / indent ${p.indents} / ${trimString(p.content, 50)}`)
      if (useTightBlockDefinition && p.type === 'separator') {
        // stop if horizontal line
        // logDebug(`NPParagraph / getParagraphBlock`, `  - ${i}: Found HR -> stopping`)
        break
      } else if (useTightBlockDefinition && p.content === '') {
        // logDebug(`NPParagraph / getParagraphBlock`, `  - ${i}: Found blank line -> stopping`)
        break
      } else if (p.type === 'title') {
        // logDebug(`NPParagraph / getParagraphBlock`, `  - ${i}: Found heading -> stopping`)
        break
      } else if (p.indents < startingIndentLevel && !includeFromStartOfSection) {
        // if we aren't using the Tight Block Definition, then
        // stop as this selectedPara is less indented than the starting line
        // logDebug(`NPParagraph / getParagraphBlock`, `  - ${i}: Found same or lower indent -> stopping`)
        break
      }
      parasInBlock.push(p) // add onto end of array
    }
  }

  logDebug(`NPParagraph / getParagraphBlock`, `  - Found ${parasInBlock.length} paras in block starting with: "${parasInBlock[0].content}"`)
  // for (const pib of parasInBlock) {
  //   // logDebug(`NPParagraph / getParagraphBlock`, `  ${pib.content}`)
  // }
  return parasInBlock
}

/**
 * Find the '## Done' section in a note, or create it at the end if not present.
 * Returns the lineIndex of the Done heading.
 * @param {TNote} note
 * @returns {number} lineIndex of the '## Done' heading
 */
export function getOrCreateDoneSection(note: TNote): number {
  const paras = note.paragraphs
  const endOfActive = findEndOfActivePartOfNote(note)
  const existingDone = paras.find((p, i) =>
    i > endOfActive &&
    p.type === 'title' &&
    p.content.trim().startsWith('Done'),
  )
  if (existingDone && typeof existingDone.lineIndex === 'number') {
    logDebug('moveCompletedToDone', `Found existing '## Done' at line ${existingDone.lineIndex}`)
    return existingDone.lineIndex
  }

  // Create a new '## Done' heading at the end of the note
  const insertionIndex = paras.length
  logDebug('moveCompletedToDone', `Creating new '## Done' heading at line ${insertionIndex}`)
  note.insertParagraph('## Done', insertionIndex, 'text')

  // After insertion, ensure we return the actual line index of the new heading
  const updated = note.paragraphs
  const newDone = updated.find((p) =>
    p.type === 'title' &&
    p.content.trim().startsWith('Done'),
  )
  if (newDone && typeof newDone.lineIndex === 'number') {
    return newDone.lineIndex
  }
  // Fallback: return original insertion index
  return insertionIndex
}

/**
 * Get the block that makes up the '## Done' section (heading + following lines until next level-2 heading).
 * If the '## Done' section doesn't yet exist, returns an empty array.
 * @param {TNote} note
 * @returns {Array<TParagraph>}
 */
export function getDoneSectionBlock(note: TNote): Array<TParagraph> {
  const doneHeading = note.paragraphs.find(
    (p) => p.type === 'title' && p.headingLevel === 2 && p.content.trim().startsWith('Done'),
  )
  if (!doneHeading || typeof doneHeading.lineIndex !== 'number') {
    return []
  }
  const block = getParagraphBlock(note, doneHeading.lineIndex, false, false)
  return block
}

/**
 * Return true if the given block (array of paragraphs) contains any active (non-completed) tasks/checklists.
 * @param {Array<TParagraph>} block
 */
export function blockHasActiveTasks(block: Array<TParagraph>): boolean {
  return block.some((p) => isOpenOrScheduled(p))
}
