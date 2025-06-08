// @flow
//-----------------------------------------------------------------------------
// Functions to list where note names and their filenames are inconsistent.
// by Leo Melo, readied for the plugin and maintained by @jgclark
// Last updated 2025-06-06 for v1.2.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../../../plugin.json'
import { findInconsistentNames } from '../../helpers/findInconsistentNames'
import { showHTMLV2 } from '@helpers/HTMLView'
import { logDebug, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { getFSSafeFilenameFromNoteTitle } from '@helpers/NPnote'
import { chooseFolder, showMessage } from '@helpers/userInput'

/**
 * Shows a list of notes with inconsistent names (i.e. where the note title and filename are different).
 * @returns void
 */
export async function listInconsistentNames(): Promise<void> {
  try {
    logDebug(pluginJson, 'listInconsistentNames(): Checking for inconsistent names in project notes...')
    const folder = await chooseFolder('Choose a folder to find inconsistent filenames in')

    if (!folder) {
      logWarn(pluginJson, 'listInconsistentNames(): No folder chosen. Stopping.')
      return
    }

    logDebug(pluginJson, `listInconsistentNames() for folder '${folder}'`)

    const inconsistentNames = await findInconsistentNames(folder)
    if (inconsistentNames.length > 0) {
      const notesList = inconsistentNames
        .map((note) => {
          const currentFullPath = note.filename
          const newPath = getFSSafeFilenameFromNoteTitle(note)
          return `<li><strong>${displayTitle(note)}</strong><br><code>${currentFullPath}</code><br>→ <code>${newPath}</code></li>`
        })
        .join('\n')
      const htmlBody = `
      <h1>Inconsistent note names</h1>
      <p>Found ${inconsistentNames.length} inconsistent names in folder <code>${folder}</code></p>
      <ol>
      ${notesList}
      </ol>
      `

      const res = showHTMLV2(htmlBody, {
        windowTitle: 'Inconsistent note names',
        customId: 'inconsistent-names',
        savedFilename: '../../jgclark.NoteHelpers/inconsistent-names.html',
        width: 620,
        height: 780,
        shouldFocus: true
      })
    } else {
      await showMessage('No inconsistent names found. Well done!', 'OK', 'List inconsistent names')
    }
  } catch (error) {
    logError(pluginJson, `listInconsistentNames() error: ${error.message}`)
  }
}
