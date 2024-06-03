// @flow
//-----------------------------------------------------------------------------
// Helpers for working with blocks of paragraphs
//-----------------------------------------------------------------------------

import { addParasAsText, parasToText } from '../jgclark.Filer/src/filerHelpers.js'
import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
// import { getParagraphBlock } from '@helpers/NPParagraph'
import { parasToText } from '@helpers/paragraph'

/**
 * Breaks an array of objects into "blocks" based on the specified block types
 * The resulting array of blocks will be an array of arrays, where each block is an array of TParagraphs
 * Blocks are broken based on the following block types: 'empty', 'separator',
 * or a 'title'.headingLevel <= the last title level in the block
 * Separators and empty lines are included as their own blocks
 *
 * @param {Array<TParagraph>} array - The array of objects to break into blocks.
 * @return {Array<Array<TParagraph>>} An array of blocks, where each block is an array of objects.
 */
export function breakParagraphsIntoBlocks(array: Array<TParagraph>): Array<Array<TParagraph>> {
  const breakBlockTypes = ['empty', 'separator']
  const blocks = []
  let currentBlock: Array<TParagraph> = []
  let lowestHeadingLevel = Infinity

  for (const item of array) {
    const isTitleChange = currentBlock.length > 0 && isTitleWithEqualOrLowerHeadingLevel(item, lowestHeadingLevel)
    if (isBreakBlock(item, breakBlockTypes)) {
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
 * Checks if an item's type is one of the specified breakBlockTypes.
 *
 * @param {TParagraph} item - The object to check.
 * @param {Array<string>} breakBlockTypes - An array of block types to check against.
 * @return {boolean} True if the item's type is in breakBlockTypes, false otherwise.
 */
export function isBreakBlock(item: TParagraph, breakBlockTypes: Array<string> = ['empty', 'separator', 'title']): boolean {
  return breakBlockTypes.includes(item.type)
}

/**
 * Checks if a title's heading level is lower than the specified level.
 *
 * @param {TParagraph} item - The title object to check.
 * @param {number} level - The lowest heading level in the block.
 * @return {boolean} True if the title's heading level is lower than the specified level, false otherwise.
 */
export function isTitleWithEqualOrLowerHeadingLevel(item: TParagraph, prevLowestLevel: number): boolean {
  return item.type === 'title' && item.headingLevel <= prevLowestLevel
}

/**
 * Move a given paragraph (and any following indented paragraphs) to a different note.
 * Note: simplified version of 'moveParas()' in NPParagraph.
 * NB: the Setting 'includeFromStartOfSection' decides whether these directly following paragaphs have to be indented (false) or can take all following lines at same level until next empty line as well.
 * @param {TParagraph} para
 * @param {string} toFilename
 * @param {NoteType} toNoteType
 * @param {string} toHeading to move under
 * @author @jgclark
 */
export async function moveGivenPara(para: TParagraph, toFilename: string, toNoteType: NoteType, toHeading: string): Promise<void> {
  try {
    if (!para || !toFilename) {
      // No note open, or no selectedParagraph selection (perhaps empty note), so don't do anything.
      throw new Error('Invalid paragraph or destination filename given.')
    }

    // Get config settings
    // const config = await getFilerSettings()

    // Get paragraph index
    const firstSelLineIndex = para.index
    const lastSelLineIndex = para.index
    const fromNote = para.note

    // Get paragraphs for the selection or block
    let firstStartIndex = 0

    // get children paras (as well as the original)
    const parasInBlock = getParaAndAllChildren(para)
    logDebug('blocks/moveGivenPara', `moveParas: move block of ${parasInBlock.length} paras`)

    // Note: There's still no API function to add multiple
    // paragraphs in one go, but we can insert a raw text string.
    const selectedParasAsText = parasToText(parasInBlock)

    // Add text to the new location in destination note
    const destNote = DataStore.noteByFilename(toFilename, toNoteType)
    logDebug('blocks/moveGivenPara', `- Moving to note '${displayTitle(destNote)}' under heading: '${toHeading}'`)
    addParasAsText(destNote, selectedParasAsText, toHeading, 'start', true)

    // delete from existing location
    logDebug('blocks/moveGivenPara', `- Removing ${parasInBlock.length} paras from original note`)
    fromNote.removeParagraphs(parasInBlock)
  }
  catch (error) {
    logError('blocks/moveGivenPara', `moveParas(): ${error.message}`)
  }
}

/**
 * Get the child (indented) paragraphs of a given 'parent' paragraph (including [great]grandchildren).
 * (JGC doesn't know enough to make jest tests for this.)
 * @author @jgclark
 * @param {TParagraph} para - the 'parent' paragraph
 * @returns {Array<TParagraph>} - array of child paragraphs
 */
export function getParaAndAllChildren(parentPara: TParagraph): Array<TParagraph> {
  const allChildren = parentPara.children()
  // but if there are multiple levels of children, then there will be duplicates in this array, which we want to remove
  const allChildrenNoDupes = allChildren.filter((p, index) => allChildren.findIndex((p2) => p2.lineIndex === p.lineIndex) === index)

  if (!allChildrenNoDupes.length) {
    logDebug('blocks/getParaAndAllChildren', `No child paragraphs found`)
    return []
  }

  const resultingParas = allChildrenNoDupes.slice()
  resultingParas.push(parentPara)
  logDebug('blocks/getParaAndAllChildren', `Returns ${resultingParas} paras:`)
  resultingParas.forEach(c => {
    console.log(`- ${c.index}: "${c.content}"`)
  })

  return resultingParas
}
