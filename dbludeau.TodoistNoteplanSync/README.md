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
- **/todoist sync project** (alias **/tosp**): sync Todoist projects to the current note. Projects can be specified via frontmatter OR inline arguments:
  - Using frontmatter (see Configuration section below)
  - Using inline project names: `/todoist sync project "Project Name"`
  - With date filter: `/todoist sync project today` or `/todoist sync project "Project Name" today`
- **/todoist sync all projects** (alias **/tosa**): this will sync all projects that have been linked using frontmatter.
- **/todoist sync all projects and today** (alias **/tosat** **/toast**): this will sync all projects and the today note.  Running it as one comand instead of individually will check for duplicates.  This command will sync all tasks from projects to their linked note, including tasks due today.  It will sync all tasks from all projects in Todoist that are due today except for those already in the project notes to avoid duplication.

### Global Sync By Project Commands

These commands sync tasks across ALL your Todoist projects based on a date filter, organizing the results by project name and section. No frontmatter required—just run the command on any note.

| Command | Alias | What it syncs |
|---------|-------|---------------|
| **/todoist sync today by project** | tostbp | Only tasks due today (API semantics: excludes overdue) |
| **/todoist sync overdue by project** | tosobp | Only overdue tasks |
| **/todoist sync current by project** | toscbp | Today + overdue (like Todoist UI "Today" view) |
| **/todoist sync week by project** | toswbp | Tasks due within 7 days (excludes overdue) |

**Example output:**
```markdown
### Project A
- task 1 from Project A

#### Section Name
- task 2 in section

### Project B
- task 3 from Project B
```

