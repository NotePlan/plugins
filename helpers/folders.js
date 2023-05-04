// @flow
//-------------------------------------------------------------------------------
// Folder-level Functions

import { JSP, logDebug, logError, logInfo, logWarn } from './dev'

/**
 * Return a subset of folders:
 * - including only those on the inclusions list (and their sub-folders) if given
 * - excluding those on the given list, and any of their sub-folders (other than root which would then exclude everything).
 * - optionally exclude all special @... folders as well.
 * @author @jgclark
 * @param {Array<string>} exclusions
 * @param {boolean} excludeSpecialFolders?
 * @param {Array<string>} inclusions?
 * @returns {Array<string>} array of folder names
 */
export function getFilteredFolderList(exclusions: Array<string>, excludeSpecialFolders: boolean = true, inclusions: Array<string> = []): Array<string> {
  try {
    // Get all folders as array of strings (other than @Trash).
    const folderList = DataStore.folders
    const reducedList: Array<string> = []
    logDebug('folders / filteredFolderList', `Starting to filter the ${folderList.length} DataStore.folders with inclusions [${inclusions.toString()}] exclusions [${exclusions.toString()}]`)

    const exclusionsTerminatedWithSlash: Array<string> = []
    for (const e of exclusions) {
      exclusionsTerminatedWithSlash.push(e.endsWith('/') ? e : `${e}/`)
    }
    const inclusionsTerminatedWithSlash: Array<string> = []
    for (const e of inclusions) {
      inclusionsTerminatedWithSlash.push(e.endsWith('/') ? e : `${e}/`)
    }
    const folderListTerminatedWithSlash: Array<string> = []
    for (const f of folderList) {
      folderListTerminatedWithSlash.push(f.endsWith('/') ? f : `${f}/`)
    }
    for (const thisFolder of folderListTerminatedWithSlash) {
      let matchedAnExcludedFolder = false
      for (const ee of exclusionsTerminatedWithSlash) {
        if (thisFolder.startsWith(ee)) {
          matchedAnExcludedFolder = true
          logDebug('folders / filteredFolderList', `  Excluded folder: ${ee} starts with ${thisFolder}`)
          break // exit loop early
        }
      }
      let matchedAnIncludedFolder = true
      if (inclusions.length > 0) {
        matchedAnIncludedFolder = false
        for (const ff of inclusionsTerminatedWithSlash) {
          if (thisFolder.startsWith(ff)) {
            matchedAnIncludedFolder = true
            logDebug('folders / filteredFolderList', `  Included folder: ${ff} starts with ${thisFolder}`)
            break // exit loop early
          }
        }
      }
      if (matchedAnIncludedFolder && !matchedAnExcludedFolder && !(excludeSpecialFolders && thisFolder.startsWith('@'))) {
        reducedList.push(thisFolder.substr(0, thisFolder.length - 1))
        // logDebug('folders / filteredFolderList', `  ${thisFolder} didn't match`)
      }
    }
    logDebug('folders / filteredFolderList', `-> filteredList ${reducedList.length}: ${reducedList.toString()}`)
    return reducedList
  } catch (error) {
    logError('folders/getFilteredFolderList', JSP(error))
    return ['(error)']
  }
}

/**
 * Get the folder name from the full NP (project) note filename, without leading or trailing slash.
 * @author @jgclark
 * @param {string} fullFilename - full filename to get folder name part from
 * @returns {string} folder/subfolder name
 */
export function getFolderFromFilename(fullFilename: string): string {
  try {
    // drop first character if it's a slash
    const filename = fullFilename.startsWith('/') ? fullFilename.substr(1) : fullFilename
    const filenameParts = filename.split('/')
    return filenameParts.slice(0, filenameParts.length - 1).join('/')
  } catch (error) {
    logError('folders/getFolderFromFilename', `Error getting folder from filename '${fullFilename}: ${error.message}`)
    return '(error)'
  }
}

/**
 * Get the lowest-level (subfolder) part of the folder name from the full NP (project) note filename, without leading or trailing slash.
 * @tests available in jest file
 * @author @jgclark
 * @param {string} fullFilename - full filename to get folder name part from
 * @returns {string} subfolder name
 */
export function getLowestLevelFolderFromFilename(fullFilename: string): string {
  try {
    // drop first character if it's a slash
    const filename = fullFilename.startsWith('/') ? fullFilename.substr(1) : fullFilename
    const filenameParts = filename.split('/')
    return filenameParts.length <= 1 ? '' : filenameParts.slice(filenameParts.length - 2, filenameParts.length - 1).join('')
  } catch (error) {
    logError('folders/getLowestLevelFolderFromFilename', `Error getting folder from filename '${fullFilename}: ${error.message}`)
    return '(error)'
  }
}
