// @flow
// ----------------------------------------------------------------------------
// Helper functions for Filer plugin.
// Jonathan Clark
// last updated 29.4.2023, for v1.1.0
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { clo, JSP, logDebug, logError } from '@helpers/dev'
import { getSetting } from '@helpers/NPConfiguration'
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
    // let useTightBlockDefinition = getSetting('np.Shared', 'useTightBlockDefinition')
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
    await showMessage('Error: ' + err.message)
  }
}

/**
 * Function to write text either to top of note, bottom of note, or after a heading
 * Note: When written, there was no API function to deal with multiple selectedParagraphs,
 * but we can insert a raw text string.
 * Note: now can't simply use note.addParagraphBelowHeadingTitle() as we have more options than it supports
 * @author @jgclark
 *
 * @param {TNote} destinationNote
 * @param {string} selectedParasAsText
 * @param {string} headingToFind if empty, means 'end of note'. Can also be the special string '(top of note)'
 * @param {string} whereToAddInSection to add after a heading: 'start' or 'end'
 * @param {boolean} allowNotePreambleBeforeHeading?
 */
export function addParasAsText(
  destinationNote: TNote,
  selectedParasAsText: string,
  headingToFind: string,
  whereToAddInSection: string,
  allowNotePreambleBeforeHeading: boolean
): void {
  const destinationNoteParas = destinationNote.paragraphs
  let insertionIndex: number
  if (headingToFind === destinationNote.title || headingToFind === '<<top of note>>') {
    // i.e. the first line in project or calendar note
    insertionIndex = findStartOfActivePartOfNote(destinationNote, allowNotePreambleBeforeHeading)
    logDebug(pluginJson, `-> top of note, line ${insertionIndex}`)
    destinationNote.insertParagraph(selectedParasAsText, insertionIndex, 'text')

  } else if (headingToFind === '') {
    // blank return from chooseHeading has special meaning of 'end of note'
    insertionIndex = destinationNoteParas.length + 1
    logDebug(pluginJson, `-> bottom of note, line ${insertionIndex}`)
    destinationNote.insertParagraph(selectedParasAsText, insertionIndex, 'text')

  } else if (whereToAddInSection === 'start') {
    logDebug(pluginJson, `-> Inserting at start of section '${headingToFind}'`)
    destinationNote.addParagraphBelowHeadingTitle(selectedParasAsText, 'text', headingToFind, false, false)

  } else if (whereToAddInSection === 'end') {
    logDebug(pluginJson, `-> Inserting at end of section '${headingToFind}'`)
    destinationNote.addParagraphBelowHeadingTitle(selectedParasAsText, 'text', headingToFind, true, false)

  } else {
    // Shouldn't get here
    logError(pluginJson, `Can't find heading '${headingToFind}'. Stopping.`)
  }
}
