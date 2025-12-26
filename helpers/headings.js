// @flow
//-----------------------------------------------------------------------------
// Helpers for working with section headings
//-----------------------------------------------------------------------------

import { clo, clof, JSP, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'

/**
 * Find all H4/H3/H2/H1 headings in the hierarchy before this para.
 * Note: could be extended to not include H1 if this is from a regular note.
 * @param {TParagraph} para
 * @returns {Array<string>} array of headings, lowest (e.g. H4) to highest (e.g. H1)
 */
export function getHeadingHierarchyForThisPara(para: TParagraph): Array<string> {
  let lineIndex = para.lineIndex
  const noteFilename = para.note?.filename ?? '?'
  // logDebug('getHeadingHierarchyForThisPara', `Finding headings for line #${String(lineIndex)} in note ${noteFilename}:`)
  const thisNote = para.note
  const noteParas = thisNote?.paragraphs
  if (!noteParas || noteParas.length === 0) {
    logWarn('getHeadingHierarchyForThisPara', `-> no note paras found for ${noteFilename}`)
    return []
  }
  let currentHeadingLevel = 5
  const theseHeadings = []
  while (lineIndex >= 0) {
    const thisPara = noteParas[lineIndex]
    if (thisPara.type === 'title') {
      const thisHeadingLevel = thisPara.headingLevel
      if (thisHeadingLevel < currentHeadingLevel) {
        theseHeadings.push(thisPara.content)
        currentHeadingLevel = thisHeadingLevel
      }
    }
    lineIndex--
  }
  // logDebug('getHeadingHierarchyForThisPara', `-> for line #${String(lineIndex)} in note ${noteFilename},  ${String(theseHeadings.length)} headings found: [${String(theseHeadings)}]`)
  return theseHeadings
}

/**
 * Get the immediate parent heading for a paragraph, if any.
 * Returns the heading paragraph or null if none is found.
 * @param {TNote} note
 * @param {TParagraph} para
 */
export function getCurrentHeading(note: CoreNoteFields, para: TParagraph): TParagraph | null {
  if (para.lineIndex == null) return null
  const paras = note.paragraphs
  for (let i = para.lineIndex - 1; i >= 0; i--) {
    const p = paras[i]
    if (p.type === 'title') {
      return p
    }
  }
  return null
}

/**
 * Checks if a title's heading level is lower than the specified level.
 * @author @dwertheimer
 * 
 * @param {TParagraph} item - The title object to check.
 * @param {number} level - The lowest heading level in the block.
 * @return {boolean} True if the title's heading level is lower than the specified level, false otherwise.
 */
export function isTitleWithEqualOrLowerHeadingLevel(item: TParagraph, prevLowestLevel: number): boolean {
  return item.type === 'title' && item.headingLevel <= prevLowestLevel
}
