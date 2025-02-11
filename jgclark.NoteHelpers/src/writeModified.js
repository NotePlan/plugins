// @flow

import pluginJson from '../plugin.json'
import { setFrontMatterVars } from '@helpers/NPFrontMatter'
import { log, logError, logDebug, timer, clo, clof, JSP } from '@helpers/dev'

/****************************************************************************************************************************
 *                             CONSTANTS
 ****************************************************************************************************************************/

/****************************************************************************************************************************
 *                             LOCAL FUNCTIONS
 ****************************************************************************************************************************/

/****************************************************************************************************************************
 *                             EXPORTED FUNCTIONS
 ****************************************************************************************************************************/

/****************************************************************************************************************************
 *                             COMMAND ENTRYPOINTS
 ****************************************************************************************************************************/

/**
 * Writes the modified date to frontmatter (on each save). Writes to 'modified' key
 * Requires the trigger onEditorWillSave
 * @author @jgclark
 */
export async function writeModified(): Promise<void> {
  try {
    logDebug('writeModified', 'Starting')
    const { authorID, dateFormat } = await DataStore.settings
    const theTime = !dateFormat || dateFormat === 'ISO' ? new Date().toISOString() : new Date().toLocaleString()
    setFrontMatterVars(Editor, {
      modified: authorID ? `${theTime} (${authorID})` : theTime,
    })
  } catch (e) {
    logError(pluginJson, JSP(e))
  }
}
