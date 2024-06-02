// useRefreshTimer.jsx
// Sends a refresh after a delay, with a debounce so only the latest refresh call is sent
// usage:
// import useRefreshTimer from './useRefreshTimer.jsx'
//   const { refreshTimer } = useRefreshTimer({ maxDelay: 5000, enabled: pluginData.settings._logLevel !== "DEV" })
// ... then wherever you want to send a refresh:
// refreshTimer()
// @flow

import { useState, useEffect } from 'react'
import { useAppContext } from '../components/AppContext.jsx'
import { logDebug } from '@helpers/react/reactDev.js'

/**
 * Options for the refresh timer hook.
 * @type {Object}
 * @property {number} maxDelay - Maximum delay for the refresh timer (in ms)
 */
type RefreshTimerOptions = {
  maxDelay: number, // default 5000
  enabled?: boolean, // designed to allow for loglevel === DEV to disable the timer
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
 * Waits n seconds and then sends a "refresh" command to the plutin
 * @param {RefreshTimerOptions} options - Options for the refresh timer.
 * @returns {RefreshTimerReturn} Return object containing refresh function.
 */
function useRefreshTimer(options: RefreshTimerOptions): RefreshTimerReturn {
  const { maxDelay = 5000, enabled = false } = options
  const [timerId, setTimerId] = useState <? TimeoutID > (null)
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
      if (!enabled) {
        logDebug('useRefreshTimer', `${maxDelay / 1000}s refreshTimer triggered - but not enabled for DEV users, so not calling Plugin for JSON Refresh...`)
        return
      } else {
        logDebug('useRefreshTimer', `${maxDelay / 1000}s refreshTimer triggered - Calling Plugin for JSON Refresh...`)
        sendActionToPlugin('refresh', { actionType: 'refresh' }, `${maxDelay / 1000}s full refresh timer triggered`, true)
      }
    }, maxDelay)
    setTimerId(newTimerId)
  }

  return { refreshTimer }
}

export default useRefreshTimer
