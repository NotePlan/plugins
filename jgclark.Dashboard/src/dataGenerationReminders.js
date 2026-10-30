// @flow
//-----------------------------------------------------------------------------
// Generate data for REM (Reminders) Section via fetch -> map -> bucket -> place
// Last updated 2026-08-18 for v2.4.0.b65, @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { isCurrentRemindersEnabled, isUndatedOverdueRemindersEnabled } from './dashboardHelpers'
import { reminderItems } from './demoData'
import { bucketReminderItems } from './reminderBuckets'
import { createReminderSectionItem, getReminderListsForConfig } from './reminderMapping'
import { reminderListTitlesFromSectionItems, REMINDER_ADD_REFRESH_SECTIONS } from './reminderAddForm'
import { placeReminderBuckets, type TReminderPlacement } from './reminderPlacement'
import type { TActionButton, TDashboardSettings, TSection, TSectionItem } from './types'
import { logDebug, logError, logTimer, timer } from '@helpers/dev'
import { buildReminderDisplayByIdFromReminders, fetchIncompleteRemindersByLists, type TReminderDisplayById } from '@helpers/NPReminders'
import { usersVersionHas } from '@helpers/NPVersions'

//-----------------------------------------------------------------------------
// Types

/**
 * Placed reminders plus the optional REM section built from forREM.
 */
export type TRemindersGeneratedData = {
  placement: TReminderPlacement,
  remindersSection: ?TSection,
  displayById: TReminderDisplayById,
}

//-----------------------------------------------------------------------------
// Helpers

/**
 * @returns {TRemindersGeneratedData}
 */
function emptyRemindersGeneratedData(): TRemindersGeneratedData {
  return {
    placement: {
      forDT: [],
      forTB: [],
      forDY: [],
      forDO: [],
      forOVERDUE: [],
      forREM: [],
      remBucketsLabel: '',
      homeless: [],
    },
    remindersSection: null,
    displayById: {},
  }
}

//-----------------------------------------------------------------------------
// Main function

/**
 * Fetch incomplete reminders, bucket by date, place into sections by settings, and build the REM section.
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @returns {Promise<TRemindersGeneratedData>}
 */
export async function getRemindersGeneratedData(
  config: TDashboardSettings,
  useDemoData: boolean = false,
): Promise<TRemindersGeneratedData> {
  try {
    const currentRemindersEnabled = isCurrentRemindersEnabled(config)
    const undatedOverdueRemindersEnabled = isUndatedOverdueRemindersEnabled(config)
    // Missing keys mean ON; only skip fetch when both toggles are explicitly off
    if (!currentRemindersEnabled && !undatedOverdueRemindersEnabled) {
      return emptyRemindersGeneratedData()
    }

    logDebug('getRemindersGeneratedData', `--------- Gathering Reminders ${useDemoData ? 'DEMO ' : ''}items --------`)

    const thisSectionCode = 'REM'
    const startTime = new Date()
    let allItems: Array<TSectionItem> = []
    let listTitlesForAdd: Array<string> = []

    if (useDemoData) {
      allItems = reminderItems.slice()
      // Unique list names from demo items so the add-Reminder heading button is shown in demo mode
      listTitlesForAdd = reminderListTitlesFromSectionItems(allItems)
    } else {
      // Resolve list titles for this Perspective (override or NotePlan-enabled), then fetch incomplete reminders
      const { titles: listTitles, colorByTitle } = getReminderListsForConfig(config)
      listTitlesForAdd = listTitles
      const reminders = await fetchIncompleteRemindersByLists(listTitles, colorByTitle)
      allItems = reminders.map((reminder, index) => createReminderSectionItem(`${thisSectionCode}-${index}`, reminder))
    }

    const displayById = buildReminderDisplayByIdFromReminders(
      allItems.map((item) => item.reminder).filter(Boolean),
    )

    const buckets = bucketReminderItems(allItems)
    logDebug(
      'getRemindersGeneratedData',
      `- buckets: timedToday=${String(buckets.timedTodayItems.length)} untimedToday=${String(buckets.untimedTodayItems.length)} yesterday=${String(buckets.yesterdayItems.length)} tomorrow=${String(buckets.tomorrowItems.length)} overdue=${String(buckets.overdueItems.length)} undated=${String(buckets.undatedItems.length)}`,
    )

    const placement = placeReminderBuckets(buckets, config)

    let remItems = placement.forREM
    const maxInSection = config.maxItemsToShowInSection ?? 24
    const totalRemCount = remItems.length
    logDebug('getRemindersGeneratedData', `- REM section will hold ${String(remItems.length)} reminder(s)`)
    if (totalRemCount > maxInSection) {
      remItems = remItems.slice(0, maxInSection)
    }

    // Set the REM section description.
    // Includes types of reminders in the section (undated + fallbacks) and the total count.
    // {itemType} is pluralised in Section.jsx (reminder / reminders) from current totalCount.
    let sectionDescription = `{countWithLimit} ${placement.remBucketsLabel} {itemType}`
    if (config?.FFlag_ShowSectionTimings) {
      sectionDescription += ` [${timer(startTime)}]`
    }

    // Adding Reminders only supported on NotePlan >= 3.21.2 (macOS build 1525).
    // The heading button opens the shared header dialog on Reminder.
    const actionButtons: Array<TActionButton> =
      usersVersionHas('addRemindersSupport') && listTitlesForAdd.length > 0
        ? [
          {
            actionName: 'addReminder',
            actionPluginID: `${pluginJson['plugin.id']}`,
            display: '<i class= "fa-regular fa-fw fa-circle-plus RemindersColor" ></i> ',
            tooltip: 'Add a reminder, task, or checklist',
            postActionRefresh: REMINDER_ADD_REFRESH_SECTIONS,
            actionParam: '',
            openAddDialog: { itemKind: 'reminder' },
          },
        ]
        : []

    const remindersSection: ?TSection = undatedOverdueRemindersEnabled
      ? {
        ID: thisSectionCode,
        sectionCode: thisSectionCode,
        name: 'Reminders',
        showSettingName: 'showRemindersSection',
        description: sectionDescription,
        FAIconClass: 'fa-regular fa-fw fa-list',
        sectionTitleColorPart: 'RemindersSectionColor',
        sectionItems: remItems,
        generatedDate: new Date(),
        isReferenced: false,
        actionButtons: actionButtons,
        totalCount: totalRemCount,
      }
      : null

    logTimer('getRemindersGeneratedData', startTime, `- REM undated section has ${String(remItems.length)} of ${String(totalRemCount)} items, 100`)

    return {
      placement,
      remindersSection,
      displayById,
    }
  } catch (error) {
    logError('getRemindersGeneratedData', error.message)
    return emptyRemindersGeneratedData()
  }
}
