# NoteHelpers plugin
This plugin provides commands to quickly add tasks/todos or general text to NotePlan notes:

- `inbox add task`: Quickly add a task to your Inbox note (defaults to Daily note, but can be configured to a different specific one)
- `quickly add a task to note section`: Quickly add a task at top of a specified note's heading 
- `quickly add a text line to note section`: Quickly add text line at top of a specified note's heading

## Configuration
Before NotePlan's configuration mechanism is available, you need to manually update the `jgclark.noteHelpers\taskHelpers.js` file in the plugin's folder. Update the following lines at the top of the file accordingly:
```js
// Items that should come from the Preference framework in time:
var pref_inboxFilename = ""  // leave blank for daily note, or give relative filename (e.g. "Folder/Inbox.md", ignoring the starting '/').
var pref_addInboxPosition = "prepend"  // or "append"
```

## Changelog

### v0.3.0 (first release)
- add `inbox add task` command
- add `quickly add a task to note section` command
- add `quickly add a text line to note section` command
