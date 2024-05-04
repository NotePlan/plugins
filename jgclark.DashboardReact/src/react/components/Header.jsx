// @flow
import React, { useState, useEffect } from 'react'
import { getTimeAgo } from '../support/showTimeAgo.js'
import Button from './Button.jsx'
import { useAppContext } from './AppContext.jsx'
import DropdownMenu from './DropdownMenu.jsx'
import { logDebug } from '@helpers/react/reactDev.js'

type Props = {
  lastUpdated: string,
}

const Header = ({ lastUpdated }: Props): React$Node => {
  const { reactSettings, setReactSettings, sendActionToPlugin } = useAppContext()

  const [timeAgo, setTimeAgo] = useState(getTimeAgo(lastUpdated))
  useEffect(() => {
    const timer = setInterval(() => {
      if (reactSettings.refreshing) {
        setTimeAgo('Refreshing Data...')
      } else {
        setTimeAgo(getTimeAgo(lastUpdated))
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [lastUpdated, reactSettings])

  const handleSwitchChange = (key: string) => (e: any) => {
    const isChecked = e?.target.checked || false
    logDebug('Header', `Checkbox clicked. setting in global Context reactSettings.${key} to ${String(isChecked)}`)
    setReactSettings((prev) => ({ ...prev, [key]: isChecked }))
  }

  const handleRefreshClick = () => {
    logDebug('Header', 'Refresh button clicked')
    sendActionToPlugin('onClickDashboardItem', { type: 'refresh' }, 'Refresh button clicked', true)
    setReactSettings((prev) => ({ ...prev, refreshing: true }))
  }

  const dropdownItems = [
    { label: 'Filter out lower-priority items?', key: 'filterPriorityItems', checked: reactSettings?.filterPriorityItems || false },
    { label: 'Hide duplicates?', key: 'hideDuplicates', checked: reactSettings?.hideDuplicates || false },
    // Add more items as needed
  ]

  return (
    <div className="header">
      <div className="lastUpdated">
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
      <DropdownMenu items={dropdownItems} handleSwitchChange={handleSwitchChange} className="settings-cog" />
    </div>
  )
}

export default Header
