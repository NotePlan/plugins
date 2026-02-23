// IdleTimer.jsx
//------------------------------------------------------------------------------
// Dashboard React component to keep track of user idle time and perform an
// action when the window has not been used in the last 'idleTime' milliseconds.
// Also triggers a refresh at midnight every day (if Dashboard is open!)
//
// Note: currently this only can see 'idle' in the Dashboard windows, not in the main
// NotePlan windows.
//------------------------------------------------------------------------------

// @flow
import { useEffect, useState, useRef } from 'react'
import moment from 'moment/min/moment-with-locales'
import { logDebug, logInfo } from '@helpers/react/reactDev'
import { getTimeAgoString } from '@helpers/dateTime.js'
import { dt } from '@helpers/dev'

/**
 * Props type for IdleTimer component.
 * @typedef {Object} IdleTimerProps
 * @property {number} idleTime - The time in milliseconds to consider the user as idle.
 * @property {() => void} onIdleTimeout - The function to execute when the user is idle.
 * @property {boolean} [userIsInteracting] - When true, pause the timer: do not fire onIdleTimeout (idle or midnight) and do not reset lastActivity.
 */
type IdleTimerProps = {|
  idleTime: number,
  onIdleTimeout: () => void,
  userIsInteracting: boolean,
|};

const msToMinutes = (ms: number): number => Math.round(ms / 1000 / 60)

// When the computer goes to sleep and wakes up, it can fire multiple queued events at once.
// We only want to execute the onIdleTimeout function once, so we try to ignore events that seem to have happened during sleep/wake
const LEGAL_DRIFT_THRESHHOLD = 10000 // 10 seconds

/**
 * IdleTimer component to keep track of user idle time and perform an action when the user is idle.
 * @param {IdleTimerProps} props - Component props.
 * @returns {React.Node} The IdleTimer component.
 */
function IdleTimer({ idleTime, onIdleTimeout, userIsInteracting = false }: IdleTimerProps): React$Node {
  const [lastActivity, setLastActivity] = useState(Date.now())
  const lastMidnightRefreshDateRef = useRef <? string > (null)
  
  // Only reset idle on meaningful interaction. 
  // Do NOT use 'mousemove' - it fires constantly while the cursor is over the window
  // and prevents the idle timer from ever firing when the user is viewing the Dashboard.
  // Similarly 'scroll' is not meaningful interaction.
  // useEffect(() => {
  //   const handleUserActivity = () => {
  //     setLastActivity(Date.now())
  //   }

  //   const handleVisibilityChange = () => {
  //     if (document.visibilityState === 'visible') {
  //       setLastActivity(Date.now())
  //     }
  //   }

  //   // window.addEventListener('mousemove', handleUserActivity)
  //   // window.addEventListener('scroll', handleUserActivity)
  //   window.addEventListener('keydown', handleUserActivity)
  //   window.addEventListener('touchstart', handleUserActivity)
  //   document.addEventListener('visibilitychange', handleVisibilityChange)

  //   return () => {
  //     // window.removeEventListener('mousemove', handleUserActivity)
  //     // window.removeEventListener('scroll', handleUserActivity)
  //     window.removeEventListener('keydown', handleUserActivity)
  //     window.removeEventListener('touchstart', handleUserActivity)
  //     document.removeEventListener('visibilitychange', handleVisibilityChange)
  //   }
  // }, [])

  useEffect(() => {
    // Run a 'tick' every 15 seconds to check for midnight refresh and idle timeout
    const interval = setInterval(() => {
      // When dialogs are open, pause: do not fire onIdleTimeout and do not reset lastActivity
      if (userIsInteracting) {
        logDebug('IdleTimer', `${dt().padEnd(19)} User is interacting, ignoring IdleTimer at the moment`)
        return
      }

      // Check for midnight refresh (works as it runs every 15 seconds)
      const now = moment()
      const currentDate = now.format('YYYY-MM-DD')
      const isMidnight = now.hours() === 0 && now.minutes() === 0
      if (isMidnight && lastMidnightRefreshDateRef.current !== currentDate) {
        lastMidnightRefreshDateRef.current = currentDate
        onIdleTimeout()
        logInfo('IdleTimer', `Midnight detected, triggering refresh`)
      }

      // Check for idle timeout
      const elapsedMs = Date.now() - lastActivity
      if (elapsedMs >= idleTime) {
        if ((elapsedMs - LEGAL_DRIFT_THRESHHOLD) < idleTime) {
          onIdleTimeout()
          logDebug('IdleTimer', `${dt().padEnd(19)} Over the ${msToMinutes(idleTime)}m limit (it's been ${getTimeAgoString(new Date(lastActivity))}), calling onIdleTimeout`)
        } else {
          logDebug('IdleTimer', `${dt().padEnd(19)} Over the ${msToMinutes(idleTime)}m limit (it's been ${getTimeAgoString(new Date(lastActivity))}), NOT calling onIdleTimeout (computer was probably asleep); Resetting timer...`)
        }
        setLastActivity(Date.now()) // Reset the timer after calling onIdleTimeout
      } else {
        logDebug('IdleTimer', `${dt().padEnd(19)} Still under the ${msToMinutes(idleTime)}m limit; It has been ${(Date.now() - lastActivity) / 1000}s since last activity`)
      }
    }, /* tickInterval */ 15000)

    return () => {
      clearInterval(interval)
    }
  }, [lastActivity, idleTime, onIdleTimeout, userIsInteracting])

  return null
}

export default IdleTimer
