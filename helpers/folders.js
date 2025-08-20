// @flow
//-------------------------------------------------------------------------------
// Folder-level Functions
// Really should be called 'NPFolders' as it relies on DataStore.folders.
//-------------------------------------------------------------------------------

import yaml from 'yaml'
import { logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { caseInsensitiveMatch, caseInsensitiveStartsWith, caseInsensitiveSubstringMatch } from '@helpers/search'
import { TEAMSPACE_INDICATOR } from '@helpers/regex'
import { getAllTeamspaceIDsAndTitles, getTeamspaceTitleFromID } from '@helpers/NPTeamspace'
import { getFilenameWithoutTeamspaceID, getTeamspaceIDFromFilename, isTeamspaceNoteFromFilename } from '@helpers/teamspace'

/**
 * Return a list of folders (and any sub-folders) that contain one of the strings on the inclusions list (if given).
 * If no inclusions are given, then use all folders.
 * Then excludes those items that are on the exclusions list.
 * The Root folder can be excluded by adding '/' to the exclusions list; this doesn't affect any sub-folders.
 * To just return the Root folder, then send just '/' as an inclusion. (But then why bother using this function?!)
 * Where there is a conflict exclusions will take precedence over inclusions.
 * Optionally exclude all special @... folders as well [this overrides inclusions]
 * Note: these are partial matches ("contains" not "equals").
 * Note: now clarified that this is a case-insensitive match.
 * TEST: Teamspace root folders included from b1417
 * @author @jgclark
 * @tests in jest file
 *
 * @param {Array<string>} inclusions - if not empty, use these (sub)strings to match folder items
 * @param {boolean?} excludeSpecialFolders? (default: true)
 * @param {Array<string>?} exclusions - if these (sub)strings match then exclude this folder. Optional: if none given then will treat as an empty list.
 * @returns {Array<string>} array of folder names
 */
export function getFoldersMatching(inclusions: Array<string>, excludeSpecialFolders: boolean = true, exclusions: Array<string> = []): Array<string> {
  try {
    // Get all folders as array of strings (other than @Trash).
    const fullFolderList = DataStore.folders.slice() // slice to make not $ReadOnly

    // Note: the API call DataStore.folders does not return the teamspace root folders until it was fixed in b1417, so we need to add them manually here, from position 1.
    if (NotePlan.environment.buildVersion <= 1416) {
      const teamspaceDefs = getAllTeamspaceIDsAndTitles()
      teamspaceDefs.forEach((teamspaceDef) => {
        // Next line avoids auto-formatting errors
        // eslint-disable-next-line
        fullFolderList.splice(1, 0, TEAMSPACE_INDICATOR + '/' + teamspaceDef.id + '/')
        logDebug('folders / getFoldersMatching', `- adding root for teamspaceDef.id ${teamspaceDef.id}(${teamspaceDef.title}) to work around bug pre v3.18.0`)
      })
    }

    logDebug(
      'getFoldersMatching',
      `Starting to filter the ${fullFolderList.length} DataStore.folders with inclusions: [${inclusions.toString()}] and exclusions [${exclusions.toString()}]. ESF? ${String(
        excludeSpecialFolders,
      )}`,
    )
    // logDebug('folders / getFoldersMatching', `fullFolderList: [${fullFolderList.toString()}]`)

    // if requested filter fullFolderList to only folders that don't start with the character '@' (special folders)
    const reducedFolderList = excludeSpecialFolders ? fullFolderList.filter((folder) => !folder.startsWith('@')) : fullFolderList
    // logDebug('folders / getFoldersMatching', `- after specials filter ->  ${reducedFolderList.length} reducedFolderList: [${reducedFolderList.toString()}]`)

    // If no inclusions or exclusions, make life easier and return all straight away
    if (inclusions.length === 0 && exclusions.length === 0) {
      return reducedFolderList ? reducedFolderList : fullFolderList
    }

    // Also now delete '/' from reducedList (added back later if wanted)
    reducedFolderList.splice(reducedFolderList.indexOf('/'), 1)

    // To aid partial matching, terminate all folder strings with a trailing /.
    let reducedTerminatedWithSlash: Array<string> = reducedFolderList.map((f) => (f.endsWith('/') ? f : `${f}/`))
    // logDebug('folders / getFoldersMatching', `- after termination ->  ${reducedTerminatedWithSlash.length} reducedTWS:[${reducedTerminatedWithSlash.toString()}]`)

    // const rootIncluded = true // inclusions.some((f) => f === '/')
    const rootExcluded = exclusions.some((f) => f === '/')
    // logDebug('folders / getFoldersMatching', `- rootIncluded=${String(rootIncluded)}, rootExcluded=${String(rootExcluded)}`)

    // Deal with special case of inclusions just '/'
    if (inclusions.length === 1 && inclusions[0] === '/') {
      // logDebug('folders / getFoldersMatching', 'Special Case: Inclusions just /')
      return rootExcluded ? [] : ['/']
    }

    // Temporarily remove root to make rest of processing easier
    const inclusionsWithoutRoot = inclusions.filter((f) => f !== '/')
    const exclusionsWithoutRoot = exclusions.filter((f) => f !== '/')
    // logDebug('folders / getFoldersMatching', `- inclusionsWithoutRoot=${String(inclusionsWithoutRoot)}`)
    // logDebug('folders / getFoldersMatching', `- exclusionsWithoutRoot=${String(exclusionsWithoutRoot)}`)

    // filter reducedTerminatedWithSlash to exclude items in the exclusions list (if non-empty). Note: now case insensitive.
    // Note: technically this fails if the exclusion is any part of '%%NotePlanCloud%%/' but that's unlikely.
    if (exclusionsWithoutRoot.length > 0) {
      reducedTerminatedWithSlash = reducedTerminatedWithSlash.filter((folder) => !exclusionsWithoutRoot.some((f) => caseInsensitiveSubstringMatch(f, folder)))
      // logDebug('folders / getFoldersMatching',`- after exclusions -> ${reducedTerminatedWithSlash.length} reducedTWS: ${reducedTerminatedWithSlash.toString()}\n`)
    }

    // filter reducedTerminatedWithSlash to only folders that start with an item in the inclusionsTerminatedWithSlash list (if non-empty). Note: now case insensitive.
    // Note: technically this fails if the exclusion is any part of '%%NotePlanCloud%%/' but that's unlikely.

    if (inclusionsWithoutRoot.length > 0) {
      reducedTerminatedWithSlash = reducedTerminatedWithSlash.filter((folder) => inclusionsWithoutRoot.some((f) => caseInsensitiveSubstringMatch(f, folder)))
      // logDebug('folders / getFoldersMatching',`- after inclusions -> ${reducedTerminatedWithSlash.length} reducedTWS: ${reducedTerminatedWithSlash.toString()}\n`)
    }

    // now remove trailing slash characters
    const outputList = reducedTerminatedWithSlash.map((folder) => (folder.length > 1 && folder.endsWith('/') ? folder.slice(0, -1) : folder))

    // add '/' back in if it was not in exclusions
    if (!rootExcluded) {
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
 * Return a list of subfolders of a given folder. Includes the given folder itself.
 * @tests in jest file.
 *
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
 *
 * @param {Array<string>} exclusions - if these (sub)strings match then exclude this folder -- can be empty
 * @param {boolean?} excludeSpecialFolders? (default: true)
 * @param {boolean?} forceExcludeRootFolder? (default: false)
 * @param {boolean?} excludeTrash? (default true) only used if excludeSpecialFolders is false
 * @returns {Array<string>} array of folder names
 */
export function getFolderListMinusExclusions(
  exclusions: Array<string>,
  excludeSpecialFolders: boolean = true,
  forceExcludeRootFolder: boolean = false,
  excludeTrash: boolean = true,
): Array<string> {
  try {
    // Get all folders as array of strings (other than @Trash). Also remove root as a special case
    const fullFolderList = DataStore.folders
    let excludeRoot = forceExcludeRootFolder
    logDebug(
      'folders / getFolderListMinusExclusions',
      `Starting to filter the ${fullFolderList.length} DataStore.folders with exclusions [${exclusions.toString()}] and forceExcludeRootFolder ${String(forceExcludeRootFolder)}`,
    )

    // if excludeSpecialFolders, filter fullFolderList to only folders that don't start with the character '@' (special folders)
    let reducedFolderList = fullFolderList
    if (excludeSpecialFolders) {
      reducedFolderList = fullFolderList.filter((folder) => !folder.startsWith('@'))
    } else if (excludeTrash) {
      reducedFolderList = reducedFolderList.filter((folder) => !folder.startsWith('@Trash'))
    }
    // logDebug('folders / getFolderListMinusExclusions', `-> after specials filtering: ${reducedFolderList.length} items: [${reducedFolderList.toString()}]`)

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
 * Get the folder name from the regular note filename, without leading or trailing slash.
 * Except for items in root folder -> '/'.
 * Note: for Teamspace notes, this returns the Teamspace indicator + teamspace ID + folder path. See getFolderDisplayName() for a more useful display name.
 * @author @jgclark
 * @tests in jest file
 *
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
 * Get a useful folder name from the folder path, without leading or trailing slash, and with Teamspace name if applicable.
 * Note: Not needed before Teamspaces.
 * @author @jgclark
 * @tests in jest file
 *
 * @param {string} folderPath - as returned by DataStore.folders. Note: not full filename.
 * @param {boolean?} includeTeamspaceEmoji? (default true) include a Teamspace emoji in the display name
 * @returns {string} folder name for display (including Teamspace name if applicable)
 */
export function getFolderDisplayName(folderPath: string, includeTeamspaceEmoji: boolean = true): string {
  try {
    // If folderPath is empty, warn and return '(error)'
    if (!folderPath) {
      throw new Error(`Empty folderPath given. Returning '(error)'.`)
    }
    // logDebug('folders/getFolderDisplayName', `folderPath: ${folderPath}`)

    if (isTeamspaceNoteFromFilename(folderPath)) {
      const teamspaceID = getTeamspaceIDFromFilename(folderPath)
      // logDebug('folders/getFolderDisplayName', `teamspaceID: ${teamspaceID}`)
      const teamspaceName = getTeamspaceTitleFromID(teamspaceID)
      // logDebug('folders/getFolderDisplayName', `teamspaceName: ${teamspaceName}`)
      let folderPart = getFilenameWithoutTeamspaceID(folderPath)
      if (folderPart === '') {
        folderPart = '/'
      }
      return `[${includeTeamspaceEmoji ? '👥 ' : ''}${teamspaceName}] ${folderPart}`
    } else {
      return folderPath
    }
  } catch (error) {
    logError('folders/getFolderDisplayName', `Error getting folder display name from '${folderPath}: ${error.message}`)
    return '(error)'
  }
}

/**
 * Get the folder name from the full NP (project) note filename, without leading or trailing slash.
 * Optionally remove file extension.
 * Note: does not handle hidden files (starting with a dot, e.g. '.gitignore').
 * @author @jgclark
 * @tests in jest file
 *
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
 * @author @jgclark
 * @tests available in jest file
 *
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
export function getRegularNotesInFolder(forFolder: string = '', ignoreSpecialFolders: boolean = true, foldersToIgnore: Array<string> = []): $ReadOnlyArray<TNote> {
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
// export function projectNotesFromFilteredFolders(foldersToExclude: Array<string>, excludeSpecialFolders: boolean): Array<TNote> {
//   // Get list of wanted folders
//   const filteredFolders = getFolderListMinusExclusions(foldersToExclude, excludeSpecialFolders, false, true)

//   // Iterate over all project notes and keep the notes in the wanted folders ...
//   const allProjectNotes = DataStore.projectNotes
//   const projectNotesToInclude = []
//   for (const pn of allProjectNotes) {
//     const thisFolder = getFolderFromFilename(pn.filename)
//     if (filteredFolders.includes(thisFolder)) {
//       projectNotesToInclude.push(pn)
//     } else {
//       // logDebug(pluginJson, `  excluded note '${pn.filename}'`)
//     }
//   }
//   return projectNotesToInclude
// }

/**
 * Return array of all regular notes, excluding those in list of folders to exclude, and (if requested) from special '@...' folders (other than trash), and (if requested) from @Trash.
 * Note: this is a newer version of getRegularNotesInFolder() that reflects Eduard's updated naming.
 * @author @jgclark
 * @param {Array<string>} foldersToExclude
 * @param {boolean} excludeSpecialFolders?
 * @param {boolean?} excludeTrash? (default true)
 * @returns {Array<TNote>} wanted notes
 */
export function getRegularNotesFromFilteredFolders(foldersToExclude: Array<string>, excludeSpecialFolders: boolean, excludeTrash: boolean = true): Array<TNote> {
  try {
    // Get list of wanted folders
    const filteredFolders = getFolderListMinusExclusions(foldersToExclude, excludeSpecialFolders, false, excludeTrash)

    // Iterate over all project notes and keep the notes in the wanted folders ...
    const allProjectNotes = DataStore.projectNotes
    const projectNotesToInclude = []
    for (const pn of allProjectNotes) {
      const thisFolder = getFolderFromFilename(pn.filename)
      if (filteredFolders.includes(thisFolder)) {
        projectNotesToInclude.push(pn)
      } else {
        // logDebug('note/getRegularNotesFromFilteredFolders', `- excluded note '${pn.filename}'`)
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

/**
 * Read and parse the folder view data from NotePlan's data store
 * @returns {Object|null} Parsed folder view data or null if not available
 */
export function getFolderViewData(): Object | null {
  try {
    // Load the folder views data from the standard location
    const folderData = DataStore.loadData('../../../Filters/folders.views', true)
    if (!folderData) {
      logWarn('folders/getFolderViewData', 'No folder views data found at standard location')
      return null
    }

    // Check if the data is already parsed (object) or needs parsing (string)
    if (typeof folderData === 'object' && folderData !== null) {
      // Data is already parsed, return it directly
      logDebug('folders/getFolderViewData', 'Data already parsed, returning directly')
      return folderData
    } else if (typeof folderData === 'string') {
      // Data is a string, parse it as YAML
      logDebug('folders/getFolderViewData', 'Data is string, parsing as YAML')
      const parsedData = yaml.parse(folderData)

      if (!parsedData || typeof parsedData !== 'object') {
        logWarn('folders/getFolderViewData', 'Failed to parse folder views YAML data')
        return null
      }

      return parsedData
    } else {
      logWarn('folders/getFolderViewData', `Unexpected data type: ${typeof folderData}`)
      return null
    }
  } catch (error) {
    logError('folders/getFolderViewData', `Error reading folder view data: ${error.message}`)
    return null
  }
}

/**
 * Parse and organize folder views from the folder YAML data
 * @param {Object} folderYaml - The raw folder YAML data from DataStore
 * @returns {Object} Object with folder paths as keys and arrays of named views as values
 */
export function organizeFolderViews(folderYaml: Object): Object {
  try {
    const folderViews = {}

    if (!folderYaml.views || !Array.isArray(folderYaml.views)) {
      logWarn('folders/organizeFolderViews', 'No views array found in folder YAML data')
      return folderViews
    }

    folderYaml.views.forEach((viewItem, index) => {
      try {
        let view

        // Handle different data formats - the view might be a string or already an object
        if (typeof viewItem === 'string') {
          // It's a JSON string, parse it
          view = JSON.parse(viewItem)
        } else if (typeof viewItem === 'object' && viewItem !== null) {
          // It's already an object, use it directly
          view = viewItem
        } else {
          logWarn('folders/organizeFolderViews', `Unexpected view item type at index ${index}: ${typeof viewItem}`)
          return
        }

        const folderPath = view.folderPath
        const viewName = view.name

        // Skip default views (name === "View")
        if (viewName === 'View') return

        // Initialize folder if it doesn't exist
        if (!folderViews[folderPath]) {
          folderViews[folderPath] = []
        }

        // Add the named view to the folder
        folderViews[folderPath].push({
          name: viewName,
          dataLevel: view.dataLevel,
          layout: view.layout,
          folderPath: view.folderPath,
          group_by: view.group_by,
          group_sort: view.group_sort,
          sort: view.sort,
          fields: view.fields,
          fixedGroups: view.fixedGroups,
          isSelected: view.isSelected,
          // Include the original parsed view object for any other properties
          original: view,
        })
      } catch (error) {
        logWarn('folders/organizeFolderViews', `Error parsing view at index ${index}: ${error.message}`)
        // Log the actual content for debugging
        logDebug('folders/organizeFolderViews', `View item at index ${index}: ${JSON.stringify(viewItem)}`)
      }
    })

    logDebug('folders/organizeFolderViews', `Organized ${Object.keys(folderViews).length} folders with named views`)
    return folderViews
  } catch (error) {
    logError('folders/organizeFolderViews', `Error organizing folder views: ${error.message}`)
    return {}
  }
}

/**
 * Get a list of folders that have named views (excluding default "View" entries)
 * @param {Object} folderYaml - The raw folder YAML data from DataStore
 * @returns {Array<string>} Array of folder paths that have named views
 */
export function getFoldersWithNamedViews(folderYaml: Object): Array<string> {
  try {
    const organizedViews = organizeFolderViews(folderYaml)
    return Object.keys(organizedViews).sort()
  } catch (error) {
    logError('folders/getFoldersWithNamedViews', `Error getting folders with named views: ${error.message}`)
    return []
  }
}

/**
 * Get all named views for a specific folder
 * @param {Object} folderYaml - The raw folder YAML data from DataStore
 * @param {string} folderPath - The folder path to get views for
 * @returns {Array<Object>} Array of named view objects for the specified folder
 */
export function getNamedViewsForFolder(folderYaml: Object, folderPath: string): Array<Object> {
  try {
    const organizedViews = organizeFolderViews(folderYaml)
    return organizedViews[folderPath] || []
  } catch (error) {
    logError('folders/getNamedViewsForFolder', `Error getting named views for folder '${folderPath}': ${error.message}`)
    return []
  }
}

/**
 * Get a specific named view by folder and view name
 * @param {Object} folderYaml - The raw folder YAML data from DataStore
 * @param {string} folderPath - The folder path
 * @param {string} viewName - The name of the view to find
 * @returns {Object|null} The named view object or null if not found
 */
export function getNamedView(folderYaml: Object, folderPath: string, viewName: string): Object | null {
  try {
    const folderViews = getNamedViewsForFolder(folderYaml, folderPath)
    return folderViews.find((view) => view.name === viewName) || null
  } catch (error) {
    logError('folders/getNamedView', `Error getting named view '${viewName}' for folder '${folderPath}': ${error.message}`)
    return null
  }
}

/**
 * Get all named views across all folders, organized by data level
 * @param {Object} folderYaml - The raw folder YAML data from DataStore
 * @returns {Object} Object with dataLevel as keys and arrays of views as values
 */
export function getNamedViewsByDataLevel(folderYaml: Object): Object {
  try {
    const organizedViews = organizeFolderViews(folderYaml)
    const viewsByLevel = {}

    Object.values(organizedViews)
      .flat()
      .forEach((view) => {
        const level = view.dataLevel || 'unknown'
        if (!viewsByLevel[level]) {
          viewsByLevel[level] = []
        }
        viewsByLevel[level].push(view)
      })

    return viewsByLevel
  } catch (error) {
    logError('folders/getNamedViewsByDataLevel', `Error organizing views by data level: ${error.message}`)
    return {}
  }
}

/**
 * Example function demonstrating how to use the folder view helper functions
 * This function shows how to get all named views and display them in a user-friendly way
 * @returns {Object} Summary of all folders and their named views
 */
export function getFolderViewsSummary(): Object {
  try {
    const folderYaml = getFolderViewData()
    if (!folderYaml) {
      return { error: 'No folder YAML data available' }
    }

    const organizedViews = organizeFolderViews(folderYaml)
    const summary = {
      totalFolders: Object.keys(organizedViews).length,
      totalNamedViews: Object.values(organizedViews).reduce((sum, views) => sum + views.length, 0),
      folders: organizedViews,
      viewsByLevel: getNamedViewsByDataLevel(folderYaml),
    }

    logDebug('folders/getFolderViewsSummary', `Found ${summary.totalFolders} folders with ${summary.totalNamedViews} named views`)
    return summary
  } catch (error) {
    logError('folders/getFolderViewsSummary', `Error getting folder views summary: ${error.message}`)
    return { error: error.message }
  }
}
