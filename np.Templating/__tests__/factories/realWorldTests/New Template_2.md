---
title: Colin Tester
type: ignore
---
# Morning Note Template
---
[Run Weather Shortcut](shortcuts://run-shortcut?name=Daily%20Weather)
##### Bonita Weather
<%- web.weather({template:"Weather: |WEATHER_ICON| |DESCRIPTION| |LOW_TEMP||UNITS|-|HIGH_TEMP||UNITS|; Feels like: |FEELS_LIKE_LOW||UNITS|-|FEELS_LIKE_HIGH||UNITS| in |TIMEZONE|"}) %>
##### Motivation
<%- quote() %>
<%- affirmation() %>

---
##### Take Care of yourself
[[⭐️ 1- Daily Mantra]]
#thankfulness
#twci
---
* Take your Medicine
---
#####  Insert Daily Actions

## Meetings and Events
<%- events({template:"- [*|START|*-*|END|*]: *|TITLE|*",allday_template:"- *|TITLE|*"}) %>

##  Notes

##  Actions 
* [Noteplan Tickler](shortcuts://run-shortcut?name=NotePlan%20Tickler)
* [Daily Wrap](shortcuts://run-shortcut?name=Noteplan%20Daily%20Wrap)