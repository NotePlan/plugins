# Architecture / How Things Work

## Components
Generally speaking the React components are in the components directory. However, when components get large, they are split as follows:
- a folder is created for the component (e.g. "Header")
- the component file is put inside the folder (e.g. Header.jsx)
- the hooks file used by this component are put inside the folder
- the handlers file used by this component are put inside the folder
- an index.js is create that exports the component:
```js
import Header from './Header.jsx'
export default Header 
```
- importing the component then looks like: `import Header from './Header'`

## Data Passing
The `pluginData` object holds the data that is populated (and later updated) at the backend, and passed to the front-end for rendering. It is defined in `reactMain::getInitialDataForReactWindow()` as follows:

```js
  const pluginData: TPluginData =
  {
    sections: sections, // generated by getAllSectionsData() or getSomeSectionsData() or incrementallyRefreshSomeSections() etc. calls. This is of type `Array<TSection>`
    lastFullRefresh: new Date(),
    dashboardSettings: await getDashboardSettings(),
    perspectiveSettings: await getPerspectiveSettings(),
    notePlanSettings: getNotePlanSettings(),
    logSettings: await getLogSettings(),
    demoMode: useDemoData, // boolean
    platform: NotePlan.environment.platform, // used in dialog positioning
    themeName: dashboardSettings.dashboardTheme ? dashboardSettings.dashboardTheme : Editor.currentTheme?.name,
  }
```

To aid coding, there are many types defined in `types.js`. The core ones are `TSection` and `TSectionItem`.

React doesn't seem to have a way of queue-ing up data for processing.
So there's a slightly complicated initial back-and-forth to make sure that the front-end window is ready to start receiving Sections:
- in reactMain.js: `showDashboardReact()` -> `getInitialDataForReactWindow()` -> `getPluginData()`
- Dashboard component `useEffect` on startup sends x-callback `reactWindowInitialised` command to plugin
- That then kicks off `incrementallyRefreshSomeSections()`.

## Settings
As of 2.0.1, there are 4 types of settings:
1. a-few-NP-settings-we-need-to-have-available-when-NotePlan-object-isn't.
2. logLevel used by other helpers + as a fallback
3. things that are only about what sections to display and how they should look.
4. things that control other bits of logic.

These are available through the following functions:
- getDashboardSettings  = 3 + 4, and these can be changed by setSetting(s)
- getNotePlanSettings = 1, and these can't be changed by setSetting(s)
- getLogSettings = 2, and these can only by changed manually in app.

As of 2.0, settings exist in two places (DataStore.settings) and sharedSettings. This is necessary during the time of transition because we want users' 1.0 preferences to not be lost.
- Under the hood, "dashboardSettings" is actually saved in `DataStore.settings.dashboardSettings` in stringified JSON, and parsed when needed on the front-end or back end.
- Any time any change is made to a setting, a useEffect listener, watching for changes to dashboardSettings will fire off a command to update the back-end (`DataStore.settings.dashboardSettings`) with the latest value.
- For the front-end, settings are defined in the file: 
    `src/dashboardSettings.js`

At 2.1, sharedSettings has been dropped.

## PerspectiveSettings
### Initial loading of data from plugin settings file
- The variable `perspectiveSettings` is persisted in `DataStore.settings` as a hidden field (just like dashboardSettings). 
- In DataStore (because it's a hidden file), it is stringified JSON
- fyi, it's actually an array, not an object, when de-stringified
- Initially passed to the React window as part of pluginData (type TPluginData), injected by the functions: getInitialDataForReactWindow() -> getPluginData() -> getPerspectiveSettings()
  - the value is read from the DataStore.settings on initial load in the function getPerspectiveSettings()
  - it is de-stringified and saved in `pluginData.perspectiveSettings` as an array (not a string anymore)
  - this is the only time that getPerspectiveSettings() is called (on initial load)

### Loading of perspectives data in React front-end
- WebView component reads the `pluginData.perspectiveSettings` array
- WebView turns it into a local state variable in WebView called perspectiveSettings and passes perspectiveSettings/dispatchPerspectiveSettings in the global context so any component can access it

### Saving of perspective changes
- Perspective changes are not directly saved by a handler, instead the settings are written to the context using dispatchPerspectiveSettings and will be picked up by a watcher (see below)
- When a user makes a change in the Settings Dialog (or using the filter switches), the function adjustSettingsAndSave() sets perspective changes in the global context using `dispatchPerspectiveSettings`

### Watching for perspective changes
- Dashboard component has a useEffect that is watching for any changes in the global perspectiveSettings, and when/if it sees a change, it sends an action to the plugin to save the changes to the DataStore: `sendActionToPlugin('perspectiveSettingsChanged'...`
- Dashboard also has a watcher looking for changes in Dashboard settings generally, and inside that watcher/effect, we check to see if the perspective is set to "-", because in that case, we need to update the perspective data for "-" automatically since dashboardSettings has been updated.


## Interactive Processing

- The interactive processing is initiated by clicking the button on the Task dialog.
- It is triggered in Section.jsx, which sets reactSettings.interactiveProcessing to an object with details.
- The incrementing of the interactive processing is handled in `DialogForTaskItems.jsx::handleIPItemProcessed()`.

## Custom Hooks (src/react/customHooks)

### useRefreshTimer (Refresh Timer, for calling for refresh after N secs - e.g. after NP cache is updated)
This is a single component that is used in several places to force refreshes after a certain amount of time. It is imported into the Dashboard component and then called in these circumstances:
1. User has autoRefresh turned on. After _n_ mins of idle time, the Dashboard will automatically do an incremental refresh of all visible sections
2. User clicked a button on the Task dialog. The timer is set for [5s] and will do a silent incremental refresh to make sure that any NP caching on the last command is finished processing and sections are updated. Ideally there are no changes.
3. The back-end (plugin) after processing a command (e.g. "move all overdues to today"), can ask for a "START_DELAYED_REFRESH_TIMER" (type `TActionOnReturn`). This sets a field in pluginSettings (`pluginData.startDelayedRefreshTimer = true`), which signals the front-end to start the [5s] timer, after which a refresh will be issued.  [Note: this is currently turned off.]

Since all of these use the same singleton customHook, by design any of them will reset any pending timers and the count will start again.

## AutoRefresh - IdleTimer component
The IdleTimer manages the refresh based on inactivity.

## CSS Notes

### Platforms
The wrapper class has the name of the platform in the class
- iOS
- macOS
- iPadOS
...so we can style things differently (e.g. `.iOS .header`), particularly where there are touch (not click) targets.

However, in most cases it is more portable to check for screen height or width and then override that, as Dashboard can be displayed at iOS-type sizes on macOS and iPadOS as well.
```css
@media screen and (width <= 450px) {
	.something-to-override {
		padding-right: 1rem;
	}
}
```

### Z-index CSS values for window elements
<!-- - StatusIcon rollover MetaTooltips: 101 -->
- modal-backdrop > div: 101
- modal-backdrop: 100
- sticky banner (from css.plugins.css): 100
- Dialog: 50
- Tooltips (::after on buttons with tooltips): 20
- Header: 10
- Date Picker (.rdp): 10
- combobox-dropdown: 10
- Dropdown Menus (e.g. filter): 5

