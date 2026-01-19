# Todoist Noteplan Sync Plugin

## Latest Updates

See [CHANGELOG](https://github.com/NotePlan/plugins/blob/main/dbludeau.TodoistNoteplanSync/CHANGELOG.md) for latest updates/changes to this plugin.

## About
Commands to sync tasks in Todoist to Noteplan.  Todoist has great quick entry capabilities for all platforms and now you can leverage that to quickly get your thoughts to Noteplan.  You do not need to be on an Apple product or have Noteplan open to quickly add a task anymore.  Todoist has an excellent API that allows for easy integration.  This will work with both the free and paid version of Todoist (I have not paid and was able to do everything in this plugin). 

### Current Sync Actions
NOTE: All sync actions (other then content and status) can be turned on and off in settings.  Everything not in this list such as task descriptions, location reminders and times will be ignored (dates can be synced, but times will be ignored).
- From Todoist to Noteplan
    - Task content
    - Due date
    - Priority
    - Status (open/closed)
    - Tags
- From Noteplan to Todoist
    - Status (open/closed)


## Available Commands
- **/todoist sync everything** (alias **/tosa**): sync everything in Todoist to a folder in Noteplan.  Every list in todoist will become a note in Noteplan.  Use this if you want to use Todoist just as a conduit to get tasks into Noteplan.  The folder used in Noteplan can be configured in settings.
- **/todoist sync today** (alias **/tost**): sync tasks due today from Todoist to your daily note in Noteplan. A header can be configured in settings.
- **/todoist sync project** (alias **/tosp**): link a single list from Todoist to a note in Note plan using frontmatter.  This command will sync the current project you have open. You can optionally add a date filter argument:
  - `/todoist sync project today` - only tasks due today
  - `/todoist sync project overdue` - only overdue tasks
  - `/todoist sync project current` - overdue + today (same as default setting)
- **/todoist sync all projects** (alias **/tosa**): this will sync all projects that have been linked using frontmatter.
- **/todoist sync all projects and today** (alias **/tosat** **/toast**): this will sync all projects and the today note.  Running it as one comand instead of individually will check for duplicates.  This command will sync all tasks from projects to their linked note, including tasks due today.  It will sync all tasks from all projects in Todoist that are due today except for those already in the project notes to avoid duplication.

## Configuration
- This plug in requires an API token from Todoist.  These are available on both the free and paid plans. To get the token follow the instructions [here](https://todoist.com/help/articles/find-your-api-token)
- You can configure a folder to use for syncing everything, headings that tasks will fall under and what details are synced.
- Sections in Todoist will become headers in Noteplan.  See [here](https://todoist.com/help/articles/introduction-to-sections) to learn about sections in Todoist.
- Currently the API token is required, everything else is optional.

### Project Date Filter
By default, project sync commands only fetch tasks that are **overdue or due today**. This keeps your notes focused on actionable items. You can change this behavior in settings:

| Filter Option | Description |
|---------------|-------------|
| `all` | Sync all tasks regardless of due date |
| `today` | Only tasks due today |
| `overdue \| today` | Tasks that are overdue or due today (default) |
| `3 days` | Tasks due within the next 3 days |
| `7 days` | Tasks due within the next 7 days |

This setting affects the following commands:
- `/todoist sync project`
- `/todoist sync all linked projects`
- `/todoist sync all linked projects and today` (project portion only)
- `/todoist sync everything`

Note: The `/todoist sync today` command always filters by today regardless of this setting.

### Linking a Todoist Project
To link a Todoist list to a Noteplan note, you need the list ID from Todoist. To get the ID, open www.todoist.com in a web browser and sign in so you can see your lists. Open the list you want to link to a Noteplan note. The list ID is at the end of the URL. For example, if the end of the Todoist.com URL is /app/project/2317353827, then you want the list ID of 2317353827.

Add frontmatter to the top of your note (see https://help.noteplan.co/article/136-templates for more information on frontmatter):
```
---
todoist_id: 2317353827
---
```

### Per-Note Date Filter
You can override the default date filter for a specific note by adding `todoist_filter` to the frontmatter:
```
---
todoist_id: 2317353827
todoist_filter: current
---
```

Valid values for `todoist_filter`: `all`, `today`, `overdue`, `current` (same as overdue | today), `3 days`, `7 days`

**Filter Priority:**
1. Command-line argument (e.g., `/todoist sync project today`) - highest
2. Frontmatter `todoist_filter` - second
3. Plugin settings "Date filter for project syncs" - default

## Caveats, Warnings and Notes
- All synced tasks in Noteplan rely on the Todoist ID being present and associated with the task.  This is stored at the end of a synced task in the form of a link to www.todoist.com.
  - These links can be used to view the Todoist task on the web.
  - WARNING: if the link is modified or deleted, the ability to sync will be lost.
- There is no automated clean up of completed tasks in Noteplan.  They are just marked as completed.  We can see what people think is best and enhance clean up in the future.
- Subtasks in Todoist will show up as first level tasks in Noteplan.  This can probably be fixed in an update if there is enough interest.
- As of version 0.3.0 this plugin should work if you are on a Todoist Teams plan.  NOTE: this has not been extensively tested.


## Coming Next
- Possible detailed sync back to Todoist.  Currently will only sync closed (or cancelled) status. If demand is there, can sync back changes in priorities, due dates, tags. Will need to have a setting to decide which application is the source of truth.
