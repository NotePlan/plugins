// @flow
//---------------------------------------------------------------
// Helper functions for Journalling plugin for NotePlan
// Jonathan Clark
// last update 2026-03-25 for v2.0.0.b3 by @jgclark + @Cursor
//---------------------------------------------------------------

import pluginJson from '../plugin.json'
import { clo, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'

//---------------------------------------------------------------
// Constants & Types

const pluginID = 'jgclark.Journalling'

export type JournalConfigType = {
  startDailyTemplateTitle: string,
  endDailyTemplateTitle: string,
  startWeeklyTemplateTitle: string,
  endWeeklyTemplateTitle: string,
  startMonthlyTemplateTitle: string,
  endMonthlyTemplateTitle: string,
  reviewSectionHeading: string,
  openCalendarNoteWhenReviewing: boolean,
  preferredWindowType: string,
  reviewUIMode?: string, // legacy setting kept for backward compatibility
  dailyReviewQuestions: string,
  weeklyReviewQuestions: string,
  monthlyReviewQuestions: string,
  quarterlyReviewQuestions: string,
  yearlyReviewQuestions: string,
  moods: string,
  calendarSet: Array<string>,
}

export type ParsedQuestionType = {
  question: string,
  type: string,
  originalLine: string,
  lineIndex: number
}

/** `<type>` names in review question templates — keep in sync with `parseQuestions` and `REVIEW_SEGMENT_RE`. */
export const REVIEW_QUESTION_TYPE_NAMES_ALT =
  'string|int|number|boolean|mood|subheading|h2|h3|bullets|checklists|tasks'

//---------------------------------------------------------------
// Settings

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
