// @flow

import { clo, clof, JSP, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'

/**
 * Find all H4/H3/H2/H1 headings in the hierarchy before this para.
 * Note: could be extended to not include H1 if this is from a regular note.
 * @param {TParagraph} para
 * @returns {Array<string>} array of headings, lowest (e.g. H4) to highest (e.g. H1)
 */
export function getHeadingHierarchyForThisPara(para) {
  let lineIndex = para.lineIndex
  const noteFilename = para.note?.filename ?? '?'
  logDebug('getHeadingHierarchyForThisPara', `Finding headings for line #${String(lineIndex)} in note ${noteFilename}:`)
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
  logDebug('getHeadingHierarchyForThisPara', `-> ${String(theseHeadings.length)} headings found: [${String(theseHeadings)}]`)
  return theseHeadings
}