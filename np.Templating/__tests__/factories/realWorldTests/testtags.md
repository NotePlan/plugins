---
title: testtags
type: ignore
tags: migrated-template
---
# testtags

## Today:
8601 date the hard way:
- 2021-09-03
Formatted:
- 
8601 the easy way:
- <%- date8601() %>
pickdate:
- <%- pickDate() %>
- <%- pickDateInterval() %>
meetingName tag:
- "<%- meetingName %>"
weather:
- <%- weather() %> 
quote:
- <%- quote() %> 
## Tasks last 7 days with headings (with confirmation):
- <%- sweepTasks({limit:{ "unit": "day", "num": 1 },includeHeadings:true,requireConfirmation:true}) %>
---
##  Events:
<%- listTodaysEvents({template:"- *|START|*-*|END|*: *|TITLE|*",allday_template:"- *|TITLE|*"}) %> ---
## Matching events:
<%- listMatchingEvents() %> -- (requires configuration)