// @flow

import { showHTMLV2 } from '../../helpers/HTMLView'
import { logError, logInfo } from '../../helpers/dev'
import { displayTitle } from '../../helpers/general'
import pluginJson from '../plugin.json'
import { findInconsistentNames } from './lib/findInconsistentNames'
import { newNotePath } from './lib/newNotePath'
/**
 * Shows a list of notes with inconsistent names (i.e. where the note title and filename are different).
 * @returns void
 */
export function listInconsistentNames(): void {
  try {
    logInfo(pluginJson, 'listInconsistentNames(): Checking for inconsistent names in project notes...')

    const inconsistentNames = findInconsistentNames()
    if (inconsistentNames.length > 0) {
      const notesList = inconsistentNames
        .map((note) => {
          const currentFullPath = note.filename
          const newPath = newNotePath(note)
          return `<li><strong>${displayTitle(note)}</strong><br><pre>${currentFullPath}</pre><pre>${newPath}</pre></li>`
        })
        .join('\n')
      const htmlBody = `
      <h1>Inconsistent note names</h1>
      <p>Found ${inconsistentNames.length} inconsistent names in project notes (current -> new):</p>
      <ol>
      ${notesList}
      </ol>
      `

      showHTMLV2(htmlBody, {
        windowTitle: 'Inconsistent note names',
        customId: 'inconsistent-names',
      })
    }
  } catch (error) {
    logError(pluginJson, `listInconsistentNames() error: ${error.message}`)
  }
}
