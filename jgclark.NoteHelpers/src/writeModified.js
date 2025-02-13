// @flow

import pluginJson from '../plugin.json'
import { updateFrontMatterVars, isTriggerLoop } from '../../helpers/NPFrontMatter'
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
    // only run if the note has not been written to in the last 5 seconds
    if (Editor?.note && !isTriggerLoop(Editor.note, 5000)) {
      const { authorID, dateFormat, showMachineInfo } = await DataStore.settings
      const theTime = !dateFormat || dateFormat === 'ISO' ? new Date().toISOString() : new Date().toLocaleString()
      const { machineName, platform } = NotePlan.environment
      const machine = showMachineInfo ? `@${machineName ? `${machineName}|` : ''}${platform}` : ''
      updateFrontMatterVars(Editor, {
        modified: authorID ? `${theTime} (${authorID}${machine})` : `${theTime}${machine}`,
      })
    }
  } catch (e) {
    logError(pluginJson, JSP(e))
  }
}
