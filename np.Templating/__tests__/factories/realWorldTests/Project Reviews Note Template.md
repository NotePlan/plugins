---
title: Project Reviews Note Template
type: empty-note, project-note, quick-note
newNoteTitle: <%- prompt('noteTitle', 'Project name') %>
folder: <select>
Comment: ideally would use `promptDate()` but that currently can't be reused. Doesn't seem to be using folder: or newNoteTitle: properly. Not sure why.
---
#project @start(<%- prompt('startDate', 'Start date (YYYY-MM-DD)') %>) @due(<%- prompt('dueDate', 'Due date (YYYY-MM-DD)') %>) @review(<%- promptDateInterval('question', 'Enter review interval') %>)
Aim: <%- prompt('Project Aim') %>
Context: <%- prompt('Project Context') %>
Team: <%- prompt('Project Team') %>
Progress: 0@<%- startDate %>: project started

### General