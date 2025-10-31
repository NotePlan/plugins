// @flow

/**
 * Check if a note has file or image links in its content
 * @author @dwertheimer
 * @param {CoreNoteFields} note - The note to check
 * @returns {boolean} - True if the note has ![image or ![file tags, false otherwise
 */
export function noteHasFileLinks(note: CoreNoteFields): boolean {
  if (!note || !note.content) {
    return false
  }

  // Check for ![image or ![file patterns
  const hasImageOrFileLinks = /!\[(image|file)/i.test(note.content)

  return hasImageOrFileLinks
}

/**
 * Get note content with absolute attachment paths if the note has file/image links,
 * otherwise return the regular content
 * @author @dwertheimer
 * @param {CoreNoteFields | null | void} note - The note to get content from
 * @returns {string} - Note content with absolute paths if links exist, otherwise regular content
 */
export function getContentWithLinks(note: CoreNoteFields | null | void): string {
  if (!note) {
    return ''
  }

  if (noteHasFileLinks(note)) {
    // $FlowIgnore - contentWithAbsoluteAttachmentPaths is not in the CoreNoteFields type definition yet, but exists at runtime
    return note.contentWithAbsoluteAttachmentPaths ? note.contentWithAbsoluteAttachmentPaths : note.content || ''
  }

  return note.content || ''
}
