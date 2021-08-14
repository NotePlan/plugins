# QuickCapture plugin
This plugin provides commands to quickly add tasks/todos or general text to NotePlan notes:

- `/int`: Quickly add a task to your '📥 Inbox' note. (To configure this, see below.)
- `/qath`: Quickly add a task at the top of a chosen note's heading
- `/qalh`: Quickly add text lines at the top of a chosen note's heading
- `/qad`: Quickly append a task to a chosen daily (calendar) note
- `/qaj`: Quickly add text to the Journal section of today's daily note
- `/qat`: Quickly append a task to a chosen project note
- `/qpd`: Quickly prepend a task to a chosen daily (calendar) note
- `/qpt`: Quickly prepend a task to a chosen project note. (Inserts after title or YAML frontmatter, or starting metadata lines.)

## Configuration
The first time you  use `/int` it should write some default configuration to the  `📋 Templates/_configuration` note. If this note has not been added, it will add one, if you agree.

In this note, include the following settings you want in the first code block. For example:

```
...
inbox: {
  inboxTitle: "📥 Inbox", // name of your inbox note, or leave empty ("") to use the daily note instead. (If the setting is missing, or doesn't match a note, then the plugin will try to create it, from default settings if necessary.)
	addInboxPosition: "prepend",  // or "append"
},
...
```
(This example fragment is in JSON5 format: see the help text in `_configuration` note. Ensure there are commas at the end of all that lines that need them.)

## History
See [CHANGELOG](CHANGELOG.md)
