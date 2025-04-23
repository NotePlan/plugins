---
title: Daily Note Template (with countdown)
type: ignore
tags: migrated-template
---
### <%- date.format('dddd, YYYY-MM-DD',Editor.note.title) %>
## >⭐️ Tasks<
* 

## Thoughts For the Day
<% const n = DataStore.projectNoteByTitle("Stoic Philosophy Quotes")[0] -%>
<% const p = n.paragraphs.slice(1) -%>
<% const q = `${p[Math.floor(Math.random() * (p.length - 1))].content}` -%>
> <%- q %>
> <%- web.quote() %>
> <%- web.advice() %>

 ## Daily Recurring Tasks
+ Did you stretch? '5m
+ Review Overdue Tasks '5m [Review Overdue Tasks](noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskAutomations&command=Review%20overdue%20tasks%20%28by%20Task%29) ><%- date.format('YYYY-MM-DD',Editor.note.title) %> !!!!
+ Plan day (review >⭐️ Tasks<) '15m ><%- date.format('YYYY-MM-DD',Editor.note.title) %> !!!!!
+ Take Vitamins ><%- date.format('YYYY-MM-DD',Editor.note.title) %> !!
+ Answer Bev Emails !!
+ Go through Inbox '15m ><%- date.format('YYYY-MM-DD',Editor.note.title) %> !!
+ Go through Tiller transactions '15m ><%- date.format('YYYY-MM-DD',Editor.note.title) %> 
+ Work out '1h ><%- date.format('YYYY-MM-DD',Editor.note.title) %> !!!
<% const dayNum = date.dayNumber(`${date.format('YYYY-MM-DD',Editor.note.title)}`) -%>
<% if (dayNum === 0) { // sunday -%>
<% } else if (dayNum === 1) { // monday -%>
+ Plan for week
<% } else if (dayNum === 2) { // tuesday -%>
* Take out the trash bins for weds pickup
<% } else if (dayNum == 3) { // wednesday task -%>
<% } else if (dayNum == 4) { // thursday task -%>
<% } else if (dayNum == 5) { // friday task -%>
* Shabbos dessert?
* 11am Defrost Challah
* 5pm Challah in oven
<% } else if (dayNum == 6) { // saturday task -%>
<% } -%>
<% if (dayNum === 0 || dayNum === 6) { // weekend (sat/sun) -%>
+ Review [[⭐️ Tasks#fix:]] list
<% } else if (dayNum > 0 && dayNum < 6) { // weekday (mon-fri) -%>
<% } -%>

## [Time Blocks](noteplan://runPlugin?pluginID=dwertheimer.EventAutomations&command=atb%20-%20Create%20AutoTimeBlocks%20for%20%3Etoday%27s%20Tasks)


## [Today's Synced Tasks](noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.EventAutomations&command=Insert%20Synced%20Todos%20for%20Open%20Calendar%20Note&arg0=yes)


## Today's Notes & Actions


## 📝 Journal

## 🌤Weather:  [Los Angeles weather](noteplan://x-callback-url/runPlugin?pluginID=np.WeatherLookup&command=Weather%20by%20Lat%2FLong&arg0=%7B%22lat%22%3A34.0536909%2C%22lon%22%3A-118.242766%2C%22name%22%3A%22Los%20Angeles%22%2C%22country%22%3A%22US%22%2C%22state%22%3A%22California%22%2C%22label%22%3A%22Los%20Angeles%2C%20California%2C%20US%22%2C%22value%22%3A0%7D&arg1=yes)

### Other
<%- progressUpdate({period: '2023-01-06', progressHeading: 'Workouts {{PERIOD}} (excl. today)', showSparklines: true, excludeToday:true}) %>

<% await DataStore.invokePluginCommandByName("Remove All Previous Time Blocks in Calendar Notes Written by this Plugin","dwertheimer.EventAutomations",["yes"])  -%>
<% await DataStore.invokePluginCommandByName("Remove All Previous Synced Copies Written by this Plugin","dwertheimer.EventAutomations",["yes"])  -%>
<% await DataStore.invokePluginCommandByName("Remove Previous Days Paragraphs Named","dwertheimer.EventAutomations",["Daily Recurring Tasks","yes"])  %>
<% await DataStore.invokePluginCommandByName("Remove Previous Days Paragraphs Named","dwertheimer.EventAutomations",["Thoughts For the Day","yes"])  %>