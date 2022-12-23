// @flow
//-----------------------------------------------------------------------------
// Progress update on some key goals to include in notes
// Jonathan Clark, @jgclark
// Last updated 16.11.2022 for v0.16.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  gatherOccurrences,
  generateProgressUpdate,
  getSummariesSettings,
  TMOccurrences,
} from './summaryHelpers'
import { getDateStringFromCalendarFilename, hyphenatedDate, toISODateString, toLocaleDateString, unhyphenatedDate, withinDateRange } from '@helpers/dateTime'
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

//-------------------------------------------------------------------------------

/**
 * This is the entry point for x-callback use of makeProgressUpdate
 * @param {?string} params as JSON string
 * @returns {string} - returns string to Template
 */
export async function progressUpdate(params: string = ''): Promise<string> {
  try {
    logDebug('progressUpdate (for xcb)', `Starting with params '${params}'`)
    return await makeProgressUpdate(params, 'xcb') ?? '<error>'
  }
  catch (err) {
    logError('progressUpdate (for xcb)', err.message)
    return '<error>' // for completeness
  }
}

/**
 * Work out the progress stats of interest (on hashtags and/or mentions) so far this week or month, and write out to current note.
 * Defaults to looking at week to date ("wtd") but can specify month to date ("mtd") as well, or 'last7d', 'last2w', 'last4w'.
 * If it's week to date, then use the user's first day of week from NP setting.
 * @author @jgclark
 *
 * @param {?string} params - can pass parameter string e.g. "{"period": 'mtd', "progressHeading": 'Progress'}"
 * @param {?string} source of this call (command/xcb/template)
 * @returns {?string} - either return string to Template, or void to plugin
 */
