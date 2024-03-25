// @flow
import React from 'react'
import Button from './Button.jsx'

type Props = {
  lastUpdated: string,
  totalItems: number,
  refreshHandler: () => void,
}

const handleCheckboxClick = () => {
  console.log('Checkbox clicked. need to do something here')
}

/**
 * Displays the dashboard's header.
 */
const Header = ({ lastUpdated, totalItems, refreshHandler }: Props): React$Node => {
  return (
    <div className="header">
      <div className="lastUpdated">
        Last updated: <span id="timer">{lastUpdated}</span>{' '}
      </div>
      <Button className="XCBButton" clickHandler={refreshHandler} text={'Refresh'} />
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
