// @flow
//-------------------------------------------------------------------------------
// Folder-level Functions

import { log, logWarn } from './dev'

/**
 * Return list of folders, excluding those on the given list (and any of their sub-folders).
 * @author @jgclark
 *
 * @param {[string]} exclusions
 * @returns {[string]} array of folder names
 */
export function filterFolderList(exclusions: Array<string>): Array<string> {
  const folderList = DataStore.folders
  const reducedList: Array<string> = []
  log('filterFolderList()', `filterFolderList: Starting with exclusions ${exclusions.toString()}`)
  if (exclusions.length > 0) {
    const exclusionsTerminatedWithSlash: Array<string> = []
    for (const e of exclusions) {
      exclusionsTerminatedWithSlash.push( e.endsWith('/') ? e : e+'/' )
    }
    const folderListTerminatedWithSlash: Array<string> = []
    for (const f of folderList) {
      folderListTerminatedWithSlash.push( f.endsWith('/') ? f : f+'/' )
    }
    for (const ff of folderListTerminatedWithSlash) {
      let matchedAnExcludedFolder = false
      for (const ee of exclusionsTerminatedWithSlash) {
        if (ff.startsWith(ee)) {
          matchedAnExcludedFolder = true
          // console.log(`  ${ee} starts with ${ff}`)
          break
        }
      }
      if (!matchedAnExcludedFolder) {
        reducedList.push(ff.substr(0, ff.length-1))
        // console.log(`  ${ff} didn't match`)
      }
    }
  } else {
    logWarn('filterFolderList()', `empty excluded folder list`)
    reducedList.push(...folderList.slice())
  }
  return reducedList
}

/**
 * Get the folder name from the full NP (project) note filename.
 * @author @jgclark
 *
 * @param {string} fullFilename - full filename to get folder name part from
 * @returns {string} folder/subfolder name
 */
export function getFolderFromFilename(fullFilename: string): string {
  // drop first character if it's a slash
  const filename = (fullFilename.startsWith('/')) ? fullFilename.substr(1) : fullFilename
  const filenameParts = filename.split('/')
  return filenameParts.slice(0, filenameParts.length - 1).join('/')
}
