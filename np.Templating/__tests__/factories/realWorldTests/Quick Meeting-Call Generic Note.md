---
title: Quick Meeting-Call Generic Note
recipient: <%- prompt(recipient,"Who with?") %>
meetingType: <%- prompt(meetingType,'Meeting type',["Zoom Mtg","Call","In-Person","Pitch Mtg"]) %>
folder: <select>
newNoteTitle: <%- recipient %> <%- meetingType %> <%- date8601() %>
type: quick-note 
---
## ### Actions
- 
### Notes
- 