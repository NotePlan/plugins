---
title: Template for jgclark
type: ignore 
noteTitle: <%- prompt('noteTitle', 'Project name') %>
startDate: <%- prompt('startDate', 'Enter start date YYYY-MM-DD') %>
folder: <select>
---
# <%- noteTitle %>
#project @start(<%- startDate %>)
Progress: 0@<%- startDate %>: project started
`