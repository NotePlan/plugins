// IdleTimer.jsx
// Dashboard React component to keep track of user idle time and perform an action when the
// window has not been used in the last 'idleTime' milliseconds.

// @flow
import { useEffect, useState } from 'react'
import { logDebug } from '@helpers/react/reactDev'
import { getTimeAgoString } from '@helpers/dateTime.js'
import { dt } from '@helpers/dev'

/**
 * Props type for IdleTimer component.
 * @typedef {Object} IdleTimerProps
 * @property {number} idleTime - The time in milliseconds to consider the user as idle.
 * @property {() => void} onIdle - The function to execute when the user is idle.
 */

type IdleTimerProps = {|
  idleTime: number,
  onIdleTimeout: () => void,
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
function IdleTimer({ idleTime, onIdleTimeout }: IdleTimerProps): React$Node {
  const [lastActivity, setLastActivity] = useState(Date.now())
  
  useEffect(() => {
    const handleUserActivity = () => {
      setLastActivity(Date.now())
    }

    const handleVisibilityChange = () => {
      // $FlowIgnore
      if (document.visibilityState === 'visible') {
        setLastActivity(Date.now())
      }
    }

    window.addEventListener('mousemove', handleUserActivity)
    window.addEventListener('keydown', handleUserActivity)
    window.addEventListener('scroll', handleUserActivity)
    // $FlowIgnore
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('mousemove', handleUserActivity)
      window.removeEventListener('keydown', handleUserActivity)
      window.removeEventListener('scroll', handleUserActivity)
      // $FlowIgnore
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
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
    }, /* idleTime */ 15000)

    return () => {
      clearInterval(interval)
    }
  }, [lastActivity, idleTime, onIdleTimeout])

  return null
}

export default IdleTimer
