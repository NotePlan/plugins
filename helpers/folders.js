// @flow
//-------------------------------------------------------------------------------
// Folder-level Functions

import { JSP, logDebug, logError, logInfo, logWarn } from './dev'

/**
 * Return a list of folders that contain one of the strings on the inclusions list (so will include any sub-folders) if given. Note: Root folder can be included by '/'; this doesn't include sub-folders.
 * Optionally exclude all special @... folders as well [this overrides inclusions]
 * @author @jgclark
 * @tests in jest file
 * @param {Array<string>} inclusions - if these (sub)strings match then exclude this folder -- can be empty
 * @param {boolean} excludeSpecialFolders?
 * @returns {Array<string>} array of folder names
 */
export function getFoldersMatching(
  inclusions: Array<string>,
  excludeSpecialFolders: boolean,
): Array<string> {
  try {
    if (!inclusions && inclusions.length) {
      throw new Error('No inclusions given.')
    }
    // Get all folders as array of strings (other than @Trash). Also remove root as a special case
    // const fullFolderList = DataStore.folders.filter((f) => f !== '/')
    const fullFolderList = DataStore.folders

    const inclusionsWithoutRoot = inclusions.filter((f) => f !== '/')

    logDebug('folders / getFoldersMatching', `Starting to filter the ${fullFolderList.length} DataStore.folders with inclusions [${inclusionsWithoutRoot.toString()}]`)

    // if necessary filter fullFolderList to only folders that don't start with the character '@' (special folders)
    const reducedFolderList = (excludeSpecialFolders)
      ? fullFolderList.filter((folder) => !folder.startsWith('@'))
      : fullFolderList

    // To aid partial matching, terminate all folder strings with a trailing /
    let reducedTerminatedWithSlash: Array<string> = []
    for (const f of reducedFolderList) {
      reducedTerminatedWithSlash.push(f.endsWith('/') ? f : `${f}/`)
    }
    logDebug('folders / getFoldersMatching', `- reduced ${reducedTerminatedWithSlash.length} folders:  [${reducedTerminatedWithSlash.toString()}]`)

    // Note: Now can't remember why this needed to be commented out
    // const inclusionsTerminatedWithSlash: Array<string> = []
    // for (const e of inclusions) {
    //   inclusionsTerminatedWithSlash.push(e.endsWith('/') ? e : `${e}/`)
    // }

    reducedTerminatedWithSlash = reducedTerminatedWithSlash.filter(
      (folder) => inclusionsWithoutRoot.some(
        (f) => folder.includes(f))
    )
    logDebug('folders / getFoldersMatching', `- after inclusions reducedTerminatedWithSlash: ${reducedTerminatedWithSlash.length} folders: ${reducedTerminatedWithSlash.toString()}\n`)

    // now remove trailing slash characters
    const outputList = reducedTerminatedWithSlash.map((folder) => (folder.endsWith('/') ? folder.slice(0, -1) : folder))

    // add '/' back in if it was there originally
    if (inclusions.includes('/')) {
      outputList.unshift('/')
    }
    logDebug('folders / getFoldersMatching', `-> outputList: ${outputList.length} items: [${outputList.toString()}]`)
    return outputList

  } catch (error) {
    logError('folders / getFoldersMatching', error.message)
    return ['(error)']
  }
}

/**
 * Return a list of folders, with those that match the 'exclusions' list (or any of their sub-folders) removed.
 * - include only those that contain one of the strings on the inclusions list (so will include any sub-folders) if given. Note: Root folder can be included by '/'; this doesn't include sub-folders.
 *   OR
 * - exclude those on the 'exclusions' list, and any of their sub-folders (other than root folder ('/') which would then exclude everything).
 * - optionally exclude all special @... folders as well [this overrides inclusions and exclusions]
 * - optionally force exclude root folder. Note: setting this to false does not fore include it.
 * If given inclusions, then exclusions will be ignored.
 * @author @jgclark
 * @tests in jest file
 * @param {Array<string>} exclusions - if these (sub)strings match then exclude this folder -- can be empty
 * @param {boolean} excludeSpecialFolders? (default: true)
 * @param {boolean} forceExcludeRootFolder? (default: false)
 * @returns {Array<string>} array of folder names
 */
