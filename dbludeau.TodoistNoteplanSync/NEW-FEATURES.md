# Todoist NotePlan Sync - New Features & Improvements

This document summarizes all new features and improvements made to the Todoist NotePlan Sync plugin, relative to the upstream main branch. Each feature is a candidate for a pull request.

---

## New Commands

### 1. Date-Filtered Project Sync Commands
**Branch:** `feature/todoist-date-filter`

Four new commands to sync project tasks with specific date filters:

| Command | Alias | Description |
|---------|-------|-------------|
| `/todoist sync project today` | `tospt` | Sync only tasks due today |
| `/todoist sync project overdue` | `tospo` | Sync only overdue tasks |
| `/todoist sync project current` | `tospc` | Sync overdue + today tasks |
| `/todoist sync project by name` | `tospn` | Interactive prompts for project names and filter |

### 2. "By Project" Commands for Current Note
**Branch:** `feature/todoist-date-filter`

Four new commands that sync tasks to the current note, organized by project headings:

| Command | Alias | Description |
|---------|-------|-------------|
| `/todoist sync today by project` | `tostbp` | Today's tasks, grouped by project |
| `/todoist sync overdue by project` | `tosobp` | Overdue tasks, grouped by project |
| `/todoist sync current by project` | `toscbp` | Today + overdue, grouped by project |
| `/todoist sync week by project` | `toswbp` | Next 7 days, grouped by project |

### 3. Convert to Todoist Task
**Branch:** `feature/convert-to-todoist-task`

| Command | Alias | Description |
|---------|-------|-------------|
| `/todoist convert to todoist task` | `cttt`, `toct` | Convert selected NotePlan tasks to Todoist Inbox tasks |

- Converts one or multiple selected tasks
- Creates tasks in Todoist Inbox with link back
- Replaces original task with Todoist-linked version
- Preserves subtasks (converts parent only)
- Parses NotePlan priority (`!!!`, `!!`, `!`) and due dates (`>YYYY-MM-DD`)

### 4. Status Sync Commands
**Branch:** `feature/sync-status-only`

| Command | Alias | Description |
|---------|-------|-------------|
| `/todoist sync status` | `toss` | Sync completion status for current note only |
| `/todoist sync status all` | `tossa` | Sync completion status across all linked notes |

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

---

## New Frontmatter Options

### Multi-Project Support
**Branch:** `feature/todoist-multi-project`

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

## Summary by PR Candidate

| Feature Area | Branch | New Commands | New Settings | Complexity |
|--------------|--------|--------------|--------------|------------|
| Date Filtering | `feature/todoist-date-filter` | 8 | 1 | Medium |
| Multi-Project | `feature/todoist-multi-project` | 0 | 2 | Medium |
| Project Names | `feature/todoist-project-name-lookup` | 0 | 0 | Low |
| Prefix Settings | `feature/todoist-prefix-settings` | 0 | 2 | Low |
| Convert Task | `feature/convert-to-todoist-task` | 1 | 0 | Medium |
| Status Sync | `feature/sync-status-only` | 2 | 0 | Medium |
| API Fixes | `feature/todoist-api-fixes` | 0 | 0 | Low |
| Test Suite | `feature/introduce-comprehensive-testing` | 0 | 0 | Low |

**Integration Branch:** `todoist-integration-testing` contains all features merged together for testing.
