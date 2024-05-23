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
      if (document.visibilityState === 'visible') {
        setLastActivity(Date.now())
      }
    }

    window.addEventListener('mousemove', handleUserActivity)
    window.addEventListener('keydown', handleUserActivity)
    window.addEventListener('scroll', handleUserActivity)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('mousemove', handleUserActivity)
      window.removeEventListener('keydown', handleUserActivity)
      window.removeEventListener('scroll', handleUserActivity)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    // debug all this       if (Date.now() - lastActivity >= idleTime) {
    const interval = setInterval(() => {
      if (Date.now() - lastActivity >= idleTime) {
        logDebug('IdleTimer', 'we are over the limit now, calling onIdleTimeout')
        onIdleTimeout()
      }
    }, idleTime)

    return () => {
      clearInterval(interval)
    }
  }, [lastActivity, idleTime, onIdleTimeout])

  return null
}

export default IdleTimer
