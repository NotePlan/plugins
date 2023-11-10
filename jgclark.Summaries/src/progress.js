// @flow
//-----------------------------------------------------------------------------
// Progress update on some key goals to include in notes
// Jonathan Clark, @jgclark
// Last updated 10.11.2023 for v0.20.1, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  gatherOccurrences,
  generateProgressUpdate,
  getSummariesSettings,
  type OccurrencesConfig,
  TMOccurrences,
  type SummariesConfig,
} from './summaryHelpers'
import { hyphenatedDate, toISODateString, toLocaleDateString, unhyphenatedDate, withinDateRange } from '@helpers/dateTime'
import { getPeriodStartEndDates } from '@helpers/NPDateTime'
import {
  clo, logDebug, logError, logInfo, logWarn, timer,
  overrideSettingsWithEncodedTypedArgs
} from '@helpers/dev'
import { CaseInsensitiveMap, createPrettyRunPluginLink, createRunPluginCallbackUrl, displayTitle, formatWithFields, getTagParamsFromString } from '@helpers/general'
import { replaceSection } from '@helpers/note'
import { getSelectedParaIndex } from '@helpers/NPParagraph'
import { caseInsensitiveMatch, caseInsensitiveStartsWith } from '@helpers/search'
import { caseInsensitiveCompare } from '@helpers/sorting'
import { showMessage } from "../../helpers/userInput";

//-------------------------------------------------------------------------------

/**
 * This is the entry point for template use of makeProgressUpdate
 * @param {?string} params as JSON string
 * @returns {string} - returns string
 */
export async function progressUpdate(params: string = '', source: string = 'template'): Promise<string> {
  try {
    logDebug(pluginJson, `progressUpdate (for template): Starting with params '${params}' (type: ${typeof params}) and source '${source}'`)
    return await makeProgressUpdate(params, source) ?? '<error>'
  }
  catch (err) {
    logError(pluginJson, `${err.message} in progressUpdate (for template)`)
    return '❗️Error: please open Plugin Console and re-run.>' // for completeness
  }
}

/**
 * Work out the progress stats of interest (on hashtags and/or mentions) so far this week or month, and write out to current note.
 * Defaults to looking at week to date ("wtd") but can specify month to date ("mtd") as well, or 'last7d', 'last2w', 'last4w'.
 * If it's week to date, then use the user's first day of week from NP setting.
 * @author @jgclark
 *
 * @param {?string} params - can pass parameter string (in JSON format) e.g. '{"period": "mtd", "progressHeading": "Progress"}'
 * @param {?string} source of this call (command/xcb/template)
 * @returns {?string} - either return string to Template, or void to plugin
 */
