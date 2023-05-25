// @flow
//-------------------------------------------------------------------------------
// Folder-level Functions

import { JSP, logDebug, logError, logInfo, logWarn } from './dev'

/**
 * Return a subset of folders:
 * - including only those that contain one of the strings on the inclusions list (so will include any sub-folders) if given
 * - excluding those on the 'exclusions' list, and any of their sub-folders (other than root which would then exclude everything).
 * - optionally exclude all special @... folders as well.
 * @author @jgclark, improved by @dwertheimer
 * @param {Array<string>} exclusions - if these (sub)strings match then exclude this folder
 * @param {boolean} excludeSpecialFolders? (default: true)
 * @param {Array<string>} inclusions? (default: empty list)
 * @param {boolean} includeRootFolder? (default: true)
 * @returns {Array<string>} array of folder names
 */
export function getFilteredFolderList(exclusions: Array<string>, excludeSpecialFolders: boolean = true, inclusions: Array<string> = [], includeRootFolder: boolean = true): Array<string> {
  try {
    // Get all folders as array of strings (other than @Trash).
    const fullFolderList = DataStore.folders
    // logDebug(
    //   'folders / filteredFolderList',
    //   `Starting to filter the ${fullFolderList.length} DataStore.folders with inclusions [${inclusions.toString()}] exclusions [${exclusions.toString()}]`,
    // )

    // const inclusionsTerminatedWithSlash: Array<string> = []
    // for (const e of inclusions) {
    //   inclusionsTerminatedWithSlash.push(e.endsWith('/') ? e : `${e}/`)
    // }
    const exclusionsTerminatedWithSlash: Array<string> = []
    for (const e of exclusions) {
      if (e !== '/') {// Need to exclude root folder if given
        exclusionsTerminatedWithSlash.push(e.endsWith('/') ? e : `${e}/`)
      }
    }
    // FIXME: Do we just need to treat / as a special case, with a special flag whether to include or exclude?
    let reducedList: Array<string> = []
    for (const f of fullFolderList) {
      reducedList.push(f.endsWith('/') ? f : `${f}/`)
    }
    // logDebug('getFilteredFolderList', `- exclusionsTerminatedWithSlash: ${exclusionsTerminatedWithSlash.toString()}\n`)

    // if inclusions list is not empty, filter reducedList to only folders that matches (includes) an item in it
    reducedList = inclusions.length > 0
      ? reducedList.filter((folder) => inclusions.some((ff) => folder.includes(ff)))
      : reducedList
    logDebug('getFilteredFolderList', `- after inclusions reducedList: ${reducedList.length} folders: ${reducedList.toString()}\n`)

    // if exclusions list is not empty, filter reducedList to only folders that don't start with an item in the exclusionsTerminatedWithSlash list
    reducedList = exclusions.length > 0
      ? reducedList.filter((folder) => !exclusions.some((ff) => folder.includes(ff)))
      : reducedList
    // reducedList = exclusionsTerminatedWithSlash.length > 0
    // ? reducedList.filter((folder) => !exclusionsTerminatedWithSlash.some((ee) => folder.startsWith(ee)))
    // : reducedList
    logDebug('getFilteredFolderList', `- after exclusions: reducedList: ${reducedList.length} folders: ${reducedList.toString()}\n`)

    // filter reducedList to only folders that don't start with the character '@' (special folders)
    reducedList = excludeSpecialFolders
      ? reducedList.filter((folder) => !folder.startsWith('@'))
      : reducedList

    logDebug('getFilteredFolderList', `-> filteredList: ${reducedList.length} items: [${reducedList.toString()}]`)
    // return the array of folders, but if the last character is a slash, remove it
    return reducedList.map((folder) => (folder.endsWith('/') ? folder.slice(0, -1) : folder))

    // return reducedList
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
