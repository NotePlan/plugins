// @flow
//-----------------------------------------------------------------------------
// Helper functions for Tidy plugin
// Jonathan Clark
// Last updated 31.12.2022 for v0.1.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { clo, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import moment from 'moment'
import { findEndOfActivePartOfNote } from '@helpers/paragraph'

//------------------------------------------------------------------------------
// Get settings

const pluginID = 'np.Tidy'

export type TidyConfig = {
  foldersToExclude: Array<string>,
  justRemoveFromChecklists: boolean,
  matchType: string,
  numDays: number,
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
    clo(config, `${pluginID} settings:`)

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
 * Return list of all notes changed in the last 'numDays'.
 * Edge case: if numDays === 0 return all Calendar and Project notes
 * @author @jgclark
 * @param {number} numDays 
 * @returns {Array<TNote>}
 */
export function getNotesChangedInInterval(numDays: number): Array<TNote> {
  try {
    const projectNotes = DataStore.projectNotes.slice()
    const calendarNotes = DataStore.calendarNotes.slice()
    const allNotes = projectNotes.concat(calendarNotes)
    let matchingNotes: Array<TNote> = []
    if (numDays > 0) {
      const todayStart = new moment().startOf('day') // use moment instead of `new Date` to ensure we get a date in the local timezone
      const momentToStartLooking = todayStart.subtract(numDays, "days")
      const jsdateToStartLooking = momentToStartLooking.toDate()

      matchingNotes = allNotes.filter((f) => f.changedDate >= jsdateToStartLooking)
      logDebug('getNotesChangedInInterval', `from ${allNotes.length} notes found ${matchingNotes.length} changed after ${String(momentToStartLooking)}`)
    } else {
      matchingNotes = allNotes
      logDebug('getNotesChangedInInterval', `returning all ${allNotes.length} notes`)
    }
    return matchingNotes
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    return [] // for completeness
  }
}

/**
 * Return array of notes changed in the last 'numDays' from provided array of 'notesToCheck'
 * @author @jgclark
 * @param {Array<TNote>} notesToCheck 
 * @param {number} numDays 
 * @returns {Array<TNote>}
 */
export function getNotesChangedInIntervalFromList(notesToCheck: $ReadOnlyArray<TNote>, numDays: number): Array<TNote> {
  try {
    const todayStart = new moment().startOf('day') // use moment instead of `new Date` to ensure we get a date in the local timezone
    const momentToStartLooking = todayStart.subtract(numDays, "days")
    const jsdateToStartLooking = momentToStartLooking.toDate()

    let matchingNotes: Array<TNote> = notesToCheck.filter((f) => f.changedDate >= jsdateToStartLooking)
    // logDebug('getNotesChangedInInterval', `from ${notesToCheck.length} notes found ${matchingNotes.length} changed after ${String(momentToStartLooking)}`)
    return matchingNotes
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    return [] // for completeness
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
