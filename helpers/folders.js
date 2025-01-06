// @flow
//-------------------------------------------------------------------------------
// Folder-level Functions

import { JSP, logDebug, logError, logInfo, logWarn } from './dev'
// import { forceLeadingSlash } from '@helpers/general'
import { caseInsensitiveStartsWith, caseInsensitiveSubstringMatch } from './search'

/**
 * Return a list of folders (and any sub-folders) that contain one of the strings on the inclusions list (if given).
 * Then excludes those items that are on the exclusions list.
 * The Root folder can be excluded by adding '/' to the exclusions list; this doesn't affect any sub-folders.
 * To just return the Root folder, then send just '/' as an inclusion.
 * Where there is a conflict exclusions will take precedence over inclusions.
 * Optionally exclude all special @... folders as well [this overrides inclusions]
 * Note: these are partial matches ("contains" not "equals").
 * Note: now clarified that this is a case-insensitive match.
 * @author @jgclark
 * @tests in jest file
 * @param {Array<string>} inclusions - if not empty, use these (sub)strings to match folder items
 * @param {boolean} excludeSpecialFolders? (default: true)
 * @param {Array<string>} exclusions - if these (sub)strings match then exclude this folder. Optional: if none given then will treat as an empty list.
 * @returns {Array<string>} array of folder names
 */
export function getFoldersMatching(inclusions: Array<string>, excludeSpecialFolders: boolean = true, exclusions: Array<string> = []): Array<string> {
  try {
    // Get all folders as array of strings (other than @Trash).
    const fullFolderList = DataStore.folders.slice() // slice to make not $ReadOnly

    logDebug(
      'getFoldersMatching',
      `Starting to filter the ${fullFolderList.length} DataStore.folders with inclusions: [${inclusions.toString()}] and exclusions [${exclusions.toString()}]. ESF? ${String(
        excludeSpecialFolders,
      )}`,
    )

    // if requested filter fullFolderList to only folders that don't start with the character '@' (special folders)
    const reducedFolderList = excludeSpecialFolders ? fullFolderList.filter((folder) => !folder.startsWith('@')) : fullFolderList
    // logDebug('getFoldersMatching', `- after specials filter ->  ${reducedFolderList.length} reducedFolderList: [${reducedFolderList.toString()}]`)

    // If no inclusions or exclusions, make life easier and return all straight away
    if (inclusions.length === 0 && exclusions.length === 0) {
      return reducedFolderList ? reducedFolderList : fullFolderList
    }

    // Also now delete '/' from reducedList (added back later if wanted)
    reducedFolderList.splice(reducedFolderList.indexOf('/'), 1)

    // To aid partial matching, terminate all folder strings with a trailing /.
    let reducedTerminatedWithSlash: Array<string> = reducedFolderList.map((f) => f.endsWith('/') ? f : `${f}/`)
    // logDebug('getFoldersMatching', `- after termination ->  ${reducedTerminatedWithSlash.length} reducedTWS:[${reducedTerminatedWithSlash.toString()}]`)

    // const rootIncluded = true // inclusions.some((f) => f === '/')
    const rootExcluded = exclusions.some((f) => f === '/')
    // logDebug('getFoldersMatching', `- rootIncluded=${String(rootIncluded)}, rootExcluded=${String(rootExcluded)}`)

    // Deal with special case of inclusions just '/'
    if (inclusions.length === 1 && inclusions[0] === '/') {
      // logDebug('getFoldersMatching', 'Special Case: Inclusions just /')
      return rootExcluded ? [] : ['/']
    }

    // Remove root to make rest of processing easier
    const inclusionsWithoutRoot = inclusions.filter((f) => f !== '/')
    const exclusionsWithoutRoot = exclusions.filter((f) => f !== '/')
    // logDebug('getFoldersMatching', `- inclusionsWithoutRoot=${String(inclusionsWithoutRoot)}`)
    // logDebug('getFoldersMatching', `- exclusionsWithoutRoot=${String(exclusionsWithoutRoot)}`)

    // filter reducedTerminatedWithSlash to exclude items in the exclusions list (if non-empty). Note: now case insensitive.
    if (exclusionsWithoutRoot.length > 0) {
      reducedTerminatedWithSlash = reducedTerminatedWithSlash.filter((folder) => !exclusionsWithoutRoot.some((f) => caseInsensitiveSubstringMatch(f, folder)))
      // logDebug('getFoldersMatching',`- after exclusions -> ${reducedTerminatedWithSlash.length} reducedTWS: ${reducedTerminatedWithSlash.toString()}\n`)
    }

    // filter reducedTerminatedWithSlash to only folders that start with an item in the inclusionsTerminatedWithSlash list (if non-empty). Note: now case insensitive.
    if (inclusionsWithoutRoot.length > 0) {
      reducedTerminatedWithSlash = reducedTerminatedWithSlash.filter((folder) => inclusionsWithoutRoot.some((f) => caseInsensitiveSubstringMatch(f, folder)))
      // logDebug('getFoldersMatching',`- after inclusions -> ${reducedTerminatedWithSlash.length} reducedTWS: ${reducedTerminatedWithSlash.toString()}\n`)
    }

    // now remove trailing slash characters
    const outputList = reducedTerminatedWithSlash.map((folder) => (folder.length > 1 && folder.endsWith('/') ? folder.slice(0, -1) : folder))

    // add '/' back in if it was not in exclusions
    if (!rootExcluded) {
      outputList.unshift('/')
    }
    logDebug('getFoldersMatching', `-> outputList: ${outputList.length} items: [${outputList.toString()}]`)
    return outputList
  } catch (error) {
    logError('getFoldersMatching', error.message)
    return ['(error)']
  }
}

