# ⚡️ QuickCapture plugin
This plugin provides commands to more quickly add tasks/todos or general text to NotePlan notes, _without having to switch away from the note you're currently working on_:

- `/quick add task to inbox` (was `/int`): Quickly add a task to your '📥 Inbox' note. (To configure this, see below.)
- `/quick add task under heading` (was `/qath`): Quickly add a task at the top of a chosen note's heading
- `/quick add line under heading` (was `/qalh`): Quickly add text lines at the top of a chosen note's heading
- `/quick add to daily note` (was `/qad`): Quickly append a task to a chosen daily (calendar) note
- `/quick add to journal today` (was `/qaj`): Quickly add text to the Journal section of today's daily note
- `/quick add task to note` (was `/qat`): Quickly append a task to a chosen project note
- `/quick prepend task to daily note` (was `/qpd`): Quickly prepend a task to a chosen daily (calendar) note
- `/quick prepend task to note` (was `/qpt`): Quickly prepend a task to a chosen project note. (Inserts after title or YAML frontmatter, or starting metadata lines.)

(You can still use the short command names as is.)

## Configuration
Most of these commands require configuration. In NotePlan v3.4 and above, please click the gear button on the 'Event Helpers' line in the Plugin Preferences panel.

Here are details on the various settings:
- **InboxTitle**: name of your inbox note, or leave empty to use the daily note instead. (Default: "📥 Inbox".)
-	**Where to Add to Inbox note**: either "prepend" (start) or "append" (end)
- **Text to append to new inbox tasks**: optional text to append to any tasks captured to the inbox through /int

## History
See [CHANGELOG](CHANGELOG.md)
