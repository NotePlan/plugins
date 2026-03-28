// @flow
//---------------------------------------------------------------
// Helper functions for Journalling plugin for NotePlan
// Jonathan Clark
// last update 2026-03-28 for v2.0.0.b4 by @jgclark + @Cursor
//---------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getNextNPPeriodString } from '@helpers/dateTime'
import { clo, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'

//---------------------------------------------------------------
// Constants & Types

const pluginID = 'jgclark.Journalling'

export type JournalConfigType = {
  dailyJournalSectionHeading: string,
  reviewSectionHeading: string,
  startDailyTemplateTitle: string,
  endDailyTemplateTitle: string,
  startWeeklyTemplateTitle: string,
  endWeeklyTemplateTitle: string,
  startMonthlyTemplateTitle: string,
  endMonthlyTemplateTitle: string,
  openCalendarNoteWhenReviewing: boolean,
  preferredWindowType: string,
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


/**
 * Replace `<date>` with the calendar period title and `<datenext>` / `<nextdate>` with the following period.
 * Used for the review HTML window and for text written back to the note.
 * @param {string} input
 * @param {string} periodString
 * @param {string} periodType — 'day' | 'week' | 'month' | 'quarter' | 'year'
 * @returns {string}
 */
export function substituteReviewPeriodPlaceholders(input: string, periodString: string, periodType: string): string {
  const nextPeriodStr = getNextNPPeriodString(periodString, periodType)
  return input
    .replace(/<\s*date\s*>/gi, periodString)
    .replace(/<\s*(?:datenext|nextdate)\s*>/gi, nextPeriodStr)
}

/**
 * Title-case adjective for UI strings (window title, review heading, messages).
 * @param {string} periodType — 'day' | 'week' | 'month' | 'quarter' | 'year'
 * @returns {string} e.g. 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'
 */
export function getPeriodAdjectiveFromType(periodType: string): string {
  switch (periodType) {
    case 'day':
      return 'Daily'
    case 'week':
      return 'Weekly'
    case 'month':
      return 'Monthly'
    case 'quarter':
      return 'Quarterly'
    case 'year':
      return 'Yearly'
    default:
      return '(error: unknown period type)'
  }
}