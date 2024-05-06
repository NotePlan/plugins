// useRefreshTimer.jsx
// Sends a refresh after a delay, with a debounce so only the latest refresh call is sent
// usage:
// import useRefreshTimer from './useRefreshTimer.jsx'
// const { refreshTimer } = useRefreshTimer({ maxDelay: 5000 })
// refreshTimer()
// @flow

import { useState, useEffect } from 'react'
import { useAppContext } from './AppContext.jsx'
import { logDebug } from '@helpers/react/reactDev.js'

/**
 * Options for the refresh timer hook.
 * @type {Object}
 * @property {number} maxDelay - Maximum delay for the refresh timer (in ms)
 */
type RefreshTimerOptions = {
  maxDelay: number, // default 5000
}

/**
 * Return object for the refresh timer hook.
 * @type {Object}
 * @property {() => void} refresh - Function to trigger refresh.
 */
type RefreshTimerReturn = {
  refreshTimer: () => void,
}

/**
 * Custom hook to handle refresh timer.
 * @param {RefreshTimerOptions} options - Options for the refresh timer.
 * @returns {RefreshTimerReturn} Return object containing refresh function.
 */
function useRefreshTimer(options: RefreshTimerOptions): RefreshTimerReturn {
  const { maxDelay = 5000 } = options
  const [timerId, setTimerId] = useState<?TimeoutID>(null)
  const { sendActionToPlugin } = useAppContext()

  useEffect(() => {
    return () => {
      // Clear the timer when the component unmounts
      if (timerId) {
        clearTimeout(timerId)
        logDebug('useRefreshTimer', 'Timer was set previously, resetting timer...')
      }
    }
  }, [timerId])

  /**
   * Function to trigger refresh.
   */
  const refreshTimer = (): void => {
    if (timerId) {
      // If a timer is already running, clear it
      clearTimeout(timerId)
    }
    // Set a new timer with the maximum delay
    const newTimerId = setTimeout(() => {
      // Trigger the refresh action
      logDebug('useRefreshTimer', 'Timer triggered - Calling Plugin for JSON Refresh...')
      sendActionToPlugin('refresh', { actionType: 'refresh' }, `5s full refresh timer triggered`, false)
    }, maxDelay)
    setTimerId(newTimerId)
  }

  return { refreshTimer }
}

export default useRefreshTimer
