// @flow

/**
 * @description Return list of folders, excluding those on the given list (and any of their sub-folders).
 * @author @jgclark
 *
 * @param {[string]} exclusions
 * @returns {[string]} array of folder names
 */
export function filterFolderList(exclusions: Array<string>): $ReadOnlyArray<string> {
  const folderList = DataStore.folders
  const reducedList: Array<string> = []
  if (exclusions.length > 0) {
    for (const f of folderList) {
      const firstPart = f.split('/')[0]
      // TODO: Check if this works specifying a sub-folder to exclude
      if (!exclusions.includes(firstPart)) {
        reducedList.push(f)
      }
    }
  } else {
    console.log(`filterFolderList: warning: empty excluded folder list`)
    reducedList.push(...folderList.slice())
  }
  return reducedList
}

/**
 * @description Get the folder name from the full NP (project) note filename.
 * @author @jgclark
 *
 * @param {string} fullFilename - full filename to get folder name part from
 * @returns {string} folder/subfolder name
 */
export function getFolderFromFilename(fullFilename: string): string {
  const filenameParts = fullFilename.split('/')
  return filenameParts.slice(0, filenameParts.length - 1).join('/')
}
