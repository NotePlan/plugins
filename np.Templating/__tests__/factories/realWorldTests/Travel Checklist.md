---
title: ✈️ Create Travel-Packing Checklist in Travel Folder (qtn)
location: <%- prompt('location','Where are you going?') %>
leaving: <%# prompt('leaving','Date of trip (for title)? (YYYY-MM-DD)') %>
newNoteTitle: "✈️ <%- location %> (<%- leaving %> days) - Travel Packing Checklist"
folder: zDELETEME/TravelPacking
type: quick-note
url: noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=New%20note%20using%20Quick%20Note%20Template&arg0=%E2%9C%88%EF%B8%8F%20Create%20Travel-Packing%20Checklist%20in%20Travel%20Folder%20%28qtn%29
---
<%- import('Empty Note Templates/✈️ Travel-Packing Checklist') %>