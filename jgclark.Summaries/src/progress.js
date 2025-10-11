/* eslint-disable max-len */
/* eslint-disable prefer-template */
// @flow
//-----------------------------------------------------------------------------
// Progress update on some key goals to include in notes
// Jonathan Clark, @jgclark
// Last updated 2025-10-07 for v1.0.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  gatherOccurrences,
  generateProgressUpdate,
  getSummariesSettings,
  type OccurrencesToLookFor,
  type SummariesConfig,
} from './summaryHelpers'
import { hyphenatedDate } from '@helpers/dateTime'
import {
  clo, logDebug, logError, logInfo, logWarn, timer,
  overrideSettingsWithEncodedTypedArgs
} from '@helpers/dev'
import {
  createPrettyRunPluginLink,
  formatWithFields, getTagParamsFromString
} from '@helpers/general'
import { replaceSection } from '@helpers/note'
import { getDateStrForEndofPeriodFromCalendarFilename, getPeriodStartEndDates } from '@helpers/NPdateTime'
import { showMessage } from "@helpers/userInput"

//-------------------------------------------------------------------------------
// Main entry points

/**
 * There are 3 ways to invoke Progress updates:
 * 1. "/appendProgressUpdate" command -- uses settings, and writes to current note
 * 2. callback to progressUpdate&arg0=... -- can give params to override settings if wanted; writes to current note
 * 3. template call to progressUpdate( { ... JSON ...} ) -- can give params to override settings; doesn't write to a note, but returns text to Templating. Under hood calls progressUpdate()
 */

/**
 * This is the entry point for 'template' or 'callback' (including 'refresh') use of makeProgressUpdate().
 * It works out if it's a template (by object passed) or a callback (by string passed).
 * @param {any?} params as JS object or JSON string
 * @param {string?} sourceIn 'template' | 'callback' | empty
 * @returns {string} - returns string
 */
export async function progressUpdate(params: any = '', sourceIn: string = ''): Promise<string> {
  try {
    logDebug(pluginJson, `progressUpdate (from template or callback): Starting with params '${params}' and source '${sourceIn}'`)
    const source = (sourceIn !== '') ? sourceIn
      : (typeof params === 'string')
        ? 'callback'
        : (typeof params === 'object')
          ? 'template'
          : ''
    logDebug('progressUpdate', `- source determined to be '${source}'`)
    if (source === 'refresh') {
      // Work out what note we're called from
      const note = Editor.note
      if (!note) {
        throw new Error('No note is open in the Editor, so cannot refresh')
      }
      const noteFilename = note.filename
      logDebug('progressUpdate', `- refresh called from filename: '${noteFilename}'`)
      const endOfPeriodDateStr = getDateStrForEndofPeriodFromCalendarFilename(noteFilename)
      logDebug('progressUpdate', `- end of period date string: '${endOfPeriodDateStr}'`)
    }

    // If run from a template, then return the output string. Otherwise there is no return value.
    return await makeProgressUpdate(params, source) ?? ''
  }
  catch (err) {
    logError(pluginJson, `progressUpdate (for template) Error: ${err.message}`)
    return '❗️ Error: please open Plugin Console and re-run to see more details.' // for completeness
  }
}

/**
 * Work out the progress stats of interest (on hashtags and/or mentions) so far this week or month, and write out to current note.
 * Defaults to looking at week to date ("wtd") but can specify month to date ("mtd") as well, or 'last7d', 'last2w', 'last4w'.
 * If it's week to date, then use the user's first day of week from NP setting.
 * @author @jgclark
 *
 * @param {any?} paramsIn - can pass parameter string (in JSON format) e.g. '{"period": "mtd", "progressHeading": "Progress"}' or as a JS object
 * @param {string?} source of this call: 'callback', 'template', 'refresh' or 'command' (the default)
 * @returns {string|void} - either return string to Template, or void to plugin
 */
