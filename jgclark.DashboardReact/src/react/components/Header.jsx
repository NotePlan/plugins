// @flow
import React from 'react'
import { getTimeAgo } from '../support/showTimeAgo.js'
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

  // Deal with timeAgo timer section
  const [timeAgo, setTimeAgo] = useState(getTimeAgo(lastUpdated))
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeAgo(getTimeAgo(lastUpdated))
    }, 30000) // Update every 30 seconds

    return () => clearInterval(timer) // Clear interval on component unmount
  }, [lastUpdated])

  const handleCheckboxClick = (e) => {
    const isChecked = e?.target.checked || false
    console.log(`Checkbox clicked. setting in global Context reactSettings.filterPriorityItems to ${String(isChecked)}`)
    updateReactSettings({ ...reactSettings, filterPriorityItems: isChecked }, `reactSettings.filterPriorityItems set to ${String(isChecked)}`)
  }

  const handleRefreshClick = () => {
    console.log('Refresh button clicked')
    sendActionToPlugin('refresh', { type: 'refresh' })
  }

  const calculateTimeSince = () => {
    return lastUpdated // placeholder - replace with the time since function
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
