// @flow
//-----------------------------------------------------------------------------
// Generate data for REM (Reminders) Section via fetch -> map -> bucket -> place
// Last updated 2026-08-01 for v2.4.0.b60, @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { isCurrentRemindersEnabled, isUndatedOverdueRemindersEnabled } from './dashboardHelpers'
import { reminderItems } from './demoData'
import { bucketReminderItems } from './reminderBuckets'
import { createReminderSectionItem, getReminderListsForConfig, mapCalendarItemToReminderForDashboard } from './reminderMapping'
import { placeReminderBuckets, type TReminderPlacement } from './reminderPlacement'
import type { TActionButton, TDashboardSettings, TSection, TSectionItem, TDialogSettingItem } from './types'
import { logDebug, logError, logTimer, timer } from '@helpers/dev'
import { buildReminderDisplayByIdFromReminders, type TReminderDisplayById } from '@helpers/NPReminders'
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
      // Create a unique list of list names from demo items so the add-Reminder heading button is shown in demo mode
      const seenListTitles: { [string]: boolean } = {}
      for (const item of allItems) {
        const listTitle = item.reminder?.listname
        if (listTitle && !seenListTitles[listTitle]) {
          seenListTitles[listTitle] = true
          listTitlesForAdd.push(listTitle)
        }
      }
    } else {
      // Resolve list titles for this Perspective (override or NotePlan-enabled), then fetch via remindersByLists
      const { titles: listTitles, colorByTitle } = getReminderListsForConfig(config)
      listTitlesForAdd = listTitles
      let calendarItems: Array<TCalendarItem> = []
      if (listTitles.length === 0) {
        logDebug('getRemindersGeneratedData', `- no reminder lists to query; buckets will be empty`)
      } else {
        // Always pass explicit list titles to remindersByLists (empty array would return ALL lists)
        calendarItems = await Calendar.remindersByLists(listTitles)
      }
      const incomplete = calendarItems.filter((ci) => !ci.isCompleted)
      logDebug('getRemindersGeneratedData', `- fetched ${String(calendarItems.length)} reminders from ${String(listTitles.length)} list(s) via remindersByLists, ${String(incomplete.length)} incomplete`)

      allItems = incomplete.map((ci, index) => {
        const reminder = mapCalendarItemToReminderForDashboard(ci, colorByTitle)
        return createReminderSectionItem(`${thisSectionCode}-${index}`, reminder)
      })
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

    // Adding Reminders only supported on NotePlan >= 3.21.2 (macOS build 1525)
    // Form fields for the heading add-Reminder button (CommandButton -> showDialog)
    const reminderFormFields: Array<TDialogSettingItem> = [
      { type: 'input', label: 'Reminder:', key: 'text', focus: true },
      {
        type: 'dropdown-select',
        label: 'Reminder List:',
        key: 'list',
        // Cast: TDialogSettingItem.options (in helpers/react/DynamicDialog) is Array<TOptionObject>, but
        // dropdown-select also accepts a plain Array<string>. Arrays are invariant so this can't be widened here.
        options: (listTitlesForAdd: any),
        noWrapOptions: true,
        value: listTitlesForAdd[0] || '',
      },
      { type: 'calendarpicker', label: 'Date (optional):', key: 'date', dateFormat: 'YYYY-MM-DD' },
      { type: 'input', label: 'Time (optional, HH:MM):', key: 'time' },
    ]
    const actionButtons: Array<TActionButton> =
      usersVersionHas('addRemindersSupport') && listTitlesForAdd.length > 0
        ? [
          {
            actionName: 'addReminder',
            actionPluginID: `${pluginJson['plugin.id']}`,
            display: '<i class= "fa-regular fa-fw fa-circle-plus RemindersColor" ></i> ',
            tooltip: 'Add a new Reminder',
            postActionRefresh: ['REM', 'DT', 'TB', 'DO', 'DY', 'OVERDUE'],
            formFields: reminderFormFields,
            submitOnEnter: true,
            submitButtonText: 'Add & Close',
            actionParam: '',
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
