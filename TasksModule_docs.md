import Link from 'next/link'
import Callout from '@/components/Callout'

# Tasks Module

## Overview

The Tasks Module provides methods for interacting with tasks within NotePlan.

<Callout
  type="info"
  description={`
This module allows you to retrieve and manipulate tasks from your notes, ensuring they are synchronized with block IDs for reliable referencing.
  `}
/>

## Methods

> namespace: `tasks`

The following are the methods available in the Tasks Module. They can be used in any `Templating` template; no additional configuration is required.

---

### getSyncedOpenTasksFrom

> #### async getSyncedOpenTasksFrom(sourceIdentifier : string) : Promise<string>
>
> Retrieves open tasks (including their sub-tasks/children) from a specified note (daily, weekly, monthly, quarterly, yearly calendar note, or a project note). It ensures each open task paragraph and its children have a block ID and returns a string with each task on a new line.

- `sourceIdentifier` - (string) Specifies the note to retrieve tasks from. This can be:
    - `'<today>'`: Fetches tasks from today's daily note.
    - `'<yesterday>'`: Fetches tasks from yesterday's daily note.
    - An ISO 8601 date string for a specific calendar note:
        - Daily: `"YYYYMMDD"` (e.g., `"20230410"`) or `"YYYY-MM-DD"` (e.g., `"2023-04-10"`)
        - Weekly: `"YYYY-Www"` (e.g., `"2023-W24"`)
        - Monthly: `"YYYY-MM"` (e.g., `"2023-10"`)
        - Quarterly: `"YYYY-Qq"` (e.g., `"2023-Q4"`)
        - Yearly: `"YYYY"` (e.g., `"2023"`)
    - The title of a project note (string).

- `-> result` - (Promise<string>) Returns a promise that resolves to a string containing all open tasks and their sub-tasks from the specified note, each on a new line. If the note is not found or contains no open tasks, it resolves to an empty string.

**Behavior Notes:**

*   The method uses `getOpenTasksAndChildren` to identify open tasks and their hierarchical children.
*   It automatically adds block IDs to any open task or child task paragraph that doesn't already have one. This modification happens directly in the NotePlan data store.
*   If multiple project notes match a given title, the method will use the first one found and log a debug message.

**Examples**

The following example retrieves open tasks from today's daily note:

```javascript
<%- await tasks.getSyncedOpenTasksFrom('<today>') %>
```

The following example retrieves open tasks from a specific weekly note:

```javascript
<%- await tasks.getSyncedOpenTasksFrom('2023-W42') %>
```

The following example retrieves open tasks from a project note titled "My Project Q4":

```javascript
<%- await tasks.getSyncedOpenTasksFrom('My Project Q4') %>
``` 