---
title: openTasks etc test
type: meeting-note, empty-note
---
* one
* two
* three
* [x] one @done(2025-03-17 11:10 AM)
* [x] two @done(2025-03-17 11:10 AM)
+ one
+ [x] one
+ [x] two
+ [x] three
+ [x] four
note.openTasks: <%- note.openTasks() %>
note.completedTasks: <%- note.completedTasks() %>
note.openChecklists: <%- note.openChecklists() %>
note.completedChecklists: <%- note.completedChecklists() %>
---
