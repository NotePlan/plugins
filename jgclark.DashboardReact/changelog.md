# What's changed in 🎛 Dashboard plugin?
For more details see the [plugin's documentation](https://github.com/NotePlan/plugins/tree/main/jgclark.Dashboard/).

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
