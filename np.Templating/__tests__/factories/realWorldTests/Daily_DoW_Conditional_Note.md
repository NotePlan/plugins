---
title: Daily DoW Conditional Note
note: This template is designed to be run by a Shortcut on a schedule. It opens today's daily note and if the note has titles, it does nothing. if the note does not have titles, it inserts the daily note template
link: noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=Append%20template%20to%20end%20of%20current%20note&arg0=Daily%20DoW%20Conditional%20Note
type: meeting-note, blank-note
daysOfWeek:
  - Sun
  - Mon
  - Tue
  - Wed
  - Thu
  - Fri
  - Sat
today: daysOfWeek[this_date.getDay()]
---
```templatejs
this_date = new Date()
await Editor.openNoteByDate(this_date) 
const hasTitles = Editor.paragraphs? Editor.paragraphs.filter(p=>p.type==="title").length : false
console.log(`Running Daily Conditional Note Template: today's note has ${hasTitles??'no'} titles. ${hasTitles?' Will not replace existing content.':' Will run template'}`)
const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const today = daysOfWeek[this_date.getDay()]
const templateName = `☀️ Daily Note - ${today}`
console.log(`Today is ${today}`)
```
<% if (!hasTitles) { -%>
<% if (["Sun", "Sat"].includes(today)) { -%>
<%- import("☀️ Daily Note Weekend")  -%>
<% } -%>
<% if (["Mon", "Tue", "Wed", "Thu", "Fri"].includes(today)) { -%>
<% import(`${templateName}`)  -%>
<% } -%>
<% } -%>
