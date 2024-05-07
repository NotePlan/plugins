# What's changed in 🎛 Dashboard plugin?
For more details see the [plugin's documentation](https://github.com/NotePlan/plugins/tree/main/jgclark.Dashboard/).

Misc TODO:
- There is no REFRESH OF DATA yet. I'm not sure I follow the gathering code well enough to know how to re-gather it.
- Projects Dialog - make more like the Tasks Dialog
- Bug: Dialog+Move To Note and selecting "top of note" places the item above the content of the note - this may be a bug in the helper also?
- Bug: A task in today's note "* a task >today" doesn't show up on today's dashboard for some reason
- (dwertheimer) Banners are not working
- Bug (from 1.x) Checklists not ignored as per setting
- the moveNote function requires a DataStore call under the hood, so needs moving back to the plugin side

## [2.0.0.a11] @dbw
- fixed the React side of the bug that was keeping data from displaying
- fixed the bug on the data generation side that was keeping a lot of the data from generating
- added sharedData to plugin.json and to context, added reading/initializing/setting functions
- refactored all the reactSettings calls to be sharedData calls instead
- the specific settings should be added to TSharedSettings in types
- ran around in circles trying to figure out why it was refreshing in an endless loop. then figured out that there was some old refresh dashboard code on a settings change, so every time i flipped one switch, it looped forever reloading reloading. i commented out the onSettingsUpdated refresh code.
- As of now, reactSettings is used only for things that are react-only (like dialogData which is used to open the dialog with certain info)
- sharedData holds all the values that you created/saved
- Both are stringified and saved to DataStore.settings in fields "sharedSettings" and "reactSettings". This way even reactSettings can persist (though currently it doesn't matter)

  "reactSettings" : "{\"lastChange\":\"_Saving\",\"dialogData\":{\"isOpen\":false,\"isTask\":true,\"details\":{}}}",

  "sharedSettings" : "{\"lastChange\":\"ignoreChecklistItems change\",\"ignoreChecklistItems\":true,\"showYesterdaySection\":true,\"showWeekSection\":false,\"showTagSection\":false,\"filterPriorityItems\":false,\"hideDuplicates\":false,\"showTomorrowSection\":false,\"showMonthSection\":true,\"showQuarterSection\":false,\"showOverdueSection\":true,\"showProjectSection\":false}",


## [2.0.0.a10] @jgc
- added shared::getSharedSettings() function. **HELP: how to get sharedSettings into appContext, so it can be picked up in Section?**
- added all sections (except TD and COUNT) to the Dropdown menu. Note: These are now called e.g. showTodaySection not earlier e.g. show_today -- this is to align with existing naming in our setting.json files.
- fixed regression on spacing around icons in dialogs
- changed `item.sectionType` to `item.sectionCode` which is slightly more accurate

## [2.0.0.a9] @dbw
- NOTE: ADDED CALENDAR PICKER AND A ROLLUP CSS PLUGIN SO YOU WILL NEED TO PULL, `npm i` and RESTART THE BUILD/ROLLUP SCRIPTS
- Fixed the header CSS so it looks right again
- Added close X at top right instead of close button - can probably use some jgclark styling
- added cog and dropdown menu to hide UI switches
- implemented "hide duplicates" switch which keeps items under one heading (TAG first, then today, then others...)
- created show/hide button for each section in the sections object
- added reactSettings setting in plugin.json to keep track of your last UI settings. eventually will need to combine with plugin settings depending on what jgclark wants to do
- added calendar picker to the dialog box and implemented back end to reschedule a task to that date. Though leaving jgclark a note about doUpdateTaskDate()
- fixed flow errors for `onClick` in AddButtons 
- fixed the lastUpdated in Root (should not have been changed, as lastFullRefresh is only used in this plugin and Root is generic)


## [2.0.0-a8] @jgc + @dw
- Major update to data types, including introduction of TItemType, TProjectForDashboard, TControlStrings, TActionOnReturn, TActionType, and their introduction in almost all files
- Major refactoring of bridgeClickDashboardItem contents into separate do... functions in clickHandlers.js
- added ability to refresh specified sections (`getSomeSectionsData`) not just all of them (`getAllSectionsData`)
- JSON data items can now be deleted as well as updated
- fix to icon horizontal positioning in dialogs
- fix to some button icon positioning in dialogs
- in tasks dialog calendar notes' titles are now hyphenated
- fixed a bunch of other flow errors

## [2.0.0-a7] @dw
- Moved the first few clickHandlers from the massive pluginToHTMLBridge to a clickHandlers file. 
- Started to work on a standardized return object from the handlers so there is not a ton of repeated code in each handler (e.g. update the JSON, refresh, etc.). It's a WIP
- only doCompleteTask and doContentUpdate are using the new concept. I'm on the fence about it. Look forward to discussing.
- Added line at end of massive switch statement in router:
    if (result) await processActionOnReturn(result, data) // process all actions based on result of handler


## [2.0.0-a5] @dw
- Dialog: Got CompleteThen to work
- Dialog: Got Unschedule to work
- Dialog: Got Cancel to work
- Dialog: Wrote JS to position the dialog perfectly relative to click
- Dashboard css: bring header z-index up to float above all elements
- Major React Refactor: Break down ItemRow to be much more modular so that Projects and Tasks are not mixed together. 
- TaskItem is now much more readable and understandable and does not have the multiple if's and multiple return statements.
- NOTE: to that end, I try to keep my React Components to a single return statement (do any if's above in the code) so if you want to see what is rendering in a component, you jump to the bottom of the file and it's always right there
- New React Components: Task Item, Review Item, Tasks Filtered, NoTasks
- Created a generalized shared/singleton auto refresh timer that allows for refresh to be called for by any component with a debounce so that only the last request counts down and you don't get 5 refreshes if you quickly click 5 tasks.
- Cleaned up lots of Flow errors (still some more to go)

## [2.0.0-a4] @dw
- Refresh button now works, refreshing all content via JSON passing only :)
- Task Dialog: Updating text and clicking "update" refreshes JSON
- Single line update scaffolding is in place, but only text updates trigger it so far
- Note: single-line updates do not reset the "last updated" counter, because it feels to me like that should only reset when all the content is pulled anew. Let me know if you feel differently
- I added a 5s delayed auto refresh hack to try to get around the updateCache bug. After clicking any button on the dialog, the JSON data does a full refresh 5s later no matter what. We can get rid of this when the single-line refreshes on the plugin/server side are all implemented.
- I added a "refreshing" message when this happens so you know what's going on.

## [2.0.0-a3] @dw
- reactSettings is working. See Header component for how to import/read/set it. Still refreshing more often than I would like. Something we will address as an optimization down the road...The user won't see it. The logs are just noisy. Speaking of which, would be good if you could turn off some of the debug logging in the loop
- Dialogs have now been split and modularized. I have worked on the Tasks dialog as an example for you. Have not touched the Projects one other than splitting it out
- I have the notes opening when clicking on a task, and the command buttons from the dialogs working
- Dialog commands that have been tested/work: today, +1d, +1b, this week, +1w, +2w, this month, this qtr, move-to, priority up, priority down, toggle type, 
- Dialog commands that do not work and need your help: Cancel, Complete Then, Unschedule. 
[editing text -- this is a big one that i will figure out]

## [2.0.0-a3] @SirTristam 2024-04-30
- Correct date handling when rescheduling or moving tasks.
- Fix error using the 'All Today -> Tomorrow' button.

## [2.0.0-a2] @jgclark 2024-04-19
- ShowTimeAgo:
    - moved showTimeAgo from a free-standing JS to being part of the Header react component
    - moved file from requiredFiles to react/support)
    - removed the body onLoad that loads it -- now loads when the Header loads
    - removed it from preBodyScript
- Actions not working: You were correct. Had to find the one thing. The command we need to use to talk to the plugin from React is sendActionToPlugin(), but to have access to that command/function, we need to pull it out of the React context. So each component that needs to talk to the plugin should:
    a) import { useAppContext } from './AppContext.jsx'
    and then inside the component:
    b)  const { sendActionToPlugin } = useAppContext()
    c) then in any click handler you can call it like:
        `onClick={() => sendActionToPlugin('showNoteInEditor', dataObjectToPassToFunction)}`
    d) the catcher/router on the other side is in reactMain.js, onMessageFromHTMLView() where there is a 'case' statement for each command fires off a command. Since you already have a function for that, bridgeClickDashboardItem(), I just put a default routing in onMessageFromHTMLView() to send everything to your function
- The "Open this note in Editor" clicks now work, so you can follow the thread: ItemNoteLink > sendActionToPlugin >  onMessageFromHTMLView > 

- NOTE: there is a circular dependency which needs to be sorted out into a 3rd file perhaps. Did not have time to look at this. must sleep.

## [2.0.0-a1] @jgclark 2024-04-07
- Brought across demoDashboard.js to experiment with forming JSON to sent to React

## [1.2.1] - 2024-04-18 by @SirTristam
- Add option to use the current date instead of '>today' to schedule tasks for today
