// @flow
//-----------------------------------------------------------------------------
// Settings for the dashboard - loaded/set in React Window
// Last updated 2024-07-26 for v2.1.0.a2 by @jgclark
//-----------------------------------------------------------------------------

import type { TPerspectiveDef, TSettingItem } from "./types.js"
import { clo, clof, logDebug } from '@helpers/react/reactDev'

// Filters are rendered in the file filterDropdownItems
// Note that filters are automatically created for each section in the dashboard.
// The filters below are non-section switches that display in the filters menu.
export const dashboardFilterDefs: Array<TSettingItem> = [
  { label: 'Filter out lower-priority items?', key: 'filterPriorityItems', type: 'switch', default: false },
  { label: 'Show referenced items in separate section?', key: 'separateSectionForReferencedNotes', type: 'switch', default: false, refreshAllOnChange: true },
  { label: 'Hide checklist items?', key: 'ignoreChecklistItems', type: 'switch', default: false, refreshAllOnChange: true },
  { label: 'Hide duplicates?', key: 'hideDuplicates', type: 'switch', default: false, description: "Only display one instance of each item, even if it's in multiple sections" },
  { label: 'Hide priority markers?', key: 'hidePriorityMarkers', type: 'switch', default: false, description: "Hide the '>>', '!!', '!', and '!!' priority markers (assuming your theme shows them visually)" },
  { label: 'Include note link for tasks?', key: 'includeTaskContext', type: 'switch', default: true, description: "Whether to show the note link for an open task or checklist" },
  { label: 'Include folder name in note link?', key: 'includeFolderName', type: 'switch', default: true, description: "Whether to include the folder name when showing a note link" },
  { label: 'Include scheduled date for tasks?', key: 'includeScheduledDates', type: 'switch', default: true, description: "Whether to display scheduled >dates for tasks in dashboard view" },
  { label: 'Exclude tasks that include time blocks', key: 'excludeTasksWithTimeblocks', type: 'switch', default: false, description: "Whether to stop display of open tasks that contain a time block" },
  { label: 'Exclude checklists that include time blocks?', key: 'excludeChecklistsWithTimeblocks', type: 'switch', default: false, description: "Whether to stop display of open checklists that contain a time block" },
]

