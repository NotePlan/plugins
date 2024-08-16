// @flow
import { allSectionDetails } from "../../../constants.js"
import type { TDashboardSettings } from "../../../types.js"
import { dashboardFilterDefs } from "../../../dashboardSettings"
import { logDebug, logError, JSP } from '@helpers/react/reactDev.js'


/**
 * Handles the click event for the refresh button, triggering a plugin refresh action.
 * 
 * @param {Function} sendActionToPlugin - Function to send actions to the plugin.
 * @param {boolean} isDev? (default: false) If true, then pressing refresh will do a complete reload, not just a refresh.
 * @returns {Function} - A function to handle the click event.
 */
export const handleRefreshClick = (sendActionToPlugin: Function, isDev: boolean = false): Function => (): void => {
  const actionType = isDev ? 'windowReload' : 'refresh'
  logDebug('Header', `Refresh button clicked; isDev:${String(isDev)} sending action:${actionType}`)
  sendActionToPlugin(actionType, { actionType }, 'Refresh button clicked', true)
}

/**
 * Handles the change event for a switch element, updating shared settings and triggering plugin actions as necessary.
 * 
 * This function uses function composition to separate the initialization logic from the event handling logic. 
 * The outer function takes the necessary parameters and returns an inner function that handles the specific change event.
 * 
 * @param {TDashboardSettings} dashboardSettings - The current shared settings.
 * @param {Function} setDashboardSettings - Function to update the shared settings.
 * @param {Function} sendActionToPlugin - Function to send actions to the plugin.
 * @returns {Function} - A function that takes a key and returns a function to handle the change event.
 */
export const handleSwitchChange = (
  dashboardSettings: TDashboardSettings,
  setDashboardSettings: Function,
  sendActionToPlugin: Function
): Function => {
  // Return the event handler function
  return (key: string) => (e: any): void => {

    logDebug('handleSwitchChange', `Invoked with key: ${key} and event:`, e)

    if (!dashboardSettings || Object.keys(dashboardSettings).length === 0) {
      logError(
        'Header',
        `handleSwitchChange: Checkbox clicked but dashboardSettings is empty or undefined`,
        dashboardSettings
      )
      return
    }

    const isSection = key.startsWith('show')
    const isTagSection = key.startsWith("showTagSection_")
    const isChecked = e?.target?.checked || false

    logDebug('handleSwitchChange', `isSection: ${String(isSection)}, isChecked: ${isChecked}`)

    // This saves the change in local context, and then it will be picked up and sent to plugin
    if (setDashboardSettings && dashboardSettings && dashboardSettings[key] !== isChecked) {
      logDebug('handleSwitchChange', `Updating dashboardSettings["${key}"]. Previous value: ${dashboardSettings[key]}. New value: ${isChecked}`, dashboardSettings)
      setDashboardSettings((prev) => ({ ...prev, [key]: isChecked, lastChange: `Dropdown value changed: ${key}=${isChecked}` }))
      if (isChecked && isSection && key.startsWith('show')) { // this is a section show/hide setting
        // call for new data for a section just turned on
        const sectionCode = allSectionDetails.find(s => s.showSettingName === key)?.sectionCode ?? null
        logDebug('handleSwitchChange', `${key} turned on, so refreshing section: ${sectionCode || '<not set>'}`)
        if (sectionCode) {
          const payload = { actionType: 'refreshSomeSections', sectionCodes: [sectionCode] }
          sendActionToPlugin('refreshSomeSections', payload, `Refreshing some sections`, true)
        } else {
          logDebug('handleSwitchChange', `No sectionCode found for ${key} so not refreshing any sections`)
        }
      }
      if (!isSection || isTagSection) {
        const refreshAllOnChange = dashboardFilterDefs.find(s => s.key === key)?.refreshAllOnChange
        if (isTagSection || refreshAllOnChange) {
          const logMessage = isTagSection ? `Tag section ${key} turned on, so refreshing all sections` : `Refresh all sections because of setting ${key} refreshAllOnChange set to true`
          sendActionToPlugin('refresh', { actionType: 'refresh', logMessage }, `Refreshing all sections`, true)
        }
      }
  } else {
      logDebug('handleSwitchChange', `No changes detected for key: ${key}. Current value: ${dashboardSettings[key]}, new value: ${isChecked}`)
  }
}
}


/**
 * Handles the save input event, updating the shared settings with the new value.
 * 
 * This function uses function composition to separate the initialization logic from the event handling logic. 
 * The outer function takes the necessary parameters and returns an inner function that handles the specific save input event.
 * 
 * @param {Function} setDashboardSettings - Function to update the shared settings.
 * @returns {Function} - A function that takes a key and returns a function to handle the save input event.
 */
