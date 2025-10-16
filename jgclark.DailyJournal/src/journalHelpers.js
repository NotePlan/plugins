// @flow
//---------------------------------------------------------------
// Helper functions for Journalling plugin for NotePlan
// Jonathan Clark
// last update 2025-10-16 for v1.0.1 by @jgclark
//---------------------------------------------------------------

import pluginJson from '../plugin.json'
import { clo, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'

//---------------------------------------------------------------
// Settings

const pluginID = 'jgclark.DailyJournal' // now out of date, but tricky to rename

export type JournalConfigType = {
  startDailyTemplateTitle: string,
  endDailyTemplateTitle: string,
  startWeeklyTemplateTitle: string,
  endWeeklyTemplateTitle: string,
  startMonthlyTemplateTitle: string,
  endMonthlyTemplateTitle: string,
  reviewSectionHeading: string,
  dailyReviewQuestions: string,
  weeklyReviewQuestions: string,
  monthlyReviewQuestions: string,
  quarterlyReviewQuestions: string,
  yearlyReviewQuestions: string,
  moods: string
}

/**
 * Get or make config settings
 * @author @jgclark
 */
export async function getJournalSettings(): Promise<any> { // want to use Promise<JournalConfigType> but too many flow errors result
  try {
    // Get settings using Config system
    const config: JournalConfigType = await DataStore.loadJSON(`../${pluginID}/settings.json`)

    if (config == null || Object.keys(config).length === 0) {
      logError(pluginJson, `getJournalSettings() cannot find '${pluginID}' plugin settings. Stopping.`)
      await showMessage(`Cannot find settings for the '${pluginID}' plugin. Please make sure you have installed it from the Plugin Preferences pane.`)
      return
    } else {
      // clo(config, `${pluginID} settings:`)
      return config
    }
  }
  catch (error) {
    logError(pluginJson, `getJournalSettings: ${error.message}`)
    return // for completeness
  }
}