// This section is an array that describes the order and type of the individual settings
// The current value for each TYPE of setting (or the fallback) is set later in this file in createDashboardSettingsItems()
// So to add a new setting of an existing type (e.g. heading, input, switch), just add it to this array at the top of this file
// But to add a new TYPE of setting, add it here, and update the switch statement in createDashboardSettingsItems()
// So it knows how to render it and set the default value.
export const dashboardSettingDefs: Array<TSettingItem> = [
  {
    type: 'heading',
    label: "Perspectives",
  },
  {
    key: "activePerspectiveName",
    label: "Name of active Perspective",
    description: "The Perspective that is active (if any).",
    type: 'input',
    default: "",
  },
  {
    type: 'heading',
    label: "General Settings",
  },
  {
    key: "ignoreTasksWithPhrase",
    label: "Ignore items in calendar sections with this phrase(s)",
    description: "If set, open tasks/checklists with this word or tag will be ignored, and not counted as open or closed. This is useful for situations where completing the item is outside your control. Note: This doesn't apply to the Tag/Mention section, which has its own setting. To include more than one phrase, separate them by commas.",
    type: 'input',
    default: "#waiting",
  },
  {
    key: "ignoreFolders",
    label: "Folders to ignore when finding items",
    // TODO(later): add this takes priority over 'Folders to include'
    description: "Comma-separated list of folder(s) to ignore when searching for open or closed tasks/checklists. This is useful where you are using sync'd lines in search results. (@Trash is always ignored, but other special folders need to be included, e.g. @Archive, @Templates.)",
    type: 'input',
    default: "@Archive, @Templates, Saved Searches",
  },
  {
    key: "newTaskSectionHeading",
    label: "Section heading to add/move new tasks under",
    description: "When moving an item to a different calendar note, or adding a new item, this sets the Section heading to add it under. (Don't include leading #s.) If the heading isn't present, it will be added at the top of the note. If this is left empty, then new tasks will appear at the top of the note.",
    type: 'input',
    default: "Tasks",
  },
  {
    key: "newTaskSectionHeadingLevel",
    label: "Heading level for new Headings",
    description: "Heading level (1-5) to use when adding new headings in notes.",
    type: 'number',
    default: "2",
    compactDisplay: true,
  },
  {
    key: "rescheduleNotMove",
    label: "Reschedule items in place, rather than move?",
    description: "When updating the due date on an open item in a calendar note, if set this will update its scheduled date in its current note, rather than move it.",
    type: 'switch',
    default: false,
  },
  {
    key: "moveSubItems",
    label: "Move sub-items with the item?",
    description: "If set, then indented sub-items of an item will be moved if the item is moved to a different note.",
    type: 'switch',
    default: true,
  },
  {
    key: "useTodayDate",
    label: "Use 'today' to schedule tasks for today?",
    description: "When scheduling a task for today, if this is set this will use '>today' to schedule the task; if it is not set it will use the current date.",
    type: 'switch',
    default: true,
  },
  {
    type: 'separator',
  },
  {
    type: 'heading',
    label: "Display settings",
  },
  {
    key: "maxItemsToShowInSection",
    label: "Max number of items to show in a section?",
    description: "The Dashboard isn't designed to show very large numbers of tasks. This gives the maximum number of items that will be shown at one time in the Overdue and Tag sections.",
    type: 'number',
    default: "30",
    compactDisplay: true,
  },
  {
    key: "dashboardTheme",
    label: "Theme to use for Dashboard",
    description: "If this is set to a valid Theme name from among those you have installed, this Theme will be used instead of your current Theme. Leave blank to use your current Theme.",
    type: 'input',
    default: "",
    compactDisplay: true,
  },
  {
    type: 'separator',
  },
  {
    type: 'heading',
    label: "Overdue Tasks section",
  },
  {
    key: "overdueSortOrder",
    label: "Sort order for Overdue tasks",
    description: "The order to show the Overdue tasks: 'priority' shows the higher priority (from `>>`, `!!!`, `!!` and `!` markers), 'earliest' by earliest modified date of the note, or 'most recent' changed note.",
    type: 'combo',
    options: ["priority", "earliest", "most recent"],
    default: "priority",
    compactDisplay: true,
  },
  {
    key: "lookBackDaysForOverdue",
    label: "Number of days to look back for Overdue tasks",
    description: "If set to any number > 0, will restrict Overdue tasks to just this last number of days.",
    type: 'number',
    default: "",
    compactDisplay: true,
  },
  {
    type: 'separator',
  },
  {
    type: 'heading',
    label: "Tag/Mention section",
  },
  {
    key: "tagsToShow",
    label: "#tag/@mention(s) to show",
    description: "If this is set as a #hashtag or @mention, then all open tasks that contain it are shown in a separate section. This is a good way to show all `#next` actions, for example. Further, this can be used to turn this into a 'deferred' section, by setting the tag to show here the same tag that is also set to be ignored in the calendar sections above. May also be more than one, separated by a comma. NOTE: These tasks will only show up in their separate section, unless you have the 'Hide Duplicates' option turned OFF.",
    type: 'input',
    default: "",
  },
  {
    key: "ignoreTagMentionsWithPhrase",
    label: "Ignore items in this section with this phrase",
    description: "Open tasks/checklists in this section will be ignored if they include this phrase.",
    type: 'input',
    default: "",
  },
  {
    type: 'separator',
  },
  {
    type: 'heading',
    label: "Automatic Refresh"
  },
  {
    key: "autoUpdateAfterIdleTime", // aka "autoRefresh"
    label: "Automatic Update frequency",
    description: "If set to any number > 0, the Dashboard will automatically refresh your data when the window is idle for a certain number of minutes.",
    type: 'number',
    default: "0",
    compactDisplay: true,
  },
  {
    type: 'separator',
  },
  {
    type: 'heading',
    label: "Interactive Processing"
  },
  {
    key: "enableInteractiveProcessing",
    label: "Enable interactive processing for each section?",
    description: "If enabled, the Dashboard will display a button that will loop through all the open items in a given section and prompt you to act on them.",
    type: 'switch',
    default: true,
  },
  {
    key: "interactiveProcessingHighlightTask",
    label: "Open note and highlight task when processing?",
    description: "If enabled, the Dashboard will open the note in the Editor and highlight the task in the note when it is processed. If this is turned, off, you can always open the note by clicking the task title in the dialog window",
    type: 'switch',
    default: false,
  },
  {
    key: "enableInteractiveProcessingTransitions",
    label: "Show interactive processing transitions?",
    description: "By default, interactive processing will show a shrink/grow transition between each item to be processed. You can turn these off if you prefer.",
    type: 'switch',
    default: true,
  },
  {
    type: 'separator',
  },
  {
    type: 'heading',
    label: "Logging: Please use the NotePlan Preferences Pane for the Dashboard Plugin to change logging settings."
  },
]

