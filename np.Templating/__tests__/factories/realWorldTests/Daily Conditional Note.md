---
title: Daily Conditional Note
note: "This template is designed to be run by a Shortcut on a schedule. It opens today's daily note and if the note has titles, it does nothing. if the note does not have titles, it inserts the daily note template"
note2: "open today's note first because if filters is open this will fail noteplan://x-callback-url/openNote?noteDate=today"
note3: "this script is run from: /Users/dwertheimer/Dropbox/CustomApps/noteplanInsertDailyNote.sh"
link: noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=Append%20template%20to%20end%20of%20current%20note&arg0=Daily%20Conditional%20Note
type: meeting-note, blank-note
---
```templatejs
await Editor.openNoteByDate(new Date()) 
const hasTitles = Editor.paragraphs? Editor.paragraphs.filter(p=>p.type==="title").length : false
console.log(`Running Daily Conditional Note Template: today's note has ${hasTitles??'no'} titles. ${hasTitles?' Will not replace existing content.':' Will run template'}`)
```
<% if (!hasTitles) { -%>
<%- import('📅 Daily Note Template')  -%>
<% } -%>