export async function makeProgressUpdate(
  paramsIn: any = '',
  source: string = 'command',
): Promise<string | void> {
  try {
    logDebug(pluginJson, `makeProgressUpdate: Starting with params '${paramsIn}' from source '${source}'`)

    let config: SummariesConfig = await getSummariesSettings()
    const paramsStr = normalizeParams(paramsIn)
    const paramsObj = (paramsStr.length >= 2) ? JSON.parse(paramsStr) : {}
    config = await applyParamOverrides(config, paramsStr)

    const period = await resolvePeriod(config, paramsStr)
    logDebug('makeProgressUpdate', `Starting for period '${period}' with title '${config.progressHeading}' / paramsStr '${paramsStr}' / source '${source}'`)

    const settingsForGO = await buildSettingsForGatherOccurrences(config, paramsStr)

    let { fromDateStr, toDateStr, periodString, periodAndPartStr } = await computeDateRange(config, period)
    if (paramsObj.fromDateStr && paramsObj.toDateStr) {
      fromDateStr = paramsObj.fromDateStr
      toDateStr = paramsObj.toDateStr
      logDebug('makeProgressUpdate', `- overriding fromDateStr and toDateStr with '${fromDateStr}' and '${toDateStr}'`)
    }
    if (paramsObj.periodString) {
      periodString = paramsObj.periodString
      logDebug('makeProgressUpdate', `- overriding periodString with '${periodString}'`)
    }
    if (paramsObj.periodAndPartStr) {
      periodAndPartStr = paramsObj.periodAndPartStr
      logDebug('makeProgressUpdate', `- overriding periodAndPartStr with '${periodAndPartStr}'`)
    }

    const output = await createProgressOutput(settingsForGO, periodString, fromDateStr, toDateStr, config)

    const { thisHeading, headingAndXCBStr } = buildHeadingAndLink(config, period, periodString, periodAndPartStr, fromDateStr, toDateStr, paramsObj)

    const routed = await routeOutput(
      source,
      config,
      output,
      thisHeading,
      headingAndXCBStr,
      periodString,
      periodAndPartStr
    )
    return routed
  } catch (error) {
    logError('makeProgressUpdate', error.message)
  }
}

//-------------------------------------------------------------------------------
// Small helpers extracted from makeProgressUpdate for readability and testability

function normalizeParams(paramsIn: any): string {
  const params = (paramsIn)
    ? (typeof paramsIn === 'object')
      ? JSON.stringify(paramsIn)
      : paramsIn
    : ''
  return params
}

function applyParamOverrides(config: SummariesConfig, params: string): SummariesConfig {
  if (params !== '') {
    const newConfig = overrideSettingsWithEncodedTypedArgs(config, params)
    // clo(newConfig, `- config after overriding with params-as-JSON-string '${params}' (from callback)`)
    logDebug('makeProgressUpdate', `- updated config after overriding with params-as-JSON-string '${params}' (from callback)`)
    return newConfig
  } else {
    logDebug('makeProgressUpdate', `- no params`)
    return config
  }
}

async function resolvePeriod(config: SummariesConfig, params: string): Promise<string> {
  let period = config.progressPeriod
  const intervalParam = await getTagParamsFromString(params, 'interval', '')
  if (intervalParam !== '') period = intervalParam
  const periodParam = await getTagParamsFromString(params, 'period', '')
  if (periodParam !== '') period = periodParam
  return period
}

