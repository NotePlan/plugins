---
title: 2Daily Note Template
type: ignore
tags: migrated-template
---
# # 2Daily Note Template
---
## Today's events: …
<%- listTodaysEvents({template:"### START-END: TITLE"}) %>

<%- listTodaysEvents({template:"### START-END: TITLE",allday_template:"### TITLE"}) %>

## Do Today

## Do In Future

## Notes
<%- sweepTasks() %>

<%- weather() %>


