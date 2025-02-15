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
 * Requires the trigger: onEditorWillSave => jgclark.NoteHelpers.writeModified
 * @param {boolean} noTriggerGuard - if true, the trigger guard is not used (so the function can be run by hand and always writes)
 * @author @dwertheimer
 */
export async function writeModified(noTriggerGuard: boolean = false): Promise<void> {
  try {
    // only run if the note has not been written to in the last 5 seconds
    if (noTriggerGuard || (Editor.note && !isTriggerLoop(Editor.note, 5000))) {
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

/**
 * Writes the modified date to frontmatter (on each save). Writes to 'modified' key
 * Does not have a trigger guard, so can be run by hand
 * This is for users who explicitly want to write the modified date to frontmatter via CommandBar or an xcallback
 * This should not be used as a trigger
 * @author @dwertheimer
 */
export async function writeModifiedWithoutTriggerGuard(): Promise<void> {
  await writeModified(true)
}
