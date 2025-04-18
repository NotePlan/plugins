---
title: Single Tag Test
type: ignore
tags: migrated-template
---
# Single Tag Test
---
No args: <%- weekDates() %>
0: <%- weekDates({weekStartsOn:0, format:"EEE yyyy-MM-dd"}) %>
1: <%- weekDates({weekStartsOn:1, format:"EEE yyyy-MM-dd"}) %>
2: <%- weekDates({weekStartsOn:2, format:"EEE yyyy-MM-dd"}) %>

before: <%- weekDates({format:"EEE yyyy/MM/dd"})}
 
after:    <%- weekDates({format:"EEE yyyy/MM/dd"}) %>
<%- formattedDateTime('%Y-%m-%d %I:%M:%S %P') %> ...


