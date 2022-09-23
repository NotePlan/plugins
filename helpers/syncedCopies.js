// @flow

// Note: Eduard's regex looks for a trailing space or end of line. I can't use that part because it will remove space we need if
// the sync copy tag is in the middle of the line.
export const textWithoutSyncedCopyTag = (text: string): string => text.replace(new RegExp('(?:^|\\s)(\\^[a-z0-9]{6})', 'mg'), '').trim()

/**
 * Eliminate duplicate paragraphs (especially for synced lines)
 * Duplicate content is not allowed if:
 * - The content is the same & the blockID is the same (multiple notes referencing this one)
 * @param {Array<TParagraph>} todos: Array<TParagraph>
 * @returns Array<TParagraph> unduplicated paragraphs
 */
export function eliminateDuplicateSyncedParagraphs(todos: Array<TParagraph>): Array<TParagraph> {
  const revisedTodos = []
  if (todos?.length) {
    todos.forEach((e) => {
      const matchingIndex = revisedTodos.findIndex((t) => {
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
        revisedTodos.push(e)
      }
    })
  }
  return revisedTodos
}
