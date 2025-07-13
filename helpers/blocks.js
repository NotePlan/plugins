// @flow
//-----------------------------------------------------------------------------
// Helpers for working with blocks of paragraphs
//-----------------------------------------------------------------------------

import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'

/**
 * Breaks an array of objects into "blocks" based on the specified block types
 * The resulting array of blocks will be an array of arrays, where each block is an array of TParagraphs
 * Blocks are broken based on the following block types: 'empty', 'separator',
 * or a 'title'.headingLevel <= the last title level in the block
 * Separators and empty lines are included as their own blocks
 * 
 * @author @dwertheimer
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
 * @author @jgclark
 * @param {TParagraph} item - The title object to check.
 * @param {number} level - The lowest heading level in the block.
 * @return {boolean} True if the title's heading level is lower than the specified level, false otherwise.
 */
export function isTitleWithEqualOrLowerHeadingLevel(item: TParagraph, prevLowestLevel: number): boolean {
  return item.type === 'title' && item.headingLevel <= prevLowestLevel
}

/**
 * Return whether this paragraph is a 'child' of a given 'parent' para.
 * The NP documentation requires a child to be an indented task/checklist of an earlier task/checklist.
 * (JGC doesn't know enough to make jest tests for this. But is confident this works from lots of logging.)
 * @author @jgclark
 * @param {TParagraph} para - the 'parent' paragraph
 * @returns {Array<TParagraph>} - array of child paragraphs
 */
export function isAChildPara(thisPara: TParagraph): boolean {
  try {
    const thisLineIndex = thisPara.lineIndex
    const allParas = thisPara.note?.paragraphs ?? []
    // First get all paras up to this one which are parents
    const allParentsUpToHere = allParas
      .filter((p) => p.children().length > 0)
      .filter((p) => p.lineIndex < thisLineIndex)
    for (const parent of allParentsUpToHere) {
      const theseChildren = parent.children()
      for (const child of theseChildren) {
        if (child.lineIndex === thisLineIndex) {
          // logInfo('blocks/isAChildPara', `✅: ${thisPara.rawContent}`)
          return true // note: now allowed in forEach but OK in for
        }
      }
    }
    // logInfo('blocks/isAChildPara', `❌: ${thisPara.rawContent}`)
    return false
  } catch (error) {
    logError('blocks/isAChildPara', `isAChildPara(): ${error.message}`)
    return false
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
    return [parentPara]
  }

  const resultingParas = allChildrenNoDupes.slice()
  resultingParas.unshift(parentPara)
  // Show what we have ...
  logDebug('blocks/getParaAndAllChildren', `Returns ${resultingParas.length} paras:`)
  resultingParas.forEach((item, index, _array) => {
    console.log(`- ${index}: "${item.content}" with ${item.indents} indents`)
  })

  return resultingParas
}
