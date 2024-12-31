// @flow
// -----------------------------------------------------------------
// Helpers for working with children/parent paragraphs in a note.
// TODO: move getParaAndAllChildren, isAChildPara from blocks in here.
// -----------------------------------------------------------------

import { TASK_TYPES } from './sorting'
import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'

export type ParentParagraphs = {
  parent: TParagraph,
  children: Array<TParagraph>,
}

/**
 * Note: not currently used.
 * By definition, a paragraph's .children() method API returns an array of TParagraphs indented underneath it
 * a grandparent will have its children and grandchildren listed in its .children() method and the child will have the grandchildren also
 * This function returns only the children of the paragraph, not any descendants, eliminating duplicates
 * Every paragraph sent into this function will be listed as a parent in the resulting array of ParentParagraphs
 * Use removeParentsWhoAreChildren() afterwards to remove any children from the array of ParentParagraphs
 * (if you only want a paragraph to be listed in one place in the resulting array of ParentParagraphs)
 * @param {Array<TParagraph>} paragraphs - array of paragraphs
 * @returns {Array<ParentParagraphs>} - array of parent paragraphs with their children
 */
export function getParagraphParentsOnly(paragraphs: Array<TParagraph>): Array<ParentParagraphs> /* tag: children */ {
  const parentsOnly = []
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i]
    logDebug('getParagraphParentsOnly', `para: "${para.content}"`)
    const childParas = getChildParas(para, paragraphs)
    parentsOnly.push({ parent: para, children: childParas })
  }
  return parentsOnly
}

/**
 * Note: not currently used.
 * Remove any children from being listed as parents in the array of ParentParagraphs
 * This function should be called after getParagraphParentsOnly()
 * If a paragraph is listed as a child, it will not be listed as a parent
 * The paragraphs need to be in lineIndex order for this to work
 * @param {Array<ParentParagraphs>} everyParaIsAParent - array of parent paragraphs with their children
 * @returns {Array<ParentParagraphs>} - array of parent paragraphs with their children
 */
export function removeParentsWhoAreChildren(everyParaIsAParent: Array<ParentParagraphs>): Array<ParentParagraphs> {
  const childrenSeen: Array<TParagraph> = []
  const parentsOnlyAtTop: Array<ParentParagraphs> = []
  for (let i = 0; i < everyParaIsAParent.length; i++) {
    const p = everyParaIsAParent[i]
    if (childrenSeen.includes(p.parent)) {
      p.children.length ? childrenSeen.push(...p.children) : null
      continue // do not list this as a parent, because another para has it as a child
    }
    // concat all p.children to the childrenSeen array (we know they are unique, so no need to check)
    p.children.length ? childrenSeen.push(...p.children) : null
    parentsOnlyAtTop.push(p)
  }
  return parentsOnlyAtTop
}

/**
 * Get the direct children paragraphs of a given paragraph (ignore [great]grandchildren)
 * NOTE: the passed "paragraphs" array can be mutated if removeChildrenFromTopLevel is true
 * @param {TParagraph} para - the parent paragraph
 * @param {Array<TParagraph>} paragraphs - array of all paragraphs
 * @returns {Array<TParagraph>} - array of children paragraphs (NOTE: the passed "paragraphs" array can be mutated if removeChildrenFromTopLevel is true)
 */
export function getChildParas(para: TParagraph, paragraphs: Array<TParagraph>): Array<TParagraph> {
  const childParas = []
  const allChildren = para.children()
  const indentedChildren = getIndentedNonTaskLinesUnderPara(para, paragraphs)
  // concatenate the two arrays, but remove any duplicates that have the same lineIndex
  const allChildrenWithDupes = allChildren.concat(indentedChildren)
  const allChildrenNoDupes = allChildrenWithDupes.filter((p, index) => allChildrenWithDupes.findIndex((p2) => p2.lineIndex === p.lineIndex) === index)

  if (!allChildrenNoDupes.length) {
    return []
  }

  // someone could accidentally indent twice
  const minIndentLevel = Math.min(...allChildrenNoDupes.map((p) => p.indents))

  for (const child of allChildrenNoDupes) {
    const childIndentLevel = child.indents

    if (childIndentLevel === minIndentLevel) {
      childParas.push(child)
    }
  }

  clo(childParas, `getChildParas of para:"${para.content}", children.length=${allChildrenNoDupes.length}. reduced to:${childParas.length}`)

  return childParas
}