async function buildSettingsForGatherOccurrences(config: SummariesConfig, params: string): Promise<OccurrencesToLookFor> {
  const paramProgressYesNo = await getTagParamsFromString(params, 'progressYesNo', '')
  const paramProgressHashtags = await getTagParamsFromString(params, 'progressHashtags', '')
  const paramProgressHashtagsAverage = await getTagParamsFromString(params, 'progressHashtagsAverage', '')
  const paramProgressHashtagsTotal = await getTagParamsFromString(params, 'progressHashtagsTotal', '')
  const paramProgressMentions = await getTagParamsFromString(params, 'progressMentions', '')
  const paramProgressMentionsTotal = await getTagParamsFromString(params, 'progressMentionsTotal', '')
  const paramProgressMentionsAverage = await getTagParamsFromString(params, 'progressMentionsAverage', '')
  const paramProgressRefNote = await getTagParamsFromString(params, 'progressChecklistReferenceNote', '')

  const useParamTerms = (paramProgressYesNo || paramProgressHashtags || paramProgressHashtagsTotal || paramProgressHashtagsAverage || paramProgressMentions || paramProgressMentionsTotal || paramProgressMentionsAverage || paramProgressRefNote)
  if (useParamTerms) {
    return {
      GOYesNo: paramProgressYesNo,
      GOHashtagsCount: paramProgressHashtags,
      GOHashtagsTotal: paramProgressHashtagsTotal,
      GOHashtagsAverage: paramProgressHashtagsAverage,
      GOMentionsCount: paramProgressMentions,
      GOMentionsTotal: paramProgressMentionsTotal,
      GOMentionsAverage: paramProgressMentionsAverage,
      GOChecklistRefNote: paramProgressRefNote,
    }
  }
  return {
    GOYesNo: config.progressYesNo,
    GOHashtagsCount: config.progressHashtags,
    GOHashtagsTotal: config.progressHashtagsTotal,
    GOHashtagsAverage: config.progressHashtagsAverage,
    GOMentionsCount: config.progressMentions,
    GOMentionsTotal: config.progressMentionsTotal,
    GOMentionsAverage: config.progressMentionsAverage,
    GOChecklistRefNote: config.progressChecklistReferenceNote,
  }
}

async function computeDateRange(
  config: SummariesConfig, period: any
): Promise<{ fromDateStr: string, toDateStr: string, periodString: string, periodAndPartStr: string }> {
  const [fromDate, toDate, _periodType, periodString, periodAndPartStr] = await getPeriodStartEndDates('', config.excludeToday, period)
  if (fromDate == null || toDate == null) {
    throw new Error(`Error: failed to calculate period start and end dates`)
  }
  if (fromDate > toDate) {
    throw new Error(`Error: requested fromDate ${String(fromDate)} is after toDate ${String(toDate)}`)
  }
  const fromDateStr = hyphenatedDate(fromDate)
  const toDateStr = hyphenatedDate(toDate)
  return { fromDateStr, toDateStr, periodString, periodAndPartStr }
}

async function createProgressOutput(
  settingsForGO: OccurrencesToLookFor, periodString: string, fromDateStr: string, toDateStr: string, config: SummariesConfig
): Promise<string> {
  const startTime = new Date()
  CommandBar.showLoading(true, `Creating Progress Update`)
  await CommandBar.onAsyncThread()
  const tmOccurrencesArray = await gatherOccurrences(
    periodString,
    fromDateStr,
    toDateStr,
    settingsForGO
  )
  CommandBar.showLoading(false)
  await CommandBar.onMainThread()
  const output = (await generateProgressUpdate(tmOccurrencesArray, periodString, fromDateStr, toDateStr, 'markdown', config.showSparklines, false)).join('\n')
  logDebug('makeProgressUpdate', `- created progress update in ${timer(startTime)}`)
  return output
}

