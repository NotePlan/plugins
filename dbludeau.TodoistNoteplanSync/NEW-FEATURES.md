# Todoist NotePlan Sync - New Features & Improvements

This document summarizes all new features and improvements made to the Todoist NotePlan Sync plugin, relative to the upstream main branch. Each feature is a candidate for a pull request.

---

## New Commands

### 1. Date-Filtered Project Sync Commands
**Branch:** `feature/todoist-date-filter`

Four new commands to sync project tasks with specific date filters:

| Command | Alias | Scope | Description |
|---------|-------|-------|-------------|
| `/todoist sync project today` | `tospt` | Current note | Sync only tasks due today |
| `/todoist sync project overdue` | `tospo` | Current note | Sync only overdue tasks |
| `/todoist sync project current` | `tospc` | Current note | Sync overdue + today tasks |
| `/todoist sync project by name` | `tospn` | Current note | Interactive prompts for project names and filter |

**Use cases:**
- *"Show me just what's due today for this project"* → `tospt`
- *"What have I let slip? Show me overdue items"* → `tospo`
- *"What needs attention right now (overdue + today)?"* → `tospc`
- *"I want to pick which projects and date range to sync"* → `tospn`

### 2. "By Project" Commands for Current Note
**Branch:** `feature/todoist-date-filter`

Four new commands that sync tasks to the current note, organized by project headings:

| Command | Alias | Scope | Description |
|---------|-------|-------|-------------|
| `/todoist sync today by project` | `tostbp` | Current note | Today's tasks, grouped by project |
| `/todoist sync overdue by project` | `tosobp` | Current note | Overdue tasks, grouped by project |
| `/todoist sync current by project` | `toscbp` | Current note | Today + overdue, grouped by project |
| `/todoist sync week by project` | `toswbp` | Current note | Next 7 days, grouped by project |

**Use cases:**
- *"What do I need to work on today, across all projects?"* → `tostbp`
- *"Show me everything overdue, organized by project so I can prioritize"* → `tosobp`
- *"Give me a unified view of what needs attention now"* → `toscbp`
- *"What's my week look like across all projects?"* → `toswbp`

### 3. Convert to Todoist Task
**Branch:** `feature/convert-to-todoist-task`

| Command | Alias | Scope | Description |
|---------|-------|-------|-------------|
| `/todoist convert to todoist task` | `cttt`, `toct` | Selected text | Convert selected NotePlan tasks to Todoist Inbox tasks |

**Use case:** *"I created tasks in NotePlan but now want to track them in Todoist too"*

- Converts one or multiple selected tasks
- Creates tasks in Todoist Inbox with link back
- Replaces original task with Todoist-linked version
- Preserves subtasks (converts parent only)
- Parses NotePlan priority (`!!!`, `!!`, `!`) and due dates (`>YYYY-MM-DD`)

### 4. Status Sync Commands
**Branch:** `feature/sync-status-only`

| Command | Alias | Scope | Description |
|---------|-------|-------|-------------|
| `/todoist sync status` | `toss` | Current note | Sync completion status for current note only |
| `/todoist sync status all` | `tossa` | All linked notes | Sync completion status across all linked notes |

**Use cases:**
- *"I completed tasks in NotePlan, push that to Todoist"* → `toss`
- *"I completed tasks in Todoist, pull that into NotePlan"* → `toss`
- *"Sync completion status everywhere without re-syncing all tasks"* → `tossa`

Features:
- Bidirectional sync: NotePlan done → closes in Todoist; Todoist done → marks done in NotePlan
- No add/remove of tasks - only syncs completion state
- Reports summary: "Synced X task(s): N closed in Todoist, M marked done in NotePlan"

---

## New Settings

### Project Sync Settings
**Branch:** `feature/todoist-date-filter`, `feature/todoist-prefix-settings`

| Setting | Options | Default | Description |
|---------|---------|---------|-------------|
| `projectDateFilter` | all, today, overdue \| today, 3 days, 7 days | overdue \| today | Default date filter for project syncs |
| `projectSeparator` | ## / ### / #### Project Name, Horizontal Rule, No Separator | ### Project Name | How to separate multiple projects |
| `projectPrefix` | Nothing, Blank Line, Horizontal Rule, Blank Line + Horizontal Rule | Blank Line | What to insert before project titles |
| `sectionFormat` | ### / #### / ##### Section, **Section** | #### Section | Format for Todoist section headings |
| `sectionPrefix` | Nothing, Blank Line, Horizontal Rule, Blank Line + Horizontal Rule | Blank Line | What to insert before section headings |

**Use cases:**
- *"I only want to see actionable tasks, not the whole backlog"* → Set `projectDateFilter` to `overdue | today`
- *"I want cleaner visual separation between projects"* → Adjust `projectSeparator` and `projectPrefix`
- *"Todoist sections should be smaller headings than projects"* → Set `sectionFormat` to `#### Section`