export const handleSaveInput = (setDashboardSettings: Function): Function => (key: string) => (newValue: string) => {
  logDebug('Header', `handleSaveInput: Saving input value for ${key} as ${newValue}`)
  setDashboardSettings((prev) => {
    logDebug('Header', `Previous dashboardSettings:`, prev)
    const newSettings = { ...prev, [key]: newValue, lastChange: `inputValue changed: ${key}=${newValue}` }
    logDebug('Header', `New dashboardSettings: ${JSP(newSettings, 2)}`)
    return newSettings
  })
}

/**
 * Sets the dropdown menu changes made state to true.
 * 
 * This function uses function composition to return a function that updates the state indicating changes were made to the dropdown menu.
 * 
 * @param {Function} setDropdownMenuChangesMade - Function to set the dropdown menu changes made state.
 * @returns {Function} - A function to set the changes made state.
 */
export const handleDropdownFieldChange = (setDropdownMenuChangesMade: Function): Function => (): void => {
  setDropdownMenuChangesMade(true)
}

/**
 * Toggles the dropdown menu, calling onDropdownMenuChangesMade if necessary.
 * 
 * This function uses function composition to separate the initialization logic from the event handling logic.
 * The outer function takes the necessary parameters and returns an inner function that handles toggling the dropdown menu.
 * 
 * @param {string | null} openDropdownMenu - The currently open dropdown menu.
 * @param {Function} setOpenDropdownMenu - Function to set the open dropdown menu.
 * @param {boolean} dropdownMenuChangesMade - Whether changes were made to the dropdown menu.
 * @param {Function} onDropdownMenuChangesMade - Function to call when changes were made to the dropdown menu.
 * @returns {Function} - A function to toggle the dropdown menu.
 */
export const handleToggleDropdownMenu = (
  openDropdownMenu: string | null,
  setOpenDropdownMenu: (menu: string | null) => void,
  dropdownMenuChangesMade: boolean,
  onDropdownMenuChangesMade: () => void
): Function => (menu: string): void => {
  if (openDropdownMenu && openDropdownMenu !== menu && dropdownMenuChangesMade) {
    logDebug('Header headerDropdownHandlers', `handleToggleDropdownMenu: dropdown menu changes made, refreshing sections`)
    onDropdownMenuChangesMade()
  }
  setOpenDropdownMenu(openDropdownMenu === menu ? null : menu)
}

/**
 * Calls onDropdownMenuChangesMade if the dropdown menu changes were made and no dropdown menu is open.
 * 
 * @param {string | null} openDropdownMenu - The currently open dropdown menu.
 * @param {boolean} dropdownMenuChangesMade - Whether changes were made to the dropdown menu.
 * @param {Function} onDropdownMenuChangesMade - Function to call when changes were made to the dropdown menu.
 */
export const handleOpenMenuEffect = (
  openDropdownMenu: string | null,
  dropdownMenuChangesMade: boolean,
  onDropdownMenuChangesMade: () => void
): void => {
  if (!openDropdownMenu && dropdownMenuChangesMade) {
    logDebug('Header headerDropdownHandlers', `handleOpenMenuEffect: dropdown menu changes made, refreshing sections`)
    onDropdownMenuChangesMade()
  }
}

/**
 * Causes a refresh when changes were made to a dropdown menu (e.g. Plugin Settings menu)
 * When the menu is closed, a full (incremental) refresh is called
 * 
 * This function uses function composition to return a function that handles the event when changes were made to the dropdown menu.
 * The outer function takes the necessary parameters and returns an inner function that performs the actions when changes are detected.
 * 
 * @param {Function} setDropdownMenuChangesMade - Function to set the dropdown menu changes made state.
 * @param {Function} sendActionToPlugin - Function to send actions to the plugin.
 * @returns {Function} - A function to handle the event when changes were made.
 */
export const onDropdownMenuChangesMade = (
  setDropdownMenuChangesMade: (changesMade: boolean) => void,
  sendActionToPlugin: Function
): Function => (): void => {
  setDropdownMenuChangesMade(false) // Reset changes made
  logDebug('Header headerDropdownHandlers', `onDropdownMenuChangesMade called -- refreshing sections after dropdown changes`)
  // const payload = { actionType: 'incrementallyRefreshSections', sectionCodes: allSectionCodes, logMessage: `Refreshing b/c settings were changed` }
  // sendActionToPlugin('incrementallyRefreshSections', payload, `Refreshing b/c settings were changed`, true)
}
