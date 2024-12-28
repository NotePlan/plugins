// @flow
//-----------------------------------------------------------------------------
// Settings for the dashboard - loaded/set in React Window
// Last updated for v2.1.0.b
//-----------------------------------------------------------------------------
import type { TSettingItem } from './types.js'
import { clo, clof, logDebug } from '@helpers/react/reactDev'

// Filters are rendered in the file filterDropdownItems
// Note that filters are automatically created for each section in the dashboard.
// The filters below are non-section switches that display in the filters menu.
export const dashboardFilterDefs: Array<TSettingItem> = [
  {
    label: 'Filter out lower-priority items?',
    key: 'filterPriorityItems',
    type: 'switch',
    default: false,
    description: 'Whether to hide lower-priority items from appearing in a dashboard section, when there are also higher-priority items in that section.',
  },
  {
    label: 'Hide checklist items?',
    key: 'ignoreChecklistItems',
    type: 'switch',
    default: false,
    refreshAllOnChange: true
  },
  {
    label: 'Hide duplicates?',
    key: 'hideDuplicates',
    type: 'switch',
    default: false,
    description: "Only display one instance of each item, even if it's in multiple sections"
  },
  {
    label: 'Exclude tasks that include time blocks?',
    key: 'excludeTasksWithTimeblocks',
    type: 'switch',
    default: false,
    description: 'Whether to stop display of open tasks that contain a time block',
  },
  {
    label: 'Exclude checklists that include time blocks?',
    key: 'excludeChecklistsWithTimeblocks',
    type: 'switch',
    default: false,
    description: 'Whether to stop display of open checklists that contain a time block',
  },
]

