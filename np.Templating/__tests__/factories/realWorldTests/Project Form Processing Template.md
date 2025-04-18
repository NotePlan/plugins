---
title: Project Form Processing Template
type: empty-note, project-note, quick-note
newNoteTitle: <%- noteTitle %>
folder: <select>
start: <%- startDateEntry ? date.format("YYYY-MM-DD",startDateEntry): '' %> 
due: <%- startDateEntry.split("T")[0] %>
NOTES: 
	- "variables do not need to be listed here if they are defined in the form field keys. only change the name and redefine them here if you need to adjust the response in some way"
---
#project @start(<%- start  %>) @due(<%- due %>) @review(<%- interval %>)
Aim: <%- aim %>
Context: <%-context %>
Team: <%- team %>
Progress: 0@<%- start %>: project started
