# 🎛 Dashboard plugin
<img alt="Example of Dashboard window" src="dashboard-medium-2.0.0.png" width="700px"/>

This plugin provides a **dashboard window** for your NotePlan data that in one place shows a compact list of:
- open tasks and checklists from today's note
- scheduled open tasks and checklists from other notes to today
- similarly for yesterday's note, tomorrow's note, this week's and last week's notes, and monthly and quarterly notes too (if used)
- all open tasks and checklists that contain a particular  `#tags` or `@mention`s of your choosing. This can give "deferred date" functionality (see below).
- all overdue tasks
- all open items with an added priority
- the next Project notes ready to review (if you use the "Projects and Reviews" plugin)
- and at the start it shows any currently-active time block you've set.

... and then gives you many controls, mostly in an "edit dialog", that let you quickly complete, cancel or move items to different time periods.

Here's a [great video from user George Crump](https://youtu.be/_lj8osSOvQc) that shows v2.0 in action, and how he lives in the Dashboard throughout his day:

[<img width="500px" alt="thumbnail" src="./dashboard-v2-GC-video-title.jpeg">](https://youtu.be/_lj8osSOvQc)

To open this run the **/show dashboard** command (aliases 'db' or 'sdb'). It automatically picks up the Theme from NotePlan and mimics it as far as possible (you're welcome).

From v2, the top right has icons for two menus: 
- a **Filter menu** that allows quick access to what sections are shown, and some other display toggles:
    
    <img width="300px" src="filter-menu-2.1.0.png" border="1pt solid" margin="8px" alt=""/>

- a **Settings menu** -- see [Settings](#settings) for more details about these more complex settings.

[<img width="150px" alt="Buy Me A Coffee" src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg">](https://www.buymeacoffee.com/revjgc)

_This Plugin requires the separate 'Shared Resources' plugin to be installed._

## Perspectives (new in v2.1)
A 'Perspective' is a named set of all your Dashboard settings, including which folders to include/ignore, and which sections to show. Each 'Perspective' has a name, and can be updated and deleted. The '-' Perspective is a default (which can't be deleted).

To change between the various Perspectives click on this dropdown menu:

<img src="perspectives-selector-2.1.0.png" width="300px" margin="8px" alt="perspectives selector" />

Use the Settings dialog to change your settings for the current perspective. When it notices you've changed something, it adds a `*` to the end of the perspective name. To update the definition of this perspective, select 'Save Perspective' from the dropdown menu.

## Interacting with items in the Dashboard
All tasks and checklists shown in the Dashboard view can be marked as **complete** by clicking in its usual open circle or square.  The item is then completed in the NotePlan note, and removed from view in this list. You can also **cancel** the item by pressing **⌘ (command)** button when clicking on the open circle or square.

<!-- TODO: <img width="400px" src="complete+cancel-2.0.0.gif" border="1pt solid" margin="8px" alt="example of completing or cancelling a task"/> -->

You can make many more changes by clicking on the **pencil** icon after each task. A dialog box pops up with many **action buttons**:

<img src="task-dialog-2.0.0.png" width="600px" margin="8px" alt="task & checklist action buttons" />

- `today` moves to today's note
- `+1d` moves to the next day's note
- `+1b` moves to the next business day's note (which ignores weekends)
- `+1w` moves to next week's note etc.
- `this week` moves to this week's note etc.
- `🗓️` moves to any date you choose, via a date picker
- `Cancel` cancels the task/checklist
- `Move to note` opens the command bar asking which note + heading you want to move this item to
- `↑ Priority` increases the priority of the current item (i.e. the start of the underlying item goes from none -> `!` -> `!!` -> `!!!` -> `>>`)
- `↓ Priority` decreases the priority of the current item (i.e. the start of the underlying item goes from none -> `!` -> `!!` -> `!!!` -> `>>`)
- `Change to ◯/◻︎` toggles an item between being a task and a checklist
- `Complete Then` completes an overdue task, but marks it `@done(...)` on the _original_ due date, not today.
- `Unschedule` unschedules a task (i.e. removes any `>date`).

You can also update the text of the item itself, which is saved whenever you press the `Update` button (or any of the other action buttons). You can press `ESC` key to close the dialog, or click on the `X` button.

### Interactive Processing
In sections with more than 1 item, a `>> N` button is available (where `N` is the number of items). This brings up the above dialog, but in 'interactive processing' mode, with extra buttons in the header to move forward (or backward) between the items. This allows you to more quickly go through a set of items, and take different actions for each one.

Notes:
- you can break out from the sequence at any time by closing the dialog.
- at the moment this only processes tasks that are currently shown -- so it won't process any ones of lower priority that you have hidden.
- there are 3 settings that control aspects of this in the Dashboard Settings dialog.

### Add Task/Checklist items
<img src="add-buttons-2.1.0.png" align="right" width="200px" alt="add buttons" />On the daily/weekly/monthly sections there are 'add task' and 'add checklist' icons, to allow you to add a task directly at the start of that current note. A second pair adds tasks and checklists but to the *next* day/week/month.

### 'All → ...' Move buttons
Some sections have "All →  ..." buttons. They move all the items in that section to the destination (e.g. from Today to Tomorrow's daily note), including any hidden as lower-priority items. If there are more than 20 items to move, then (on macOS) it will first check whether you want to proceed.

Note: _Please be careful with this_: NotePlan doesn't provide a proper Undo/Redo mechanism for plugins, and so these Move operations can't easily be undone. If you do need to do so, then you'll need to use the 'Versions' feature on all the notes the tasks were moved from and to.

## Other notes about the Dashboard display
The Dashboard uses a flexible HTML-based display, that's entirely different technology from NotePlan's editors. Behind the scenes it cleverly translates your current NotePlan theme into its CSS equivalent. (You're welcome.)

The display is **responsive**: change the width of the window, and it will change from narrow to normal to multi-column layout. Note: some of the buttons are hidden when running on iOS or iPadOS because of limitations in the environment the Dashboard runs in. We are hopeful these will be removed in time.

The items are shown **sorted** first by increasing time (where there is a time block), then by decreasing priority. And it **de-duplicates** items that would appear twice in a list where the lines are sync'd together.

There's a UI toggle "**Filter out lower-priority items?**". If this is on, then items without any extra priority in calendar files will be hidden until there are no remaining priority items that haven't been completed. Priority items are currently indicated by having `>>`, `!!!`, `!!` or `!` at the beginning of the item.

The top bar has a **count of tasks done today** (apart from on narrow windows and on iOS). This includes all those completed in project notes, not just from the calendar sections shown. Note: this requires having the NotePlan setting 'Todo > Append Completion Date' setting turned on, as otherwise we can't tell when a task is finished. (As @done(...) dates don't get appended to completed checklists, it's not possible to count completed checklists.) When you complete a task in a project note, it will be included the next time the Dashboard is refreshed, automatically on manually.

The display will **automatically refresh** in the background if you set the "Automatic Update frequency" to any number > 0. This number is the number of minutes after the window is idle when it will refresh the sections you want to display. You can also press the 'Refresh' button at any point, and/or you can set a trigger (see below).

### Current Time Block section
[Time blocks in NotePlan](https://help.noteplan.co/article/121-time-blocking) are a helpful way to help you plan your days. If you define some, they appear in the calendar sidebar.  If the current time is within a time block, then this section appears at the top of the Dashboard:

<img src="timeblock-section-2.1.0.a15.png" width="800px" margin="8px" alt="project action buttons" />

It always shows the time range first, minus any 'Text must contain' string that you have set in NP's 'Todo' settings pane. Where a time block is defined on a heading or list item, then the calendar+clock icon is shown in place of the task/checklist icon.

### #tag/@mention sections
The "#tag/@mention Section" will show all open tasks/checklists that include this #tag or @mention. This is a good way of showing all `#next` actions, for example. Further, this can be used to turn this into a 'deferred' section, by setting the tag to show here the same tag that is also set to be ignored in the calendar sections above.

You can use the '#Tags' section to create a "deferred date" function. To do this tag something as (for example) `#next` and then schedule it with a day in the future.On that future date, it will show up in this `#next` section. (Thanks to @george65 for spotting this use case.)

### Project section
If you use the [Projects & Reviews Plugin](https://github.com/NotePlan/plugins/tree/main/jgclark.Reviews), the Dashboard will show up the projects ready for review. It reads this from the hidden list that's updated every time its **/project lists** command is run, or you **/finish project review** on a project note.  

<img src="project-dialog-2.0.0.png" width="800px" margin="8px" alt="project action buttons" />

The 'action buttons' available in this section are:
- `Finish Review` does the equivalent of the "/finish review" command, marking that project as @reviewed today.
- the various `Skip ...` buttons do the equivalent of the "/skip project review" command, that override (or skips) the normal review interval by the duration given. This adds a `@nextReview(...)` to the note's metadata. See [Project + Reviews documentation](../jgclark.Reviews/README.md) for more details.
- `🗓️` skips  to any date you choose, via a date picker
- "Complete", "Cancel" and "Pause" Project buttons, that each mimic the same command from the Project & Reviews plugin
- shows the latest 'Progress' comment for a project, and an `Add` button to add a new progress comment.

The 'Start Reviews' button does the same as the button of the same name in the Project & Reviews plugin, and is the equivalent of its **/start reviews** command. See the documentation for how that works, and which commands to follow it with once you've done reviewed the note.

### Priority section
Note: this is likely to be very slow to generate, as it can't use any of NotePlan's internal caches.

## Configuration Settings
Dashboard v2 provides a quicker-to-access Settings window, accessed from the cog wheel at the top right of the dashboard window. (This replaces the normal method of going to the NotePlan Preference Pane, and finding the right Plugin.)  It is broken up in to a number of different sections.

<img width="550px" src="settings-dialog-2.1.0.png" alt="Settings dialog"/>

The 3 key settings in "What to Include and Exclude" section control what folders and items are included and excluded in Dashboard's many sections. It includes the folders from the first setting, and then removes any specified from the next setting. Finally, individual lines in notes can be ignored by adding terms to the third setting:

- Folders to Include: Comma-separated list of folder(s) to include when searching for open or closed tasks/checklists. The matches are partial, so 'Home' will include 'Home' and 'The Home Areas' etc. If left blank, all folders are included.
- Folders to Exclude: Comma-separated list of folder(s) to ignore when searching for open or closed tasks/checklists. The matches are partial, so 'Work' will exclude 'Work' and 'Work/CompanyA' etc. To ignore notes at the top-level (not in a folder), include '/' in the list. (@Trash is always ignored, but other special folders need to be specified, e.g. @Archive, @Templates.)
- Ignore items in notes with these phrase(s): If set, open tasks/checklists with this word or tag will be ignored, and not counted as open or closed. (This check is not case sensitive.) This is useful for situations where completing the item is outside your control.
- Apply to sections under headings in Calendar notes? If turned on, then all content in Calendar notes under headings that contains any of those phrases will be ignored.

These settings change some of how it displays and behaves:
- Reschedule items in place, rather than move them?: When updating the due date on an open item in a calendar note, if set this will update its scheduled date in its current note, rather than move it.
  - Use simplified (re)scheduling method?: By default this is off, but if selected then the item simply has its `>date` updated in the note it is in. It does not show with the special 🕓 task icon, and a copy isn't added into the date its being scheduled to. (This is my much preferred way of operating, and avoids duplicating unfinished tasks in calendar notes.)
- Max number of items to show in a section?: The Dashboard isn't designed to show very large numbers of tasks. This gives the maximum number of items that will be shown at one time in the Overdue and Tag sections. (Default: 30)
- Section heading to add/move new tasks under: When moving an item to a different calendar note, or adding a new item, this sets the Section heading to add it under. If the heading isn't present, it will be added using the settings from the QuickCapture plugin (if installed).\nIf this is left empty, then new tasks will appear at the top of the note.
- Heading level for new Headings: level 1-5 to use when adding new headings in notes.
- Move sub-items with the item? If set, then indented sub-items of an item will be moved if the item is moved to a different note.
- Use '>today' to schedule tasks for today?: You can have tasks scheduled for today to use '>today' or the current date. If you use '>today', the task will automatically move to tomorrow if not completed. If you use the current date, the task will not automatically move and will show as an overdue task. 
- Show completed task count?: Show the number of tasks completed today at the top of the Dashboard. Note: For this to work, you need to have enabled "Append Completion Date" in the NotePlan Preferences/Todo section.
- Automatic Update frequency: If set to any number > 0, the Dashboard will automatically refresh your data when the window is idle for a certain number of minutes.
- Theme to use for Dashboard: If this is set to a valid Theme name from among those you have installed, this Theme will be used instead of your current Theme. Leave blank to use your current Theme.
- Show referenced items in separate section? Whether to show Today's open tasks and checklists in two separate sections: first from the daily note itself, and second referenced from project notes. The same also goes for Weekly/Monthly/Quarterly notes.
- Hide priority markers? Hide the '>>', '!!', '!', and '!!' priority markers (if your theme uses priorities markers).
- Show note link for tasks? Whether to show the note link for an open task or checklist.
- Show folder name in note link? Whether to include the folder name when showing a note link
- Show scheduled date for tasks? Whether to display scheduled >dates for tasks in dashboard view.
- Show parent markers on items? If set adds an ellipsis icon on items that have "children" (indented sub-items), whether they are also shown or not.
- Sort order for Overdue tasks: The order to show the Overdue tasks: 'priority' shows the higher priority (from `>>`, `!!!`, `!!` and `!` markers), 'earliest' by earliest modified date of the note, or 'most recent' changed note.
- #tag/@mention(s) to show: If this is set as a #hashtag or @mention, then all open tasks that contain it are shown in a separate section. This is a good way to show all `#next` actions, for example. Further, this can be used to turn this into a 'deferred' section, by setting the tag to show here the same tag that is also set to be ignored in the calendar sections above. May also be more than one, separated by a comma. NOTE: These tasks will only show up in their separate section, unless you have the 'Hide Duplicates' option turned OFF.
- Enable interactive processing for each section? If enabled, the Dashboard will display a button that will loop through all the open items in a given section and prompt you to act on them.
- Open note and highlight task when processing? If enabled, the Dashboard will open the note in the Editor and highlight the task in the note when it is processed. If this is turned, off, you can always open the note by clicking the task title in the dialog window
- Show interactive processing transitions? By default, interactive processing will show a shrink/grow transition between each item to be processed. You can turn these off if you prefer.

The Filter menu includes the following toggles:
- Include context for tasks? Whether to show the note link for an open task or checklist
- Exclude tasks that include time blocks?: Whether to stop display of open tasks that contain a time block. (This setting does _not_ apply to the 'Current time block' section.)
- Exclude checklists that include time blocks?: Whether to stop display of open checklists that contain a time block. (This setting does _not_ apply to the 'Current time block' section.)

Note: if you have more than 1 device running NotePlan, then all the settings are shared across your devices (apart from the logging settings).

### Updating the Dashboard automatically with a trigger
The dashboard window can automatically update when a change is made in the relevant calendar note(s) if you have [added a trigger to the frontmatter](https://help.noteplan.co/article/173-plugin-note-triggers) of the relevant daily/weekly/monthly/quarterly note(s). To get this added automatically to the daily note, turn on setting 'Add dashboard auto-update trigger when dashboard opened?' (details below).

Or you can use the **/add trigger to note** command from my [Note Helpers plugin](https://github.com/NotePlan/plugins/tree/main/jgclark.NoteHelpers/) which adds this:
```yaml
---
triggers: onEditorWillSave => jgclark.Dashboard.decideWhetherToUpdateDashboard
---
```

Note: If you use the 'Overdue Tasks' section, this can add some delay before the dashboard window is updated if you have hundreds of overdue tasks 🥺. So this section is deliberately not updated when a trigger has fired. In practice this shouldn't matter, as editing your daily note won't change any overdue tasks.

## Controlling from Shortcuts, Streamdeck etc.
There are number of 'callback's you can use to control the dashboard from shortcuts, command line, Streamdeck etc.  As these can be fiddly to set up, I recommend using the **/Make Callback from Current Settings** command to generate the appropriately encoded callback URL. This is copied to the clipboard ready to paste elsewhere.

The simplest **opens (or refreshes) the Dashboard**, using the `showDashboard` call:
```
noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=showDashboard
```

To open using a **specific named Perspective** use the `showPerspective` call. For example to start it in the 'Work' Perspective:
```
noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=showPerspective&arg0=Work
```
This can also be used when it is already open to _switch_ Perspective.

You can also **give a list of sections you want to see** use the `showSections` call. For example, to show the today, tomorrow + @home mentions:
```
noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=showSections&arg0=DT,DO,@home
```
Use `arg0=` followed by a comma-separated list of one or more of the following section codes:

| Section | Code | Section | Code |
| -------- | -------- | -------- | -------- |
| Today | `DT` | Yesterday | `DY` |
| Tomorrow | `DO` | Week | `W` |
| Month | `M` | Quarter | `Q` |
| Projects | `PROJ` | Overdue | `OVERDUE` |
| Items with Priority | `PRIORITY` | tags / mentions from your settings | `#tag` / `@mention` |
| Current Time Block | `TB` |

You can also **set a particular setting** using `setSetting` command:
```
noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=setSetting&arg0=<settingName>&arg1=<value>
```

Or you can **set multiple settings in one call**:
```
noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=setSetting&arg0=<settingName=value pairs separated by semicolons>
```

For the `setSetting` callbacks, the names of the possible settings (described above), and their types, are:

| Name | Type |
| -------- | -------- |
| separateSectionForReferencedNotes | true / false |
| filterPriorityItems | true / false |
| dashboardTheme | string |
| hideDuplicates | true / false |
| ignoreItemsWithTerms | string |
| ignoreChecklistItems | true / false |
| includedFolders | comma-separated values |
| excludedFolders | comma-separated values |
| includeFolderName | true / false |
| includeTaskContext | true / false |
| rescheduleNotMove | true / false |
| useLiteScheduleMethod | true / false |
| newTaskSectionHeading | string |
| newTaskSectionHeadingLevel | 1-5 |
| excludeChecklistsWithTimeblocks | true / false |
| excludeTasksWithTimeblocks | true / false |
| showYesterdaySection | true / false |
| showTomorrowSection | true / false |
| showWeekSection | true / false |
| showMonthSection | true / false |
| showQuarterSection | true / false |
| showOverdueSection | true / false |
| showPrioritySection | true / false |
| showProjectSection | true / false |
| maxItemsToShowInSection | number |
| overdueSortOrder | string |
| tagsToShow | string |
| useTodayDate | true / false |
| moveSubItems | true / false |
| enableInteractiveProcessing | true / false |
| interactiveProcessingHighlightTask | true / false |
| enableInteractiveProcessingTransitions | true / false |

## Team
I'm just a hobby coder, and not part of the NotePlan team, but I have spent at least 2 working months on this particular plugin. So if you would like to support my late-night hobby extending NotePlan through writing these plugins, you can through:

[<img width="200px" alt="Buy Me A Coffee" src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg">](https://www.buymeacoffee.com/revjgc)

David Wertheimer has contributed much knowledge and code to v2.0 onwards, which is a complete re-write using the React framework for Javascript.  George Crump has contributed many suggestions, bug reports, and several great explainer videos.  And of course, thanks to Eduard for continually improving NotePlan itself, and the APIs I've used to build my various Plugins.

Thanks, team!

## Support
The Dashboard requires the **Shared Resources** plugin to be installed as well, to work and display properly. The Dashboard should automatically offer to install it if it isn't already.

Do join the excellent Discord community around NotePlan, where the plugins and much more, is discussed and ideas shared. If you find an issue with this plugin, or would like to suggest new features for it, as well as commenting there you can raise an ['Issue' of a Bug or Feature Request on GitHub](https://github.com/NotePlan/plugins/issues).

iOS/iPadOS users: if you need support, and we ask for more logs, you can change the logging level by running the "/Change Logging levels" command. For technical reasons, this is not available through the main Settings menu inside the Dashboard.

## History
Please see the [CHANGELOG](CHANGELOG.md).
