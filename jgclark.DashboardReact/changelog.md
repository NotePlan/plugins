# What's changed in 🎛 Dashboard plugin?
For more details see the [plugin's documentation](https://github.com/NotePlan/plugins/tree/main/jgclark.Dashboard/).

## [2.0.0-a4]

### dbw Notes to jgclark
- Refresh button now works, refreshing all content via JSON passing only :)
- Task Dialog: Updating text and clicking "update" refreshes JSON
- Single line update scaffolding is in place, but only text updates trigger it so far
- Note: single-line updates do not reset the "last updated" counter, because it feels to me like that should only reset when all the content is pulled anew. Let me know if you feel differently
- I added a 5s delayed auto refresh hack to try to get around the updateCache bug. After clicking any button on the dialog, the JSON data does a full refresh 5s later no matter what. We can get rid of this when the single-line refreshes on the plugin/server side are all implemented.
- I added a "refreshing" message when this happens so you know what's going on.

### jgclark notes


## [2.0.0-a3] 

Notes to @jgclark
- reactSettings is working. See Header component for how to import/read/set it. Still refreshing more often than I would like. Something we will address as an optimization down the road...The user won't see it. The logs are just noisy. Speaking of which, would be good if you could turn off some of the debug logging in the loop
- Dialogs have now been split and modularized. I have worked on the Tasks dialog as an example for you. Have not touched the Projects one other than splitting it out
- I have the notes opening when clicking on a task, and the command buttons from the dialogs working
- Dialog commands that have been tested/work: today, +1d, +1b, this week, +1w, +2w, this month, this qtr, move-to, priority up, priority down, toggle type, 
- Dialog commands that do not work and need your help: Cancel, Complete Then, Unschedule. 
[editing text -- this is a big one that i will figure out]

Other TODO:
- There is no REFRESH OF DATA yet. I'm not sure I follow the gathering code well enough to know how to re-gather it.
- Projects Dialog - make more like the Tasks Dialog
- Bug: Dialog+Move To Note and selecting "top of note" places the item above the content of the note - this may be a bug in the helper also?
- Bug: A task in today's note "* a task >today" doesn't show up on today's dashboard for some reason
- Minor thing but the "title" field that is passed for calendar note items is unhyphenated, whereas the actual title in a Calendar note is hyphenated. Would look better in the dialog box to have it hyphenated.
- (dwertheimer) Banners are not working

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