---

## New Frontmatter Options

### Multi-Project Support
**Branch:** `feature/todoist-multi-project`

**Use case:** *"I have a NotePlan note for 'Q1 Goals' that pulls from multiple Todoist projects"*

Link multiple Todoist projects to a single NotePlan note:

```yaml
---
todoist_ids: ["2349578229", "2349578230"]
---
```

Or using project names:

```yaml
---
todoist_project_names: ["Work", "Personal"]
---
```

### Per-Note Date Filter Override
**Branch:** `feature/todoist-date-filter`

**Use case:** *"Most notes should show current tasks, but my 'Weekly Review' note needs to show 7 days"*

Override the global date filter for a specific note:

```yaml
---
todoist_id: 2349578229
todoist_filter: 7 days
---
```

Valid values: `all`, `today`, `overdue`, `overdue | today`, `3 days`, `7 days`

### Project Name Lookup
**Branch:** `feature/todoist-project-name-lookup`

**Use case:** *"I don't want to look up project IDs - just let me use the project name"*

Reference projects by name instead of ID:

```yaml
---
todoist_project_name: Work
---
```

Or multiple:

```yaml
---
todoist_project_names: ["Work", "Personal"]
---
```

---

## Enhanced Existing Commands

### `/todoist sync project` Enhancements
**Branch:** `feature/todoist-date-filter`, `feature/todoist-project-name-lookup`

The existing `syncProject` command now supports:

1. **Command-line arguments:**
   ```
   /todoist sync project "Work, Personal" "7 days"
   ```

2. **Project names** (not just IDs) via frontmatter or arguments

3. **Date filter argument** as second parameter

---

## Bug Fixes

### API Compatibility Fixes
**Branch:** `feature/todoist-api-fixes`

- **Correct API endpoint:** Updated from deprecated endpoints to `https://api.todoist.com/api/v1`
- **Pagination support:** Properly handles cursor-based pagination for large task lists
- **Deduplication:** Prevents duplicate tasks when syncing

### Task ID Format Fix
**Branch:** `feature/sync-status-only`

- **Alphanumeric task IDs:** Todoist now uses alphanumeric IDs (e.g., `6X4P4Mp38MWX3MW4`). Updated regex from `(\d+)` to `([a-zA-Z0-9]+)`

### Completion Status Field Fix
**Branch:** `feature/sync-status-only`

- **Correct field name:** API returns `checked: true` not `is_completed: true`. Fixed in all 3 places checking completion status.

### Timezone Fix
**Branch:** `feature/todoist-date-filter`

- **Local timezone parsing:** Date filtering now correctly uses local timezone instead of UTC

### Heading Creation Fix
**Branch:** `feature/todoist-date-filter`

- **Auto-create headings:** If a target heading doesn't exist, it's now created automatically
- **Correct task placement:** Tasks are appended directly after the heading, not at end of note

---

## Testing

### Comprehensive Test Suite
**Branch:** `feature/introduce-comprehensive-testing`

- 121 passing tests covering:
  - Pure function unit tests (parsing, filtering, task ID extraction)
  - API mock tests (fetch, close, create tasks)
  - Integration tests with NotePlan mocks

---

## Command Scope Reference

| Scope | Description | Commands |
|-------|-------------|----------|
| **Current note** | Operates on the note open in the editor | `tospt`, `tospo`, `tospc`, `tospn`, `tostbp`, `tosobp`, `toscbp`, `toswbp`, `toss` |
| **Selected text** | Operates on selected paragraphs | `toct` (convert to todoist task) |
| **All linked notes** | Searches all notes with Todoist frontmatter | `tossa` (sync status all) |
| **Today's daily note** | Writes to today's date note | `tost` (existing command) |
| **Todoist folder** | Creates/updates notes in dedicated folder | `tose` (existing command) |

---

## Summary by PR Candidate

| Feature Area | Branch | New Commands | New Settings | Scope | Complexity |
|--------------|--------|--------------|--------------|-------|------------|
| Date Filtering | `feature/todoist-date-filter` | 8 | 1 | Current note | Medium |
| Multi-Project | `feature/todoist-multi-project` | 0 | 2 | Current note | Medium |
| Project Names | `feature/todoist-project-name-lookup` | 0 | 0 | Current note | Low |
| Prefix Settings | `feature/todoist-prefix-settings` | 0 | 2 | Current note | Low |
| Convert Task | `feature/convert-to-todoist-task` | 1 | 0 | Selected text | Medium |
| Status Sync | `feature/sync-status-only` | 2 | 0 | Current note + All notes | Medium |
| API Fixes | `feature/todoist-api-fixes` | 0 | 0 | N/A | Low |
| Test Suite | `feature/introduce-comprehensive-testing` | 0 | 0 | N/A | Low |

**Integration Branch:** `todoist-integration-testing` contains all features merged together for testing.
