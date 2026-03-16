// @flow
//-----------------------------------------------------------------------------
// Clean up note filenames: decode entities, fix path-unsafe chars in a folder and subfolders.
// Jonathan Clark
// Last updated 2026-03-14 for v1.18.0 by @Cursor guided by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { getTagParamsFromString } from '@helpers/general'
import { getFolderFromFilename, getRegularNotesInFolder, doesFilenameExistInFolderWithDifferentCase } from '@helpers/folders'
import { cleanFilenameBasename } from '@helpers/NPnote'
import { parseTeamspaceFilename } from '@helpers/teamspace'
import { chooseFolder, showMessage, showMessageYesNo } from '@helpers/userInput'

/**
 * Clean up note filenames in a folder and all subfolders.
 * Optional folderToStart from params (e.g. template/callback); if missing, prompts user to choose folder.
 * Excludes Calendar and Teamspace notes. Renames only when cleaned basename differs from current.
 * @param {string} params - Optional JSON string with folderToStart
 */
export async function cleanUpNoteFilenames(params: string = ''): Promise<void> {
  try {
    let folderToStart = await getTagParamsFromString(params ?? '', 'folderToStart', '')
    if (folderToStart && typeof folderToStart === 'string') {
      folderToStart = decodeURIComponent(folderToStart)
    }
    if (!folderToStart || folderToStart === '') {
      logDebug(pluginJson, 'cleanUpNoteFilenames(): No folder param, asking user')
      folderToStart = await chooseFolder('Choose folder to clean up note filenames in (includes subfolders)', false, false, '', true, true)
    }
    if (!folderToStart || folderToStart === '') {
      logWarn(pluginJson, 'cleanUpNoteFilenames(): No folder chosen. Stopping.')
      return
    }

    logDebug(pluginJson, `cleanUpNoteFilenames(): folder: ${folderToStart}`)

    const notes = getRegularNotesInFolder(folderToStart, true, [])
    const toProcess = notes.filter((n) => {
      if (n.type === 'Calendar') return false
      const { isTeamspace } = parseTeamspaceFilename(n.filename)
      return !isTeamspace
    })

    logInfo('cleanUpNoteFilenames', `Processing ${String(toProcess.length)} notes ...`)
    const changes = []
    for (const n of toProcess) {
      const folder = getFolderFromFilename(n.filename)
      const basename = (n.filename.includes('/') ? n.filename.split('/').pop() : n.filename) ?? n.filename
      const cleanedBasename = cleanFilenameBasename(basename)
      if (cleanedBasename === basename) continue
      console.log(`- TO DO: "${n.filename}" -> "${cleanedBasename}"`)
      const newPath = folder === '/' ? cleanedBasename : `${folder}/${cleanedBasename}`
      changes.push({ note: n, newPath })
    }
    if (changes.length === 0) {
      await showMessage('No note filenames need cleaning in that folder and subfolders.', 'OK', 'Clean up note filenames')
      return
    }

    const confirmed = await showMessageYesNo(
      `Clean ${String(changes.length)} note filename(s) in this folder and subfolders? (Details are in the log.)`,
      ['Yes', 'No'],
      'Clean up note filenames',
    )
    if (confirmed !== 'Yes') {
      logDebug('cleanUpNoteFilenames', 'User cancelled.')
      return
    }

    let numRenamed = 0
    for (const { note, newPath } of changes) {
      let targetPath = newPath
      let i = 0
      while (doesFilenameExistInFolderWithDifferentCase(targetPath)) {
        i += 1
        const lastDot = targetPath.lastIndexOf('.')
        targetPath = lastDot >= 0 ? targetPath.slice(0, lastDot) + `_${i}` + targetPath.slice(lastDot) : targetPath + `_${i}`
      }
      const noteRef = DataStore.noteByFilename(note.filename, 'Notes')
      if (!noteRef) {
        logWarn('cleanUpNoteFilenames', `Note not found: ${note.filename}`)
        continue
      }
      try {
        noteRef.rename(targetPath)
        numRenamed += 1
        console.log(`- DONE: ${note.filename} -> ${targetPath}`)
        DataStore.updateCache(noteRef, true)
      } catch (e) {
        logError('cleanUpNoteFilenames', `rename failed ${note.filename}: ${JSP(e)}`)
      }
    }

    await showMessage(`Renamed ${String(numRenamed)} note filename(s).\nNote: You're advised to use 'Reset Caches' from the Help menu before using these notes again.`, 'OK', 'Clean up note filenames')
    logInfo('cleanUpNoteFilenames', `Renamed ${String(numRenamed)} note filename(s).`)
  } catch (err) {
    logError(pluginJson, `cleanUpNoteFilenames(): ${JSP(err)}`)
  }
}