// This section is an array that describes the order and type of the individual settings
// The current value for each TYPE of setting (or the fallback) is set later in this file in createDashboardSettingsItems()
// So to add a new setting of an existing type (e.g. heading, input, switch), just add it to this array.
// But to add a new TYPE of setting, add it here, and update the switch statement in createDashboardSettingsItems()
// so it knows how to render it and set the default value.
export const dashboardSettingDefs: Array<TSettingItem> = [
  {
    type: 'heading',
    label: 'Perspectives',
    description:
      "A 'Perspective' is a named set of all your Dashboard settings below, including which folders to include/ignore, which sections to show. Each 'Perspective' has a name, and can be updated and deleted. The '-' Perspective is a default (which can't be deleted).",
  },
  {
    key: 'perspectivesEnabled',
    label: 'Enable Perspectives',
    description: '',
    type: 'switch',
    default: true,
    compactDisplay: true,
    controlsOtherKeys: [],
  },
  {
    type: 'separator',
  },
  {
    type: 'heading',
    label: 'What to Include and Exclude',
    description: "These 3 key settings control what folders and items are included and excluded in Dashboard's many sections. It includes the folders from the first setting, and then removes any specified from the next setting. Finally, individual lines in notes can be ignored by adding terms to the third setting.",
  },
  {
    key: 'includedFolders',
    label: 'Folders to Include',
    description: "Comma-separated list of folder(s) to include when searching for open or closed tasks/checklists. The matches are partial, so 'Home' will include 'Home' and 'The Home Areas' etc. If left blank, all folders are included.",
    type: 'input',
    default: '',
    compactDisplay: true,
  },
  {
    key: 'excludedFolders',
    label: 'Folders to Exclude',
    description:
      "Comma-separated list of folder(s) to ignore when searching for open or closed tasks/checklists. The matches are partial, so 'Work' will exclude 'Work' and 'Work/CompanyA' etc. To ignore notes at the top-level (not in a folder), include '/' in the list. (@Trash is always ignored, but other special folders need to be specified, e.g. @Archive, @Templates.)",
    type: 'input',
    default: '@Archive, @Templates, Saved Searches',
    compactDisplay: true,
  },
  {
    // Note: replaces earlier "ignoreTagMentionsWithPhrase" which applied only to the Tag/Mention section
    key: 'ignoreItemsWithTerms',
    label: 'Ignore items in notes with phrase(s)',
    description:
      'If set, open tasks/checklists with any of these words or tags/mentions will be ignored, and not counted as open or closed. This is useful for situations where completing the item is outside your control, or you want to ignore it in a particular Perpsective. To include more than one word, separate them by commas.',
    type: 'input',
    default: '#waiting',
    compactDisplay: false,
    controlsOtherKeys: ['applyIgnoreTermsToCalendarHeadingSections'],
  },
  {
    key: 'applyIgnoreTermsToCalendarHeadingSections',
    label: "Apply to sections under headings in Calendar notes?",
    description:
      "If turned on, then all content in Calendar notes under headings that contains any of those phrases will be ignored.",
    type: 'switch',
    default: false,
    compactDisplay: true,
    dependsOnKey: 'ignoreItemsWithTerms',
  },
  {
    type: 'separator',
  },
  {
    type: 'heading',
    label: 'Moving/Scheduling Items',
  },
  {
    key: 'newTaskSectionHeading',
    label: 'Section heading to add/move new tasks under',
    description:
      "When moving an item to a different calendar note, or adding a new item, this sets the Section heading to add it under. (Don't include leading #s.) If the heading isn't present, it will be added at the top of the note. If you leave this field blank, it will prompt you each time which heading to use. If you want new tasks to always appear at the top of the note, use <<top of note>> (with the << and >>).",
    type: 'input',
    default: 'Tasks',
    compactDisplay: true,
  },
  {
    key: 'newTaskSectionHeadingLevel',
    label: 'Heading level for new Headings',
    description: 'Heading level (1-5) to use when adding new headings in notes.',
    type: 'number',
    default: '2',
    compactDisplay: true,
  },
  {
    key: 'moveSubItems',
    label: 'Move sub-items with the item?',
    description: 'If set, then indented sub-items of an item will be moved if the item is moved to a different note.',
    type: 'switch',
    default: true,
  },
  {
    key: 'rescheduleNotMove',
    label: '(Re)schedule items in place, rather than move?',
    description: 'When updating the due date on an open item in a calendar note, if set this will update its scheduled date in its current note, rather than move it.',
    type: 'switch',
    default: false,
    compactDisplay: true,
    controlsOtherKeys: ['useLiteScheduleMethod'],
  },
  {
    key: 'useLiteScheduleMethod',
    label: "When (re)scheduling an item, use simplified method?",
    description: "If set then the task simply has the '>date' updated in the note it is in. It does not show with the special 🕓 task icon. The normal NP method does mark it with the 🕓 task icon, and copies the item to the date you're scheduling it to, and adds the '<date' it was scheduled from.",
    type: 'switch',
    default: false,
    dependsOnKey: 'rescheduleNotMove',
  },
  {
    key: 'useTodayDate',
    label: "Use '>today' to schedule tasks for today?",
    description: "When scheduling a task for today, if this is set this will use '>today' to schedule the task; if it is not set it will use the current date (>YYYY-MM-DD).",
    type: 'switch',
    default: true,
  },
  {
    type: 'separator',
  },
  {
    type: 'heading',
    label: 'Display settings',
    description: 'Settings that control how the Dashboard displays information. There are also toggles that control filtering of which Sections to show in the Filters dropdown menu.',
  },
  {
    key: 'maxItemsToShowInSection',
    label: 'Max number of items to show in a section?',
    description:
      "The Dashboard isn't designed to show very large numbers of tasks. This gives the maximum number of items that will be shown at one time in the Overdue and Tag sections.",
    type: 'number',
    default: '24',
    compactDisplay: true,
  },
  {
    key: 'displayDoneCounts',
    label: 'Show completed task count?',
    description:
      'Show the number of tasks completed today at the top of the Dashboard. For this to work, you need to have enabled "Append Completion Date" in the NotePlan Preferences/Todo section.',
    type: 'switch',
    default: true,
  },
  {
    key: 'autoUpdateAfterIdleTime', // aka "autoRefresh"
    label: 'Automatic Update frequency',
    description: 'If set to any number > 0, the Dashboard will automatically refresh your data when the window is idle for a certain number of minutes.',
    type: 'number',
    default: '10',
    compactDisplay: true,
  },
  {
    key: 'dashboardTheme',
    label: 'Theme to use for Dashboard',
    description:
      'If this is set to a valid Theme name from among those you have installed, this Theme will be used instead of your current Theme. Leave blank to use your current Theme.',
    type: 'input',
    default: '',
    compactDisplay: true,
  },
  {
    label: 'Show referenced items in separate section?',
    key: 'separateSectionForReferencedNotes',
    description: 'Whether to show items that are referenced to a Calendar note from other notes in a separate section than those in the Calendar note itself.',
    type: 'switch',
    default: false,
    refreshAllOnChange: true
  },
  {
    label: 'Hide priority markers?',
    key: 'hidePriorityMarkers',
    type: 'switch',
    default: false,
    description: "Hide the '>>', '!!', '!', and '!!' priority markers (if your theme uses priorities markers)",
  },
  {
    label: 'Show note link for tasks?',
    key: 'includeTaskContext',
    type: 'switch',
    default: true,
    description: 'Whether to show the note link for an open task or checklist'
  },
  {
    label: 'Show folder name in note link?',
    key: 'includeFolderName',
    type: 'switch',
    default: true,
    description: 'Whether to include the folder name when showing a note link',
  },
  {
    label: 'Show scheduled date for tasks?',
    key: 'includeScheduledDates',
    type: 'switch',
    default: true,
    description: 'Whether to display scheduled >dates for tasks in dashboard view',
  },
  {
    key: 'parentChildMarkersEnabled',
    // label: 'Show parent/child markers on items?',
    // description: 'Add a small icon on items that either have indented sub-items, or is an indented child a parent item.',
    label: 'Show parent markers on items?',
    description: 'If set adds an ellipsis icon on items that have "children" (indented sub-items), whether they are also shown or not.',
    type: 'switch',
    default: true,
  },
  {
    type: 'separator',
  },
  {
    type: 'heading',
    label: 'Overdue Tasks section',
  },
  {
    key: 'overdueSortOrder',
    label: 'Sort order for Overdue tasks',
    description:
      "The order to show the Overdue tasks: 'priority' shows the higher priority (from `>>`, `!!!`, `!!` and `!` markers), 'earliest' by earliest modified date of the note, or 'most recent' changed note.",
    type: 'dropdown-select',
    options: ['priority', 'earliest', 'most recent'],
    default: 'priority',
    compactDisplay: true,
    fixedWidth: 150,
  },
  {
    key: 'lookBackDaysForOverdue',
    label: 'Number of days to look back for Overdue tasks',
    description: 'If set to any number > 0, will restrict Overdue tasks to just this last number of days.',
    type: 'number',
    default: '7',
    compactDisplay: true,
  },
  {
    type: 'separator',
  },
  {
    type: 'heading',
    label: 'Tag/Mention section',
  },
  {
    key: 'tagsToShow',
    label: '#tag/@mention(s) to show',
    description:
      "If this is set as a #hashtag or @mention, then all open tasks that contain it are shown in a separate section. This is a good way to show all `#next` actions, for example. Further, this can be used to turn this into a 'deferred' section, by setting the tag to show here the same tag that is also set to be ignored in the calendar sections above. May also be more than one, separated by a comma. NOTE: These tasks will only show up in their separate section, unless you have the 'Hide Duplicates' option turned OFF.",
    type: 'input',
    default: '',
  },
  {
    type: 'separator',
  },
  {
    type: 'heading',
    label: 'Interactive Processing',
  },
  {
    key: 'enableInteractiveProcessing',
    label: 'Enable interactive processing for each section?',
    description: 'If enabled, the Dashboard will display a button that will loop through all the open items in a given section and prompt you to act on them.',
    type: 'switch',
    default: true,
    controlsOtherKeys: ['interactiveProcessingHighlightTask', 'enableInteractiveProcessingTransitions'],
  },
  {
    key: 'interactiveProcessingHighlightTask',
    label: 'Open note and highlight task when processing?',
    description:
      'If enabled, the Dashboard will open the note in the Editor and highlight the task in the note when it is processed. If this is turned, off, you can always open the note by clicking the task title in the dialog window',
    type: 'switch',
    dependsOnKey: 'enableInteractiveProcessing',
    default: false,
  },
  {
    key: 'enableInteractiveProcessingTransitions',
    label: 'Show interactive processing transitions?',
    description: 'By default, interactive processing will show a shrink/grow transition between each item to be processed. You can turn these off if you prefer.',
    type: 'switch',
    dependsOnKey: 'enableInteractiveProcessing',
    default: true,
  },
  {
    type: 'separator',
  },
  {
    type: 'heading',
    label: 'Logging',
    description: 'Please use the NotePlan Settings Pane for the Dashboard Plugin to change logging settings.',
  },
]

