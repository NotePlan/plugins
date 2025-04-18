---
title: New Project note
type: template, empty-note, project-note
folder: <select>
---
#project @start(<%- promptDate('startDate', 'Enter start date') %>) @due(<%- promptDate('dueDate', 'Enter due date - or enter') %>) @review(<%- promptDateInterval('question', 'Enter review interval') %>)
Context tags: <%# prompt('context') %>
---
