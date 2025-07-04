// @flow
//-------------------------------------------------------------------------------
// Folder-level Functions

import { logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { caseInsensitiveMatch, caseInsensitiveStartsWith, caseInsensitiveSubstringMatch } from '@helpers/search'
// import { getRegularNotesInFolder } from '@helpers/note'

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
    // logDebug('getFoldersMatching', `-> outputList: ${outputList.length} items: [${outputList.toString()}]`)
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
 * Specifically:
 *   - exclude those that start with those on the 'exclusions' list, and any sub-folders (other than root folder ('/') which would then exclude everything).
 *   - optionally exclude all special @... folders as well [this overrides exclusions list]
 *   - optionally force exclude root folder. Note: setting this to false does not force include it.
 *   - always exclude '@Trash' folder (as the API doesn't return it).
 * @author @jgclark
 * @tests in jest file
 * @param {Array<string>} exclusions - if these (sub)strings match then exclude this folder -- can be empty
 * @param {boolean} excludeSpecialFolders? (default: true)
 * @param {boolean} forceExcludeRootFolder? (default: false)
 * @returns {Array<string>} array of folder names
 */
export function getFolderListMinusExclusions(exclusions: Array<string>, excludeSpecialFolders: boolean = true, forceExcludeRootFolder: boolean = false): Array<string> {
  try {
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
 * @tests in jest file
 * @param {string} fullFilename - full filename to get folder name part from
 * @returns {string} folder/subfolder name
 */
export function getFolderFromFilename(fullFilename: string): string {
  try {
    // If filename is empty, warn and return '(error)'
    if (!fullFilename) {
      logWarn('folders/getFolderFromFilename', `Empty filename given. Returning '(error)'`)
      return '(error)'
    }
    // Deal with special case of file in root -> '/'
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
 * Optionally remove file extension.
 * Note: does not handle hidden files (starting with a dot, e.g. '.gitignore').
 * @author @jgclark
 * @tests in jest file
 * @param {string} fullFilename - full filename to get folder name part from
 * @param {boolean} removeExtension? (default: false)
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

/**
 * Check if a note is in a special folder.
 * @param {TNote} note - the note to check
 * @returns {boolean} true if the note is in a special folder, false otherwise
 */
export function isNoteInSpecialFolder(note: TNote): boolean {
  return note.filename.substring(0, 1) === '@'
}

/**
 * Note: DEPRECATED: use getRegularNotesInFolder() instead.
 * Get all notes in a given folder:
 * - matching all folders that include the 'forFolder' parameter
 * - or just those in the root folder (if forFolder === '/')
 * - or all project notes if no folder given
 * Note: ignores any sub-folders
 * Now also caters for searches just in root folder.
 * @author @dwertheimer + @jgclark

 * @param {string} forFolder optional folder name (e.g. 'myFolderName'), matching all folders that include this string
 * @returns {$ReadOnlyArray<TNote>} array of notes in the folder
 */
export function getProjectNotesInFolder(forFolder: string = ''): $ReadOnlyArray<TNote> {
  const notes: $ReadOnlyArray<TNote> = DataStore.projectNotes
  let filteredNotes: Array<TNote> = []
  if (forFolder === '') {
    filteredNotes = notes.slice() // slice() avoids $ReadOnlyArray mismatch problem
  } else if (forFolder === '/') {
    // root folder ('/') has to be treated as a special case
    filteredNotes = notes.filter((note) => !note.filename.includes('/'))
  } else {
    // if last character is a slash, remove it
    const folderWithoutSlash = forFolder.charAt(forFolder.length - 1) === '/' ? forFolder.slice(0, forFolder.length) : forFolder
    filteredNotes = notes.filter((note) => getFolderFromFilename(note.filename) === folderWithoutSlash)
  }
  // logDebug('note/getProjectNotesInFolder', `Found ${filteredNotes.length} notes in folder '${forFolder}'`)
  return filteredNotes
}

/**
 * Get all notes in a given folder (or all project notes if no folder given), sorted by note title.
 * Optionally look in sub-folders as well.
 * @author @jgclark
 *
 * @param {string} folder - folder to scan
 * @param {string} alsoSubFolders? - also look in subfolders under the folder name
 * @return {Array<TNote>} - list of notes
 */
export function notesInFolderSortedByTitle(folder: string, alsoSubFolders: boolean = false): Array<TNote> {
  try {
    // logDebug('note/notesInFolderSortedByTitle', `Starting for folder '${folder}'`)
    const allNotesInFolder = DataStore.projectNotes.slice()
    let notesInFolder: Array<TNote>
    // If folder given (not empty) then filter using it
    if (folder !== '') {
      if (alsoSubFolders) {
        notesInFolder = allNotesInFolder.filter((n) => getFolderFromFilename(n.filename).startsWith(folder))
      } else {
        notesInFolder = allNotesInFolder.filter((n) => getFolderFromFilename(n.filename) === folder)
      }
    } else {
      // return all project notes
      notesInFolder = allNotesInFolder
    }
    // Sort alphabetically on note's title
    const notesSortedByTitle = notesInFolder.sort((first, second) => (first.title ?? '').localeCompare(second.title ?? ''))
    return notesSortedByTitle
  } catch (err) {
    logError('note/notesInFolderSortedByTitle', err.message)
    return []
  }
}

/**
 * Get all regular notes in a given folder (and any sub-folders):
 * - matching all folders that include the 'forFolder' parameter
 * - or just those in the root folder (if forFolder === '/')
 * - or all regular notes if no folder given
 * If 'ignoreSpecialFolders' is true, then ignore folders whose folder path starts with '@' (e.g. @Templates)
 * Note: this is a newer version of getProjectNotesInFolder() that reflects Eduard's updated naming.
 * @author @dwertheimer + @jgclark

 * @param {string} forFolder optional folder name (e.g. 'myFolderName'), matching all folders that include this string
 * @param {Array<string>} foldersToIgnore? (default []) ignore folders whose folder path starts with any of these strings
 * @param {boolean?} ignoreSpecialFolders (default true) ignore folders whose folder path starts with '@' (e.g. @Templates)
 * @returns {$ReadOnlyArray<TNote>} array of notes in the folder
 */
export function getRegularNotesInFolder(
  forFolder: string = '',
  ignoreSpecialFolders: boolean = true,
  foldersToIgnore: Array<string> = [],
): $ReadOnlyArray<TNote> {
  const notes: $ReadOnlyArray<TNote> = DataStore.projectNotes
  let filteredNotes: Array<TNote> = []
  if (forFolder === '') {
    filteredNotes = notes.slice() // slice() avoids $ReadOnlyArray mismatch problem
  } else if (forFolder === '/') {
    // root folder ('/') has to be treated as a special case
    filteredNotes = notes.filter((note) => !note.filename.includes('/'))
  } else {
    // if last character is a slash, remove it
    const folderWithoutSlash = forFolder.charAt(forFolder.length - 1) === '/' ? forFolder.slice(0, forFolder.length) : forFolder
    filteredNotes = notes.filter((note) => getFolderFromFilename(note.filename).startsWith(folderWithoutSlash))
  }

  // Now, if wanted, filter out any special folders
  if (ignoreSpecialFolders) {
    filteredNotes = filteredNotes.filter((note) => !isNoteInSpecialFolder(note))
  }

  // Finally, if wanted, filter out any of the folders to ignore
  if (foldersToIgnore.length > 0) {
    filteredNotes = filteredNotes.filter((note) => !foldersToIgnore.some((folder) => note.filename.startsWith(folder)))
  }

  // logDebug('note/getRegularNotesInFolder', `Found ${filteredNotes.length} notes in folder '${forFolder}'`)
  return filteredNotes
}

/**
 * WARNING: Deprecated: use renamed function 'getRegularNotesFromFilteredFolders' instead.
 * Return array of all project notes, excluding those in list of folders to exclude, and (if requested) from special '@...' folders
 * @author @jgclark
 * @param {Array<string>} foldersToExclude
 * @param {boolean} excludeSpecialFolders?
 * @returns {Array<TNote>} wanted notes
 */
export function projectNotesFromFilteredFolders(foldersToExclude: Array<string>, excludeSpecialFolders: boolean): Array<TNote> {
  // Get list of wanted folders
  const filteredFolders = getFolderListMinusExclusions(foldersToExclude, excludeSpecialFolders)

  // Iterate over all project notes and keep the notes in the wanted folders ...
  const allProjectNotes = DataStore.projectNotes
  const projectNotesToInclude = []
  for (const pn of allProjectNotes) {
    const thisFolder = getFolderFromFilename(pn.filename)
    if (filteredFolders.includes(thisFolder)) {
      projectNotesToInclude.push(pn)
    } else {
      // logDebug(pluginJson, `  excluded note '${pn.filename}'`)
    }
  }
  return projectNotesToInclude
}

/**
 * Return array of all regular notes, excluding those in list of folders to exclude, and (if requested) from special '@...' folders
 * Note: this is a newer version of getRegularNotesInFolder() that reflects Eduard's updated naming.
 * @author @jgclark
 * @param {Array<string>} foldersToExclude
 * @param {boolean} excludeSpecialFolders?
 * @returns {Array<TNote>} wanted notes
 */
export function getRegularNotesFromFilteredFolders(foldersToExclude: Array<string>, excludeSpecialFolders: boolean): Array<TNote> {
  try {
    // Get list of wanted folders
    const filteredFolders = getFolderListMinusExclusions(foldersToExclude, excludeSpecialFolders)

    // Iterate over all project notes and keep the notes in the wanted folders ...
    const allProjectNotes = DataStore.projectNotes
    const projectNotesToInclude = []
    for (const pn of allProjectNotes) {
      const thisFolder = getFolderFromFilename(pn.filename)
      if (filteredFolders.includes(thisFolder)) {
        projectNotesToInclude.push(pn)
      } else {
        logDebug('note/getRegularNotesFromFilteredFolders', `- excluded note '${pn.filename}'`)
      }
    }
    return projectNotesToInclude
  } catch (err) {
    logError('note/getRegularNotesFromFilteredFolders', err.message)
    return []
  }
}

/**
 * Check for invalid characters <>:"\|?* in filename, covering APFS and NTFS rules, but still allowing '/'
 * @param {string} path - The path to check.
 * @returns {boolean} - Whether the filename has invalid characters.
 */
export function doesFilenameHaveInvalidCharacters(path: string): boolean {
  const invalidChars = /[<>:"\\|?*]/g
  if (path.match(invalidChars)) {
    return true
  }
  return false
}

/**
 * Check if a filename exists in the same folder, but with a different case.
 * @param {string} filepath - The filepath to check.
 * @returns {boolean} - Whether the filename exists in the same folder, but with a different case.
 */
export function doesFilenameExistInFolderWithDifferentCase(filepath: string): boolean {
  // const filename = getJustFilenameFromFullFilename(filepath)
  const folder = getFolderFromFilename(filepath)
  // logDebug(`doesFilenameExistInFolderWithDifferentCase`, `Checking if analogue of "${filename}" exists in folder "${folder}"`)
  const filesInFolder = getRegularNotesInFolder(folder)
  for (const file of filesInFolder) {
    // logDebug(`doesFilenameExistInFolderWithDifferentCase`, `- Checking if "${file.filename}" is equivalent to "${filepath}"`)
    if (caseInsensitiveMatch(file.filename, filepath)) {
      logInfo(`doesFilenameExistInFolderWithDifferentCase`, `different case version of filename "${filepath}" DOES exist`)
      return true
    }
  }
  // logDebug(`doesFilenameExistInFolderWithDifferentCase`, `different case version of "${filename}" does NOT exist`)
  return false
}
