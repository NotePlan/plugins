// @flow
//-----------------------------------------------------------------------------
// Header row in Dashboard
// Last updated 6.5.2024 for v2.0.0 by @jgclark
//-----------------------------------------------------------------------------

import React, { useState, useEffect } from 'react'
import { getTimeAgo } from '../support/showTimeAgo.js'
import { allSectionDetails } from '../../types.js'
import Button from './Button.jsx'
import { useAppContext } from './AppContext.jsx'
import DropdownMenu from './DropdownMenu.jsx'
import { logDebug } from '@helpers/react/reactDev.js'
import { clo } from '@helpers/dev'

type Props = {
  lastFullRefresh: string,
}

const Header = ({ lastFullRefresh }: Props): React$Node => {
  const { reactSettings, setReactSettings, sendActionToPlugin, pluginData } = useAppContext()

  const [timeAgo, setTimeAgo] = useState(getTimeAgo(lastFullRefresh))

  useEffect(() => {
    const timer = setInterval(() => {
      if (reactSettings?.refreshing) {
        setTimeAgo('Refreshing Data...')
      } else {
        setTimeAgo(getTimeAgo(lastFullRefresh))
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [lastFullRefresh, reactSettings])

  const handleSwitchChange = (key: string) => (e: any) => {
    const isChecked = e?.target.checked || false
    logDebug('Header', `Checkbox clicked. setting in global Context reactSettings.${key} to ${String(isChecked)}`)
    setReactSettings((prev) => ({ ...prev, [key]: isChecked, lastChange: `${key} change` }))
  }

  const handleRefreshClick = () => {
    logDebug('Header', 'Refresh button clicked')
    const actionType = 'refresh'
    sendActionToPlugin(actionType, { actionType }, 'Refresh button clicked', true)
    setReactSettings((prev) => ({ ...prev, refreshing: true, lastChange: `_Dashboard-RefreshClick` }))
  }

  const tagSectionStr = pluginData?.sections.find(a => a.sectionCode === 'TAG')?.name ?? ''
  // const dropdownSectionNames = (pluginData?.sections ?? []).map((section: TSection) => ({
  const dropdownSectionNames = allSectionDetails.filter(s => s.showSettingName !== '').map(s => ({
    label: `Show ${s.sectionCode !== 'TAG' ? s.sectionName : tagSectionStr}`,
    key: `${s.showSettingName}`,
    checked: reactSettings?.[`${s.showSettingName}`] ?? true,
  }))

  let dropdownItems = [
    { label: 'Filter out lower-priority items?', key: 'filterPriorityItems', checked: reactSettings?.filterPriorityItems || false },
    { label: 'Hide checklist items?', key: 'ignoreChecklistItems', checked: reactSettings?.ignoreChecklistItems || false },
    { label: 'Hide duplicates?', key: 'hideDuplicates', checked: reactSettings?.hideDuplicates || false },
  ]

  dropdownItems = [...dropdownItems, ...dropdownSectionNames]

  return (
    <div className="header">
      <div className="lastFullRefresh">
        Last updated: <span id="timer">{timeAgo}</span>
      </div>
      <Button
        text={
          <>
            <i className="fa-regular fa-arrow-rotate-right"></i> <span className="pad-left">Refresh</span>
          </>
        }
        clickHandler={handleRefreshClick}
        className="PCButton refreshButton"
      ></Button>
      <div className="totalCounts">
        <span id="totalDoneCount">0</span> items closed
      </div>
      <DropdownMenu items={dropdownItems} handleSwitchChange={handleSwitchChange} className={'filter'} />
      {/* TODO(later): more detailed setting dialog, using className={'settings'} and icon fa-gear */}
    </div>
  )
}

export default Header
