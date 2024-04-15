// @flow
import React from 'react'
import Button from './Button.jsx'
import { useAppContext } from './AppContext.jsx'

type Props = {
  lastUpdated: string,
}

/**
 * Displays the dashboard's header.
 */
const Header = ({ lastUpdated }: Props): React$Node => {
  const { reactSettings, updateReactSettings, sendActionToPlugin /*, sendToPlugin, dispatch, pluginData, */ } = useAppContext()

  const handleCheckboxClick = (e) => {
    const isChecked = e?.target.checked || false
    console.log(`Checkbox clicked. setting in global Context reactSettings.filterPriorityItems to ${String(isChecked)}`)
    updateReactSettings({ ...reactSettings, filterPriorityItems: isChecked }, `reactSettings.filterPriorityItems set to ${String(isChecked)}`)
  }

  const handleRefreshClick = () => {
    console.log('Refresh button clicked')
    sendActionToPlugin('refresh', {})
  }

  const calculateTimeSince = () => {
    return lastUpdated // placeholder - replace with the time since function
  }

  return (
    <div className="header">
      <div className="lastUpdated">
        Last updated: <span id="timer"></span>
        {' '}
      </div>
      <Button
        text={'Refresh'}
        clickHandler={handleRefreshClick}
        className="PCButton" />
      <div className="totalCounts">
        <span id="totalDoneCount">0</span> items closed
      </div>
      <div>
        <input
          type="checkbox"
          className="apple-switch"
          onChange={handleCheckboxClick}
          name="filterPriorityItems"
          id="filterPriorityItems"
          checked={reactSettings.filterPriorityItems || false}
        />
        <label htmlFor="filterPriorityItems">Filter out lower-priority items?</label>
      </div>
    </div>
  )
}

export default Header
