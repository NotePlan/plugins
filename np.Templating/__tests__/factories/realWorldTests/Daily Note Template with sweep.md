---
title: Daily Note Template (with sweep)
type: ignore
tags: migrated-template
---
# Daily Note Template (with sweep)
---
<%- formattedDateTime({format: '%A, %B %d, %Y'}) %>

## Today's events:
<%- listTodaysEvents({template:"- *|START|*-*|END|*: *|TITLE|*",allday_template:"- *|TITLE|*"}) %>

---

## Tasks
<%- sweepTasks({limit:{ "unit": "day", "num": 7 },includeHeadings:false, ignoreFolders:['📋 Templates','_TEST','zDELETEME']}) %>
---
## Notes


---
<%- weather() %>

### Things to think about:
- "<%- affirmation() %>."
- "<%- advice() %>"
- <%- quote() %>