export const createDashboardSettingsItems = (allSettings: TAnyObject /*, pluginSettings: TAnyObject */): Array<TSettingItem> => {
  return dashboardSettingDefs.map((setting) => {
    // clof(setting, 'createDashboardSettingsItems: setting',true)
    const thisKey = setting.key ?? ''
    switch (setting.type) {
      case 'separator':
        return {
          type: 'separator',
        }
      case 'heading':
        return {
          type: 'heading',
          label: setting.label || '',
          description: setting.description || '',
        }
      // $FlowIgnore[incompatible-type] don't understand the error
      case 'header': // Note: deliberately the same as 'heading' above.
        return {
          type: 'heading',
          label: setting.label || '',
          description: setting.description || '',
        }
      case 'switch':
        return {
          type: 'switch',
          label: setting.label || '',
          key: thisKey,
          checked: allSettings[thisKey] ?? setting.default,
          description: setting.description,
          controlsOtherKeys: setting.controlsOtherKeys,
          dependsOnKey: setting.dependsOnKey,
        }
      case 'input':
        return {
          type: 'input',
          label: setting.label || '',
          key: thisKey,
          value: allSettings[thisKey] ?? setting.default,
          description: setting.description,
          compactDisplay: setting.compactDisplay ?? false,
          dependsOnKey: setting.dependsOnKey,
        }
      case 'input-readonly':
        return {
          type: 'input-readonly',
          label: setting.label || '',
          key: thisKey,
          value: allSettings[thisKey] ?? setting.default,
          description: setting.description,
          compactDisplay: setting.compactDisplay ?? false,
          dependsOnKey: setting.dependsOnKey,
        }
      case 'number':
        return {
          type: 'number',
          label: setting.label || '',
          key: thisKey,
          value: allSettings[thisKey] ?? setting.default,
          description: setting.description,
          compactDisplay: setting.compactDisplay ?? false,
          dependsOnKey: setting.dependsOnKey,
        }
      case 'dropdown-select':
        return {
          type: 'dropdown-select',
          label: setting.label || '',
          key: thisKey,
          value: allSettings[thisKey] ?? setting.default,
          options: setting.options,
          description: setting.description,
          compactDisplay: setting.compactDisplay ?? false,
          dependsOnKey: setting.dependsOnKey,
        }
      // $FlowIgnore[incompatible-type] don't understand the error
      case 'hidden':
        return {
          //$FlowIgnore[incompatible-call] don't understand the error
          type: 'hidden',
          label: setting.label || '',
          key: thisKey,
          value: allSettings[thisKey] ?? setting.default,
          description: setting.description,
        }
      // $FlowIgnore[incompatible-type] don't understand the error
      case 'perspectiveList':
        return {
          //$FlowIgnore[incompatible-call] don't understand the error
          type: 'perspectiveList',
          dependsOnKey: setting.dependsOnKey,
        }
      default:
        return {
          type: 'text',
          label: setting.label || '',
          key: thisKey || '',
          value: allSettings[thisKey] ?? setting.default,
          description: setting.description,
          dependsOnKey: setting.dependsOnKey,
        }
    }
  })
}
