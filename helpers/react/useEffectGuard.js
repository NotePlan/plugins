// @flow
/**
 * Custom hook to detect and prevent infinite loops in useEffect hooks
 * 
 * Usage:
 * ```javascript
 * const renderCount = useEffectGuard('MyComponent', 'myEffect')
 * useEffect(() => {
 *   // Your effect code
 * }, [dependencies])
 * ```
 * 
 * This will log a warning if the effect runs more than 50 times in 5 seconds,
 * which typically indicates an infinite loop.
 */

import { useRef, useEffect } from 'react'

type GuardOptions = {
  maxRuns?: number, // Maximum number of runs before warning (default: 50)
  timeWindow?: number, // Time window in ms to track runs (default: 5000)
  onExceeded?: () => void, // Callback when limit is exceeded
}

const defaultOptions: GuardOptions = {
  maxRuns: 50,
  timeWindow: 5000,
}

export function useEffectGuard(
  componentName: string,
  effectName: string,
  options: GuardOptions = {},
): number {
  const { maxRuns, timeWindow, onExceeded } = { ...defaultOptions, ...options }
  const runCountRef = useRef<number>(0)
  const runTimesRef = useRef<Array<number>>([])
  const renderCountRef = useRef<number>(0)

  // Increment render count
  renderCountRef.current += 1

  useEffect(() => {
    const now = Date.now()
    runCountRef.current += 1

    // Add current time to run times array
    runTimesRef.current.push(now)

    // Remove runs outside the time window
    runTimesRef.current = runTimesRef.current.filter((time) => now - time < timeWindow)

    // Check if we've exceeded the limit
    if (runTimesRef.current.length > maxRuns) {
      const runsInWindow = runTimesRef.current.length
      console.error(
        `[useEffectGuard] INFINITE LOOP DETECTED in ${componentName}.${effectName}:`,
        `Effect has run ${runsInWindow} times in the last ${timeWindow}ms.`,
        `This likely indicates an infinite loop. Check your dependencies and ensure they are stable.`,
      )
      console.error(`[useEffectGuard] Total runs: ${runCountRef.current}, Renders: ${renderCountRef.current}`)
      
      if (onExceeded) {
        onExceeded()
      }
    } else if (runTimesRef.current.length > maxRuns * 0.8) {
      // Warn when approaching limit
      console.warn(
        `[useEffectGuard] WARNING: ${componentName}.${effectName} has run ${runTimesRef.current.length} times in the last ${timeWindow}ms.`,
        `Approaching infinite loop threshold (${maxRuns}).`,
      )
    }
  })

  return renderCountRef.current
}

/**
 * Hook to track useEffect execution and detect potential infinite loops
 * Returns a function to call at the start of your useEffect
 * 
 * Usage:
 * ```javascript
 * const trackEffect = useEffectTracker('MyComponent', 'myEffect')
 * useEffect(() => {
 *   trackEffect()
 *   // Your effect code
 * }, [dependencies])
 * ```
 */
export function useEffectTracker(componentName: string, effectName: string, options: GuardOptions = {}) {
  const { maxRuns, timeWindow, onExceeded } = { ...defaultOptions, ...options }
  const runTimesRef = useRef<Array<number>>([])

  return () => {
    const now = Date.now()
    
    // Add current time to run times array
    runTimesRef.current.push(now)

    // Remove runs outside the time window
    runTimesRef.current = runTimesRef.current.filter((time) => now - time < timeWindow)

    // Check if we've exceeded the limit
    if (runTimesRef.current.length > maxRuns) {
      const runsInWindow = runTimesRef.current.length
      console.error(
        `[useEffectTracker] INFINITE LOOP DETECTED in ${componentName}.${effectName}:`,
        `Effect has run ${runsInWindow} times in the last ${timeWindow}ms.`,
        `This likely indicates an infinite loop. Check your dependencies and ensure they are stable.`,
      )
      
      if (onExceeded) {
        onExceeded()
      }
    } else if (runTimesRef.current.length > maxRuns * 0.8) {
      // Warn when approaching limit
      console.warn(
        `[useEffectTracker] WARNING: ${componentName}.${effectName} has run ${runTimesRef.current.length} times in the last ${timeWindow}ms.`,
        `Approaching infinite loop threshold (${maxRuns}).`,
      )
    }
  }
}
