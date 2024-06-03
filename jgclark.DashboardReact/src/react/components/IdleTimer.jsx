// IdleTimer.jsx
// Dashboard React component to keep track of user idle time and perform an action when the
// window has not been used in the last 'idleTime' milliseconds.

// @flow
import { useEffect, useState } from 'react'
import { logDebug } from '@helpers/react/reactDev'

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
      if (Date.now() - lastActivity >= idleTime) {
        logDebug('IdleTimer', `We are over the ${idleTime / 1000 / 60}m limit now, calling onIdleTimeout`)
        onIdleTimeout()
        setLastActivity(Date.now()) // Reset the timer after calling onIdleTimeout
      } else {
        logDebug('IdleTimer', `Still under the ${idleTime / 1000 / 60}m limit; It has been ${(Date.now() - lastActivity) / 1000}s since last activity`)
      }
    }, /* idleTime */ 15000)

    return () => {
      clearInterval(interval)
    }
  }, [lastActivity, idleTime, onIdleTimeout])

  return null
}

export default IdleTimer
