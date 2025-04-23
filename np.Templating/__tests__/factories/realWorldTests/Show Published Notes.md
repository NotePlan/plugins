---
title: Show Published/Public Notes
type: meeting-note, empty-note 
---
```templatejs
const publishedNotes = DataStore.projectNotes.filter(note=>note.publicRecordID)
const overviewMsg = `Found ${publishedNotes.length} published notes`
const noteTitles = publishedNotes.map(note=>`[[${note.title}]] [link](https://noteplan.co/n/${note.publicRecordID})`).join("\n")
```
<%- overviewMsg %>
<%- noteTitles %>
