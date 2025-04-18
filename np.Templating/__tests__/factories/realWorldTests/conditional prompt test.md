---
title: conditional prompt test
type: meeting-note, empty-note
takeaways: <%- prompt('takeaways', 'Any takeaways from yesterday?', ['yes','no']) -%>
---
<% if (takeaways === "yes") { %>
 ## Takeaways from yesterday
- <%- await CommandBar.showInput("Takeways","Takeaway: '%@'") %>
<% }  %>
