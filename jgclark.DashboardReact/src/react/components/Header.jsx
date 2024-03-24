// @flow
import React from 'react'
import Button from './Button.jsx'

type Props = {
  lastUpdated: string,
  totalItems: number,
};

/**
 * Displays the dashboard's header.
 */
const Header = ({ lastUpdated, totalItems }: Props):React$Node => (
  <div className="header">
    <div>Last updated: {lastUpdated}</div>
    <div>{totalItems} items closed</div>
    <Button text="Refresh" onClick={() => {}} />
  </div>
)
 
export default Header
