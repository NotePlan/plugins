# What's changed in ⚡️ Quick Capture

### v0.7.0, 29.8.2021
- new: this feature requested by @bcohen44: "with a new _configuration setting `textToAppendToTasks`, you can specify text (including hashtags or mentions) that will be appended to all new tasks created using the `/int` command." I've extended this to cover all the other relevant commands provided by this plugin.

### v0.6.0, 29.8.2021
- new: this feature requested by @duclearc: "I want to be able to call the global NotePlan shortcut, and from it (using /qath) add a task to it on the fly to a heading. And if that heading doesn't exist, the plugin should create it." It allows creation of the new header both at the top and bottom of the note.

### v0.5.0, 14.8.2021
- change: `/int` now only looks for `inboxTitle` in the _configuration settings note. If the setting is missing, or doesn't match a note, then the plugin will try to create it, from default settings if necessary. If the empty string (`inboxTitle: ""`) is given, then use the daily note instead 
- change: some code refactoring

### v0.4.5, 9.7.2021
- fix: bug fix with empty configurations (thanks to @renehuber)

### v0.4.4, 9.7.2021
- improve: smarter prepending for `/qpt` command

### v0.4.2, 5.7.2021
- add `/qaj` command: Quickly add text to the Journal section of today's daily note

### v0.4.0, 15.6.2021
- `/int`  now uses the `Templates/_configuration` file (described above) to get settings for this command, rather than have to change the plugin script file directly

### v0.3.2, 16.5.2021
- change name of plugin to QuickCapture [EM suggestion]

### v0.3.1, 16.5.2021
- change to using short command names [EM suggestions]
- add `/qpt` command: quickly prepend task
- add `/qat` command: quickly append task

### v0.3.0, 10.5.2021
- add `inbox add task` command
- add `quickly add a task to note section` command
- add `quickly add a text line to note section` command
