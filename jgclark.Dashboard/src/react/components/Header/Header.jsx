// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Header at the top of the Dashboard window.
// Called by Dashboard component.
// Last updated 2024-10-11 for v2.1.0.a13 by @jgclark
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React from 'react'
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
import PerspectiveSelector  from './PerspectiveSelector.jsx'
import { useDropdownMenuHandler } from './useDropdownMenuHandler.jsx'
import useLastFullRefresh from './useLastFullRefresh.js'
import {
  handleSwitchChange,
  handleRefreshClick,
  handleSaveInput,
  handleDropdownFieldChange,
  onDropdownMenuChangesMade
} from './headerDropdownHandlers.js'
import { clo, logDebug } from '@helpers/react/reactDev.js'
import './Header.css'

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
  const { dashboardSettings, dispatchDashboardSettings, sendActionToPlugin, pluginData, perspectiveSettings, dispatchPerspectiveSettings } = useAppContext()

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
  const { sections, logSettings } = pluginData

  const [dropdownSectionItems, dropdownOtherItems] = createFilterDropdownItems(dashboardSettings)
  const dashboardSettingsItems = createDashboardSettingsItems(dashboardSettings)
  const featureFlagItems = createFeatureFlagItems(dashboardSettings)

  const isDevMode = logSettings._logLevel === 'DEV'
  const showHardRefreshButton = isDevMode && dashboardSettings?.FFlag_HardRefreshButton
  const isMobile = pluginData.platform !== "macOS"
  const isNarrowWidth = window.innerWidth <= 650
  const updatedText = "Updated"

  const visibleSectionCodes = getVisibleSectionCodes(dashboardSettings, sections)

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------
  const timeAgoText = isMobile || isNarrowWidth ? timeAgo : timeAgo.replace(" mins", "m").replace(" min", "m").replace(" hours", "h").replace(" hour", "h")

  return (
    <div className="header">
      {/* Perspective selector */}
      {dashboardSettings.showPerspectives && (
        <div className="perspectiveName">
          <PerspectiveSelector />
        </div>
      )}

      <div className="refresh">
        <RefreshControl
          refreshing={pluginData.refreshing === true}
          handleRefreshClick={handleRefreshClick(sendActionToPlugin, false, visibleSectionCodes)}
        />
        {showHardRefreshButton && (
          <button
            onClick={handleRefreshClick(sendActionToPlugin, true, visibleSectionCodes)}
            className="HAButton hardRefreshButton"
          >
            <i className={"fa-regular fa-arrows-retweet"}></i>
            <span className="pad-left">{isNarrowWidth ? "HR" : "Hard Refresh"}</span>
          </button>
        )}
      </div>

      <div className="lastFullRefresh">
        {updatedText}: <span id="timer">{timeAgoText}</span>
      </div>

      <div className="totalCounts">
        {pluginData?.totalDoneCounts
          ? <DoneCounts totalDoneCounts={pluginData.totalDoneCounts} />
          : ''}
      </div>

      <div id="dropdowns" className="dropdownButtons">
        {/* Feature Flags dropdown */}
        {isDevMode && (
          <DropdownMenu
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
          />
        )}
        {/* Display toggles dropdown menu */}
        <DropdownMenu
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
