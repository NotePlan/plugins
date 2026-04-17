// @flow
//---------------------------------------------------------------------
// Escaping only — kept separate from regex.js so lightweight consumers
// (e.g. np.Templating) avoid loading large RegExp literals that use syntax
// unsupported on older JavaScriptCore (macOS 12 / Monterey).
//---------------------------------------------------------------------

/**
 * Escapes RegExp special characters in a string
 * Because if you are using a user-created string in a `new RegExp()` command, you need to worry about whether
 * The user has included reserved chars in there. If so, you need to double-escape them so they are treated as strings
 * Usage:
 * const sanitizedBlockName = escapeRegExp(unsafeString);
 * const regex = new RegExp(sanitizedBlockName, 'gi');
 * @param {string} str - The string to escape.
 * @return {string} The escaped string.
 */
export function escapeRegExp(str: string): string {
  // RegExp special characters and their escape sequence
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
