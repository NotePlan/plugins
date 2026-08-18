// @flow
//-----------------------------------------------------------------------------
// Parse the 'folders to ignore' plugin setting
// Last updated 2026-08-18 for v1.4.0, @jgclark
//-----------------------------------------------------------------------------

/**
 * Parse the comma-separated 'folders to ignore' plugin setting into a list of folder names.
 * Empty entries (including a blank setting) are dropped, so an empty setting means ignore no folders.
 * @author @jgclark
 * @param {mixed} setting
 * @returns {Array<string>}
 */
export function parseFoldersToIgnore(setting: mixed): Array<string> {
  if (setting == null) {
    return []
  }
  const asString = typeof setting === 'string' ? setting : String(setting)
  return asString
    .split(',')
    .map((folder) => folder.trim())
    .filter(Boolean)
}