function buildHeadingAndLink(
  config: SummariesConfig, period: string, periodString: string, periodAndPartStr: string, fromDateStr: string, toDateStr: string, paramsObjIn: any
): { thisHeading: string, headingAndXCBStr: string } {
  // Create params string from paramsIn with date range information added
  // V1
  // logDebug('buildHeadingAndLink', `- paramsStr: '${paramsStr}'`)
  // const paramsStr = (paramsIn.length > 1)
  //   ? paramsIn.slice(0, -1) + `, "period": "${period}", "periodString": "${periodString}", "fromDateStr": "${fromDateStr}", "toDateStr": "${toDateStr}"}`
  //   : `{"period": "${period}", "periodString": "${periodString}", "fromDateStr": "${fromDateStr}", "toDateStr": "${toDateStr}"}`
  // V2
  // clo(paramsObjIn, 'buildHeadingAndLink: paramsObjIn:')
  const params: any = { ...paramsObjIn, period, periodString, fromDateStr, toDateStr }
  // Remove duplicate keys in params
  const paramsUniqueByKey = Object.fromEntries(
    new Map(Object.entries(params))
  )
  // clo(paramsUniqueByKey, 'buildHeadingAndLink: paramsUniqueByKey:')

  const paramsStr = JSON.stringify(paramsUniqueByKey)
  logDebug('buildHeadingAndLink', `- params string for refresh: '${paramsStr}'`)
  const xCallbackMD = createPrettyRunPluginLink('🔄 Refresh', 'jgclark.Summaries', 'progressUpdate', [paramsStr, 'refresh']) // this does URL encoding
  const thisHeading = formatWithFields(config.progressHeading, { PERIOD: periodAndPartStr ? periodAndPartStr : periodString })
  const headingAndXCBStr = `${thisHeading} ${xCallbackMD}`
  return { thisHeading, headingAndXCBStr }
}

async function routeOutput(
  source: string, config: SummariesConfig, output: string, thisHeading: string, headingAndXCBStr: string, periodString: string, periodAndPartStr: string
): Promise<string | void> {
  // if (source === 'template') {
  //   // FIXME: currently this means a template call has to route its output to the current note, which doesn't match when used as a command.
  //   logDebug('routeOutput', `-> returning text to template for '${thisHeading}' ('${periodAndPartStr}' for '${periodString}')`)
  //   return (config.progressHeading !== '')
  //     ? `${'#'.repeat(config.headingLevel)} ${headingAndXCBStr}\n${output}`
  //     : output
  // } else
  if (source === 'refresh') {
    config.progressDestination = 'current'
    logDebug('routeOutput', `- will refresh section '${thisHeading}' in current note for '${periodAndPartStr}'`)
  } else if (source === 'todayProgressUpdate') {
    config.progressDestination = 'daily'
  }

  switch (config.progressDestination) {
    case 'daily': {
      const destNote = DataStore.calendarNoteByDate(new Date(), 'day')
      if (destNote) {
        logDebug('routeOutput', `- about to update section '${thisHeading}' in daily note '${destNote.filename}' for '${periodAndPartStr}'`)
        replaceSection(destNote, thisHeading, headingAndXCBStr, config.headingLevel, output)
        logInfo('routeOutput', `Updated section '${thisHeading}' in daily note '${destNote.filename}' for '${periodAndPartStr}'`)
      } else {
        logError('routeOutput', `Cannot find weekly note to write to`)
      }
      break
    }
    case 'weekly': {
      const destNote = DataStore.calendarNoteByDate(new Date(), 'week')
      if (destNote) {
        logDebug('routeOutput', `- about to update section '${thisHeading}' in weekly note '${destNote.filename}' for '${periodAndPartStr}'`)
        replaceSection(destNote, thisHeading, headingAndXCBStr, config.headingLevel, output)
        logInfo('routeOutput', `Updated section '${thisHeading}' in weekly note '${destNote.filename}' for '${periodAndPartStr}'`)
      } else {
        logError('routeOutput', `Cannot find weekly note to write to`)
      }
      break
    }
    default: {
      const currentNote = Editor.note
      if (currentNote == null) {
        logWarn('routeOutput', `No note is open in the Editor, so I can't write to it.`)
        await showMessage(`No note is open in the Editor, so I can't write to it.`)
      } else {
        replaceSection(currentNote, thisHeading, headingAndXCBStr, config.headingLevel, output)
        logInfo('routeOutput', `Appended progress update for '${periodString}' to current note`)
      }
      break
    }
  }
}
