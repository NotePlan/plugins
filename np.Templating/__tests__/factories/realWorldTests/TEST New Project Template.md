---
title: New Project Template (with folder and meeting note)
type: blank-note
types: empty-note, quick-note
projectCode: <%- prompt('projectCode', 'Project Code', 'XXX_1') %>
projectTitle: <%- prompt('projectTitle', 'Project Title') %>
codePlusTitle: <%- projectCode %> - <%- projectTitle %>
folder: 1 - Projects/<%- codePlusTitle %>
newNoteTitle: <%- codePlusTitle %>
meetingNotesTitle: <%- projectCode %> - Project Meeting Notes
meetingNotesContent: "# <%- meetingNotesTitle %>\n##Actions:\n"
---
#project @start(<%- prompt('startDate','Start Date','%today%') %>) @due(date.add(startDate, 15)) @review(<%- promptDateInterval('question', 'Enter review interval') %>)

<% await DataStore.newNoteWithContent(meetingNotesContent,folder) -%>