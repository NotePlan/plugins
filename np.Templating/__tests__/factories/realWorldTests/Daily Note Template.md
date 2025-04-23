---
type:
  - empty-note
  - snippet
tags: migrated-template
title: 📅 Daily Note Template
---
```templatejs
console.log("gotto 1");
const dayNum = date.dayNumber(`${date.format('YYYY-MM-DD',Editor.note.title)}`);
console.log("gotto 2");
const isWeekday = dayNum >= 1 && dayNum <= 5;
console.log("gotto 3");
const isWeekend = !isWeekday;
```
### <%- date.format('dddd, YYYY-MM-DD',Editor.note.title) %> [WS](noteplan://x-callback-url/runPlugin?pluginID=jgclark.WindowTools&command=open%20window%20set&arg0=Today%20%2B%20Dashboard) [Dashboard](noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=Show%20Dashboard) [ATB](noteplan://runPlugin?pluginID=dwertheimer.EventAutomations&command=atb%20-%20Create%20AutoTimeBlocks%20for%20%3Etoday%27s%20Tasks) [dbwDR](noteplan://x-callback-url/openNote?noteTitle=Dashboard%20Plugin%20%F0%9F%A7%A9%23David&useExistingSubWindow=yes) [Top-level->Tasks](noteplan://x-callback-url/runPlugin?pluginID=np.Tidy&command=Move%20top-level%20tasks%20in%20Editor%20to%20heading&arg0=Tasks&arg1=false&arg2=false)
<%# DELETE UNNEEDED SECTIONS FROM PREV DAYS -%>
<%# Putting these clean-ups at the top before we look for orphaned tasks etc -%>
<% await DataStore.invokePluginCommandByName("Remove section from recent notes","np.Tidy",['{"numDays":14, "sectionHeading":"Blocks 🕑", "runSilently": true}'])  -%>
<% await DataStore.invokePluginCommandByName("Remove section from recent notes","np.Tidy",['{"numDays":14, "sectionHeading":"Thoughts For the Day", "runSilently": true}'])  -%>
<% await DataStore.invokePluginCommandByName("Remove section from recent notes","np.Tidy",['{"numDays":14, "sectionHeading":"Daily Recurring Tasks", "runSilently": true}'])  -%>
<% await DataStore.invokePluginCommandByName("Remove section from recent notes","np.Tidy",['{"numDays":14, "sectionHeading":"[Time Blocks](noteplan://runPlugin?pluginID=dwertheimer.EventAutomations&command=atb%20-%20Create%20AutoTimeBlocks%20for%20%3Etoday%27s%20Tasks)", "runSilently": true}'])  -%>
<% await DataStore.invokePluginCommandByName("Remove section from recent notes","np.Tidy",['{"numDays":14, "sectionHeading":"[Today\'s Synced Tasks](noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.EventAutomations&command=Insert%20Synced%20Todos%20for%20Open%20Calendar%20Note)", "runSilently": true}'])  -%>
<% await DataStore.invokePluginCommandByName("Remove section from recent notes","np.Tidy", ["{\"numDays\":365, \"sectionHeading\":\"🌤Weather:  [Los Angeles weather](noteplan://x-callback-url/runPlugin?pluginID=np.WeatherLookup&command=Weather%20by%20Lat%2FLong&arg0=%7B%22lat%22%3A34.0536909%2C%22lon%22%3A-118.242766%2C%22name%22%3A%22Los%20Angeles%22%2C%22country%22%3A%22US%22%2C%22state%22%3A%22California%22%2C%22label%22%3A%22Los%20Angeles%2C%20California%2C%20US%22%2C%22value%22%3A0%7D&arg1=yes)\", \"runSilently\": true}"])  -%>
<%# // DELETE UNNEEDED SECTIONS FROM PREV DAYS -%>
<%# await DataStore.invokePluginCommandByName("Tidy Up","np.Tidy",[])  -%>
## Tasks
* 
<% const tasks = await DataStore.invokePluginCommandByName("Move top-level tasks in Editor to heading","np.Tidy",["",true,true]);  -%>
<% if (tasks?.length) { -%>
<%- tasks %>
<% } -%>
<% if (dayNum == 6) { // saturday task -%>
* Review bits box @home
<% } -%>
## [Today's Synced Tasks](noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.EventAutomations&command=Insert%20Synced%20Todos%20for%20Open%20Calendar%20Note)
<% const syncedLines = await DataStore.invokePluginCommandByName("Insert Synced Todos for Open Calendar Note","dwertheimer.EventAutomations",["yes"])  -%>
<% if (syncedLines?.length) { -%>
<%- syncedLines %>
<% } -%>
## Thoughts For the Day
<% const n = DataStore.projectNoteByTitle("Stoic Philosophy Quotes")[0] -%>
<% const p = n.paragraphs.slice(1) -%>
<% const q = `${p[Math.floor(Math.random() * (p.length - 1))].content}` -%>
<% const sn = DataStore.projectNoteByTitle("Southern Phrases")[0] -%>
<% const sp = sn.paragraphs.slice(1) -%>
<% const sq = `${sp[Math.floor(Math.random() * (sp.length - 1))].content}` -%>
> <%- q %> [Stoic Quotes]
> <%- sq %> [Southern Quotes](https://www.southernliving.com/culture/sayings/southern-sayings)
> <%- web.quote() %> [Web.quote]
> <%- web.advice() %> [Web.advice]
## Daily Recurring Tasks
* [Import Apple Reminders](shortcuts://run-shortcut?name=Reminders%20to%20NP%20-dbw) #daysetup
* Weigh-in #getup
* Take Vitamins > !! #getup
* radio [taiso](https://youtu.be/0xfDmrcI7OI)  #workout
* Did you [stretch](noteplan://x-callback-url/openNote?filename=Exercise%2F%E2%AD%90%EF%B8%8F%20PT%20-%202023.md)? '5m  #workout
* Work out '1h > !!! #workout
* Review Overdue Tasks: '5m [Dashboard Overdue](noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=showPerspective&arg0=z_OVERDUE%20Only) !!!! #daysetup
* Answer Bev Emails !!
* [Plan Tomorrow](noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskAutomations&command=Review%20Overdue%20Tasks%20as%20of%20%3CDate%3E&arg0=tomorrow) @home #winddown
<% if (dayNum === 0) { // sunday -%>
<% } else if (dayNum === 1) { // monday -%>
* Plan for week #daysetup
* Book Friday Tennis Court
* Tell Betty what to cook !!
<% } else if (dayNum === 2) { // tuesday -%>
* Book Saturday Tennis Court
* Take out the trash bins for weds pickup
<% } else if (dayNum == 3) { // wednesday task -%>
* Tell Betty what to cook on  !!
<% } else if (dayNum == 4) { // thursday task -%>
<% } else if (dayNum == 5) { // friday task -%>
* Tell Betty what to cook !!
* Shabbos dessert?
* 11am Defrost Challah
* 5pm Challah in oven
<% } else if (dayNum == 6) { // saturday task -%>
<% } -%>
<% if (isWeekend) { // weekend (sat/sun) -%>
* Review [[⭐️ Tasks#fix:]] list
<% } else { // weekday (mon-fri) -%>
<% } -%>

<%- events()  %>
## [TIME BLOCKS](noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.EventAutomations&command=atb%20-%20Create%20AutoTimeBlocks%20for%20%3Etoday's%20Tasks)
## Blocks 🕑
- 
## Today's Notes & Actions

## 🌤Weather:  [Los Angeles weather](noteplan://x-callback-url/runPlugin?pluginID=np.WeatherLookup&command=Weather%20by%20Lat%2FLong&arg0=%7B%22lat%22%3A34.0536909%2C%22lon%22%3A-118.242766%2C%22name%22%3A%22Los%20Angeles%22%2C%22country%22%3A%22US%22%2C%22state%22%3A%22California%22%2C%22label%22%3A%22Los%20Angeles%2C%20California%2C%20US%22%2C%22value%22%3A0%7D&arg1=yes)

## Events to Enter [create](noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.EventAutomations&command=cevt%20-%20Create%20Events%20From%20Text%20under%20heading&arg0=Events%20to%20Enter&arg1=yes&arg2=dbwmail@gmail.com)

### Other
<% console.log("1") -%>
<%# THESE ARE DISABLED FOR NOW. HERE FOR REFERENCE - CAN BE DELETED -%>
<% console.log("2") -%>
<%# await DataStore.invokePluginCommandByName("Remove All Previous Time Blocks in Calendar Notes Written by this Plugin","dwertheimer.EventAutomations",["yes"])  -%>
<% console.log("3") -%>
<%# await DataStore.invokePluginCommandByName("Remove All Previous Synced Copies Under Synced Copies Heading","dwertheimer.EventAutomations",["yes"])  -%>
<%# await DataStore.invokePluginCommandByName("Remove Previous Days Paragraphs Named","dwertheimer.EventAutomations",["Daily Recurring Tasks","yes"])  -%>
<%# // END DELETE SECTION -%>
<%# import("Daily Timeblocks Snippet") -%>
<% progressUpdate({excludeToday: true, progressHeading: 'Post-Birthday Habits', showSparklines: true}) -%>
  