// @flow
//----------------------------------------------------------------------------
// NotePlan note file extension helpers
// Last updated 2026-08-28 by @CursorAI directed by @jgclark
//----------------------------------------------------------------------------

/** Regex fragment for supported note file extensions at end of string. */
export const FILE_EXTENSIONS_GROUP = `\\.(md|txt)$` // and tie to end of string
export const RE_NOTE_FILE_EXTENSION: RegExp = new RegExp(FILE_EXTENSIONS_GROUP, 'i')
/** 
 * Supported note file extensions (without dot), parsed from RE_NOTE_FILE_EXTENSION. */
export const SUPPORTED_NOTE_FILE_EXTENSIONS: Array<string> = ((): Array<string> => {
  const match = FILE_EXTENSIONS_GROUP.match(/\(([^)]+)\)/)
  return match ? match[1].split('|') : ['md']
})()

/** Fallback note file extension when DataStore.defaultFileExtension is unavailable. */
export const DEFAULT_NOTE_FILE_EXTENSION: string = SUPPORTED_NOTE_FILE_EXTENSIONS[0]

/**
 * User's note file extension without leading dot (DataStore preference, or DEFAULT_NOTE_FILE_EXTENSION).
 * Note: in a React/HTML window `DataStore` is an async bridge proxy, so every property access returns a
 * function rather than the underlying value. Only an actual non-empty string is trusted here; anything
 * else (function, Promise, empty string, missing DataStore) falls back to DEFAULT_NOTE_FILE_EXTENSION.
 * @returns {string}
 */
export function getUsersNoteFileExtension(): string {
  try {
    const ext = DataStore.defaultFileExtension
    if (typeof ext === 'string' && ext.trim() !== '') {
      return ext.trim().replace(/^\./, '')
    }
  } catch {
    /* use fallback */
  }
  return DEFAULT_NOTE_FILE_EXTENSION
}

/**
 * Build a calendar note filename for the current vault's default extension.
 * @param {string} dateStr - YYYYMMDD, YYYY-Wnn, YYYY-MM, or YYYY-Qn
 * @returns {string}
 */
export function makeCalendarFilename(dateStr: string): string {
  return `${dateStr}.${getUsersNoteFileExtension()}`
}
