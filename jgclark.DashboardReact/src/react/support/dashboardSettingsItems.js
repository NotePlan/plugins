// @flow
import type {TDropdownItem,TSharedSettings} from "../../types.js"


const settings = [
  {
    key: "heading0",
    type: 'header',
    label: "Dashboard Preferences and Settings (Not working yet)",
  },
  {
    key: "separateSectionForReferencedNotes",
    label: "Show referenced items in separate section?",
    tooltip: "Whether to show Today's open tasks and checklists in two separate sections: first from the daily note itself, and second referenced from project notes. The same also goes for Weekly/Monthly/Quarterly notes.",
    type: 'switch',
    default: false,
  },

  {
    key: "ignoreTasksWithPhrase",
    label: "Ignore items in calendar sections with this phrase",
    tooltip: "If set, open tasks/checklists with this word or tag will be ignored, and not counted as open or closed. This is useful for situations where completing the item is outside your control. Note: This doesn't apply to the Tag/Mention section, which has its own setting.",
    type: 'input',
    default: "#waiting",
  },
  {
    key: "ignoreFolders",
    label: "Folders to ignore when finding items",
    tooltip: "Comma-separated list of folder(s) to ignore when searching for open or closed tasks/checklists. This is useful where you are using sync'd lines in search results.",
    type: 'input',
    default: "@Archive, Saved Searches",
  },
  {
    key: "includeTaskContext",
    label: "Include context for tasks?",
    tooltip: "Whether to show the note link for an open task or checklist",
    type: 'switch',
    default: true,
  },
  {
    key: "autoAddTrigger",
    label: "Add dashboard auto-update trigger when dashboard opened?",
    tooltip: "Whether to add the auto-update trigger to the frontmatter to the current note when the dashboard is opened",
    type: 'switch',
    default: false,
  },
  {
    key: "excludeTasksWithTimeblocks",
    label: "Exclude tasks that include time blocks?",
    tooltip: "Whether to stop display of open tasks that contain a time block",
    type: 'switch',
    default: false,
  },
  {
    key: "excludeChecklistsWithTimeblocks",
    label: "Exclude checklists that include time blocks?",
    tooltip: "Whether to stop display of open checklists that contain a time block",
    type: 'switch',
    default: false,
  },
  {
    key: "includeFolderName",
    label: "Include folder name?",
    tooltip: "Whether to include the folder name when showing a note link",
    type: 'switch',
    default: true,
  },
  {
    key: "maxTasksToShowInSection",
    label: "Max number of items to show in a section?",
    tooltip: "The Dashboard isn't designed to show very large numbers of tasks. This gives the maximum number of items that will be shown at one time in the Overdue and Tag sections.",
    type: 'input',
    default: "30",
  },
  {
    key: "newTaskSectionHeading",
    label: "Section heading to add/move new tasks under",
    tooltip: "When moving an item to a different calendar note, or adding a new item, this sets the Section heading to add it under. (Don't include leading #s.) If the heading isn't present, it will be added at the top of the note. If this is left empty, then new tasks will appear at the top of the note.",
    type: 'input',
    default: "Tasks",
  },
  {
    key: "rescheduleNotMove",
    label: "Reschedule items in place, rather than move them?",
    tooltip: "When updating the due date on an open item in a calendar note, if set this will update its scheduled date in its current note, rather than move it.",
    type: 'switch',
    default: false,
  },
  {
    key: "useTodayDate",
    label: "Use 'today' to schedule tasks for today?",
    tooltip: "When scheduling a task for today, if this is set this will use '>today' to schedule the task; if it is not set it will use the current date.",
    type: 'switch',
    default: true,
  },
  {
    key: "dashboardTheme",
    label: "Theme to use for Dashboard",
    tooltip: "If this is set to a valid Theme name from among those you have installed, this Theme will be used instead of your current Theme. Leave blank to use your current Theme.",
    type: 'input',
    default: "",
  },
  {
    key: "separator1",
    type: 'separator',
  },
  {
    key: "heading1",
    type: 'heading',
    label: "Overdue Tasks section",
  },
  {
    key: "overdueSortOrder",
    label: "Sort order for Overdue tasks",
    tooltip: "The order to show the Overdue tasks: 'priority' shows the higher priority (from `>>`, `!!!`, `!!` and `!` markers), 'earliest' by earliest modified date of the note, or 'most recent' changed note.",
    type: 'combo',
    options: ["priority", "earliest", "most recent"],
    default: "priority",
  },
  {
    key: "updateOverdueOnTrigger",
    hidden: true,
    label: "Update Overdue section when triggered?",
    tooltip: "If true then the 'Overdue' section will be updated even when the update comes from being triggered by a change to the daily note.",
    type: 'switch',
    default: true,
  },
  {
    key: "separator2",
    type: 'separator',
  },
  {
    key: "heading2",
    type: 'heading',
    label: "Tag/Mention section",
  },
  {
    key: "tagToShow",
    label: "#tag/@mention to show",
    tooltip: "If this is set as a #hashtag or @mention, then all open tasks that contain it are shown in a separate section. This is a good way to show all `#next` actions, for example. Further, this can be used to turn this into a 'deferred' section, by setting the tag to show here the same tag that is also set to be ignored in the calendar sections above. Note: This is limited to a single hashtag or mention for speed, and it can show tasks duplicated from other sections.",
    type: 'input',
    default: "",
  },
  {
    key: "ignoreTagMentionsWithPhrase",
    label: "Ignore items in this section with this phrase",
    tooltip: "Open tasks/checklists in this section will be ignored if they include this phrase.",
    type: 'input',
    default: "",
  },
  {
    key: "updateTagMentionsOnTrigger",
    hidden: true,
    label: "Update items in this section when triggered?",
    tooltip: "If true then the 'Tag/Mention' section will be updated even when the update comes from being triggered by a change to the daily note.",
    type: 'switch',
    default: true,
  },
  {
    key: "autoUpdateAfterIdleTime",
    label: "How long after Dashboard window is idle should it update?",
    tooltip: "When the value in this field is a non-zero number, then the Dashboard will update after the window is idle for that many minutes.",
    type: 'input',
    default: "5",
  },
]

export const createDashboardSettingsItems = (sharedSettings: TSharedSettings, pluginSettings: TAnyObject  ): Array<TDropdownItem> => {
  return settings.map(setting => {
    switch (setting.type) {
      case 'separator':
      case 'heading':
      case 'header':
        return {
          label: setting.label || '',
          key: setting.key,
          type: 'header',
        }
      case 'switch':
        return {
          label: setting.label || '',
          key: setting.key,
          type: 'switch',
          checked: sharedSettings[setting.key] ?? pluginSettings[setting.key] ?? setting.default,
          tooltip: setting.tooltip,
        }
      case 'input':
        return {
          label: setting.label || '',
          key: setting.key,
          type: 'input',
          value: sharedSettings[setting.key] ??  pluginSettings[setting.key] ?? setting.default,
          tooltip: setting.tooltip,
        }
      case 'combo':
        return {
          label: setting.label || '',
          key: setting.key,
          type: 'combo',
          value: sharedSettings[setting.key] ??  pluginSettings[setting.key] ?? setting.default,
          options: setting.options,
          tooltip: setting.tooltip,
        }
      default:
        return {
          label: setting.label || '',
          key: setting.key,
          type: 'text',
          value: sharedSettings[setting.key] ??  pluginSettings[setting.key] ?? setting.default,
          tooltip: setting.tooltip,
        }
    }
  })
}