export const createDashboardSettingsItems = (allSettings: TAnyObject /*, pluginSettings: TAnyObject */): Array<TSettingItem> => {
  return dashboardSettingDefs.map(setting => {
    // clof(setting, 'createDashboardSettingsItems: setting',true)
    const thisKey = setting.key ?? ''
    switch (setting.type) {
      case 'separator':
        return {
          type: 'separator',
        }
      case 'heading':
      case 'header':
        return {
          type: 'heading',
          label: setting.label || '',
        }
      case 'switch':
        return {
          type: 'switch',
          label: setting.label || '',
          key: thisKey,
          checked: allSettings[thisKey] ?? setting.default,
          description: setting.description,
        }
      case 'input':
        return {
          type: 'input',
          label: setting.label || '',
          key: thisKey,
          value: allSettings[thisKey] ?? setting.default,
          description: setting.description,
          compactDisplay: setting.compactDisplay ?? false,
        }
      case 'number':
        return {
          type: 'number',
          label: setting.label || '',
          key: thisKey,
          value: allSettings[thisKey] ?? setting.default,
          description: setting.description,
          compactDisplay: setting.compactDisplay ?? false,
        }
      case 'combo':
        return {
          type: 'combo',
          label: setting.label || '',
          key: thisKey,
          value: allSettings[thisKey] ?? setting.default,
          options: setting.options,
          description: setting.description,
          compactDisplay: setting.compactDisplay ?? false,
        }
      // case 'perspective':
      //   return {
      //     type: 'perspective',
      //     // label: setting.label || '',
      //     key: thisKey,
      //     value: allSettings[thisKey] ?? setting.default,
      //     // description: setting.description,
      //   }
      default:
        return {
          label: setting.label || '',
          key: thisKey || '',
          type: 'text',
          value: allSettings[thisKey] ?? setting.default,
          description: setting.description,
        }
    }
  })
}

export const perspectiveSettingDefinitions: Array<TSettingItem> = [
  {
    key: "name",
    label: "Perspective Name",
    description: "",
    type: 'input',
    compactDisplay: true
  },
  {
    key: "includeCalendarNotes",
    label: "Include Calendar Notes?",
    description: "",
    type: 'switch',
  },
  {
    key: "includedFolders",
    label: "Included Folders",
    description: "(Optional) Comma-separated list of names of folders (or parts of names) to include in this perspective.",
    type: 'input',
    compactDisplay: false
  },
  {
    key: "excludedFolders",
    label: "Excluded Folders",
    description: "(Optional) Comma-separated list of names of folders (or parts of names) to exclude from this perspective. (If there is a conflict, Exclusion has a higher priority than Inclusion.)",
    type: 'input',
    compactDisplay: false
  },
  {
    key: "includedTags",
    label: "Tags/Mentions to Include",
    description: "(Optional) Comma-separated list of #tags or @mentions to include in this perspective.",
    type: 'input',
    compactDisplay: true
  },
  {
    key: "excludedTags",
    label: "Tags/Mentions to Exclude",
    description: "(Optional) Comma-separated list of #tags or @mentions to exclude from this perspective.",
    type: 'input',
    compactDisplay: true
  },
]

export const perspectiveSettingDefaults: Array<TPerspectiveDef> = [
  {
    key: 'persp0',
    name: "Home",
    includeCalendarNotes: true,
    includedFolders: "Home, NotePlan",
    excludedFolders: "",
    includedTags: "#jgcDR,#home",
    excludedTags: "#test"
  },
  {
    key: 'persp1',
    name: "Work",
    includeCalendarNotes: true,
    includedFolders: "CCC, Ministry",
    excludedFolders: "",
    includedTags: "@church",
    excludedTags: "#test"
  }
]
