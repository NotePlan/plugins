---
title: (backup) daily note
type: ignore
tags: migrated-template
---
# (backup) daily note	
# Daily Note Template
---
## Today's events:
<%- listTodaysEvents({template:"- *|START|*-*|END|*: *|TITLE|*",allday_template:"- *|TITLE|*"}) %>
## Tasks
<%- sweepTasks({limit:{ "unit": "day", "num": 7 },includeHeadings:true}) %>
## Do Today
[Plugins must be working...a plugin put this text here!]
## Do In Future
[Plugins must be working...a plugin put this text here!][Plugins must be working...a plugin put this text here!]
[Plugins must be working...a plugin put this text here!]
## Notes
[Plugins must be working...a plugin put this text here!]
<%- weather() %>