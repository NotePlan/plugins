---
title: Someday Tasks - Random Task Inserter Template
type: meeting-note, empty-note 
---
```templatejs
const noteTitle = "Someday Tasks"
let syncedTaskContent;
const n = DataStore.projectNoteByTitle(noteTitle)[0] // get the note
const opens = n.paragraphs.filter(p=>p.type === 'open') // include only task that are open
if (opens.length) {
const para = opens[Math.floor(Math.random() * (opens.length))] // pick a task from the list of open tasks
if (!para.blockId) { // if there is no sync marker already, then we need to add one
	n.addBlockID(para)
	n.updateParagraph(para)
}
syncedTaskContent = para.rawContent // rawContent will include the task marker at the front so you can insert it directly
} else {
	syncedTaskContent = `No open tasks to choose from in [[${noteTitle}]]`
}
```
<%- syncedTaskContent %>