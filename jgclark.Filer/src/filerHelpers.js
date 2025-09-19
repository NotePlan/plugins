// @flow
// ----------------------------------------------------------------------------
// Helper functions for Filer plugin.
// Jonathan Clark
// last updated 2025-09-06, for v1.3.2
// ----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { clo, JSP, logDebug, logError } from '@helpers/dev'
import { findStartOfActivePartOfNote } from '@helpers/paragraph'
import { showMessage } from '@helpers/userInput'

//-----------------------------------------------------------------------------

const pluginID = pluginJson['plugin.id'] // was 'jgclark.Filer'

export type FilerConfig = {
  addDateBacklink: boolean,
  dateRefStyle: string,
  includeFromStartOfSection: boolean,
  allowNotePreambleBeforeHeading: boolean,
  useTightBlockDefinition: boolean,
  whereToAddInSection: string, // 'start' (default) or 'end'
  // justCompletedItems: boolean, // migrating to the next item
  typesToFile: string, // now a choice: all but incomplete tasks
  useBlocks: boolean,
  whereToAddInNote: string, // 'start' (default) or 'end'
  ignoreNoteLinkFilerTag: string,
  copyOrMove: string, // 'copy' or 'move'. Note: not set in plugin settings, but in object to send from wrappers to main functions
  recentDays: number,
  _logLevel: string,
}

export async function getFilerSettings(): Promise<any> {
  try {
    // // TODO: add to np.Shared
    // // First get global setting 'useTightBlockDefinition'
    // let useTightBlockDefinition = await getSetting('np.Shared', 'useTightBlockDefinition')
    // logDebug('getFilerSettings', `- useTightBlockDefinition: np.Globals: ${String(useTightBlockDefinition)}`)

    // Get settings using Config system
    const config: FilerConfig = await DataStore.loadJSON(`../${pluginID}/settings.json`)

    if (config == null || Object.keys(config).length === 0) {
      logError(pluginJson, `getFilerSettings() cannot find '${pluginID}' plugin settings. Stopping.`)
      await showMessage(`Cannot find settings for the '${pluginID}' plugin. Please make sure you have installed it from the Plugin Preferences pane.`)
      return
    } else {
      // clo(config, `${pluginID} settings:`)
      return config
    }
  } catch (err) {
    logError(pluginJson, `GetFilerSettings(): ${err.name}: ${err.message}`)
    await showMessage(`Error: ${err.message}`)
  }
}

/**
 * Highlight the given Paragraph range (including just a single line) in the open editor.
 * @author @jgclark
 * @param {Array<TParagraph>} paras
 */
export function highlightSelectionInEditor(paras: Array<TParagraph>): void {
  const firstStartCharIndex = paras[0].contentRange?.start ?? NaN
  const lastEndCharIndex = paras[paras.length - 1].contentRange?.end ?? null
  if (firstStartCharIndex && lastEndCharIndex) {
    const parasCharIndexRange: TRange = Range.create(firstStartCharIndex, 
    lastEndCharIndex)
    // logDebug('moveParas', `- will try to highlight automatic block  selection range ${rangeToString(parasCharIndexRange)}`)
    Editor.highlightByRange(parasCharIndexRange)
  }
}
