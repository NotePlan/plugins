# 🎛 Dashboard plugin
<img alt="Example of Dashboard window" src="Dashboard-0.6.0@2x.png" />

This plugin provides a **dashboard window** that in one place shows a compact list of:
- open tasks and checklists from today's note
- scheduled open tasks and checklists from other notes to today
- similarly for yesterday's note, and the weekly, monthly and quarterly notes too (if used)
- all overdue tasks
- all open tasks and checklists that conain a particular @tag or #mention of your choosing. This gives "deferred date" functionality (see below).
- next few notes to review (if you use the "Projects and Reviews" plugin)

To open this run the **/show dashboard** command (aliases 'db' or 'sdb').  There are many different [Settings](#settings) to tailor what is shown according to your preferences.

[<img width="120px" alt="Buy Me A Coffee" src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg">](https://www.buymeacoffee.com/revjgc)

## Interacting with items in the Dashboard
All tasks and checklists shown in the Dashboard view can be marked as **complete** by clicking in its usual open circle or square:
<img width="400px" src="complete+cancel.gif" border="1pt solid" margin="8px" alt="example of completing or cancelling a task"/>
The item is then completed in the NotePlan note, and removed from view in this list. You can also **cancel** the item by pressing **⌘ (command button)** when clicking on the open circle or square.

<img src="action-buttons-0.7.3@2x.png" width="330px" border="1pt solid" margin="8px" alt="action buttons" />
After a short time hovering over a task or checklist item a small box appears with a number of '**action buttons**' (not all are relevant for all tasks):

- `→today` moves to today's note
- `+1d` moves to the next day's note
- `+1b` moves to the next business day's note (which ignores weekends)
- `+1w` moves to next week's note etc.
- `→wk` moves to this week's note
- `→mon` moves to this month's note
- `pri` cycles the priority of the current item from none -> `!` -> `!!` -> `!!!` -> `>>` -> none
- `◯/◻︎` toggles an item between being a task and a checklist
- `≯` 'unschedules a task (i.e. removes any `>date`). Note: only relevant on tasks in Project notes.
- `✓then` completes an overdue task, but marks it `@done(...)` at the original time, not today.

<img src="add-buttons@2x.png" align="right" width="170px" alt="add buttons" />On the daily/weekly/monthly sections there are 'add task' and 'add checklist' icons, to allow you to add a task directly at the start of that current note:

Other notes:
- _This requires the separate 'Shared Resources' plugin to be installed_.
- The Dashboard doesn't use NotePlan's normal editor, but a more flexible HTML-based display. Behind the scenes it cleverly translates your current NotePlan theme into its CSS equivalent. (You're welcome.)
- The plugin cannot work effectively on an **iPhone**-sized device, so it is disabled there.  On an **iPad** windows can't float in the same way as they can on macOS, so it's less useful, but it still works.
- When the window is wide enough, it will display with 2 (or even 3!) columns.
- It de-dupes items that would appear twice in a list where the lines are sync'd together.
- There's a UI toggle "Filter out lower-priority items?". If this is on, then items without any extra priority in calendar files will be hidden until there are no remaining priority items that haven't been completed. Priority items are currently indicated by having `>>`, `!!!``, `!!`` or `!`` at the beginning of the item.
- you can use the '#Tags' section to create a "deferred date" function. To do this tag something as (for example) `#next` and then date it with a day in the future.On that future date, it will show up in this `#next` section. (Thanks to @george65 for spottig this use case.)
- If you use the [Projects & Reviews Plugin](https://github.com/NotePlan/plugins/tree/main/jgclark.Reviews), the Dashboard will show up to the first 4 projects ready for review. It reads this from the hidden list thats updated every time its **/project lists** command is run, or you **/finish project review** on a project note.  
The equivalent 'action buttons' in the Project section all do the equivalent of the "/skip project review" command, that overrides (or skips) the normal review interval by the duration given. This adds a `@nextReview(...)` to the note's metadata. See [Project + Reviews documentation](../jgclark.Reviews/README.md) for more details.


### Updating the Dashboard automatically
The dashboard window can automatically update when a change is made in the relevant calendar note(s) if you have [added a trigger to the frontmatter](https://help.noteplan.co/article/173-plugin-note-triggers) of the relevant daily/weekly/monthly/quarterly note(s). To get this added automatically to the daily note, turn on setting 'Add dashboard auto-update trigger when dashboard opened?' (details below).

Or you can use the **/add trigger to note** command from my [Note Helpers plugin](https://github.com/NotePlan/plugins/tree/main/jgclark.NoteHelpers/) which adds this:
```yaml
---
triggers: onEditorWillSave => jgclark.Dashboard.decideWhetherToUpdateDashboard
---
```

Note: If you use the 'Overdue Tasks' section, this can add some delay before the dashboard window is updated if you have hundreds of overdue tasks 🥺. So this section is deliberately not updated when a trigger has fired. In practice this shouldn't matter, as editing your daily note won't change any overdue tasks.

## Configuration Settings
This requires the **Shared Resources** plugin to be installed as well, to work and display properly. The Dashboard should automatically offer to install it if it isn't already.

These settings change some of how it displays:
- Show referenced items in separate section? Whether to show Today's open tasks and checklists in two separate sections: first from the daily note itself, and second referenced from project notes. The same also goes for Weekly/Monthly/Quarterly notes.
- Ignore checklist items? If set, only tasks are included in any of the sections.
- Ignore items with this phrase: If set, open tasks/checklists with this word or tag will be ignored, and not counted as open or closed. This is useful for situations where completing the item is outside your control.
- Folders to ignore when finding linked items: If set, the contents of these folder(s) will be ignored when searching for open or closed tasks/checklists. This is useful where you are using sync'd lines in search results. Default: "@Archive, Saved Searches"
- Include context for tasks? Whether to show the note link for an open task or checklist
- Add dashboard auto-update trigger when dashboard opened?: Whether to add the auto-update trigger to the frontmatter to the current note when the dashboard is opened.
- Exclude tasks that include time blocks?: : Whether to stop display of open tasks that contain a time block.
- Exclude checklists that include time blocks?: Whether to stop display of open checklists that contain a time block.
- Include folder name? Whether to include the folder name when showing a note link
- Theme to use for Dashboard: If this is set to a valid Theme name from among those you have installed, this Theme will be used instead of your current Theme. Leave blank to use your current Theme.
- Show section for Yesterday? Allows this to be always turned on/off.
- Show section for Week? Allows this to be always turned on/off.
- Show section for Overdue tasks?: If true then an 'Overdue' section is added, and the following 2 settings will be used.\nNote: if set, then for performance reasons, this section will not be shown when a refresh is triggered automatically by a change in today's note. (Default: false)
- Max number of items to show in section?: The Dashboard isn't designed to show very large numbers of tasks. This gives the maximum number of items to show in the Overdue and Tag sections. (Default: 30)
- Sort order for Overdue tasks: The order to show the Overdue tasks: 'priority' shows the higher priority (from `>>`, `!!!`, `!!` and `!` markers), 'earliest' by earliest modified date of the note, or 'most recent' changed note. (Default: 'priority')
- #tag/@mention to show: (if set) will show all open tasks/checklists that include this #tag or @mention. It ignores tasks that are scheduled to the future. This is one way of showing all `#next` actions, for example.

## Known Issues
- Some open tasks referenced to weekly notes can be missing. A bug report has been raised on the underlying NotePlan app about this.
- In multi-column mode the open circle or square can be split apart from its text. I'm looking for a work-around to this HTML layout bug.
- Items can appear in the Overdue section as well as the other sections. This is correct, but I'm looking for a way to suppress the duplicate in the Overdue section.

## Support
If you find an issue with this plugin, or would like to suggest new features for it, please raise an ['Issue' of a Bug or Feature Request](https://github.com/NotePlan/plugins/issues).

I'm not part of the NotePlan team, but I've spent at least 3 working weeks on this particular plugin. So if you would like to support my late-night hobby extending NotePlan through writing these plugins, you can through:

[<img width="200px" alt="Buy Me A Coffee" src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg">](https://www.buymeacoffee.com/revjgc)

Thanks!

## History
Please see the [CHANGELOG](CHANGELOG.md).
