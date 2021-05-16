# NoteHelpers plugin
This plugin provides commands to quickly add tasks/todos or general text to NotePlan notes:

- `/int`: Quickly add a task to your '📥 Inbox' note (defaults to Daily note, but can be configured to a different specific one)
- `/qath`: Quickly add a task at the top of a chosen note's heading
- `/qalh`: Quickly add text lines at the top of a chosen note's heading
- `/qpt`: Quickly prepend a task to a chosen note
- `/qat`: Quickly append a task to a chosen note

## Configuration
Before NotePlan's configuration mechanism is available, you need to manually update the `jgclark.noteHelpers\taskHelpers.js` file in the plugin's folder. Update the following lines at the top of the file accordingly:

```js
// Items that should come from the Preference framework in time:
var pref_inboxFilename = ""  // leave blank to use today's daily note, or give relative filename (e.g. "Folder/Inbox.md", ignoring the starting '/').
var pref_addInboxPosition = "prepend"  // or "append"
```

## History

### v0.3.2, 16.5.2021
- change name of plugin to QuickCapture [EM suggestion]

### v0.3.1, 16.5.2021
- change to using short command names [EM suggestions]
- 

### v0.3.0, 10.5.2021
- add `inbox add task` command
- add `quickly add a task to note section` command
- add `quickly add a text line to note section` command