export async function makeProgressUpdate(paramsIn: string = '', source: string = 'command'): Promise<string | void> {
  try {
    // Get config setting
    let config: SummariesConfig = await getSummariesSettings()
    let settingsForGO: OccurrencesConfig

    // First workaround situation where paramsIn can be a null Object when called from a template. If so, make an empty JSON string.
    const params = (paramsIn && typeof paramsIn === 'object') ? paramsIn : "{}"
    // If there are paramsIn passed, then we've been called by a template command (and so use those).
    if (params !== '') {
      // logDebug(pluginJson, `makeProgressUpdate: Starting from '${source}' with params '${params}'`)
      config = overrideSettingsWithEncodedTypedArgs(config, params)
      // clo(config, `config after overriding with params '${params}'`)
    } else {
      // If no params are passed, then we've been called by a plugin command (and so use defaults from config).
      // logDebug(pluginJson, `makeProgressUpdate: Starting from '${source}' with no params`)
    }

    // Use configuration setting as default for time period
    // (And allow 'period' instead of 'interval')
    let period = config.progressPeriod
    const intervalParam = await getTagParamsFromString(params, 'interval', '')
    if (intervalParam !== '') {
      period = intervalParam
    }
    const periodParam = await getTagParamsFromString(params, 'period', '')
    if (periodParam !== '') {
      period = periodParam
    }
    logDebug('makeProgressUpdate', `Starting for period '${period}' with title '${config.progressHeading}' / params '${params}' / source '${source}'`)

    // Now deal with any parameters passed that are mentions/hashtags to work on
    const paramProgressYesNo = await getTagParamsFromString(params, 'progressYesNo', '')
    const paramProgressHashtags = await getTagParamsFromString(params, 'progressHashtags', '')
    const paramProgressHashtagsAverage = await getTagParamsFromString(params, 'progressHashtagsAverage', '')
    const paramProgressHashtagsTotal = await getTagParamsFromString(params, 'progressHashtagsTotal', '')
    const paramProgressMentions = await getTagParamsFromString(params, 'progressMentions', '')
    const paramProgressMentionsTotal = await getTagParamsFromString(params, 'progressMentionsTotal', '')
    const paramProgressMentionsAverage = await getTagParamsFromString(params, 'progressMentionsAverage', '')

    // If we have any of these params, then override all the mentions/hashtags settings
    const useParamTerms = (paramProgressYesNo || paramProgressHashtags || paramProgressHashtagsTotal || paramProgressHashtagsAverage || paramProgressMentions || paramProgressMentionsTotal || paramProgressMentionsAverage)
    if (useParamTerms) {
      settingsForGO = {
        GOYesNo: paramProgressYesNo,
        GOHashtagsCount: paramProgressHashtags,
        GOHashtagsTotal: paramProgressHashtagsTotal,
        GOHashtagsAverage: paramProgressHashtagsAverage,
        GOHashtagsExclude: [],
        GOMentionsCount: paramProgressMentions,
        GOMentionsTotal: paramProgressMentionsTotal,
        GOMentionsAverage: paramProgressMentionsAverage,
        GOMentionsExclude: [],
      }
    } else {
      settingsForGO = {
        GOYesNo: config.progressYesNo ?? [],
        GOHashtagsCount: config.progressHashtags,
        GOHashtagsTotal: config.progressHashtagsTotal,
        GOHashtagsAverage: config.progressHashtagsAverage,
        GOHashtagsExclude: [],
        GOMentionsCount: config.progressMentions,
        GOMentionsTotal: config.progressMentionsTotal,
        GOMentionsAverage: config.progressMentionsAverage,
        GOMentionsExclude: [],
      }
    }

    // Get more detailed items for the chosen time period
    const [fromDate, toDate, periodType, periodString, periodAndPartStr] = await getPeriodStartEndDates('', config.excludeToday, period)
    if (fromDate == null || toDate == null) {
      throw new Error(`Error: failed to calculate period start and end dates`)
    }
    if (fromDate > toDate) {
      throw new Error(`Error: requested fromDate ${String(fromDate)} is after toDate ${String(toDate)}`)
    }
    const fromDateStr = hyphenatedDate(fromDate)
    const toDateStr = hyphenatedDate(toDate)

    const startTime = new Date()
    CommandBar.showLoading(true, `Creating Progress Update`)
    await CommandBar.onAsyncThread()

    // Main work: calculate the progress update as an array of strings
    const tmOccurrencesArray = await gatherOccurrences(
      periodString,
      fromDateStr,
      toDateStr,
      settingsForGO
    )

    const output = generateProgressUpdate(tmOccurrencesArray, periodString, fromDateStr, toDateStr, 'markdown', config.showSparklines, false).join('\n')

    await CommandBar.onMainThread()
    CommandBar.showLoading(false)
    logDebug('makeProgressUpdate', `- created progress update in ${timer(startTime)}`)

    // If we have a heading specified, make heading, using periodAndPartStr or '{{PERIOD}}' if it exists. Add a refresh button.
    // Create x-callback of form `noteplan://x-callback-url/runPlugin?pluginID=jgclark.Summaries&command=progressUpdate&arg0=...` with 'Refresh' pseudo-button
    const xCallbackMD = createPrettyRunPluginLink('🔄 Refresh', 'jgclark.Summaries', 'progressUpdate', params)
    const thisHeading = formatWithFields(config.progressHeading, { PERIOD: periodAndPartStr ? periodAndPartStr : periodString })
    const headingAndXCBStr = `${thisHeading} ${xCallbackMD}`
    const thisHeadingLine = `${'#'.repeat(config.headingLevel)} ${headingAndXCBStr}`

    // Send output to chosen required destination:
    // - if it's a template, then return the output text
    // - if it's an x-callback or command, then write to a note
    // - if it's from todayProgressUpdate, then write to daily note

    if (source === 'template') {
      // this was a template command call, so simply return the output text
      logDebug('makeProgressUpdate', `-> returning text to template for '${thisHeading}' (${periodAndPartStr} for ${periodString})`)
      return (config.progressHeading !== '')
        ? `${'#'.repeat(config.headingLevel)} ${headingAndXCBStr}\n${output}`
        : output
    }

    if (source === 'todayProgressUpdate') {
      config.progressDestination = 'daily'
    }

    // Else we were called by a plugin command or x-callback
    // Now decide whether to write to current note or update the relevant section in the current Daily or Weekly note
    switch (config.progressDestination) {
      case 'daily': {
        const destNote = DataStore.calendarNoteByDate(new Date(), 'day')
        if (destNote) {
          logDebug('makeProgressUpdate', `- about to update section '${thisHeading}' in daily note '${destNote.filename}' for ${periodAndPartStr}`)
          // Replace or add Section
          replaceSection(destNote, thisHeading, headingAndXCBStr, config.headingLevel, output)
          logInfo('makeProgressUpdate', `Updated section '${thisHeading}' in daily note '${destNote.filename}' for ${periodAndPartStr}`)
        } else {
          logError('makeProgressUpdate', `Cannot find weekly note to write to`)
        }
        break
      }
      case 'weekly': {
        // get weekly
        const destNote = DataStore.calendarNoteByDate(new Date(), 'week')
        if (destNote) {
          logDebug('makeProgressUpdate', `- about to update section '${thisHeading}' in weekly note '${destNote.filename}' for ${periodAndPartStr}`)
          // Replace or add Section
          replaceSection(destNote, thisHeading, headingAndXCBStr, config.headingLevel, output)
          logInfo('makeProgressUpdate', `Updated section '${thisHeading}' in weekly note '${destNote.filename}' for ${periodAndPartStr}`)
        } else {
          logError('makeProgressUpdate', `Cannot find weekly note to write to`)
        }
        break
      }

      default: {
        // = 'current' = append to current note
        const currentNote = Editor
        if (currentNote == null) {
          logWarn('makeProgressUpdate', `No note is open in the Editor, so I can't write to it.`)
          await showMessage(`No note is open in the Editor, so I can't write to it.`)
        } else {
          // Now insert the summary to the current note: replace or append Section
          replaceSection(currentNote, thisHeading, headingAndXCBStr, config.headingLevel, output)
          logInfo('makeProgressUpdate', `Appended progress update for ${periodString} to current note`)
        }
        break
      }
    }
    return
  } catch (error) {
    logError('makeProgressUpdate', error.message)
  }
}