/**
 * Return a list of subfolders of a given folder. Includes the given folder itself.
 * @tests in jest file.
 * @author @jgclark
 * @param {string} folderpath - e.g. "some/folder". Leading or trailing '/' will be removed.
 * @returns {Array<string>} array of subfolder names
 */
export function getSubFolders(parentFolderPathArg: string): Array<string> {
  try {
    const parts = parentFolderPathArg.match(/\/?(.*?)\/?$/)
    const parentFolderPath = parts ? parts[1] : null
    if (!parentFolderPath) {
      throw new Error('No valid parentFolderPath given.')
    }
    // Get all folders as array of strings (other than @Trash). Also remove root as a special case
    const subfolderList = DataStore.folders.filter((f) => f.startsWith(parentFolderPath))

    logDebug('folders / getSubFolders', `-> ${subfolderList.length} items: [${subfolderList.toString()}]`)
    return subfolderList
  } catch (error) {
    logError('folders / getSubFolders', error.message)
    return ['(error)']
  }
}

/**
 * Return a list of folders, with those that match the 'exclusions' list (or any of their sub-folders) removed.
 * EITHER
 *   - include only those that start with one of the strings on the inclusions list (so will include any sub-folders) if given. Note: Root folder can be included by '/'; this doesn't include sub-folders.
 * OR
 *   - exclude those that start with those on the 'exclusions' list, and any sub-folders (other than root folder ('/') which would then exclude everything).
 *   - optionally exclude all special @... folders as well [this overrides inclusions and exclusions]
 *   - optionally force exclude root folder. Note: setting this to false does not force include it.
 * If given inclusions, then exclusions will be ignored.
 * @author @jgclark
 * @tests in jest file
 * @param {Array<string>} exclusions - if these (sub)strings match then exclude this folder -- can be empty
 * @param {boolean} excludeSpecialFolders? (default: true)
 * @param {boolean} forceExcludeRootFolder? (default: false)
 * @returns {Array<string>} array of folder names
 */
export function getFolderListMinusExclusions(exclusions: Array<string>, excludeSpecialFolders: boolean = true, forceExcludeRootFolder: boolean = false): Array<string> {
  try {
    // if (!inclusions && inclusions.length === 0 && !exclusions && exclusions.length === 0) {
    //   throw new Error('No inclusions or exclusions given.')
    // }
    // Get all folders as array of strings (other than @Trash). Also remove root as a special case
    const fullFolderList = DataStore.folders
    let excludeRoot = forceExcludeRootFolder
    // logDebug('folders / filteredFolderList', `Starting to filter the ${fullFolderList.length} DataStore.folders with exclusions [${exclusions.toString()}] and forceExcludeRootFolder ${String(forceExcludeRootFolder)}`)

    // if excludeSpecialFolders, filter fullFolderList to only folders that don't start with the character '@' (special folders)
    const reducedFolderList = excludeSpecialFolders ? fullFolderList.filter((folder) => !folder.startsWith('@')) : fullFolderList

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
    // reducedTerminatedWithSlash = reducedTerminatedWithSlash.filter((folder) => !exclusionsTerminatedWithSlash.some((ee) => folder.startsWith(ee)))
    reducedTerminatedWithSlash = reducedTerminatedWithSlash.filter((folder) => !exclusionsTerminatedWithSlash.some((ef) => caseInsensitiveStartsWith(ef, folder, false)))
    // logDebug('getFolderListMinusExclusions', `- after exclusions reducedTerminatedWithSlash: ${reducedTerminatedWithSlash.length} folders: ${reducedTerminatedWithSlash.toString()}\n`)

    // now remove trailing slash characters
    const outputList = reducedTerminatedWithSlash.map((folder) => (folder !== '/' && folder.endsWith('/') ? folder.slice(0, -1) : folder))

    // remove root folder if wanted
    if (excludeRoot) {
      const itemToRemove = outputList.indexOf('/')
      outputList.splice(itemToRemove, 1)
    }
    // logDebug('folders/getFolderListMinusExclusions', `-> outputList: ${outputList.length} items: [${outputList.toString()}] with excludeRoot? ${String(excludeRoot)}`)
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
