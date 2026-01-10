// @flow
// --------------------------------------------------------------------------
// Dashboard React component to show the Header at the top of the Dashboard window.
// Called by Dashboard component.
// Last updated 2026-01-09 for v2.4.0.b14 by @jgclark
// --------------------------------------------------------------------------

// --------------------------------------------------------------------------
// Imports
// --------------------------------------------------------------------------
import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { createDashboardSettingsItems } from '../../../dashboardSettings.js'
import { getVisibleSectionCodes } from '../Section/sectionHelpers.js'
import { useSettingsDialogHandler } from '../../customHooks/useSettingsDialogHandler.jsx'
// import { usersVersionHas } from '../../../../../helpers/NPVersions.js'
import { useAppContext } from '../AppContext.jsx'
import DropdownMenu from '../DropdownMenu.jsx'
import SettingsDialog from '../SettingsDialog.jsx'
import RefreshControl from '../RefreshControl.jsx'
import { DASHBOARD_ACTIONS } from '../../reducers/actionTypes'
import DoneCounts from './DoneCounts.jsx'
import { createFeatureFlagItems } from './featureFlagItems.js'
import { createFilterDropdownItems } from './filterDropdownItems.js'
import './Header.css'
import PerspectiveSelector from './PerspectiveSelector.jsx'
import SearchBar from './SearchBar.jsx'
import SearchPanel from './SearchPanel.jsx'
import useLastFullRefresh from './useLastFullRefresh.js'
import { clo, logDebug, logInfo, logError } from '@helpers/react/reactDev.js'
import AddToAnyNote from './AddToAnyNote.jsx'
// import ModalWithTooltip from '@helpers/react/Modal/ModalWithTooltip.jsx'

// --------------------------------------------------------------------------
// Type Definitions
// --------------------------------------------------------------------------

type Props = {
  lastFullRefresh: Date,
}

/**
 * Header Component to display the dashboard header.
 * @component
 * @param {Props} props - The props object.
 * @param {Date} props.lastFullRefresh - The timestamp of the last full refresh.
 * @returns {React.Node} The rendered Header component.
 */
