// @flow
import React, { useState, useEffect } from 'react'
import { getTimeAgo } from '../support/showTimeAgo.js'
import Button from './Button.jsx'
import { useAppContext } from './AppContext.jsx'
import { logDebug } from '@helpers/reactDev.js'
type Props = {
  lastUpdated: string,
}

/**
 * Displays the dashboard's header.
 */
const Header = ({ lastUpdated }: Props): React$Node => {
  const { reactSettings, setReactSettings, sendActionToPlugin /*, sendToPlugin, dispatch, pluginData, */ } = useAppContext()

  // Deal with timeAgo timer section
  const [timeAgo, setTimeAgo] = useState(getTimeAgo(lastUpdated))
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeAgo(getTimeAgo(lastUpdated))
    }, 30000) // Update every 30 seconds

    return () => clearInterval(timer) // Clear interval on component unmount
  }, [lastUpdated])

  const handleCheckboxClick = (e: any) => {
    const isChecked = e?.target.checked || false
    logDebug('Header', `Checkbox clicked. setting in global Context reactSettings.filterPriorityItems to ${String(isChecked)}`)
    setReactSettings((prev) => ({ ...prev, filterPriorityItems: isChecked }))
  }

  const handleRefreshClick = () => {
    console.log('Refresh button clicked')
    sendActionToPlugin('refresh', { type: 'refresh' })
  }

  return (
    <div className="header">
      <div className="lastUpdated">
        Last updated: <span id="timer">{timeAgo}</span>
      </div>
      <Button text={'Refresh'} clickHandler={handleRefreshClick} className="PCButton" />
      <div className="totalCounts">
        <span id="totalDoneCount">0</span> items closed
      </div>
      <div>
        <input
          type="checkbox"
          className="apple-switch filterPriorityItems"
          onChange={handleCheckboxClick}
          name="filterPriorityItems"
          id="filterPriorityItems"
          checked={reactSettings?.filterPriorityItems || false}
        />
        <label htmlFor="filterPriorityItems">Filter out lower-priority items?</label>
      </div>
    </div>
  )
}

export default Header
