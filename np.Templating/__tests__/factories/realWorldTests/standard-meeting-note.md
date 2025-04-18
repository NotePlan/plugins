---
title: TEST (all fields) Meeting Note in zDELETEME Folder
type: ignore
documentation: https://help.noteplan.co/article/134-meeting-notes
folder: zDELETEME
Note1: put "append: <note title>" or "prepend: <note title>" if you want to append or prepend to an existing file
Note2: use newNoteTitle field to create a new note with a specific title
Note3: eventDate on a recurring task will generally display the date of the first occurrence. There is no way to get a specific occurrence of a recurring task. But there are workarounds. See Discord. 
---
## DELETEME TEST <%- eventTitle %> - <%- eventDate('MMM Do YY') %>

eventTitle: <%- eventTitle %> = The title of the selected calendar event.
eventAttendees: <%- eventAttendees %> = Comma separated list of all attendees of this event (names or emails as email links).
eventAttendeeNames: <%- eventAttendeeNames %> = Comma separated list of all attendees of this event (names or emails as plain text, available from v3.5.2).
calendarItemLink: <%- calendarItemLink %> = The link to this event, this has to be added to link a note to an event.
eventDate: <%- eventDate('MMM Do YY') %> = The date of the event, you can modify the format of the date.
eventEndDate: <%- eventEndDate('MMM Do YY') %> = The end date of the event, you can modify the format of the date.
eventLink: <%- eventLink %> = URL which is optionally added to events, like the link to the zoom call.
eventLocation: <%- eventLocation %> = Location of the event.
eventCalendar: <%- eventCalendar %> = Calendar name of the event.
eventNotes: <%- eventNotes %> = The text inside the notes field of the event.

## Misc Notes
- 