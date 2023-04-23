// @flow
//-----------------------------------------------------------------------------
// Helper functions for Tidy plugin
// Jonathan Clark
// Last updated 26.3.2023 for v0.4.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import moment from 'moment/min/moment-with-locales'
import { clo, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { findEndOfActivePartOfNote } from '@helpers/paragraph'

//------------------------------------------------------------------------------
// Get settings

const pluginID = 'np.Tidy'

export type TidyConfig = {
  foldersToExclude: Array<string>,
  justRemoveFromChecklists: boolean,
  matchType: string,
  numDays: number,
  rootNotesToIgnore: Array<string>,
  runFileRootNotesCommand: boolean,
  runRemoveOrphansCommand: boolean,
  runRemoveDoneMarkersCommand: boolean,
  runRemoveDoneTimePartsCommand: boolean,
  runRemoveSectionFromNotesCommand: boolean,
  removeTriggersFromRecentCalendarNotes: boolean,
  runSilently: boolean,
  _logLevel: string,
}

/**
 * Get config settings using Plugin settings system.
 * @return {TidyConfig} object with configuration
 */
export async function getSettings(): Promise<any> {
  // logDebug(pluginJson, `Start of getSettings()`)
  try {
    // Get settings
    const config: TidyConfig = await DataStore.loadJSON(`../${pluginID}/settings.json`)
    // clo(config, `${pluginID} settings:`)

    if (config == null || Object.keys(config).length === 0) {
      throw new Error(`Cannot find settings for '${pluginID}' plugin`)
    }

    return config
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    return null // for completeness
  }
}

/**
 * Run supplied regex against supplied list of notes and return matched paragraphs.
 * @author @jgclark
 * @param {Array<TNote>} notesIn list of notes to process
 * @param {RegExp} regexIn to test with
 * @returns {Array<TParagraph> | void} list of paras (or void if none)
 */
export function returnRegexMatchedParas(notesIn: Array<TNote>, regexIn: RegExp): Array<TParagraph> | void {
  try {
    logDebug('returnRegexMatchedParas', `Starting for ${String(notesIn.length)} notes and RegExp /${String(regexIn)}/`)
    let matchedParas: Array<TParagraph> = []
    let matchCount = 0
    for (const thisNote of notesIn) {
      const { paragraphs, title, type } = thisNote
      if (thisNote === null || paragraphs === null) {
        let lineCount = paragraphs.length
        // check if the last paragraph is undefined, and if so delete it from our copy
        if (paragraphs[lineCount] === null) {
          lineCount--
        }

        // Go through each line in the active part of the file
        let n = 0
        for (const p of paragraphs) {
          const thisLine = p.content

          // test if matches this regex
          if (regexIn.test(thisLine)) {
            logDebug('returnRegexMatchedParas', `- matched ${n}:  ${thisLine}`)
            matchCount++
            matchedParas.push(p)
          }
          n++
        }
      }
    }
    if (matchCount === 0) {
      logDebug('repeats', 'No matched paragraphs found')
    } else {
      logDebug('repeats', 'Found ${matchCount} matched paragraphs')
    }
    return matchedParas
  } catch (error) {
    logError(`${pluginJson}/repeats`, error.message)
  }
}