export function getFolderListMinusExclusions(
  exclusions: Array<string>,
  excludeSpecialFolders: boolean = true,
  forceExcludeRootFolder: boolean = false,
): Array<string> {
  try {
    // if (!inclusions && inclusions.length === 0 && !exclusions && exclusions.length === 0) {
    //   throw new Error('No inclusions or exclusions given.')
    // }
    // Get all folders as array of strings (other than @Trash). Also remove root as a special case
    const fullFolderList = DataStore.folders
    let excludeRoot = forceExcludeRootFolder
    // logDebug('folders / filteredFolderList', `Starting to filter the ${fullFolderList.length} DataStore.folders with exclusions [${exclusions.toString()}] and forceExcludeRootFolder ${String(forceExcludeRootFolder)}`)

    // if excludeSpecialFolders, filter fullFolderList to only folders that don't start with the character '@' (special folders)
    const reducedFolderList = (excludeSpecialFolders)
      ? fullFolderList.filter((folder) => !folder.startsWith('@'))
      : fullFolderList

    // To aid partial matching, terminate all folder strings with a trailing /
    let reducedTerminatedWithSlash: Array<string> = []
    for (const f of reducedFolderList) {
      reducedTerminatedWithSlash.push(f.endsWith('/') ? f : `${f}/`)
    }

// To aid partial matching, terminate all exclusion strings with a trailing /.
    const exclusionsTerminatedWithSlash: Array<string> = []
    // Note: Root folder('/') here needs special handling: remove it now if found, but add back later.
    for (const e of exclusions) {
      if (e === '/') {
        excludeRoot = true
      } else {
        exclusionsTerminatedWithSlash.push(e.endsWith('/') ? e : `${e}/`)
      }
    }
    // logDebug('getFolderListMinusExclusions', `- exclusionsTerminatedWithSlash: ${exclusionsTerminatedWithSlash.toString()}\n`)

    // if exclusions list is not empty, filter reducedTerminatedWithSlash to only folders that don't start with an item in the exclusionsTerminatedWithSlash list
    // reducedTerminatedWithSlash = exclusions.length > 0
    //   ? reducedTerminatedWithSlash.filter((folder) => !exclusions.some((ff) => folder.includes(ff)))
    //   : reducedTerminatedWithSlash
    reducedTerminatedWithSlash = reducedTerminatedWithSlash.filter((folder) => !exclusionsTerminatedWithSlash.some((ee) => folder.startsWith(ee)))
    // logDebug('getFolderListMinusExclusions', `- after exclusions reducedTerminatedWithSlash: ${reducedTerminatedWithSlash.length} folders: ${reducedTerminatedWithSlash.toString()}\n`)

    // now remove trailing slash characters
    const outputList = reducedTerminatedWithSlash.map((folder) => (folder !== '/' && folder.endsWith('/') ? folder.slice(0, -1) : folder))

    // remove root folder if wanted
    if (excludeRoot) {
      const itemToRemove = outputList.indexOf('/')
      outputList.splice(itemToRemove, 1)
    }
    logDebug('folders/getFolderListMinusExclusions', `-> outputList: ${outputList.length} items: [${outputList.toString()}] with excludeRoot? ${String(excludeRoot)}`)
    return outputList

  } catch (error) {
    logError('folders/getFolderListMinusExclusions', error.message)
    return ['(error)']
  }
}

/**
 * Get the folder name from the full NP (project) note filename, without leading or trailing slash.
 * Except for items in root folder -> '/'.
 * @author @jgclark
 * @param {string} fullFilename - full filename to get folder name part from
 * @returns {string} folder/subfolder name
 */
export function getFolderFromFilename(fullFilename: string): string {
  try {
    // First deal with special case of file in root -> '/'
    if (!fullFilename.includes('/')) {
      return '/'
    }
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
 * Get the folder name from the full NP (project) note filename, without leading or trailing slash. 
 * Optionally remove file extension
 * @author @jgclark
 * @param {string} fullFilename - full filename to get folder name part from
 * @param {boolean} removeExtension?
 * @returns {string} folder/subfolder name
 */
export function getJustFilenameFromFullFilename(fullFilename: string, removeExtension: boolean = false): string {
  try {
    const filepathParts = fullFilename.split('/')
    const filenamePart = filepathParts.slice(-1, filepathParts.length).join('')
    if (removeExtension) {
      const fileNameWithoutExtension = filenamePart.replace(/\.[^/.]+$/, '')
      return fileNameWithoutExtension
    } else {
      return filenamePart
    }
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
