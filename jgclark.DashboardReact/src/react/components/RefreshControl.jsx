// RefreshControl.jsx
// renders a refresh button or a refreshing spinner depending on refreshing state

// @flow
import React from 'react'
import Button from './Button.jsx'

type Props = {
  refreshing: boolean,
  handleRefreshClick: () => void,
};

/**
 * Conditional rendering based on the `refreshing` state.
 * Displays a spinner icon when data is being refreshed.
 * Otherwise, displays a refresh button.
 *
 * @param {Props} props - The props object containing plugin data and event handlers.
 * @returns {React$Node} - The spinner or button component based on the refreshing state.
 */
const RefreshControl = (props: Props): React$Node => {
  const { refreshing, handleRefreshClick } = props
  return (
    <>
      {refreshing ? (
        <i className="fa fa-spinner fa-spin"></i>
      ) : (
        <Button
          text={
            <>
              <i className="fa-regular fa-arrow-rotate-right"></i>
              <span className="pad-left">Refresh</span>
            </>
          }
          clickHandler={handleRefreshClick}
          className="PCButton refreshButton"
        />
      )}
    </>
  )
}

export default RefreshControl