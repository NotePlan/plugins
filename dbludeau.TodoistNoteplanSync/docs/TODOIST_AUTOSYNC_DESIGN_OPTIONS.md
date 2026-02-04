# Todoist Auto-Sync Design Options

This document describes approaches for automatically syncing Todoist tasks when a daily note is created or opened in NotePlan.

## Summary

There are three approaches to automatically run the Todoist sync:

| Option | Trigger | Runs On | Code Changes Required |
|--------|---------|---------|----------------------|
| Option 1 | Template invocation | Note creation only | None |
| Option 2 | onOpen trigger | Every note open | Plugin modification |
| Option 3 | Template runner | Every note open | None (two templates) |

---

## Option 1: Direct Invocation in Template (Recommended)

Add this to your daily note template:

```markdown
---
title: Daily Note Template
type: template
todoist_id: ["6PmCM89PJPjRm2Qc", "6Q3cR7cM28RrwW4C"]
---

# <%- date.now("dddd, MMMM D, YYYY") %>

## Todoist Tasks
<% await DataStore.invokePluginCommandByName("todoist sync project", "dbludeau.TodoistNoteplanSync") %>
```

### How It Works
1. When the template is applied, the frontmatter with `todoist_id` is written to the note
2. The template engine executes `DataStore.invokePluginCommandByName()`
3. The Todoist sync command runs, reads the `todoist_id` from frontmatter, and populates tasks

### Pros
- Simple, single template
- No code changes required
- Works with existing plugin functionality

### Cons
- Only runs when template is first applied
- Does not re-sync on subsequent note opens

---

## Option 2: onOpen Trigger (Auto-Sync Every Open)

Add frontmatter trigger to your daily note template:

```markdown
---
title: Daily Note Template
type: template
triggers: onOpen => dbludeau.TodoistNoteplanSync.onOpen
todoist_id: ["6PmCM89PJPjRm2Qc", "6Q3cR7cM28RrwW4C"]
---

# <%- date.now("dddd, MMMM D, YYYY") %>

## Todoist Tasks
```

### Current Plugin Behavior

The existing `onOpen` function in `dbludeau.TodoistNoteplanSync/src/NPTriggers-Hooks.js` does NOT automatically sync - it's a placeholder. To use this option, modify the plugin:

```javascript
// In NPTriggers-Hooks.js
export async function onOpen(note: TNote): Promise<void> {
  const frontmatter = note?.frontmatter
  if (frontmatter?.todoist_id || frontmatter?.todoist_ids) {
    // Guard against rapid re-triggers
    const now = new Date()
    if (Editor?.note?.changedDate) {
      const lastEdit = new Date(Editor.note.changedDate)
      if (now.getTime() - lastEdit.getTime() > 15000) {
        await syncProject()
      }
    }
  }
}
```

### Pros
- Syncs every time you open the note
- Single template

### Cons
- Requires plugin code modification
- May slow down note opening

---

## Option 3: Template Runner (Most Flexible)

### Step 1: Add to your daily note template

```yaml
---
title: Daily Note Template
type: template
runTemplateOnOpen: Sync Todoist
triggers: onOpen => np.Templating.triggerTemplateRunner
todoist_id: ["id1", "id2"]
---

# <%- date.now("dddd, MMMM D, YYYY") %>

## Todoist Tasks
```

### Step 2: Create a runner template at `@Templates/Sync Todoist`

```yaml
---
title: Sync Todoist
type: template-runner
---
<% await DataStore.invokePluginCommandByName("todoist sync project", "dbludeau.TodoistNoteplanSync") %>
```

### Pros
- Runs every time note opens
- No plugin code changes
- Flexible - can add other automation to the runner

### Cons
- Requires maintaining two templates
- Slightly more complex setup

---

## Key Technical References

- **Template Engine**: `np.Templating/src/Templating.js`
- **Plugin Invocation**: `DataStore.invokePluginCommandByName(commandName, pluginId)`
- **Frontmatter Parsing**: `helpers/NPFrontMatter.js`
- **Trigger Syntax**: `triggers: onOpen => plugin.id.functionName`
- **Todoist Plugin**: `dbludeau.TodoistNoteplanSync/`

---

## Recommended Approach

**For immediate use without code changes:** Use **Option 1** (direct template invocation).

This approach:
1. Creates the daily note with frontmatter containing your project IDs
2. Automatically calls the sync command during template application
3. Populates tasks from all configured projects with section headings

If you later need automatic re-sync on every note open, implement Option 2 by modifying the plugin's `onOpen` handler.
