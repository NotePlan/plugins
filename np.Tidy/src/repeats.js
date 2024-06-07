// @flow
//-----------------------------------------------------------------------------
// Generate @repeat()s for recent notes
// Jonathan Clark
// Last updated 7.6.2024 for v0.14.0, @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { generateRepeats } from '../../jgclark.RepeatExtensions/src/main'
import pluginJson from '../plugin.json'
import { getSettings, type TidyConfig } from './tidyHelpers'
import { clo, JSP, logDebug, logError, logInfo, logWarn, overrideSettingsWithEncodedTypedArgs, timer } from '@helpers/dev'
import { getTagParamsFromString } from '@helpers/general'
import { getNotesChangedInInterval } from '@helpers/NPnote'
import { showMessage } from '@helpers/userInput'

//-----------------------------------------------------------------------------

/**
 * Run /generate repeats on all recently-updated notes.
 * Can be passed parameters to override default time interval through an x-callback call
 * @author @jgclark
 * @param {string?} params optional JSON string
 */
export async function generateRepeatsFromRecentNotes(params: string = ''): Promise<void> {
  try {
    // Get plugin settings (config)
    let config: TidyConfig = await getSettings()
    // Setup main variables
    if (params) {
      logDebug(pluginJson, `generateRepeatsFromRecentNotes() Starting with params '${params}'`)
      config = overrideSettingsWithEncodedTypedArgs(config, params)
      clo(config, `config after overriding with params '${params}'`)
    } else {
      // If no params are passed, then we've been called by a plugin command (and so use defaults from config).
      logDebug(pluginJson, `generateRepeatsFromRecentNotes() Starting with no params`)
    }

    // Get num days to process from param, or by asking user if necessary
    const numDays: number = await getTagParamsFromString(params ?? '', 'numDays', config.numDays ?? 0)
    logDebug('generateRepeatsFromRecentNotes', `- numDays = ${String(numDays)}`)
    // Note: can be 0 at this point, which implies process all days

    // Decide whether to run silently
    const runSilently: boolean = await getTagParamsFromString(params ?? '', 'runSilently', false)
    logDebug('generateRepeatsFromRecentNotes', `- runSilently = ${String(runSilently)}`)

    // // Find which notes have @repeat(...) tags
    // const start = new Date()
    // // Use multi-threaded DataStore.search() to look for "@repeat(", and then use regex to narrow down. This also implements foldersToExclude for us.
    // // (This approach is borrowed from removeDone().)
    // const parasToCheck: $ReadOnlyArray<TParagraph> = await DataStore.search('@repeat(', ['calendar', 'notes'], [], config.removeFoldersToExclude)
    // let allMatchedParas: Array<TParagraph> = parasToCheck.filter((p) => RE_DONE_DATE_OPT_TIME.test(p.content)) ?? []

    // Get date range to use
    const todayStart = new moment().startOf('day') // use moment instead of `new Date` to ensure we get a date in the local timezone
    const momentToStartLooking = todayStart.subtract(numDays, 'days')
    const jsDateToStartLooking = momentToStartLooking.toDate()

    const startTime = new Date() // for timing only
    CommandBar.showLoading(true, `Finding completed @repeats`)
    await CommandBar.onAsyncThread()

    // Find past calendar notes changed in the last numDays (or all if numDays === 0)
    // v2 method:
    const recentNotes = getNotesChangedInInterval(config.numDays, ['Notes', 'Calendar'])
    logDebug('generateRepeatsFromRecentNotes', `- found  ${String(recentNotes.length)} 'recent' notes to process`)

    // Now run generateRepeats() on each and count how many were changed
    let numGenerated = 0
    for (const thisNote of recentNotes) {
      const num = await generateRepeats(thisNote, true)
      numGenerated += num
    }
    await CommandBar.onMainThread()
    CommandBar.showLoading(false)

    logInfo('generateRepeatsFromRecentNotes', `Generated ${String(numGenerated)} new @repeat(...)s from ${String(recentNotes.length)} recent notes, in ${timer(startTime)}`)
    if (!runSilently) {
      await showMessage(`Generated ${String(numGenerated)} new @repeats from ${String(recentNotes.length)} recent notes`, 'OK', 'Tidy: Generate Repeats')
    }
    return
  } catch (error) {
    logError('generateRepeatsFromRecentNotes', JSP(error))
    return // for completeness
  }
}
