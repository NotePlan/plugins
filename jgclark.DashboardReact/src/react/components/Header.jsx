// @flow
import React, { useState, useEffect } from 'react'
import { getFeatureFlags } from '../../shared.js'
import { createDropdownItems } from '../support/filterDropdownItems'
import { createFeatureFlagItems } from '../support/featureFlagItems'
import { createDashboardSettingsItems } from '../support/dashboardSettingsItems.js'
import { handleSwitchChange, handleRefreshClick, handleSaveInput, handleDropdownFieldChange, handleToggleDropdownMenu, handleOpenMenuEffect, onDropdownMenuChangesMade } from '../support/headerHandlers'
import useLastFullRefresh from '../support/useLastFullRefresh'
import useSharedSettingsLogger from '../support/useSharedSettingsLogger'
import DropdownMenu from './DropdownMenu.jsx'
import RefreshControl from './RefreshControl.jsx'
import { useAppContext } from './AppContext.jsx'

type Props = {
  lastFullRefresh: Date,
};

const Header = ({ lastFullRefresh }: Props): React$Node => {
  const { sharedSettings, setSharedSettings, sendActionToPlugin, pluginData } = useAppContext()
  const timeAgo = useLastFullRefresh(lastFullRefresh)
  useSharedSettingsLogger(sharedSettings)
  const { FFlag_DashboardSettings } = getFeatureFlags(pluginData.settings, sharedSettings)
  const { settings } = pluginData

  const [openDropdownMenu, setOpenDropdownMenu] = useState<string | null>(null)
  const [dropdownMenuChangesMade, setDropdownMenuChangesMade] = useState(false)

  const tagSectionStr = pluginData?.sections.find(a => a.sectionCode === 'TAG')?.name ?? '' // TODO: settings.tagToShow

  const dropdownItems = createDropdownItems(sharedSettings, tagSectionStr, pluginData.settings)
  const dashboardSettingsItems = createDashboardSettingsItems(sharedSettings, pluginData.settings)
  const featureFlagItems = createFeatureFlagItems(sharedSettings, pluginData.settings)

  const onChangesMade = onDropdownMenuChangesMade(setDropdownMenuChangesMade, sendActionToPlugin)

  useEffect(() => {
    handleOpenMenuEffect(openDropdownMenu, dropdownMenuChangesMade, onChangesMade)
  }, [openDropdownMenu, dropdownMenuChangesMade, onChangesMade])

  return (
    <div className="header">
      <div className="lastFullRefresh">
        Last updated: <span id="timer">{timeAgo}</span>
      </div>

      <RefreshControl refreshing={pluginData.refreshing === true} handleRefreshClick={handleRefreshClick(sendActionToPlugin)} />

      <div className="totalCounts">
        {/* <span id="totalDoneCount">0</span> items closed */}
      </div>
      <div id="dropdowns">
        {settings?._logLevel === 'DEV' && <DropdownMenu
          items={featureFlagItems}
          handleSwitchChange={(key) => (e) => {
            handleDropdownFieldChange(setDropdownMenuChangesMade)()
            handleSwitchChange(sharedSettings, setSharedSettings, sendActionToPlugin)(key)(e)
          }}
          className={'feature-flags'}
          iconClass="fa-solid fa-flag"
          isOpen={openDropdownMenu === 'featureFlags'}
          toggleMenu={() => handleToggleDropdownMenu(openDropdownMenu, setOpenDropdownMenu, dropdownMenuChangesMade, onChangesMade)('featureFlags')}
          labelPosition="left"
          style={{ width: "200px", right: "10px" }} // Adjust the width as needed
        />}
        {FFlag_DashboardSettings && <DropdownMenu
          items={dashboardSettingsItems}
          handleSaveInput={(key) => (newValue) => {
            handleDropdownFieldChange(setDropdownMenuChangesMade)()
            handleSaveInput(setSharedSettings)(key)(newValue)
          }}
          handleSwitchChange={(key) => (e) => {
            handleDropdownFieldChange(setDropdownMenuChangesMade)()
            handleSwitchChange(sharedSettings, setSharedSettings, sendActionToPlugin)(key)(e)
          }}
          handleComboChange={(key) => (e) => {
            handleDropdownFieldChange(setDropdownMenuChangesMade)()
            handleSaveInput(setSharedSettings)(key)(e)
          }}
          className={'dashboard-settings'}
          iconClass="fa-solid fa-gear"
          isOpen={openDropdownMenu === 'dashboardSettings'}
          toggleMenu={() => handleToggleDropdownMenu(openDropdownMenu, setOpenDropdownMenu, dropdownMenuChangesMade, onChangesMade)('dashboardSettings')}
          style={{ width: "550px", right: "10px" }} // Adjust the width as needed
          onChangesMade={onChangesMade}
        />}
        <DropdownMenu
          items={dropdownItems}
          handleSwitchChange={(key) => (e) => {
            handleDropdownFieldChange(setDropdownMenuChangesMade)()
            handleSwitchChange(sharedSettings, setSharedSettings, sendActionToPlugin)(key)(e)
          }}
          handleSaveInput={(key) => (newValue) => {
            handleDropdownFieldChange(setDropdownMenuChangesMade)()
            handleSaveInput(setSharedSettings)(key)(newValue)
          }}
          className={'filter'}
          iconClass="fa-solid fa-filter"
          isOpen={openDropdownMenu === 'filter'}
          toggleMenu={() => handleToggleDropdownMenu(openDropdownMenu, setOpenDropdownMenu, dropdownMenuChangesMade, onChangesMade)('filter')}
          labelPosition="left"
          style={{ width: "300px", right: "10px" }} // Adjust the width as needed
        />
      </div>
      {/* TODO: more detailed setting dialog, using className={'settings'} and icon fa-gear */}
    </div>
  )
}

export default Header
