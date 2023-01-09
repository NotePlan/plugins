// @flow

// Note: Eduard's regex looks for a trailing space or end of line. I can't use that part because it will remove space we need if
// the sync copy tag is in the middle of the line.
export const textWithoutSyncedCopyTag = (text: string): string => text.replace(new RegExp('(?:^|\\s)(\\^[a-z0-9]{6})', 'mg'), '').trim()

/**
 * Eliminate duplicate paragraphs (especially for synced lines)
 * Duplicate content is not allowed if:
 * - The content is the same & the blockID is the same (multiple notes referencing this one)
 * Currently it keeps the first copy it finds ... so this is dependent on the order of paras passed to the function.
 * @param {Array<TParagraph>} paras: Array<TParagraph>
 * @returns Array<TParagraph> unduplicated paragraphs
 */
export function eliminateDuplicateSyncedParagraphs(paras: Array<TParagraph>): Array<TParagraph> {
  const revisedParas = []
  if (paras?.length) {
    paras.forEach((e) => {
      const matchingIndex = revisedParas.findIndex((t) => {
        if (t.content === e.content) {
          if (t.blockId !== undefined && e.blockId !== undefined && t.blockId === e.blockId) {
            return true
          } else {
            if (t.filename === e.filename) {
              return true
            }
          }
        }
        return false
      })
      const exists = matchingIndex > -1
      if (!exists) {
        revisedParas.push(e)
      }
    })
  }
  return revisedParas
}
