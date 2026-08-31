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

/** globalSharedData is the payload np.Shared bakes into every React window; undefined in plugin context. */
declare var globalSharedData: { [string]: any }

/**
 * Normalise a candidate extension value: a non-empty string, without a leading dot.
 * @param {mixed} value - candidate value from DataStore or pluginData
 * @returns {?string} the cleaned extension, or null if the value isn't usable
 */
function cleanFileExtension(value: mixed): ?string {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim().replace(/^\./, '')
  }
  return null
}

/**
 * User's note file extension without leading dot (DataStore preference, or DEFAULT_NOTE_FILE_EXTENSION).
 *
 * Works in both contexts:
 * - Plugin: reads `DataStore.defaultFileExtension` directly.
 * - React/HTML window: `DataStore` is an async bridge proxy there, so every property access returns a
 *   function rather than the underlying value, and there is no synchronous way to read it. Falls back to
 *   `pluginData.notePlanSettings.defaultFileExtension`, which np.Shared bakes into every React window
 *   when it opens (see `np.Shared/src/NPReactLocal.js`).
 *
 * Only an actual non-empty string is trusted from either source; anything else (function, Promise, empty
 * string, missing DataStore) moves on to the next fallback.
 * @returns {string}
 */
export function getUsersNoteFileExtension(): string {
  try {
    const ext = cleanFileExtension(DataStore.defaultFileExtension)
    if (ext) return ext
  } catch {
    /* not in a plugin context - try the React window payload below */
  }
  try {
    const ext = cleanFileExtension(globalSharedData?.pluginData?.notePlanSettings?.defaultFileExtension)
    if (ext) return ext
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
