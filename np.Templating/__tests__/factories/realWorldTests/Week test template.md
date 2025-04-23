---
title: Week test template
type: meeting-note, empty-note
lastWeek: <%- date.now('YYYY-MM-DD',-7) %>
weekNumber: <%- date.weekNumber(lastWeek) %>
startDay: <%- date.startOfWeek('MMMM D',lastWeek) %>
endDay: <%- date.endOfWeek('MMMM D, YYYY',lastWeek) %>
---
Week <%- weekNumber %>: <%- startDay %> - <%- endDay %>
Week 28: July 7 - July 13, 2024
This week:
Start on Sunday
<%- date.startOfWeek('MMMM D') %>
<%- date.endOfWeek('MMMM D, YYYY') %>
Title: <%- Editor.title %>
Start/End Using Calendar: <%- Calendar.startOfWeek(new Date()).toISOString().split("T")[0] %> - <%- Calendar.endOfWeek(new Date()).toISOString().split("T")[0] %>
firstDayOfWeekPref: <%- DataStore.preference('firstDayOfWeek') %>
Date: <%- Editor.note.date %>

Eduard Version
<%- Calendar.startOfWeek(Editor.note.date) %> - <%- Calendar.endOfWeek(Editor.note.date) %>

<%- date.format("YYYY-MM-DD",Calendar.startOfWeek(Editor.note.date)) %> - <%- date.format("YYYY-MM-DD",Calendar.endOfWeek(Editor.note.date)) %>

<%- Calendar.startOfWeek(Editor.note.date).toISOString().split("T")[0] %> - <%- Calendar.endOfWeek(Editor.note.date).toISOString().split("T")[0] %>