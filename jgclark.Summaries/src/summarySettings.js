// @flow
//-----------------------------------------------------------------------------
// Summary settings helper module for jgclark.Summaries plugin
// Last updated: 2026-02-02 for v1.1.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { logError } from '@helpers/dev'
import { type headingLevelType } from '@helpers/general'
import { type TPeriodCode } from '@helpers/NPdateTime'

const pluginID = 'jgclark.Summaries'

export type SummariesConfig = {
  // Common settings ...
  foldersToExclude: Array<string>,
  headingLevel: headingLevelType,
  progressYesNoChars: string,
  excludeToday: boolean,
  // for appendProgressUpdate ...
  progressPeriod: TPeriodCode,
  progressDestination: string,
  progressHeading: string,
  showSparklines: boolean,
  progressYesNo: Array<string>,
  progressHashtags: Array<string>,
  progressHashtagsAverage: Array<string>,
  progressHashtagsTotal: Array<string>,
  progressMentions: Array<string>,
  progressMentionsAverage: Array<string>,
  progressMentionsTotal: Array<string>,
  progressChecklistReferenceNote: string,
  // for periodStats ...
  folderToStore: string,
  PSStatsHeading: string, // was "statsHeading"
  PSShowSparklines: boolean, // was "periodStatsShowSparklines"
  PSHowAsHashtagOrMention: boolean, // was "showAsHashtagOrMention"
  PSYesNo: Array<string>, // both hashtags and mentions. Was "periodStatsYesNo"
  PSHashtagsCount: Array<string>, // was "includedHashtags"
  PSHashtagsAverage: Array<string>, // was "periodStatsHashtagsAverage"
  PSHashtagsTotal: Array<string>, // was "periodStatsHashtagsTotal"
  // PSHashtagsToExclude: Array<string>, // was "excludeHashtags"
  PSMentionsCount: Array<string>, // was "periodStatsMentions"
  PSMentionsAverage: Array<string>, // was "periodStatsMentionsAverage"
  PSMentionsTotal: Array<string>, // was "periodStatsMentionsTotal"
  // PSMentionsToExclude: Array<string>, // was "excludeMentions"
  // for todayProgress ...
  todayProgressHeading: string,
  todayProgressItems: Array<string>,
  // for charts ...
  weeklyStatsItems: Array<string>,
  weeklyStatsDuration: ?number,
  weeklyStatsIncludeCurrentWeek: boolean,
  // chart summary stats (new in v1.1.0) ...
  chartDefaultDaysBack?: number,
  chartHeight?: number,
  chartTimeTags?: Array<string>,
  chartTotalTags?: Array<string>,
  chartNonZeroTags?: string, // JSON object string, parse in chartStats  e.g. "{ \"@bedtime\":{\"min\":20,\"max\":24}, \"@sleep\":{\"min\":5,\"max\":10} }"
  chartSignificantFigures?: number,
  chartAverageType?: 'none' | 'moving' | 'period', // none | 7-day moving avg | 7-day period avg
  // chartYesNoHabits?: Array<string>,
  chartYesNoChartHeight?: number,
  // chart colors: single comma-separated string
  chartColors?: string,
}

/**
 * Get config settings using Config V2 system.
 * @returns {Promise<SummariesConfig>} Object with configuration
 * @throws {Error} If settings cannot be loaded
 */
export async function getSummariesSettings(): Promise<SummariesConfig> {
  try {
    // Get settings using ConfigV2
    const v2Config: ?SummariesConfig = await DataStore.loadJSON(`../${pluginID}/settings.json`)

    if (v2Config == null || Object.keys(v2Config).length === 0) {
      throw new Error(`Cannot find settings for '${pluginID}' plugin`)
    }

    return v2Config
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    throw err
  }
}