These commands respect your plugin settings for:
- Project heading format (##, ###, ####, Horizontal Rule, or No Separator)
- Section heading format (###, ####, #####, or **bold**)
- Prefix settings (blank lines, horizontal rules before headings)

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

### Specifying Todoist Projects

There are three ways to specify which Todoist projects to sync:

#### Option 1: Inline Project Names (Simplest)

Pass project names directly to the sync command—no frontmatter needed:

```
/todoist sync project "ARPA-H"
/todoist sync project "ARPA-H, Personal, Work"
/todoist sync project "ARPA-H" today
```

**Multiple projects with commas in names:** Use quotes around names that contain commas:

```
/todoist sync project "ARPA-H, \"Work, Life Balance\", Personal"
```

This uses standard CSV parsing:
- Simple names are comma-separated: `"ARPA-H, Personal, Work"`
- Names containing commas are quoted: `"\"Work, Life Balance\""`
- Mixed: `"ARPA-H, \"Work, Life\", Personal"`

#### Option 2: Frontmatter with Project Names

Add project names to frontmatter for persistent configuration:

```
---
todoist_project_name: ARPA-H
---
```

Or multiple projects:
```
---
todoist_project_names:
  - ARPA-H
  - Personal
  - Work
---
```

#### Option 3: Frontmatter with Project IDs (Legacy)

To link a Todoist list to a Noteplan note using IDs, you need the list ID from Todoist. To get the ID, open www.todoist.com in a web browser and sign in so you can see your lists. Open the list you want to link to a Noteplan note. The list ID is at the end of the URL. For example, if the end of the Todoist.com URL is /app/project/2317353827, then you want the list ID of 2317353827.

Add frontmatter to the top of your note (see https://help.noteplan.co/article/136-templates for more information on frontmatter):
```
---
todoist_id: 2317353827
---
```

**Priority order:** When syncing, the plugin checks in this order:
1. Inline project names (command argument)
2. Frontmatter `todoist_project_name` / `todoist_project_names`
3. Frontmatter `todoist_id` / `todoist_ids`

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

### Multiple Projects Per Note

You can sync multiple Todoist projects to a single note using `todoist_ids` (note the plural):

```
---
todoist_ids: ["2317353827", "2317353828"]
---
```

Tasks from each project will sync in the order specified. You can configure how projects are visually separated in the plugin settings.

| Separator Option | Result |
|-----------------|--------|
| `## Project Name` | Large heading with project name |
| `### Project Name` | Medium heading with project name (default) |
| `#### Project Name` | Small heading with project name |
| `Horizontal Rule` | A `---` line between projects |
| `No Separator` | No visual separation between projects |

You can also configure how Todoist sections appear within each project:

| Section Format | Result |
|---------------|--------|
| `### Section` | Large heading |
| `#### Section` | Medium heading (default) |
| `##### Section` | Small heading |
| `**Section**` | Bold text (not a heading) |

Example with `### Project Name` and `#### Section`:

```
### Home                    ← Project heading (###)
- task without section
#### Backlog                ← Section heading (####)
- task in Backlog
#### In Progress
- task in progress

### Work                    ← Next project
- another task
```

Note: The single `todoist_id` format still works for backward compatibility. You can also use `todoist_id` with a JSON array: `todoist_id: ["id1", "id2"]`.

### Combining Date Filter with Multiple Projects

You can use both features together:

```
---
todoist_ids: ["2317353827", "2317353828"]
todoist_filter: 7 days
---
```

This will sync tasks from both projects, but only those due within the next 7 days.

### Embedding Sync Calls in Notes

You can embed clickable sync commands directly in your notes without using frontmatter.

#### Template Tags (np.Templating)

Use array syntax for the cleanest approach—no escaping needed for names with commas:

```
<%- await DataStore.invokePluginCommandByName("todoist sync project", "dbludeau.TodoistNoteplanSync", [["ARPA-H", "Personal"], "today"]) -%>
```

More examples:
```
// Single project, no filter (uses settings default)
<%- await DataStore.invokePluginCommandByName("todoist sync project", "dbludeau.TodoistNoteplanSync", [["ARPA-H"]]) -%>

// Multiple projects with filter
<%- await DataStore.invokePluginCommandByName("todoist sync project", "dbludeau.TodoistNoteplanSync", [["ARPA-H", "Personal", "Work"], "7 days"]) -%>

// Project names containing commas - no escaping needed with array syntax
<%- await DataStore.invokePluginCommandByName("todoist sync project", "dbludeau.TodoistNoteplanSync", [["ARPA-H", "Work, Life Balance"], "today"]) -%>
```

#### X-Callback-URL Links (Clickable)

For clickable links in note content, use x-callback-urls with CSV syntax:

```markdown
[Sync ARPA-H and Personal (today)](noteplan://x-callback-url/runPlugin?pluginID=dbludeau.TodoistNoteplanSync&command=todoist%20sync%20project&arg0=ARPA-H%2C%20Personal&arg1=today)
```

More examples:
```markdown
// Single project with filter
[Sync ARPA-H](noteplan://x-callback-url/runPlugin?pluginID=dbludeau.TodoistNoteplanSync&command=todoist%20sync%20project&arg0=ARPA-H&arg1=today)

// Multiple projects with filter
[Sync All Projects](noteplan://x-callback-url/runPlugin?pluginID=dbludeau.TodoistNoteplanSync&command=todoist%20sync%20project&arg0=ARPA-H%2C%20Personal%2C%20Work&arg1=7%20days)
```

**Note:** URL values must be percent-encoded (space = `%20`, comma = `%2C`).

**Available filters:** `today`, `overdue`, `current`, `3 days`, `7 days`, `all`

**Tip:** Use the **np.CallbackURLs** plugin's `/Get X-Callback-URL` command to generate these URLs without manual encoding.

## Caveats, Warnings and Notes
- All synced tasks in Noteplan rely on the Todoist ID being present and associated with the task.  This is stored at the end of a synced task in the form of a link to www.todoist.com.
  - These links can be used to view the Todoist task on the web.
  - WARNING: if the link is modified or deleted, the ability to sync will be lost.
- There is no automated clean up of completed tasks in Noteplan.  They are just marked as completed.  We can see what people think is best and enhance clean up in the future.
- Subtasks in Todoist will show up as first level tasks in Noteplan.  This can probably be fixed in an update if there is enough interest.
- As of version 0.3.0 this plugin should work if you are on a Todoist Teams plan.  NOTE: this has not been extensively tested.


## Coming Next
- Possible detailed sync back to Todoist.  Currently will only sync closed (or cancelled) status. If demand is there, can sync back changes in priorities, due dates, tags. Will need to have a setting to decide which application is the source of truth.
