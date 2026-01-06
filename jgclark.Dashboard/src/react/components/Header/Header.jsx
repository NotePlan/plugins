// @flow
// --------------------------------------------------------------------------
// Dashboard React component to show the Header at the top of the Dashboard window.
// Called by Dashboard component.
// Last updated 2025-06-04 for v2.3.0 by @jgclark
// --------------------------------------------------------------------------

// --------------------------------------------------------------------------
// Imports
// --------------------------------------------------------------------------
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { createDashboardSettingsItems } from '../../../dashboardSettings.js'
import { getVisibleSectionCodes } from '../Section/sectionHelpers.js'
import { useSettingsDialogHandler } from '../../customHooks/useSettingsDialogHandler.jsx'
import { useAppContext } from '../AppContext.jsx'
import DropdownMenu from '../DropdownMenu.jsx'
import SettingsDialog from '../SettingsDialog.jsx'
import RefreshControl from '../RefreshControl.jsx'
import { DASHBOARD_ACTIONS } from '../../reducers/actionTypes'
import DoneCounts from './DoneCounts.jsx'
import { createFeatureFlagItems } from './featureFlagItems.js'
import { createFilterDropdownItems } from './filterDropdownItems.js'
import PerspectiveSelector from './PerspectiveSelector.jsx'
import SearchBar from './SearchBar.jsx'
import SearchPanel from './SearchPanel.jsx'
import useLastFullRefresh from './useLastFullRefresh.js'
import { clo, logDebug, logInfo, logError } from '@helpers/react/reactDev.js'
import DynamicDialog, { type TSettingItem } from '@helpers/react/DynamicDialog/DynamicDialog'
import type { NoteOption } from '@helpers/react/DynamicDialog/NoteChooser'
// import ModalWithTooltip from '@helpers/react/Modal/ModalWithTooltip.jsx'
import './Header.css'
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
  const { dashboardSettings, dispatchDashboardSettings, sendActionToPlugin, pluginData, reactSettings, setReactSettings } = useAppContext()
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
  // State for add task dialog
  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false)
  const [notes, setNotes] = useState<Array<NoteOption>>([])
  const [notesLoaded, setNotesLoaded] = useState(false)
  const [loadingNotes, setLoadingNotes] = useState(false)
  const pendingRequestsRef = useRef<Map<string, { resolve: (value: any) => void, reject: (error: Error) => void, timeoutId: TimeoutID }>>(new Map())

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
   * Request function for plugin communication (promise-based)
   * CRITICAL: Must use useCallback to prevent infinite loops when passed to AppContext
   */
  const requestFromPlugin = useCallback(
    (command: string, dataToSend: any = {}, timeout: number = 10000): Promise<any> => {
      if (!command) throw new Error('requestFromPlugin: command must be called with a string')

      const correlationId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      logDebug('Header', `requestFromPlugin: command="${command}", correlationId="${correlationId}"`)

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          const pending = pendingRequestsRef.current.get(correlationId)
          if (pending) {
            pendingRequestsRef.current.delete(correlationId)
            logDebug('Header', `requestFromPlugin TIMEOUT: command="${command}", correlationId="${correlationId}"`)
            reject(new Error(`Request timeout: ${command}`))
          }
        }, timeout)

        pendingRequestsRef.current.set(correlationId, { resolve, reject, timeoutId })

        const requestData = {
          ...dataToSend,
          __correlationId: correlationId,
          __requestType: 'REQUEST',
        }

        // Use sendActionToPlugin to send the request
        sendActionToPlugin(command, requestData, `Header: requestFromPlugin: ${String(command)}`, true)
      })
        .then((result) => {
          logDebug('Header', `requestFromPlugin RESOLVED: command="${command}", correlationId="${correlationId}"`)
          return result
        })
        .catch((error) => {
          logError('Header', `requestFromPlugin REJECTED: command="${command}", correlationId="${correlationId}", error="${error.message}"`)
          throw error
        })
    },
    [sendActionToPlugin],
  )

  /**
   * Listen for RESPONSE messages from plugin
   * Note: Messages come in format: { type: 'RESPONSE', payload: { correlationId, success, data, error } }
   */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const eventData: any = event.data
      // Check if this is a RESPONSE message (format from sendToHTMLWindow)
      if (eventData && eventData.type === 'RESPONSE' && eventData.payload) {
        const { correlationId, success, data, error } = eventData.payload
        if (correlationId && typeof correlationId === 'string') {
          const pending = pendingRequestsRef.current.get(correlationId)
          if (pending) {
            pendingRequestsRef.current.delete(correlationId)
            clearTimeout(pending.timeoutId)
            if (success) {
              pending.resolve(data)
            } else {
              pending.reject(new Error(error || 'Request failed'))
            }
          } else {
            logDebug('Header', `RESPONSE received for unknown correlationId: ${correlationId}`)
          }
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
      // Clean up any pending requests on unmount
      pendingRequestsRef.current.forEach((pending) => {
        clearTimeout(pending.timeoutId)
        pending.reject(new Error('Component unmounted'))
      })
      pendingRequestsRef.current.clear()
    }
  }, [])

  /**
   * Load notes for the add task dialog
   */
  const loadNotes = useCallback(async () => {
    if (notesLoaded || loadingNotes) return

    try {
      setLoadingNotes(true)
      logDebug('Header', 'Loading notes for add task dialog...')
      // Load all note types
      const notesData = await requestFromPlugin('getNotes', {
        includeCalendarNotes: true,
        includePersonalNotes: true,
        includeRelativeNotes: true,
        includeTeamspaceNotes: true,
      })
      if (Array.isArray(notesData)) {
        setNotes(notesData)
        setNotesLoaded(true)
        logDebug('Header', `Loaded ${notesData.length} notes`)
      } else {
        logError('Header', `Failed to load notes: Invalid response format`)
        setNotesLoaded(true)
      }
    } catch (error) {
      logError('Header', `Error loading notes: ${error.message}`)
      setNotesLoaded(true)
    } finally {
      setLoadingNotes(false)
    }
  }, [notesLoaded, loadingNotes, requestFromPlugin])

  /**
   * Reload notes after creating a new note
   */
  const reloadNotes = useCallback((): void => {
    setNotesLoaded(false)
    // Call loadNotes but don't await it - it's fire-and-forget
    loadNotes().catch((error) => {
      logError('Header', `Error reloading notes: ${error.message}`)
    })
  }, [loadNotes])

  /**
   * Handle opening the add task dialog
   */
  const handleOpenAddTaskDialog = useCallback(() => {
    setIsAddTaskDialogOpen(true)
    // Load notes when dialog opens
    if (!notesLoaded && !loadingNotes) {
      loadNotes()
    }
  }, [notesLoaded, loadingNotes, loadNotes])

  /**
   * Handle closing the add task dialog
   */
  const handleCloseAddTaskDialog = useCallback(() => {
    setIsAddTaskDialogOpen(false)
  }, [])

  /**
   * Handle saving the add task dialog
   */
  const handleAddTaskDialogSave = useCallback(
    (formValues: { [key: string]: any }) => {
      const space = formValues.space || ''
      const note = formValues.note || ''
      const task = formValues.task || ''
      const heading = formValues.heading || ''

      logDebug('Header', `Add task dialog save: space="${space}", note="${note}", task="${task}", heading="${heading}"`)

      if (!task.trim()) {
        logError('Header', 'Task text is required')
        return
      }

      if (!note) {
        logError('Header', 'Note is required')
        return
      }

      // Send action to plugin to add the task
      const dataToSend = {
        actionType: 'addTask',
        toFilename: note,
        taskText: task.trim(),
        heading: heading || undefined,
        space: space || undefined,
      }

      sendActionToPlugin('addTask', dataToSend, 'Add task dialog submitted', true)
      setIsAddTaskDialogOpen(false)
    },
    [sendActionToPlugin],
  )

  /**
   * Form fields for the add task dialog
   */
  const addTaskFormFields: Array<TSettingItem> = useMemo(
    () => [
      {
        type: 'space-chooser',
        key: 'space',
        label: 'Space',
        placeholder: 'Select space (Private or Teamspace)',
        includeAllOption: true,
        value: '',
      },
      {
        type: 'note-chooser',
        key: 'note',
        label: 'Note',
        placeholder: 'Type to search notes...',
        includeCalendarNotes: true,
        includePersonalNotes: true,
        includeRelativeNotes: true,
        includeTeamspaceNotes: true,
        sourceSpaceKey: 'space', // Filter notes by selected space
        value: '',
      },
      {
        type: 'input',
        key: 'task',
        label: 'Task',
        placeholder: 'Enter task text...',
        focus: true,
        required: true,
        value: '',
      },
      {
        type: 'heading-chooser',
        key: 'heading',
        label: 'Under Heading',
        placeholder: 'Select heading...',
        sourceNoteKey: 'note', // Get headings from selected note
        value: '',
      },
    ],
    [],
  )

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
  const isMobile = pluginData.platform !== 'macOS'
  const isNarrowWidth = window.innerWidth <= 700
  const isSearchPanelAvailable = dashboardSettings?.FFlag_ShowSearchPanel // Note: not yet used

  // ----------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------
  const timeAgoText = isMobile || isNarrowWidth ? timeAgo : timeAgo.replace(' mins', 'm').replace(' min', 'm').replace(' hours', 'h').replace(' hour', 'h')
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

          {/* addItem button - opens DynamicDialog for adding tasks */}
          <button accessKey="a"
            className="buttonsWithoutBordersOrBackground"
            title="Add new task/checklist"
            onClick={handleOpenAddTaskDialog}>
            <i className="fa-solid fa-hexagon-plus"></i>
          </button>

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
          {isMobile && <span className="modalCloseButtonSpacer"></span>}
          
        </div>

        {/* Render the SettingsDialog only when it is open */}
        {isDialogOpen && <SettingsDialog items={dashboardSettingsItems} className={'dashboard-settings'} onSaveChanges={handleChangesInSettings} />}

        {/* Render the Add Task Dialog */}
        {isAddTaskDialogOpen && (
          <DynamicDialog
            isOpen={isAddTaskDialogOpen}
            title="Add a new task"
            items={addTaskFormFields}
            onSave={handleAddTaskDialogSave}
            onCancel={handleCloseAddTaskDialog}
            submitButtonText="Add & Close"
            notes={notes}
            requestFromPlugin={requestFromPlugin}
            onNotesChanged={reloadNotes}
            isModal={true}
          />
        )}

      </header>

      {/* SearchPanel container with sliding animation */}
      <div className={`search-panel-container ${isSearchOpen ? 'open' : ''}`}>{(isSearchOpen || shouldRenderPanel) && <SearchPanel onClose={closeSearchPanel} />}</div>
    </div>
  )
}

export default Header
