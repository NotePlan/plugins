// @flow
//------------------------------------------------------------------------------
// useMidnightRollover.jsx
// Detect calendar date rollover while Dashboard is open and visible, and
// trigger a callback once per new day, even if idle auto-refresh is disabled.
// Last updated for 2026-04-16 for v2.4.0.b26, @Cursor
//------------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react'
import moment from 'moment/min/moment-with-locales'
import { logDebug } from '@helpers/react/reactDev'

type UseMidnightRolloverOptions = {
  enabled: boolean,
  userIsInteracting: boolean,
  isViewVisible: boolean,
  onDateRollover: () => void,
}

const TICK_INTERVAL_MS = 15000 // 15 seconds, same cadence as IdleTimer

/**
 * Hook that detects when the local calendar date changes while the Dashboard
 * view is open, and calls `onDateRollover` once per new date.
 *
 * - Independent of idle auto-refresh settings.
 * - Safe across sleep/wake (relies on date change, not exact 00:00).
 * - Defers the callback until the view is visible and not interacting.
 */
export default function useMidnightRollover(options: UseMidnightRolloverOptions): void {
  const { enabled, userIsInteracting, isViewVisible, onDateRollover } = options

  const lastProcessedDateRef = useRef<?string>(null)
  const [pendingRolloverDate, setPendingRolloverDate] = useState<?string>(null)

  // Track calendar date changes while enabled
  useEffect(() => {
    if (!enabled) {
      return
    }

    const tick = () => {
      const currentDate = moment().format('YYYY-MM-DD')

      if (lastProcessedDateRef.current == null) {
        // First run: initialise but don't fire
        lastProcessedDateRef.current = currentDate
        logDebug('useMidnightRollover', `First run: Initialising lastProcessedDateRef to ${currentDate}`)
        return
      }

      if (currentDate !== lastProcessedDateRef.current) {
        lastProcessedDateRef.current = currentDate
        setPendingRolloverDate(currentDate)
        logDebug('useMidnightRollover', `Detected new calendar date ${currentDate}; queuing rollover`)
      }
    }

    const intervalId = setInterval(tick, TICK_INTERVAL_MS)

    return () => {
      clearInterval(intervalId)
    }
  }, [enabled])

  // When a rollover is pending, wait until the view is visible and not interacting
  useEffect(() => {
    if (!pendingRolloverDate) {
      return
    }
    if (!enabled) {
      return
    }
    if (!isViewVisible || userIsInteracting) {
      return
    }

    logDebug('useMidnightRollover', `Processing queued date rollover for ${String(pendingRolloverDate)} (view visible, not interacting)`)
    setPendingRolloverDate(null)
    onDateRollover()
  }, [enabled, isViewVisible, pendingRolloverDate, userIsInteracting, onDateRollover])
}

