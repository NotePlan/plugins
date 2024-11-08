// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Header at the top of the Dashboard window.
// Called by Dashboard component.
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useState, useEffect, useCallback } from 'react'
import { createDashboardSettingsItems } from '../../../dashboardSettings.js'
import { getVisibleSectionCodes } from '../Section/sectionHelpers.js'
import { useSettingsDialogHandler } from '../../customHooks/useSettingsDialogHandler.jsx'
import DropdownMenu from '../DropdownMenu.jsx'
import SettingsDialog from '../SettingsDialog.jsx'
import RefreshControl from '../RefreshControl.jsx'
import { useAppContext } from '../AppContext.jsx'
import DoneCounts from './DoneCounts.jsx'
import { createFeatureFlagItems } from './featureFlagItems.js'
import { createFilterDropdownItems } from './filterDropdownItems.js'
import PerspectiveSelector from './PerspectiveSelector.jsx'
import useLastFullRefresh from './useLastFullRefresh.js'
import { handleSwitchChange, handleRefreshClick, handleSaveInput, handleDropdownFieldChange, onDropdownMenuChangesMade } from './headerDropdownHandlers.js'
import { clo, logDebug } from '@helpers/react/reactDev.js'
import './Header.css'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------

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
  //----------------------------------------------------------------------
  // Context
  //----------------------------------------------------------------------
  const { dashboardSettings, dispatchDashboardSettings, sendActionToPlugin, pluginData, perspectiveSettings, dispatchPerspectiveSettings } = useAppContext()

  //----------------------------------------------------------------------
  // Hooks
  //----------------------------------------------------------------------
  const timeAgo = useLastFullRefresh(lastFullRefresh)

  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------
  const [openDropdownMenu, setOpenDropdownMenu] = useState<string | null>(null)
  const [dropdownMenuChangesMade, setDropdownMenuChangesMade] = useState(false)
  const { isDialogOpen, handleToggleDialog } = useSettingsDialogHandler(sendActionToPlugin)

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------
  /**
   * Toggles the open/closed state of a dropdown menu.
   * @param {string} dropdown - The identifier of the dropdown menu to toggle.
   */
  const handleToggleDropdownMenu = (dropdown: string) => {
    setOpenDropdownMenu(openDropdownMenu === dropdown ? null : dropdown)
  }

  /**
   * Effect hook that runs when openDropdownMenu or dropdownMenuChangesMade changes.
   * Currently empty but can be used for side-effects.
   */
  useEffect(() => {
    // Any necessary side-effects when openDropdownMenu or dropdownMenuChangesMade change
  }, [openDropdownMenu, dropdownMenuChangesMade])

  const handleChangesInSettings = useCallback(
    (updatedSettings?: Object) => {
      // FIXME: finish this
      setDropdownMenuChangesMade(false)
      if (updatedSettings) {
        // this came from the SettingsDialog
      } else {
        // this came from the DropdownMenu
      }
      logDebug('Header/handleChangesInSettings', `handleChangesInSettings called!`)
      // let settingsToSave = updatedSettings
      // if (updatedSettings.perspectiveSettings) {
      //   logDebug(`SettingsDialog/handleSave`, `Updating perspectiveSettings from the dialog`)
      //   // setPerspectivesIfJSONChanged will peel off perspectiveSettings if it has changed via the JSON editor and leave the rest to be saved as dashboardSettings
      //   settingsToSave = setPerspectivesIfJSONChanged(updatedSettings, dashboardSettings, dispatchPerspectiveSettings, `Dashboard Settings Panel updates`)
      // }
      // dispatchDashboardSettings({
      //   type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS,
      //   payload: settingsToSave,
      //   reason: `Dashboard Settings saved from (modal or menu)`,
      // })
      // sendActionToPlugin(
      //   'incrementallyRefreshSections',
      //   { sectionCodes: allSectionCodes, logMessage: `Refreshing b/c settings were changed` },
      //   `Refreshing b/c settings were changed`,
      //   true,
      // )
    },
    [dashboardSettings, dispatchDashboardSettings, dispatchPerspectiveSettings, perspectiveSettings],
  )

  //----------------------------------------------------------------------
  // Constants
  //----------------------------------------------------------------------
  const { sections, logSettings } = pluginData

  const [dropdownSectionItems, dropdownOtherItems] = createFilterDropdownItems(dashboardSettings)
  const dashboardSettingsItems = createDashboardSettingsItems(dashboardSettings)
  const featureFlagItems = createFeatureFlagItems(dashboardSettings)

  const isDevMode = logSettings._logLevel === 'DEV'
  const showHardRefreshButton = isDevMode && dashboardSettings?.FFlag_HardRefreshButton
  const isMobile = pluginData.platform !== 'macOS'
  const isNarrowWidth = window.innerWidth <= 650
  const updatedText = 'Updated'

  const visibleSectionCodes = getVisibleSectionCodes(dashboardSettings, sections)

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------
  const timeAgoText = isMobile || isNarrowWidth ? timeAgo : timeAgo.replace(' mins', 'm').replace(' min', 'm').replace(' hours', 'h').replace(' hour', 'h')

  return (
    <div className="header">
      {/* Perspective selector */}
      {dashboardSettings.showPerspectives && (
        <div className="perspectiveName">
          <PerspectiveSelector />
        </div>
      )}

      <div className="refresh">
        <RefreshControl refreshing={pluginData.refreshing === true} handleRefreshClick={handleRefreshClick(sendActionToPlugin, false, visibleSectionCodes)} />
        {showHardRefreshButton && (
          <button onClick={handleRefreshClick(sendActionToPlugin, true, visibleSectionCodes)} className="HAButton hardRefreshButton">
            <i className={'fa-regular fa-arrows-retweet'}></i>
            <span className="pad-left">{isNarrowWidth ? 'HR' : 'Hard Refresh'}</span>
          </button>
        )}
      </div>

      <div className="lastFullRefresh">
        {updatedText}: <span id="timer">{timeAgoText}</span>
      </div>

      <div className="totalCounts">{dashboardSettings.displayDoneCounts && pluginData?.totalDoneCounts ? <DoneCounts totalDoneCounts={pluginData.totalDoneCounts} /> : ''}</div>

      <div id="dropdowns" className="dropdownButtons">
        {/* Feature Flags dropdown */}
        {isDevMode && (
          <DropdownMenu
            onSaveChanges={handleChangesInSettings}
            otherItems={featureFlagItems}
            handleSwitchChange={(key, e) => {
              handleDropdownFieldChange(setDropdownMenuChangesMade)()
              handleSwitchChange(dashboardSettings, dispatchDashboardSettings, sendActionToPlugin, perspectiveSettings, dispatchPerspectiveSettings)(key)(e)
              onDropdownMenuChangesMade(setDropdownMenuChangesMade, sendActionToPlugin)() // Call here instead
            }}
            className={'feature-flags'}
            iconClass="fa-solid fa-flag"
            isOpen={openDropdownMenu === 'featureFlags'}
            toggleMenu={() => handleToggleDropdownMenu('featureFlags')}
            labelPosition="left"
          />
        )}
        {/* Render the SettingsDialog only when it is open */}
        {isDialogOpen && (
          <SettingsDialog
            items={dashboardSettingsItems}
            className={'dashboard-settings'}
            isOpen={isDialogOpen}
            toggleDialog={handleToggleDialog}
            onSaveChanges={handleChangesInSettings}
          />
        )}
        {/* Display toggles dropdown menu */}
        <DropdownMenu
          onSaveChanges={handleChangesInSettings}
          sectionItems={dropdownSectionItems}
          otherItems={dropdownOtherItems}
          handleSwitchChange={(key, e) => {
            handleDropdownFieldChange(setDropdownMenuChangesMade)()
            handleSwitchChange(dashboardSettings, dispatchDashboardSettings, sendActionToPlugin, perspectiveSettings, dispatchPerspectiveSettings)(key)(e)
            onDropdownMenuChangesMade(setDropdownMenuChangesMade, sendActionToPlugin)() // Call here instead
          }}
          handleSaveInput={(key, newValue) => {
            handleDropdownFieldChange(setDropdownMenuChangesMade)()
            handleSaveInput(dispatchDashboardSettings)(key)(newValue)
            onDropdownMenuChangesMade(setDropdownMenuChangesMade, sendActionToPlugin)() // Call here instead
          }}
          className={'filter'}
          iconClass="fa-solid fa-filter"
          isOpen={openDropdownMenu === 'filter'}
          toggleMenu={() => handleToggleDropdownMenu('filter')}
          labelPosition="left"
        />
        {/* Cog Icon for opening the settings dialog */}
        <div>
          <i
            className="fa-solid fa-gear"
            onClick={handleToggleDialog}
            // style={{ cursor: 'pointer' }}
          ></i>
        </div>
      </div>
    </div>
  )
}

export default Header
