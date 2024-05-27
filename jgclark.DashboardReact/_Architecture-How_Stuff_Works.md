# Architecture / How Things Work

## Settings

As of 2.0, settings exist in two places (DataStore.settings) and sharedSettings. This is necessary during the time of transition because we want users' 1.0 preferences to not be lost. Starting in 2.1, there will be no *user visible* plugin settings in DataStore.settings (or plugin.json), other than LOG_LEVEL. 
- For the time being, the back-end (plugin) gets its config from `getCombinedSettings()` which uses the sharedSettings set in react first, and falls back to the DataStore settings if the react settings have not been set yet. This way, if somone has made a change to a React switch, it's used. Otherwise, their 1.0 setting is used.
- Under the hood, "sharedSettings" is actually saved in `DataStore.settings.sharedSettings` in stringified JSON, and parsed when needed on the front-end or back end.
- Any time any change is made to a setting, a useEffect listener, watching for changes to sharedSettings will fire off a command to update the back-end (DataStore.settings.sharedSetttings) with the latest value.
- For the front-end, settings are defined in the file: 
    `src/react/support.dashboardSettingsItems.js`


## Custom Hooks (src/react/customHooks)

### useInteractiveProcessing (process all tasks)
This is the hook that handles interactive processing of all items in a section
- Section.jsx: 
    - Every section with items gets the button 
    - clicking the button calls handleProcessTasksClick() which sets reactSettings.interactiveProcessing to the name of the section clicked -- a truthy value
    - useInteractiveProcessing is loaded by Section.jsx
- useInteractiveProcessing
    - Has effects that monitor reactSettings looking for reactSettings.interactiveProcessing having been set
    - when it's first set, the items to process array is saved
    - the first item is loaded
    - each time a user action on an item closes the dialog, traverses to the next item in the list and opens the dialog 

## CSS Notes

### Z-index
- Header: 1000
- Dialog: 50
- Tooltips (buttons with tooltips): 20
- Date Picker (.rdp): 10
- combobox-dropdown: 5
- Dropdown Menus (e.g. filter): 1
- dropdown-content: 1
