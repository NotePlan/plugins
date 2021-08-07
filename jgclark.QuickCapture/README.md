# QuickCapture plugin
This plugin provides commands to quickly add tasks/todos or general text to NotePlan notes:

- `/int`: Quickly add a task to your '📥 Inbox' note (defaults to Daily note, but can be configured to a different specific one)
- `/qath`: Quickly add a task at the top of a chosen note's heading
- `/qalh`: Quickly add text lines at the top of a chosen note's heading
- `/qad`: Quickly append a task to a chosen daily (calendar) note
- `/qaj`: Quickly add text to the Journal section of today's daily note
- `/qat`: Quickly append a task to a chosen project note
- `/qpd`: Quickly prepend a task to a chosen daily (calendar) note
- `/qpt`: Quickly prepend a task to a chosen project note. (Inserts after title or YAML frontmatter, or starting metadata lines.)

## Configuration
The first time you  use `/int` it should write some default configuration to the  `_configuration_` note found in the `Templates` folder. If this note has not been added, it will add one, if you agree.

In the `Templates/_configuration` note, include the following settings you want in the note's first configuration block. For example:

```
...
inbox: {
	inboxFilename: "📥 Inbox.md", // leave blank to use today's daily note, or give relative filename (e.g. "Folder/Inbox.md", ignoring the starting '/')
	inboxTitle: "📥 Inbox", // or whatever you want to call it
	addInboxPosition: "prepend",  // or "append"
},
...
```
(This example fragment is in JSON5 format: see the help text in `_configuration` note. Ensure there are commas at the end of all that lines that need them.)
