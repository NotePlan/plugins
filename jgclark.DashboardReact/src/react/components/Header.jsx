// @flow
import React, { useState, useEffect } from 'react'
import { getTimeAgo } from '../support/showTimeAgo.js'
import { type TSection } from '../../types.js'
import Button from './Button.jsx'
import { useAppContext } from './AppContext.jsx'
import DropdownMenu from './DropdownMenu.jsx'
import { logDebug } from '@helpers/react/reactDev.js'

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

  let dropdownItems = [
    { label: 'Filter out lower-priority items?', key: 'filterPriorityItems', checked: reactSettings?.filterPriorityItems || false },
    { label: 'Hide duplicates?', key: 'hideDuplicates', checked: reactSettings?.hideDuplicates || false },
  ]

  const sections = (pluginData?.sections ?? []).map((section: TSection) => ({
    label: `Show "${section.name}"`,
    key: `show_${section.sectionType}`,
    checked: reactSettings?.[`show_${section.sectionType}`] ?? true,
  }))

  dropdownItems = [...dropdownItems, ...sections]

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
      <DropdownMenu items={dropdownItems} handleSwitchChange={handleSwitchChange} className={'settings-cog'} />
    </div>
  )
}

export default Header
