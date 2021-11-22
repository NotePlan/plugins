# ⚡️ QuickCapture plugin
This plugin provides commands to quickly add tasks/todos or general text to NotePlan notes:

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
The first time you  use `/int` it should write some default configuration to the  `📋 Templates/_configuration` note. If this note has not been added, it will add one, if you agree.

In this note, include the following settings you want in the first code block. For example:

```jsonc
...
inbox: {
  inboxTitle: "📥 Inbox", // name of your inbox note, or leave empty ("") to use the daily note instead. (If the setting is missing, or doesn't match a note, then the plugin will try to create it, from default settings if necessary.)
	addInboxPosition: "prepend",  // or "append"
  textToAppendToTasks: "" // text to append to any tasks captured to the inbox through /int
},
...
```
(This example fragment is in JSON5 format: see the help text in `_configuration` note. Ensure there are commas at the end of all that lines that need them.)

## History
See [CHANGELOG](CHANGELOG.md)
