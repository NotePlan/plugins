// @flow
//-----------------------------------------------------------------------------
// Settings helper module for jgclark.Summaries plugin
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
