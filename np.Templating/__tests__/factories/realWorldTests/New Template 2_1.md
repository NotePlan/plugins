---
title: TEST Meeting Note w/ Email Link
type: ignore
documentation: https://help.noteplan.co/article/134-meeting-notes
---
# <%- eventTitle %> - <%- eventDate('MMM Do YY') %>
**Event:**  <%- calendarItemLink %>
**Attendees:** 
<% const emails = eventAttendees.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi) -%>
<% const uniqueEmails = [...(new Set(emails))].join(",") -%>
<% const uniqueLinks = [...(new Set(eventAttendeeNames.split(", ")))].join("]],[[") -%>
[[<%- uniqueLinks -%>]] 
→ [✉️ Email All Attendees](mailto:<%- uniqueEmails %>?subject=<%- encodeURIComponent(eventTitle) %>)
---