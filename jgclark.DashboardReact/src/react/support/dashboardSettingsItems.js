// @flow
import type { TDropdownItem, TSharedSettings } from "../../types.js"

// Filters are rendered in the file filterDropdownItems
// Note that filters are automatically created for each section in the dashboard
// The filters below are non-section switches that display in the filters menu
export const dashboardFilters = [
  { label: 'Filter out lower-priority items?', key: 'filterPriorityItems', default: false },
  { label: 'Show referenced items in separate section?', key: 'separateSectionForReferencedNotes', default: false, refreshAllOnChange: true },
  { label: 'Hide checklist items?', key: 'ignoreChecklistItems', default: false, refreshAllOnChange: true },
  { label: 'Hide duplicates?', key: 'hideDuplicates', default: false, description: "Only display one instance of each item, even if it's in multiple sections" },
  { label: 'Hide priority markers?', key: 'hidePriorityMarkers', default: false, description: "Hide the '>>', '!!', '!', and '!!' priority markers (assuming your theme shows them visually)" },
  // TEST: moved from dashboardSettings on 4.6.2024
  { label: 'Include note link for tasks?', key: 'includeTaskContext', default: true, description: "Whether to show the note link for an open task or checklist" },
  { label: 'Include folder name in note link?', key: 'includeFolderName', default: true, description: "Whether to include the folder name when showing a note link" },
  { label: 'Include scheduled date for tasks?', key: 'includeScheduledDates', default: true, description: "Whether to display scheduled >dates for tasks in dashboard view" },
  { label: 'Exclude tasks that include time blocks', key: 'excludeTasksWithTimeblocks', default: false, description: "Whether to stop display of open tasks that contain a time block" },
  { label: 'Exclude checklists that include time blocks?', key: 'excludeChecklistsWithTimeblocks', default: false, description: "Whether to stop display of open checklists that contain a time block" },
]

const dashboardSettings = [
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
    description: "Comma-separated list of folder(s) to ignore when searching for open or closed tasks/checklists. This is useful where you are using sync'd lines in search results.",
    type: 'input',
    default: "@Archive, Saved Searches",
  },
  // {
  //   key: "includeTaskContext",
  //   label: "Include context for tasks?",
  //   description: "Whether to show the note link for an open task or checklist",
  //   type: 'switch',
  //   default: true,
  // },
  // {
  //   key: "excludeTasksWithTimeblocks",
  //   label: "Exclude tasks that include time blocks?",
  //   description: "Whether to stop display of open tasks that contain a time block",
  //   type: 'switch',
  //   default: false,
  // },
  // {
  //   key: "excludeChecklistsWithTimeblocks",
  //   label: "Exclude checklists that include time blocks?",
  //   description: "Whether to stop display of open checklists that contain a time block",
  //   type: 'switch',
  //   default: false,
  // },
  // {
  //   key: "includeFolderName",
  //   label: "Include folder name?",
  //   description: "Whether to include the folder name when showing a note link",
  //   type: 'switch',
  //   default: true,
  // },
  {
    key: "maxTasksToShowInSection",
    label: "Max number of items to show in a section?",
    description: "The Dashboard isn't designed to show very large numbers of tasks. This gives the maximum number of items that will be shown at one time in the Overdue and Tag sections.",
    type: 'input',
    default: "30",
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
    type: 'input',
    default: "2",
  },
  {
    key: "rescheduleNotMove",
    label: "Reschedule items in place, rather than move them?",
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
    key: "dashboardTheme",
    label: "Theme to use for Dashboard",
    description: "If this is set to a valid Theme name from among those you have installed, this Theme will be used instead of your current Theme. Leave blank to use your current Theme.",
    type: 'input',
    default: "",
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
  },
  // {
  //   key: "updateOverdueOnTrigger",
  //   hidden: true,
  //   label: "Update Overdue section when triggered?",
  //   description: "If true then the 'Overdue' section will be updated even when the update comes from being triggered by a change to the daily note.",
  //   type: 'switch',
  //   default: true,
  // },
  {
    type: 'separator',
  },
  {
    type: 'heading',
    label: "Tag/Mention section",
  },
  {
    key: "tagToShow",
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
    key: "updateTagMentionsOnTrigger",
    hidden: true,
    label: "Update items in this section when triggered?",
    description: "If true then the 'Tag/Mention' section will be updated even when the update comes from being triggered by a change to the daily note.",
    type: 'switch',
    default: true,
  },
  {
    type: 'separator',
  },
  {
    type: 'heading',
    label: "Automatic Refresh"
  },
  {
    key: "autoAddTrigger",
    label: "Add dashboard auto-update trigger when dashboard opened?",
    description: "Whether to add the auto-update trigger to the frontmatter to the current note when the dashboard is opened. This will ensure an immediate Dashboard refresh is triggered when the note is changed.",
    type: 'switch',
    default: false,
  },
  {
    key: "autoUpdateAfterIdleTime", // // aka "autoRefresh"
    label: "Automatic Update frequency",
    description: "If set to any number > 0, the Dashboard will automatically refresh your data when the window is idle for a certain number of minutes.",
    type: 'input',
    default: "0",
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
] 

export const createDashboardSettingsItems = (sharedSettings: TSharedSettings, pluginSettings: TAnyObject  ): Array<TDropdownItem> => {
  return dashboardSettings.map(setting => {
    switch (setting.type) {
      case 'separator':
        return {
          type: 'separator',
        }
      case 'heading':
      case 'header':
        return {
          label: setting.label || '',
          type: 'heading',
        }
      case 'switch':
        return {
          label: setting.label || '',
          key: setting.key,
          type: 'switch',
          checked: sharedSettings[setting.key] ?? pluginSettings[setting.key] ?? setting.default,
          description: setting.description,
        }
      case 'input':
        return {
          label: setting.label || '',
          key: setting.key,
          type: 'input',
          value: sharedSettings[setting.key] ??  pluginSettings[setting.key] ?? setting.default,
          description: setting.description,
        }
      case 'combo':
        return {
          label: setting.label || '',
          key: setting.key,
          type: 'combo',
          value: sharedSettings[setting.key] ??  pluginSettings[setting.key] ?? setting.default,
          options: setting.options,
          description: setting.description,
        }
      default:
        return {
          label: setting.label || '',
          key: setting.key || '',
          type: 'text',
          value: sharedSettings[setting.key] ??  pluginSettings[setting.key] ?? setting.default,
          description: setting.description,
        }
    }
  })
}