export async function makeProgressUpdate(params: string = '', source: string = 'command'): Promise<string | void> {
  try {
    // Get config setting
    let config = await getSummariesSettings()
    // If there are params passed, then we've been called by a template command (and so use those).
    if (params) {
      logDebug('makeProgressUpdate', `Starting with params '${params}'`)
      config = overrideSettingsWithEncodedTypedArgs(config, params)
      clo(config, `config after overriding with params '${params}'`)
    } else {
      // If no params are passed, then we've been called by a plugin command (and so use defaults from config).
    }
    // const progressHeading = await getTagParamsFromString(params ?? '', 'progressHeading', config.progressHeading)
    // const showSparklines = await getTagParamsFromString(params ?? '', 'showSparklines', config.showSparklines)
    // const excludeToday = await getTagParamsFromString(params ?? '', 'excludeToday', true)
    // Use configuration setting as default for time period
    // (And allow 'period' instead of 'interval')
    let period = config.progressPeriod
    const intervalParam = await getTagParamsFromString(params ?? '', 'interval', '')
    if (intervalParam !== '') {
      period = intervalParam
    }
    const periodParam = await getTagParamsFromString(params ?? '', 'period', '')
    if (periodParam !== '') {
      period = periodParam
    }
    logDebug('makeProgressUpdate', `Starting for period '${period}' titled '${config.progressHeading}' with params '${params ?? ''}'`)

    // Now deal with any parameters passed that are mentions/hashtags to work on
    // If we have any, then they override what the main settings say.
    const paramProgressYesNo = await getTagParamsFromString(params ?? '', 'progressYesNo', '')
    const paramProgressMentions = await getTagParamsFromString(params ?? '', 'progressMentions', '')
    const paramProgressMentionsAverage = await getTagParamsFromString(params ?? '', 'progressMentionsAverage', '')
    const paramProgressMentionsTotal = await getTagParamsFromString(params ?? '', 'progressMentionsTotal', '')
    const useParamTerms = (paramProgressYesNo || paramProgressMentions || paramProgressMentionsTotal || paramProgressMentionsAverage)
    let progressYesNo = useParamTerms ? paramProgressYesNo : config.progressYesNo
    let progressMentions = useParamTerms ? paramProgressMentions : config.progressMentions
    let progressMentionsTotal = useParamTerms ? paramProgressMentionsTotal : config.progressMentionsTotal
    let progressMentionsAverage = useParamTerms ? paramProgressMentionsAverage : config.progressMentionsAverage
    if (useParamTerms) {
      config.progressHashtags = []
      config.progressMentions = []
    }

    // Get time period of interest
    const [fromDate, toDate, periodType, periodString, periodAndPartStr] = await getPeriodStartEndDates('', config.excludeToday, period)
    logDebug('', `${periodType} / ${periodString} / ${periodAndPartStr}`)
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
      config.progressHashtags,
      [],
      config.progressMentions,
      [],
      progressYesNo,
      progressMentions,
      progressMentionsAverage,
      progressMentionsTotal,
    )

    const output = generateProgressUpdate(tmOccurrencesArray, periodString, fromDateStr, toDateStr, 'markdown', config.showSparklines, false).join('\n')

    await CommandBar.onMainThread()
    CommandBar.showLoading(false)
    logDebug(pluginJson, `- created progress update in${timer(startTime)}`)

    // Create x-callback of form `noteplan://x-callback-url/runPlugin?pluginID=jgclark.Summaries&command=progressUpdate&arg0=...` with 'Refresh' pseudo-button
    const xCallbackMD = createPrettyRunPluginLink('🔄 Refresh', 'jgclark.Summaries', 'progressUpdate', params)

    const thisHeading = formatWithFields(config.progressHeading, { PERIOD: periodAndPartStr ? periodAndPartStr : periodString })
    const headingAndXCBStr = `${thisHeading} ${xCallbackMD}`
    logDebug(pluginJson, headingAndXCBStr)

    // Send output to chosen required destination
    // Now complicated because if we have params it could be either from x-callback or template call.
    if (params && source !== 'xcb') {
      // this was a template command call, so simply return the output text
      logDebug(pluginJson, `-> returning text to template for '${thisHeading}: ${periodAndPartStr} for ${periodString}'`)
      return `${'#'.repeat(config.headingLevel)} ${headingAndXCBStr}\n${output}`
    }

    // Else we were called by a plugin command.
    // Now decide whether to write to current note or update the relevant section in the current Daily or Weekly note
    switch (config.progressDestination) {
      case 'daily': {
        const destNote = DataStore.calendarNoteByDate(new Date(), 'day')
        if (destNote) {
          logDebug(pluginJson, `- about to update section '${thisHeading}' in daily note '${destNote.filename}' for ${periodAndPartStr}`)
          // Replace or add Section
          replaceSection(destNote, thisHeading, headingAndXCBStr, config.headingLevel, output)
          logInfo(pluginJson, `Updated section '${thisHeading}' in daily note '${destNote.filename}' for ${periodAndPartStr}`)
        } else {
          logError(pluginJson, `Cannot find weekly note to write to`)
        }
        break
      }
      case 'weekly': {
        // get weekly
        const destNote = DataStore.calendarNoteByDate(new Date(), 'week')
        if (destNote) {
          logDebug(pluginJson, `- about to update section '${thisHeading}' in weekly note '${destNote.filename}' for ${periodAndPartStr}`)
          // Replace or add Section
          replaceSection(destNote, thisHeading, headingAndXCBStr, config.headingLevel, output)
          logInfo(pluginJson, `Updated section '${thisHeading}' in weekly note '${destNote.filename}' for ${periodAndPartStr}`)
        } else {
          logError(pluginJson, `Cannot find weekly note to write to`)
        }
        break
      }

      default: {
        // = 'current'
        const currentNote = Editor.note
        if (currentNote == null) {
          // Now insert the summary to the current note
          logError(pluginJson, `No note is open in the Editor, so I can't write to it.`)
        } else {
          let currentLineIndex = getSelectedParaIndex()
          if (currentLineIndex === 0) {
            logError(pluginJson, `Couldn't find correct cursor position, so will append to note instead.`)
            currentLineIndex = Editor.paragraphs.length - 1
          }
          logDebug(pluginJson, `- inserting results to current note (${currentNote.filename ?? '(error)'}) at line ${currentLineIndex}`)
          // Replace or add Section
          replaceSection(currentNote, thisHeading, headingAndXCBStr, config.headingLevel, output)
          logInfo(pluginJson, `Appended progress update for ${periodString} to current note`)
        }
        break
      }
    }
    return
  } catch (error) {
    logError(pluginJson, error.message)
  }
}
