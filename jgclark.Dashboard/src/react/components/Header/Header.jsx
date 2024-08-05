// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Header at the top of the Dashboard window.
// Called by Dashboard component.
// Last updated 2024-08-02 for v2.1.0.a3 by @jgclark
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React from 'react'
import { createDashboardSettingsItems } from '../../../dashboardSettings.js'
import { useSettingsDialogHandler } from '../../customHooks/useSettingsDialogHandler.jsx'
import DropdownMenu from '../DropdownMenu.jsx'
import SettingsDialog from '../SettingsDialog.jsx'
import RefreshControl from '../RefreshControl.jsx'
import { useAppContext } from '../AppContext.jsx'
import DoneCounts from './DoneCounts.jsx'
import { createFeatureFlagItems } from './featureFlagItems.js'
import { createFilterDropdownItems } from './filterDropdownItems.js'
import { useDropdownMenuHandler } from './useDropdownMenuHandler.jsx'
import PerspectiveSelector  from './PerspectiveSelector.jsx'
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
  const { dashboardSettings, setDashboardSettings, sendActionToPlugin, pluginData } = useAppContext()

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
  const {/* pluginDataSettings, notePlanSettings, */ logSettings } = pluginData

  const [dropdownSectionItems, dropdownOtherItems] = createFilterDropdownItems(dashboardSettings)
  const dashboardSettingsItems = createDashboardSettingsItems(dashboardSettings)
  const featureFlagItems = createFeatureFlagItems(dashboardSettings)

  const isDevMode = logSettings._logLevel === 'DEV'
  const showHardRefreshButton = isDevMode && dashboardSettings?.FFlag_HardRefreshButton

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------

  // TODO: HELP: I get lost on what to put here.
  // These are two handlers from other places for reference.
  // const handleOptionClick = (option: string) => {
  //   setSelectedValue(option)
  //   onChange(option)
  //   setIsOpen(false)
  // }

  // const handleFieldChange = (key: string, value: any) => {
  //   setUpdatedSettings(prevSettings => ({ ...prevSettings, [key]: value }))
  // }

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------
  const isDesktop = pluginData.platform === "macOS"
  const updatedText = "Updated"
  const timeAgoText = isDesktop ? timeAgo : timeAgo.replace(" mins", "m").replace(" min", "m")

  return (
    <div className="header">
      <div className="perspectiveName">
        {dashboardSettings.FFlag_Perspectives && (
          <PerspectiveSelector/>
        )}
      </div>

      <div className="lastFullRefresh">
        {updatedText}: <span id="timer">{timeAgoText}</span>
      </div>

      <div className="refresh">
        <RefreshControl
          refreshing={pluginData.refreshing === true}
          handleRefreshClick={handleRefreshClick(sendActionToPlugin, false)}
        />
        {showHardRefreshButton && (
          <button
            onClick={handleRefreshClick(sendActionToPlugin, true)}
            className="HAButton hardRefreshButton"
          >
            <i className={"fa-regular fa-arrows-retweet"}></i>
            <span className="pad-left">{isDesktop ? "Hard Refresh" : " HR "}</span>
          </button>
        )}
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
              handleSwitchChange(dashboardSettings, setDashboardSettings, sendActionToPlugin)(key)(e)
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
            handleSwitchChange(dashboardSettings, setDashboardSettings, sendActionToPlugin)(key)(e)
            onDropdownMenuChangesMade(setDropdownMenuChangesMade, sendActionToPlugin)() // Call here instead
          }}
          handleSaveInput={(key, newValue) => {
            handleDropdownFieldChange(setDropdownMenuChangesMade)()
            handleSaveInput(setDashboardSettings)(key)(newValue)
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
            style={{ cursor: 'pointer' }}
          ></i>
        </div>
      </div>
    </div>
  )
}

export default Header
