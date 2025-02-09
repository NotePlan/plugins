// @flow
//----------------------------------------------------------------------
// RefreshControl.jsx
// renders a refresh button or a refreshing spinner depending on refreshing state
// Last updated 2025-01-31 for v2.1.8 by @jgclark
//----------------------------------------------------------------------

import React from 'react'
import Button from './Button.jsx'
import { logDebug, logInfo } from '@helpers/dev'

type Props = {
  refreshing: boolean,
  firstRun?: boolean,
  handleRefreshClick: () => void,
}

/**
 * Conditional rendering based on the `refreshing` state.
 * Displays a spinner icon when data is being refreshed.
 * Otherwise, displays a refresh button.
 *
 * @param {Props} props - The props object containing plugin data and event handlers.
 * @returns {React$Node} - The spinner or button component based on the refreshing state.
 */
const RefreshControl = (props: Props): React$Node => {
  const { refreshing, firstRun, handleRefreshClick } = props
  logDebug('RefreshControl', `refreshing = ${String(refreshing)}, firstRun = ${String(firstRun)}`)
  return (
    <Button
      text={
        <>
          <i className={refreshing ? 'fa-regular fa-arrow-rotate-right fa-spin' : 'fa-regular fa-arrow-rotate-right'}></i>
          {/* <span className="pad-left">{refreshing ? 'Refreshing' : 'Refresh'}</span> */}
          <span className={refreshing || firstRun ? 'pad-left greyedText' : 'pad-left'}>{firstRun ? 'Generating' : 'Refresh'}</span>
        </>
      }
      clickHandler={handleRefreshClick}
      disabled={Boolean(refreshing || firstRun)}
      className="HAButton refreshButton"
    />
  )
}

export default RefreshControl