/**
 * Get the parent paragraph for a given paragraph.
 * Note: not tested or used yet.
 * 
 * @param {number} thisParaLineIndex - The paragraph index for which to find the parent.
 * @param {Array<TParagraph>} paragraphs - The array of all paragraphs.
 * @returns {TParagraph | null} - The parent paragraph or null if no parent is found.
 */
export function getParentPara(thisParaLineIndex: number, paragraphs: Array<TParagraph>): TParagraph | null {
  const thisPara = paragraphs[thisParaLineIndex]
  const paraIndentLevel = thisPara.indents

  // Iterate backwards from the current paragraph to find the parent
  for (let i = thisParaLineIndex - 1; i >= 0; i--) {
    const potentialParent = paragraphs[i]
    if (potentialParent.indents < paraIndentLevel) {
      return potentialParent // Found the parent
    }
  }
  return null // No parent found
}

/**
 * Get any indented text paragraphs underneath a given paragraph, excluding tasks
 * Doing this to pick up any text para types that may have been missed by the .children() method, which only gets task paras
 * @param {TParagraph} para - The parent paragraph
 * @param {Array<TParagraph>} paragraphs - Array of all paragraphs
 * @returns {Array<TParagraph>} - Array of indented paragraphs underneath the given paragraph
 */
export function getIndentedNonTaskLinesUnderPara(para: TParagraph, paragraphs: Array<TParagraph>): Array<TParagraph> {
  const indentedParas = []

  const thisIndentLevel = para.indents
  let lastLineUsed = para.lineIndex

  for (const p of paragraphs) {
    // only get indented lines that are not tasks
    if (p.lineIndex > para.lineIndex && p.indents > thisIndentLevel && lastLineUsed === p.lineIndex - 1) {
      if (TASK_TYPES.includes(p.type)) break // stop looking if we hit a task
      indentedParas.push(p)
      lastLineUsed = p.lineIndex
    }
  }

  return indentedParas
}

/**
 * Return whether this paragraph is a 'child' of a given 'parent' para.
 * The NP documentation requires a child to be an indented task/checklist of an earlier task/checklist.
 * (JGC doesn't know enough to make jest tests for this. But is confident this works from lots of logging.)
 * Note: Copy from blocks.js
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
 * Note: Copy from blocks.js
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

/**
 * Returns an array of all "open" paragraphs and their children without duplicates.
 * Children will adhere to the NotePlan API definition of children()
 * Only tasks can have children, but any paragraph indented underneath a task
 * can be a child of the task. This includes bullets, tasks, quotes, text.
 * Children are counted until a blank line, HR, title, or another item at the
 * same level as the parent task. So for items to be counted as children, they
 * need to be contiguous vertically.
 * @param {Array<TParagraph>} paragraphs - The initial array of paragraphs.
 * @return {Array<TParagraph>} - The new array containing all unique "open" paragraphs and their children in lineIndex order.
 */
export const getOpenTasksAndChildren = (paragraphs: Array<TParagraph>): Array<TParagraph> => [
  ...new Map(
    paragraphs
      .filter((p) => p.type === 'open') // Filter paragraphs with type "open"
      .flatMap((p) => [p, ...p.children()]) // Flatten the array of paragraphs and their children
      .map((p) => [p.lineIndex, p]), // Map each paragraph to a [lineIndex, paragraph] pair
  ).values(),
] // Extract the values (unique paragraphs) from the Map and spread into an array
