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
  const { sendActionToPlugin /*, sendToPlugin, dispatch, pluginData */ } = useAppContext()

  const handleCheckboxClick = () => {
    console.log('Checkbox clicked. need to do something here')
    sendActionToPlugin('refresh', {})
  }

  return (
    <div className="header">
      <div className="lastUpdated">
        Last updated: <span id="timer">{lastUpdated}</span>{' '}
      </div>
      <Button className="XCBButton" clickHandler={handleCheckboxClick} text={'Refresh'} />
      <div className="totalCounts">
        <span id="totalDoneCount">0</span> items closed
      </div>
      <div>
        <input type="checkbox" className="apple-switch" onChange={handleCheckboxClick} name="filterPriorityItems" id="filterPriorityItems" />
        <label htmlFor="filterPriorityItems">Filter out lower-priority items?</label>
      </div>
    </div>
  )
}

export default Header
