---
title: Simple Test
type: meeting-note, empty-note
newNoteTitle: <%- prompt('meetingSummary','What would you like to discuss') %> <%- date.now() %>
---
--
tags: #testnote 
type: test-note
--
```templatejs
// Get all overdue tasks
const overdues = await DataStore.listOverdueTasks()

// Get the overdue task count
const overdueCount = overdues.length

// Get the latest overdue task
const latestTask = overdueCount > 0 ? overdues[0] : undefined

// Create a variable that holds the content if there is a latest task
let taskContent = ""
if (latestTask) {
	taskContent = latestTask.rawContent
}
```
Overdue Tasks: <%- overdueCount %>
<%- taskContent %>

## now what