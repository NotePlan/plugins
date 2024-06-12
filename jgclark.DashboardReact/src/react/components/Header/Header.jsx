// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Header at the top of the Dashboard window.
// Called by Dashboard component.
// Last updated 2024-06-04 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React from 'react'
// import { getFeatureFlags } from '../../shared.js'
import { createDashboardSettingsItems } from '../../../dashboardSettings.js'
import { useSettingsDialogHandler } from '../../customHooks/useSettingsDialogHandler.jsx'
import DropdownMenu from '../DropdownMenu.jsx'
import SettingsDialog from '../SettingsDialog.jsx'
import RefreshControl from '../RefreshControl.jsx'
import { useAppContext } from '../AppContext.jsx'
import { createFeatureFlagItems } from './featureFlagItems.js'
import { createFilterDropdownItems } from './filterDropdownItems.js'
import { useDropdownMenuHandler } from './useDropdownMenuHandler.jsx'
import useLastFullRefresh from './useLastFullRefresh.js'
import {
  handleSwitchChange,
  handleRefreshClick,
  handleSaveInput,
  handleDropdownFieldChange,
  onDropdownMenuChangesMade
} from './headerDropdownHandlers.js'
import { logDebug } from '@helpers/react/reactDev.js'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------

type Props = {
  lastFullRefresh: Date,
};

type DropdownMenuHandlerType = {
  openDropdownMenu: string | null,
  dropdownMenuChangesMade: boolean,
  setDropdownMenuChangesMade: (value: boolean) => void,
  handleToggleDropdownMenu: (dropdown: string) => void,
};

//--------------------------------------------------------------------------
// Header Component
//--------------------------------------------------------------------------

const Header = ({ lastFullRefresh }: Props): React$Node => {
  //----------------------------------------------------------------------
  // Context
  //----------------------------------------------------------------------
  const { sharedSettings, setSharedSettings, sendActionToPlugin, pluginData } = useAppContext()

  //----------------------------------------------------------------------
  // Hooks
  //----------------------------------------------------------------------
  const timeAgo = useLastFullRefresh(lastFullRefresh)

  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------
  const dropdownMenuHandler: DropdownMenuHandlerType = useDropdownMenuHandler(() => {
    // Removed the call to `onDropdownMenuChangesMade` here
  })

  const { openDropdownMenu, setDropdownMenuChangesMade, handleToggleDropdownMenu } = dropdownMenuHandler

  const { isDialogOpen, handleToggleDialog } = useSettingsDialogHandler(sendActionToPlugin)

  //----------------------------------------------------------------------
  // Constants
  //----------------------------------------------------------------------
  // const { FFlag_DashboardSettings } = getFeatureFlags(pluginData.settings, sharedSettings)

  const { settings: pluginDataSettings } = pluginData

  const dropdownItems = createFilterDropdownItems(sharedSettings, pluginDataSettings)
  const dashboardSettingsItems = createDashboardSettingsItems(sharedSettings, pluginDataSettings)
  const featureFlagItems = createFeatureFlagItems(sharedSettings, pluginDataSettings)

  const isDevMode = pluginDataSettings._logLevel === 'DEV'
  const showHardRefreshButton = isDevMode && sharedSettings?.FFlag_HardRefreshButton

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------
  return (
    <div className="header">
      <div className="lastFullRefresh">
        Last updated: <span id="timer">{timeAgo}</span>
      </div>

      <div className="refresh">
        <RefreshControl
          refreshing={pluginData.refreshing === true}
          handleRefreshClick={handleRefreshClick(sendActionToPlugin, false)}
        />
        {showHardRefreshButton && (
          <button
            onClick={handleRefreshClick(sendActionToPlugin, true)}
            className="PCButton hardRefreshButton"
          >
            <i className={"fa-solid fa-arrows-retweet"}></i>
            <span className="pad-left">Hard Refresh</span>
          </button>
        )}
      </div>

      <div className="totalCounts">
        {/* <span id="totalDoneCount">0</span> items closed */}
      </div>
      <div id="dropdowns" className="dropdownButtons">
        {/* Feature Flags dropdown */}
        {isDevMode && (
          <DropdownMenu
            items={featureFlagItems}
            handleSwitchChange={(key, e) => {
              handleDropdownFieldChange(setDropdownMenuChangesMade)()
              handleSwitchChange(sharedSettings, setSharedSettings, sendActionToPlugin)(key)(e)
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
          />
        )}
        {/* Display toggles dropdown menu */}
        <DropdownMenu
          items={dropdownItems}
          handleSwitchChange={(key, e) => {
            handleDropdownFieldChange(setDropdownMenuChangesMade)()
            handleSwitchChange(sharedSettings, setSharedSettings, sendActionToPlugin)(key)(e)
            onDropdownMenuChangesMade(setDropdownMenuChangesMade, sendActionToPlugin)() // Call here instead
          }}
          handleSaveInput={(key, newValue) => {
            handleDropdownFieldChange(setDropdownMenuChangesMade)()
            handleSaveInput(setSharedSettings)(key)(newValue)
            onDropdownMenuChangesMade(setDropdownMenuChangesMade, sendActionToPlugin)() // Call here instead
          }}
          className={'filter'}
          iconClass="fa-solid fa-filter"
          isOpen={openDropdownMenu === 'filter'}
          toggleMenu={() => handleToggleDropdownMenu('filter')}
          labelPosition="left"
          displayInColumnsIfPossible={true}
        />
        {/* Cog Icon for opening the settings dialog */}
        <div>
          <i
            className="fa-solid fa-gear"
            onClick={handleToggleDialog}
            style={{ cursor: 'pointer' }}
          ></i>
        </div>
      </div>
    </div>
  )
}

export default Header