const Header = ({ lastFullRefresh }: Props): React$Node => {
  // ----------------------------------------------------------------------
  // Context
  // ----------------------------------------------------------------------
  const { dashboardSettings, dispatchDashboardSettings, sendActionToPlugin, pluginData, /*reactSettings, setReactSettings*/ } = useAppContext()
  const { isDialogOpen, openDialog, closeDialog } = useSettingsDialogHandler()

  // ----------------------------------------------------------------------
  // Hooks
  // ----------------------------------------------------------------------
  const timeAgo = useLastFullRefresh(lastFullRefresh)

  // ----------------------------------------------------------------------
  // State
  // ----------------------------------------------------------------------
  const [openDropdownMenu, setOpenDropdownMenu] = useState<string | null>(null)
  const [tempDashboardSettings, setTempDashboardSettings] = useState({ ...dashboardSettings }) // for queuing up changes from dropdown menu to be applied when it is closed
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [lastSearchPanelToggleTime, setLastSearchPanelToggleTime] = useState(0)
  // State to track if the panel should be rendered
  const [shouldRenderPanel, setShouldRenderPanel] = useState(false)

  // ----------------------------------------------------------------------
  // Effects
  // ----------------------------------------------------------------------
  /**
   * Synchronize tempDashboardSettings with dashboardSettings when the dropdown menu is not open.
   */
  useEffect(() => {
    logDebug(`Header/useEffect dashboardSettings or openDropdownMenu changed. openDropdownMenu=${String(openDropdownMenu)}`, { dashboardSettings })
    if (!openDropdownMenu) {
      logDebug(`Header/useEffect dashboardSettings or openDropdownMenu changed memo. openDropdownMenu=${String(openDropdownMenu)}`, { dashboardSettings })
      setTempDashboardSettings({ ...dashboardSettings })
    }
  }, [dashboardSettings, openDropdownMenu])

  // Effect to handle panel rendering/removal with animation
  useEffect(() => {
    if (isSearchOpen) {
      // When opening, immediately render the panel
      setShouldRenderPanel(true)
    } else {
      // When closing, wait for the animation to complete before removing
      const timer = setTimeout(() => {
        setShouldRenderPanel(false)
      }, 500) // Match the faster closing animation duration (500ms)
      return () => clearTimeout(timer)
    }
  }, [isSearchOpen])

  // ----------------------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------------------
  /**
   * Toggles the open/closed state of a dropdown menu.
   * @param {string} dropdown - The identifier of the dropdown menu to toggle.
   */
  const handleToggleDropdownMenu = useCallback(
    (dropdown: string) => {
      console.log('Header/handleToggleDropdownMenu', `Toggling dropdown menu: "${dropdown}"; current openDropdownMenu=${String(openDropdownMenu)}`)
      if (openDropdownMenu === dropdown) {
        // Closing the dropdown menu
        logDebug('Header/handleToggleDropdownMenu', `Closing dropdown menu ${dropdown}`)
        // handleChangesInSettings()
        setOpenDropdownMenu(null)
        setTempDashboardSettings({ ...dashboardSettings }) // Reset temp settings
      } else {
        // Opening a new dropdown menu
        logDebug('Header/handleToggleDropdownMenu', `Opening dropdown menu ${dropdown}`)
        setOpenDropdownMenu(dropdown)
        setTempDashboardSettings({ ...dashboardSettings }) // Initialize temp settings
      }
    },
    [openDropdownMenu, dashboardSettings],
  )

  /**
   * Handles changes in settings when user saves changes from the dropdown menu or settings dialog.
   */
  const handleChangesInSettings = useCallback(
    (updatedSettings?: Object) => {
      const newSettings = {
        ...dashboardSettings,
        ...tempDashboardSettings,
        ...updatedSettings,
      }
      dispatchDashboardSettings({
        type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS,
        payload: newSettings,
        reason: `Dashboard Settings updated`,
      })
      // Update tempDashboardSettings with the new settings
      setTempDashboardSettings(newSettings)
      //TODO: REFACTOR:Maybe update isModified & sendActionToPlugin to save the settings and remove from the useDashboardSettings hook
    },
    [dashboardSettings, tempDashboardSettings, dispatchDashboardSettings],
  )

  /**
   * Handles switch change in the dropdown menu.
   */
  const handleLocalSwitchChange =
    (key: string) =>
    (e: any): void => {
      const isChecked = e?.target?.checked || false
      logDebug('Header/handleLocalSwitchChange', `Changing setting ${key} to ${isChecked}`)
      setTempDashboardSettings((prevSettings) => ({
        ...prevSettings,
        [key]: isChecked,
      }))
    }

  /**
   * Handles input save in the dropdown menu.
   */
  const handleLocalSaveInput =
    (key: string) =>
    (newValue: string): void => {
      logDebug('Header/handleLocalSaveInput', `Changing setting ${key} to ${newValue}`)
      setTempDashboardSettings((prevSettings) => ({
        ...prevSettings,
        [key]: newValue,
      }))
    }

  /**
   * Handles the click event for the refresh button, triggering a plugin refresh action.
   *
   * @param {boolean} isHardRefresh - If true, performs a hard refresh.
   * @returns {Function} - A function to handle the click event.
   */
  const handleRefreshClick =
    (isHardRefresh: boolean = false): Function =>
    (): void => {
      const actionType = isHardRefresh ? 'windowReload' : 'refreshEnabledSections'
      logDebug('Header', `Refresh button clicked; isHardRefresh:${String(isHardRefresh)} sending action:${actionType}`)
      sendActionToPlugin(actionType, { actionType: actionType, sectionCodes: visibleSectionCodes }, 'Refresh button clicked', true)
    }

  /**
   * Handles the search event.
   * @param {string} query - The search query.
   */
  const handleSearch = (query: string): void => {
    console.log('Header: handleSearch', `Search query:${query}`) // not OK here
    // Send request to plugin to start a search
    const data = {
      stringToEvaluate: query,
      from: 'searchBar',
    }
    sendActionToPlugin('startSearch', data, 'Search button clicked', false)
  }

  /**
   * Handles the click event for the search icon.
   * If the panel is open (X is showing), it will close the panel.
   * If the panel is closed (search icon is showing), it will open the panel.
   * @param {Object} e - The mouse event
   */
  const handleSearchPanelIconClick = (e: any) => {
    e.preventDefault()
    e.stopPropagation()

    const now = Date.now()
    // Prevent toggling too quickly (within 300ms)
    if (now - lastSearchPanelToggleTime < 300) {
      return
    }

    setLastSearchPanelToggleTime(now)

    // Force the state to be the opposite of what it currently is
    setIsSearchOpen((prevState) => !prevState)
  }

  function handleButtonClick(_event: MouseEvent, controlStr: string, handlingFunction: string) {
    // const { metaKey, altKey, ctrlKey, shiftKey } = extractModifierKeys(_event) // Indicates whether a modifier key was pressed
    // clo(detailsMessageObject, 'handleButtonClick detailsMessageObject')
    // const currentContent = para.content
    logDebug(`Header handleButtonClick`, `Button clicked on controlStr: ${controlStr}, handlingFunction: ${handlingFunction}`)
    // $FlowIgnore[prop-missing]
    // const updatedContent = inputRef?.current?.getValue() || ''
    // if (controlStr === 'update') {
    //   logDebug(`DialogForTaskItems`, `handleButtonClick - orig content: {${currentContent}} / updated content: {${updatedContent}}`)
    // }
    // let handlingFunctionToUse = handlingFunction
    // const actionType = (noteType === 'Calendar' && !resched) ? 'moveFromCalToCal' : 'rescheduleItem'
    // logDebug(`DialogForTaskItems`, `handleButtonClick - actionType calculated:'${actionType}', resched?:${String(resched)}`)

    const dataToSend = {
      // ...detailsMessageObject,
      actionType: handlingFunction,
      controlStr: controlStr,
      // updatedContent: currentContent !== updatedContent ? updatedContent : '',
      // sectionCodes: sectionCodes,
    }

    sendActionToPlugin(handlingFunction, dataToSend, `Header requesting call to ${handlingFunction}`, true)
  }

  /**
   * Closes the search panel
   */
  const closeSearchPanel = () => {
    setIsSearchOpen(false)
  }

  /**
   * Handler for the old "add task anywhere" button that uses QuickCapture plugin
   */
  const handleAddTaskAnywhere = useCallback(() => {
    sendActionToPlugin('addTaskAnywhere', {}, 'Add task to any note', false)
  }, [sendActionToPlugin])


  // ----------------------------------------------------------------------
  // Constants
  // ----------------------------------------------------------------------
  const { sections, logSettings, firstRun } = pluginData

  const visibleSectionCodes = getVisibleSectionCodes(dashboardSettings, sections)

  // Memoized dropdown items that update when tempDashboardSettings changes
  const [dropdownSectionItems, dropdownOtherItems] = useMemo(() => createFilterDropdownItems(tempDashboardSettings), [tempDashboardSettings])
  const dashboardSettingsItems = useMemo(() => createDashboardSettingsItems(tempDashboardSettings), [tempDashboardSettings])
  const featureFlagItems = useMemo(() => createFeatureFlagItems(tempDashboardSettings), [tempDashboardSettings])

  // Show Feature Flags menu if any FF is set, or we're in DEV logging mode (and not in demo mode)
  const showFeatureFlagsMenu = (logSettings._logLevel === 'DEV' || dashboardSettings.FFlag_DebugPanel
    || dashboardSettings.FFlag_ShowTestingPanel
    || dashboardSettings.FFlag_ForceInitialLoadForBrowserDebugging
    || dashboardSettings.FFlag_HardRefreshButton
    || dashboardSettings.FFlag_ShowSectionTimings
    || dashboardSettings.FFlag_UseTagCache) && !pluginData.demoMode
  const showRefreshButton = pluginData.platform !== 'iOS'
  const showHardRefreshButton = dashboardSettings?.FFlag_HardRefreshButton && showRefreshButton
  const isNarrowWidth = window.innerWidth <= 700

  const isSearchPanelAvailable = dashboardSettings?.FFlag_ShowSearchPanel // Note: not yet used
  const useDynamicAddToAnywhere = dashboardSettings?.FFlag_DynamicAddToAnywhere ?? false

  // Note: this is a hack on iOS and iPadOS in modal mode, to allow the modal close button to be visible
  // FIXME: not working yet on iOS and iPadOS, and not logging either!
  const isModal = (pluginData.platform === 'iOS' || pluginData.platform === 'iPadOS') && !pluginData.mainWindowModeSupported
  logInfo('Header', `isModal:${String(isModal)}, mainWindowModeSupported:${String(pluginData.mainWindowModeSupported)} on platform ${pluginData.platform}`)

  // ----------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------
  const timeAgoText = isModal || isNarrowWidth ? timeAgo : timeAgo.replace(' mins', 'm').replace(' min', 'm').replace(' hours', 'h').replace(' hour', 'h')
  // logInfo('Header', `Rendering Header; isMobile:${String(isMobile)}, isNarrowWidth:${String(isNarrowWidth)}, showRefreshButton:${String(showRefreshButton)}, showHardRefreshButton:${String(showHardRefreshButton)}`)
  return (
    <div className="header-container">
      <header className="header">
        {/* Perspective selector */}
        {dashboardSettings.usePerspectives && (
          <div className="perspectiveName">
            <PerspectiveSelector />
          </div>
        )}

        {showRefreshButton && (
          <div className="refreshButtons">
            <RefreshControl refreshing={pluginData.refreshing === true}
              firstRun={firstRun}
              handleRefreshClick={handleRefreshClick(false)} />
            {showHardRefreshButton && (
              <button onClick={handleRefreshClick(true)} className="HAButton hardRefreshButton" title="Hard Refresh (restart whole Dashboard)">
                <i className={'fa-regular fa-arrows-retweet'}></i>
                <span className="pad-left">HR</span>
              </button>
            )}
          </div>
        )}

        <div className="lowerPrioritySpace">
          <div className="lastRefreshInfo">
            Updated: <span id="timer">{timeAgoText}</span>
          </div>

          <div className="totalCounts">{dashboardSettings.displayDoneCounts && pluginData?.totalDoneCount ? <DoneCounts totalDoneCount={pluginData.totalDoneCount} /> : ''}</div>
        </div>

        <div className="headerActionIconButtons">
          {/* {isSearchPanelAvailable ? (
            <div id="searchPanelButton">
              <i
                className={`fa-solid ${isSearchOpen ? 'fa-xmark' : 'fa-search'}`}
                onClick={handleSearchPanelIconClick}
                onMouseDown={(e) => {
                  // Prevent default to avoid any unwanted behavior
                  e.preventDefault()
                  e.stopPropagation()
                }}
                title={isSearchOpen ? 'Close search panel' : 'Open search panel'}
              ></i>
            </div>
          ) : ( */}
          <SearchBar onSearch={handleSearch} />
          {/* )} */}

          {/* Add task to any note button and dialog */}
          {useDynamicAddToAnywhere ? (
            <AddToAnyNote sendActionToPlugin={sendActionToPlugin} />
          ) : (
            <button
              accessKey="a"
              className="buttonsWithoutBordersOrBackground"
              title="Add new task/checklist"
              onClick={handleAddTaskAnywhere}
            >
              <i className="fa-solid fa-hexagon-plus"></i>
            </button>
          )}

          {/* Feature Flags dropdown */}
          {showFeatureFlagsMenu && (
            <DropdownMenu
              onSaveChanges={handleChangesInSettings}
              otherItems={featureFlagItems}
              handleSwitchChange={handleLocalSwitchChange}
              className={'feature-flags'}
              iconClass="fa-solid fa-flag"
              isOpen={openDropdownMenu === 'featureFlags'}
              toggleMenu={() => handleToggleDropdownMenu('featureFlags')}
              labelPosition="left"
            />
          )}

          {/* Display Filters dropdown menu */}
          <DropdownMenu
            accessKey="f" // FIXME: this is not working
            onSaveChanges={handleChangesInSettings}
            sectionItems={dropdownSectionItems}
            otherItems={dropdownOtherItems}
            handleSwitchChange={handleLocalSwitchChange}
            handleSaveInput={handleLocalSaveInput}
            className={'filter'}
            iconClass="fa-solid fa-filter"
            isOpen={openDropdownMenu === 'filter'}
            toggleMenu={() => handleToggleDropdownMenu('filter')}
            labelPosition="left"
          />
          {/* Cog Icon for opening the settings dialog */}
          <button accessKey=","
            className="dropdown buttonsWithoutBordersOrBackground"
            onClick={() => openDialog()}
            title="Open Dashboard Settings dialog">
            <i className="fa-solid fa-gear"></i>
          </button>

          {/* Spacer for the NP-generated close button on modal windows on mobile */}
          {isModal && <span className="modalCloseButtonSpacer"></span>}
          
        </div>

        {/* Render the SettingsDialog only when it is open */}
        {isDialogOpen && <SettingsDialog items={dashboardSettingsItems} className={'dashboard-settings'} onSaveChanges={handleChangesInSettings} />}

      </header>

      {/* SearchPanel container with sliding animation */}
      <div className={`search-panel-container ${isSearchOpen ? 'open' : ''}`}>{(isSearchOpen || shouldRenderPanel) && <SearchPanel onClose={closeSearchPanel} />}</div>
    </div>
  )
}

export default Header
