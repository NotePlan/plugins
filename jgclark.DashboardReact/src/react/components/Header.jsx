// @flow
//-----------------------------------------------------------------------------
// Header row in Dashboard
// Last updated 17.5.2024 for v2.0.0 by @jgclark
//-----------------------------------------------------------------------------

import React, { useState, useEffect } from 'react'
import { getTimeAgo } from '../support/showTimeAgo.js'
import { allSectionDetails, nonSectionSwitches } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import RefreshControl from './RefreshControl.jsx'
import DropdownMenu from './DropdownMenu.jsx'
import { logDebug, clo, JSP } from '@helpers/react/reactDev.js'

type Props = {
  lastFullRefresh: Date,
}

const Header = ({ lastFullRefresh }: Props): React$Node => {
  const { sharedSettings, setSharedSettings, sendActionToPlugin, pluginData } = useAppContext()
  const [timeAgo, setTimeAgo] = useState(getTimeAgo(lastFullRefresh))

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeAgo(getTimeAgo(lastFullRefresh))
    }, 1000)

    return () => clearInterval(timer)
  }, [lastFullRefresh])

  const handleSwitchChange = (key:string) => (e: any) => {
    if (!sharedSettings || Object.keys(sharedSettings).length === 0) return

    const isSection = key.startsWith('show')
    const isChecked = e?.target.checked || false
    logDebug('Header', `Checkbox clicked. setting in global Context sharedSettings.${key} to ${String(isChecked)}`)
    // this saves the change in local context, and then it will be picked up and sent to plugin
    if (setSharedSettings && sharedSettings && sharedSettings[key] !== isChecked) {
      logDebug('Header', `Checkbox clicked. sharedSettings[key] was ${sharedSettings[key]}. setting in global Context sharedSettings.${key} to ${String(isChecked)}`)
      setSharedSettings((prev) => ({ ...prev, [key]: isChecked, lastChange: `showKey changed: ${key}=${isChecked}` }))
      if (isChecked && isSection && key.startsWith('show')) { // this is a section show/hide setting
        // call for new data for a section just turned on
        const sectionCode = allSectionDetails.find(s => s.showSettingName === key)?.sectionCode ?? null
        logDebug(`Header`,`${key} turned on, so refreshing section: ${sectionCode||'<not set>'}`)
        if (sectionCode) {
          const payload = {actionType:'refreshSomeSections', sectionCodes:[sectionCode] }
          sendActionToPlugin('refreshSomeSections', payload, `Refreshing some sections`, true)
        }
      }
      if(!isSection) {
        const refreshAllOnChange = nonSectionSwitches.find(s => s.key === key)?.refreshAllOnChange
        if (refreshAllOnChange) {
          sendActionToPlugin('refresh', {actionType:'refresh'}, `Refreshing all sections`, true)
        }
      }
    }
  }

  const handleRefreshClick = () => {
    logDebug('Header', 'Refresh button clicked')
    const actionType = 'refresh'
    sendActionToPlugin(actionType, { actionType }, 'Refresh button clicked', true)
  }

  const tagSectionStr = pluginData?.sections.find(a => a.sectionCode === 'TAG')?.name ?? '' // TODO: settings.tagToShow

  // const dropdownSectionNames = (pluginData?.sections ?? []).map((section: TSection) => ({
  const dropdownSectionNames = allSectionDetails.filter(s => (s.showSettingName !== '')).map((s) => ({
    label: `Show ${s.sectionCode !== 'TAG' ? s.sectionName : tagSectionStr}`,
    key: s.showSettingName,
    checked: (typeof sharedSettings !== undefined && sharedSettings[s.showSettingName]) ?? true,
  }))
  // NOTE: only section name on/off can start with the word "show" (e.g. showOverdueSection, showYesterdaySection, etc.)
  // Other settings can be any text but should not start with show (e.g. filterPriorityItems, hideDuplicates, etc.)
  // They should all be pulled from the [types] file 
  let dropdownItems = nonSectionSwitches.map(s => ({ label: s.label, key: s.key, checked: (typeof sharedSettings !== undefined && sharedSettings[s.key]) ?? s.default }))

  dropdownItems = [...dropdownItems, ...dropdownSectionNames]

  return (
    <div className="header">
      <div className="lastFullRefresh">
        Last updated: <span id="timer">{timeAgo}</span>
      </div>

      <RefreshControl refreshing={pluginData.refreshing === true} handleRefreshClick={handleRefreshClick} />
      
      <div className="totalCounts">
        {/* <span id="totalDoneCount">0</span> items closed */}
      </div>
      <DropdownMenu items={dropdownItems} handleSwitchChange={handleSwitchChange} className={'filter'} />
      {/* TODO(later): more detailed setting dialog, using className={'settings'} and icon fa-gear */}
    </div>
  )
}

export default Header
