// @flow
//----------------------------------------------------------------------
// RefreshControl.jsx
// renders a refresh button or a refreshing spinner depending on refreshing state
// Last updated 2024-09-18 for v2.1.0.a11 by @jgclark
//----------------------------------------------------------------------

import React from 'react'
import Button from './Button.jsx'

type Props = {
  refreshing: boolean,
  handleRefreshClick: () => void,
}

/**
 * Conditional rendering based on the `refreshing` state.
 * Displays a spinner icon when data is being refreshed.
 * Otherwise, displays a refresh button.
 *
 * @param {Props} props - The props object containing plugin data and event handlers.
 * @returns {React.ReactNode} - The spinner or button component based on the refreshing state.
 */
const RefreshControl = (props: Props): React.ReactNode => {
  const { refreshing, handleRefreshClick } = props
  return (
    <Button
      text={
        <>
          {/* <i className={refreshing ? "fa-spinner fa-spin" : "fa-regular fa-arrow-rotate-right"}></i> */}
          <i className={refreshing ? 'fa-regular fa-arrow-rotate-right fa-spin' : 'fa-regular fa-arrow-rotate-right'}></i>
          {/* <span className="pad-left">{refreshing ? 'Refreshing' : 'Refresh'}</span> */}
          <span className={refreshing ? "pad-left greyedText" : "pad-left"}>Refresh</span>
        </>
      }
      clickHandler={handleRefreshClick}
      disabled={refreshing}
      className="HAButton refreshButton"
    />
  )
}

export default RefreshControl
