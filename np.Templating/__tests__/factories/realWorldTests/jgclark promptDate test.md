---
title: jgclark promptDate test
type: ignore 
---
# <%- prompt('noteTitle', 'Project name') %>
#project @start(<%- promptDate('startDate','Enter start date (YYYY-MM-DD)') %><%#- startDate %>)
 @due(<%- promptDate('question','Enter due date (YYYY-MM-DD)') %>) @review(<%- promptDateInterval('reviewInterval','Enter review interval') %>)
Aim: <%- prompt('Project Aim') %>
Context: <%- prompt('Project Context') %>
Team: <%- prompt('Project Team') %>
Progress: 0@<%- startDate %>: project started