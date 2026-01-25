// @flow
//-----------------------------------------------------------------------------
// Functions to list where note names and their filenames are inconsistent.
// by Leo Melo, readied for the plugin and maintained by @jgclark
// Last updated 2026-01-25 for v1.3.1 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../../../plugin.json'
import { findInconsistentNames } from '../../helpers/findInconsistentNames'
import { showHTMLV2 } from '@helpers/HTMLView'
import { logDebug, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { getFSSafeFilenameFromNoteTitle } from '@helpers/NPnote'
import { closeWindowFromCustomId } from '@helpers/NPWindows'
import { chooseFolder, showMessage } from '@helpers/userInput'

/**
 * Shows a list of notes with inconsistent names (i.e. where the note title and filename are different).
 * Only makes sense for private regular notes.
 * @param {string} folderIn - Optional URL-encodedfolder to check for inconsistent names. If not provided, the user will be prompted to choose a folder.
 * @returns void
 */
export async function listInconsistentNames(folderIn: string = ''): Promise<void> {
  try {
    let folder = ''
    if (folderIn) {
      logDebug(pluginJson, `listInconsistentNames() for folder '${folderIn}'`)
      folder = decodeURIComponent(folderIn)
    } else {
      logDebug(pluginJson, 'listInconsistentNames(): Checking for inconsistent names in project notes...')
      // Find only private (non-teamspace) notes
      folder = await chooseFolder('Choose a note folder to find inconsistent filenames in', false, false, '', true, true)
    }

    if (!folder) {
      logWarn(pluginJson, 'listInconsistentNames(): No folder chosen. Stopping.')
      return
    }

    logDebug(pluginJson, `listInconsistentNames() for folder '${folder}'`)

    const inconsistentNames = await findInconsistentNames(folder, true)
    if (inconsistentNames.length > 0) {
      const notesList = inconsistentNames
        .map((note) => {
          const currentFullPath = note.filename
          const newPath = getFSSafeFilenameFromNoteTitle(note)
          return `<li><strong>${displayTitle(note)}</strong><br><span class="path">${currentFullPath}</span><br>→ <span class="path">${newPath}</span></li>`
        })
        .join('\n')
      const refreshButton = `<a href="noteplan://x-callback-url/runPlugin?pluginID=jgclark.NoteHelpers&command=list%20inconsistent%20note%20filenames&arg0=${encodeURIComponent(folder)}" class="button">Refresh</a>`
      const renameButton = `<a href="noteplan://x-callback-url/runPlugin?pluginID=jgclark.NoteHelpers&command=rename%20inconsistent%20note%20filenames&arg0=${encodeURIComponent(folder)}" class="button">Rename all files ...</a>`
      const headTags = `<head><style>
strong {
  font-weight: 600;
}
.folder {
  font-family: monospace;
  font-size: 1rem;
  font-weight: 600;
  color: var(--tint-color);
}
.path {
  font-family: monospace;
  font-size: 0.9rem;
  color: var(--tint-color);
}
.button {
  background-color: var(--bg-alt-color);
  border: 1px solid var(--fg-main-color);
  color: var(--fg-main-color);
  padding: 0.2rem 0.4rem;
  text-align: center;
  text-decoration: none;
  display: inline-block;
  margin: 4px 2px;
  cursor: pointer;
  border-radius: 4px;
}

.button:hover {
  background-color: var(--bg-mid-color);
}
  </style>
</head>`
      const htmlBody = `${headTags}
      <h1>Inconsistent note names</h1>
      <p>Found ${inconsistentNames.length} inconsistent names in folder <span class="folder">${folder}</span>: ${refreshButton} ${renameButton}</p>
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
      closeWindowFromCustomId('inconsistent-names')
      await showMessage(`No inconsistent names found in folder ${folder}`, 'OK', 'List inconsistent names')
    }
  } catch (error) {
    logError(pluginJson, `listInconsistentNames() error: ${error.message}`)
  }
}
