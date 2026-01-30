// @flow
//-----------------------------------------------------------------------------
// Progress update for Today only
// Jonathan Clark, @jgclark
// Last updated 2026-01-30 for v1.0.3 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import type { SummariesConfig } from './settings'
import { gatherOccurrences, generateProgressUpdate, getSummariesSettings, type OccurrencesToLookFor } from './summaryHelpers'
import { todaysDateISOString } from '@helpers/dateTime'
import { toNPLocaleDateString } from '@helpers/NPdateTime'
import { clo, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import { createPrettyRunPluginLink, formatWithFields, getTagParamsFromString } from '@helpers/general'
import { replaceSection } from '@helpers/note'
import { showMessage } from '@helpers/userInput'

//-------------------------------------------------------------------------------

/**
 * Entry point for template use of makeTodayProgress.
 * Called from NotePlan templates to generate today's progress summary.
 * 
 * @param {string?} params as JSON string (optional)
 * @returns {Promise<string>} Formatted progress update string for template
 * @throws {Error} If items to show are not specified or progress generation fails
 */
export async function todayProgressFromTemplate(params: string = ''): Promise<string> {
  try {
    logDebug(pluginJson, `todayProgressFromTemplate() starting with params '${typeof params === 'string' ? params : JSON.stringify(params)}' (type: ${typeof params})`)

    const config = await getSummariesSettings()
    const heading = await getTagParamsFromString(params, 'todayProgressHeading', config.todayProgressHeading ?? '')
    const itemsToShowStr = await getTagParamsFromString(params, 'todayProgressItems', (config.todayProgressItems ?? []).join(','))
    if ((itemsToShowStr ?? '') === '') {
      throw new Error("Cannot generate today's progress: no items specified. Please set 'todayProgressItems' in plugin settings or pass 'todayProgressItems' in the parameters.")
    }

    const itemsToShowArr = itemsToShowStr.split(',') ?? []
    const summaryStr = (await makeTodayProgress(itemsToShowArr, 'template', heading)) ?? '<error>'
    logInfo('todayProgressFromTemplate()', `-> ${summaryStr}`)
    return summaryStr
  } catch (err) {
    logError(pluginJson, `${err.message} in todayProgressFromTemplate()`)
    return '❗️Error: please open Plugin Console and re-run.' // for completeness
  }
}

/**
 * Entry point for /command or x-callback use of makeTodayProgress.
 * Generates a progress summary for today's note and writes it to the daily note.
 * 
 * @param {string} itemsToShowArg - Optional comma-separated list of @mentions or #tags. If not provided, uses default items from 'todayProgressItems' setting.
 * @param {string} headingArg - Optional heading to use. If not provided, uses default from 'todayProgressHeading' setting.
 * @returns {Promise<void>}
 * @throws {Error} If daily note cannot be found or progress generation fails
 */
export async function todayProgress(itemsToShowArg?: string, headingArg?: string): Promise<void> {
  try {
    logDebug(pluginJson, `todayProgress() starting with itemsToShowArg '${itemsToShowArg ? itemsToShowArg : '-'}'`)
    const itemsToShowArr: Array<string> = itemsToShowArg ? itemsToShowArg.split(',') : []
    logDebug('todayProgress()', `itemsToShowArr '${String(itemsToShowArr)}'`)

    if (typeof headingArg === 'string') {
      await makeTodayProgress(itemsToShowArr, 'command', headingArg)
    } else {
      await makeTodayProgress(itemsToShowArr, 'command')
    }
    // NB: don't need to do anything with output
  } catch (err) {
    logError('todayProgress', `Failed to generate today's progress: ${err.message}`)
    throw err
  }
}

/**
 * Work out the progress stats of interest (on hashtags and/or mentions) for today's note.
 * Generates statistics for specified hashtags and mentions from today's daily note only.
 * This is useful for summarizing items like @calories or @exercise that may appear multiple times in a day.
 * 
 * @author @jgclark
 *
 * @param {Array<string>?} itemsToShowArr - Array of items to track (e.g., ['@calories', '#test']). If empty, uses default items from 'todayProgressItems' setting.
 * @param {string?} source - Source of this call: 'command' | 'xcb' | 'template'. Defaults to 'command'.
 * @param {string?} headingArg - Optional heading to use. If not provided, uses default from 'todayProgressHeading' setting.
 * @returns {Promise<string>} Returns formatted string for template if source is 'template', otherwise empty string
 * @throws {Error} If daily note cannot be found or progress generation fails
 */
export async function makeTodayProgress(itemsToShowArr: Array<string> = [], source: string = 'command', headingArg?: string): Promise<string> {
  try {
    // Get config setting
    const config: SummariesConfig = await getSummariesSettings()

    // Only interested in today!
    // const period = 'daily'
    const fromDateStr = todaysDateISOString
    const toDateStr = todaysDateISOString
    const periodString = toNPLocaleDateString(new Date())

    const heading = typeof headingArg === 'string' ? headingArg : (config.todayProgressHeading ?? '') // this test means we can pass an empty heading, that can be distinguished from no headingArg
    logDebug('makeTodayProgress', `Starting with itemsToShowArr '${String(itemsToShowArr)}' for ${fromDateStr} heading '${heading}' from source ${source}`)
    const itemsToShow: Array<string> = itemsToShowArr.length > 0 ? itemsToShowArr : (config.todayProgressItems ?? [])

    // Validate that we have items to show
    if (itemsToShow.length === 0) {
      await showMessage("Cannot generate today's progress, as no items are specified. Please set 'todayProgressItems' in plugin settings or provide items as a parameter.")
      throw new Error("Cannot generate today's progress: no items specified. Please set 'todayProgressItems' in plugin settings or provide items as a parameter.")
    }
    logDebug('makeTodayProgress', `itemsToShow: '${String(itemsToShow)}'`)
    logDebug('makeTodayProgress', `heading: '${heading}'`)
    const mentionsToShow = itemsToShow.filter((f) => f.startsWith('@'))
    logDebug('makeMentionsToShow', mentionsToShow)
    const hashtagsToShow = itemsToShow.filter((f) => f.startsWith('#'))

    // Configuration for today's progress - only track totals (averages don't make sense for a single day)
    const settingsForGO: OccurrencesToLookFor = {
      GOYesNo: [],
      GOHashtagsCount: [], // covered in the total
      GOHashtagsTotal: hashtagsToShow.length > 0 ? hashtagsToShow : [],
      GOHashtagsAverage: [], // just 1 day so average doesn't make sense
      GOMentionsCount: [], // covered in the total
      GOMentionsTotal: mentionsToShow.length > 0 ? mentionsToShow : [],
      GOMentionsAverage: [], // just 1 day so average doesn't make sense
      GOChecklistRefNote: '',
    }

    const startTime = new Date()
    CommandBar.showLoading(true, `Calculating Today's Progress`)
    await CommandBar.onAsyncThread()

    // Main work: calculate the progress update as an array of strings
    const tmOccurrencesArray = await gatherOccurrences(periodString, fromDateStr, toDateStr, settingsForGO)

    CommandBar.showLoading(false)
    await CommandBar.onMainThread()
    const output = (await generateProgressUpdate(tmOccurrencesArray, periodString, fromDateStr, toDateStr, 'markdown', false, false)).join('\n')

    logDebug('makeTodayProgress', `- created progress update in ${timer(startTime)}`)

    // If we have a heading specified, make heading, using periodAndPartStr or '{{PERIOD}}' if it exists. Add a refresh button.
    // Create x-callback of form `noteplan://x-callback-url/runPlugin?pluginID=jgclark.Summaries&command=todayProgress&arg0=...` with 'Refresh' pseudo-button
    let thisHeading = ''
    let thisHeadingLine = ''
    let headingAndXCBStr = ''
    if (heading !== '') {
      const xCallbackParams = [itemsToShow.join(','), heading] // need to be strings in order
      const xCallbackMD = createPrettyRunPluginLink('🔄 Refresh', 'jgclark.Summaries', 'todayProgress', xCallbackParams)
      thisHeading = formatWithFields(heading, { PERIOD: periodString })
      headingAndXCBStr = `${thisHeading} ${xCallbackMD}`
      thisHeadingLine = `${'#'.repeat(config.headingLevel)} ${headingAndXCBStr}`
    }

    // Send output to chosen required destination:
    // - if it's a template, then return the output text
    // - if it's an x-callback or command, then write to a note

    if (source === 'template') {
      // this was a template command call, so simply return the output text
      logDebug('makeTodayProgress', `-> returning text to template for '${heading}' (for ${periodString})`)
      return thisHeadingLine !== '' ? `${thisHeadingLine}\n${output}` : output
    }

    // Now write to current daily note
    const destNote = DataStore.calendarNoteByDate(new Date(), 'day')
    if (destNote) {
      if (heading !== '') {
        logDebug('makeTodayProgress', `- about to update section '${heading}' in daily note '${destNote.filename}' for ${periodString}`)
        // Replace existing Section or append
        replaceSection(destNote, thisHeading, headingAndXCBStr, config.headingLevel, output)
        logInfo('makeTodayProgress', `Updated section '${heading}' in daily note '${destNote.filename}' for ${periodString}`)
      } else {
        logDebug('makeTodayProgress', `- about to append to daily note`)
        destNote.appendParagraph(output, 'text')
      }
    } else {
      const errorMsg = `Cannot find today's daily note to write progress update. Please ensure daily notes are enabled.`
      logError('makeTodayProgress', errorMsg)
      throw new Error(errorMsg)
    }
    return ''
  } catch (err) {
    logError('makeTodayProgress', `Failed to generate today's progress: ${err.message}`)
    throw err
  }
}
