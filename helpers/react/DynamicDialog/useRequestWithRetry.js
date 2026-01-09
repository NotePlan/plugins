// @flow
//--------------------------------------------------------------------------
// useRequestWithRetry Hook
// A reusable hook for managing request/retry logic with retry limiting
// Used by choosers (HeadingChooser, NoteChooser, etc.) to load data from plugin
//--------------------------------------------------------------------------

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { logDebug, logError } from '@helpers/react/reactDev.js'

export type UseRequestWithRetryOptions = {
  requestFromPlugin?: (command: string, dataToSend?: any, timeout?: number) => Promise<any>,
  command: string, // Command to send (e.g., 'getHeadings', 'getNotes')
  requestParams?: any, // Parameters to send with request
  enabled?: boolean, // Whether the request should be made (default: true)
  maxRetries?: number, // Maximum number of retries before giving up (default: 2)
  retryDelay?: number, // Delay between retries in ms (default: 0)
  onSuccess?: (data: any) => void, // Callback when request succeeds
  onError?: (error: Error) => void, // Callback when request fails after all retries
  validateResponse?: (data: any) => boolean, // Function to validate response (returns true if valid)
  identifier?: string, // Identifier for tracking (for logging) - defaults to command
}

export type UseRequestWithRetryResult = {
  data: any,
  loading: boolean,
  loaded: boolean,
  error: ?Error,
  retryCount: number,
  refetch: () => Promise<void>, // Function to manually trigger a retry
  reset: () => void, // Function to reset state and allow new requests
}

/**
 * Hook for making requests with automatic retry logic and retry limiting
 * @param {UseRequestWithRetryOptions} options
 * @returns {UseRequestWithRetryResult}
 */
export function useRequestWithRetry({
  requestFromPlugin,
  command,
  requestParams = {},
  enabled = true,
  maxRetries = 2,
  retryDelay = 0,
  onSuccess,
  onError,
  validateResponse,
  identifier,
}: UseRequestWithRetryOptions): UseRequestWithRetryResult {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [loaded, setLoaded] = useState<boolean>(false)
  const [error, setError] = useState<?Error>(null)
  const [retryCount, setRetryCount] = useState<number>(0)

  const lastIdentifierRef = useRef<?string>(null) // Track last identifier to prevent duplicate loads
  const loadedRef = useRef<boolean>(false) // Track loaded state in ref to avoid dependency cycles
  const loadingRef = useRef<boolean>(false) // Track loading state in ref to avoid dependency cycles
  const makeRequestRef = useRef<?(currentRetry: number) => Promise<void>>(null) // Ref to stable makeRequest function
  // Check if AbortController is available (may not be in older WebView environments)
  const hasAbortController = typeof AbortController !== 'undefined'
  const abortControllerRef = useRef<?AbortController>(null)
  const identifierStr = identifier || command

  // Reset function to allow new requests
  const reset = useCallback(() => {
    setData(null)
    setLoaded(false)
    loadedRef.current = false
    setLoading(false)
    loadingRef.current = false
    setError(null)
    setRetryCount(0)
    lastIdentifierRef.current = null
    if (hasAbortController && abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  // Create identifier key from params (memoized to avoid recalculating)
  const paramsKeyForIdentifier = useMemo(() => JSON.stringify(requestParams), [requestParams])

  // Make request function (recursive for retries)
  // $FlowFixMe[recursive-definition] - Function calls itself for retries
  const makeRequest = useCallback(
    async (currentRetry: number = 0): Promise<void> => {
      if (!requestFromPlugin || !enabled) {
        return
      }

      // Create identifier from params to track unique requests
      const currentIdentifier = `${identifierStr}:${paramsKeyForIdentifier}`

      // Skip if already loaded for this identifier (use ref to avoid dependency on loaded state)
      if (lastIdentifierRef.current === currentIdentifier && loadedRef.current) {
        logDebug(identifierStr, `Skipping request: already loaded for "${currentIdentifier}"`)
        return
      }

      // Check retry limit
      if (currentRetry > 0 && currentRetry > maxRetries) {
        logError(identifierStr, `Max retries (${maxRetries}) reached for "${identifierStr}". Giving up.`)
        setLoading(false)
        lastIdentifierRef.current = currentIdentifier // Set BEFORE loadedRef to ensure guard works
        loadedRef.current = true // Set ref BEFORE setLoaded
        setLoaded(true)
        const maxRetriesError = new Error(`Max retries (${maxRetries}) reached`)
        setError(maxRetriesError)
        if (onError) {
          onError(maxRetriesError)
        }
        return
      }

      // Abort previous request if still pending
      if (hasAbortController && abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (hasAbortController) {
        abortControllerRef.current = new AbortController()
      }

      // CRITICAL: Set identifier and loading state BEFORE starting request
      // This allows the guard in useEffect to catch duplicate requests
      lastIdentifierRef.current = currentIdentifier
      loadingRef.current = true // Set ref BEFORE setLoading to ensure guard works

      try {
        setLoading(true)
        setError(null)

        if (currentRetry > 0) {
          logDebug(identifierStr, `Retry ${currentRetry}/${maxRetries} for "${identifierStr}"`)
          if (retryDelay > 0) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay))
          }
        } else {
          logDebug(identifierStr, `Making request: "${identifierStr}" with params: ${JSON.stringify(requestParams)}`)
        }

        const response = await requestFromPlugin(command, requestParams)

        // Check if request was aborted
        if (hasAbortController && abortControllerRef.current?.signal.aborted) {
          return
        }

        logDebug(identifierStr, `Received response: ${Array.isArray(response) ? `Array with ${response.length} items` : typeof response}`)

        // Log response details for debugging
        if (typeof response === 'object' && response !== null) {
          const isArray = Array.isArray(response)
          const keys = Object.keys(response)
          logDebug(identifierStr, `Response details: isArray=${String(isArray)}, keys=${keys.length}, keys=${keys.join(', ')}`)

          // If it's an object (not array), log what's in it
          if (!isArray && keys.length > 0) {
            logDebug(identifierStr, `Response object contents: ${JSON.stringify(response).substring(0, 200)}`)
          }
        } else {
          logDebug(identifierStr, `Response is not an object: type=${typeof response}, value=${String(response)}`)
        }

        const normalizedResponse = response

        // Validate response if validator provided
        let isValid = true
        if (validateResponse) {
          isValid = validateResponse(normalizedResponse)
        } else {
          // Default validation: check if response is not empty object or null/undefined
          if (normalizedResponse === null || normalizedResponse === undefined) {
            isValid = false
          } else if (typeof normalizedResponse === 'object' && !Array.isArray(normalizedResponse) && Object.keys(normalizedResponse).length === 0) {
            // Empty object - might be valid (note has no headings) or error
            // If it's an array result expected, treat empty object as invalid
            isValid = false
          }
        }

        if (isValid) {
          setData(normalizedResponse)
          setRetryCount(0) // Reset retry count on success
          lastIdentifierRef.current = currentIdentifier
          loadedRef.current = true // Set ref BEFORE setLoaded to ensure guard works
          setLoaded(true)

          if (onSuccess) {
            onSuccess(normalizedResponse)
          }
          logDebug(identifierStr, `Request successful: ${Array.isArray(normalizedResponse) ? `got ${normalizedResponse.length} items` : 'got data'}`)
        } else {
          // Invalid response - might be empty result or error
          logDebug(identifierStr, `Invalid/empty response received (may be valid empty result or error): ${typeof normalizedResponse}`)

          // Treat empty as valid if it's explicitly an array
          if (Array.isArray(normalizedResponse)) {
            setData(normalizedResponse)
            setRetryCount(0)
            lastIdentifierRef.current = currentIdentifier
            loadedRef.current = true // Set ref BEFORE setLoaded to ensure guard works
            setLoaded(true)
            if (onSuccess) {
              onSuccess(normalizedResponse)
            }
          } else if (currentRetry < maxRetries) {
            // Retry if we haven't exceeded max retries
            logDebug(identifierStr, `Invalid response, retrying (${currentRetry + 1}/${maxRetries})...`)
            setRetryCount(currentRetry + 1)
            // Don't set loaded/identifier yet - allow retry
            await makeRequest(currentRetry + 1)
          } else {
            // Max retries reached - treat as error
            // CRITICAL: Set identifier and loadedRef BEFORE setLoaded to ensure guard works
            lastIdentifierRef.current = currentIdentifier
            loadedRef.current = true
            logError(identifierStr, `Max retries reached. Invalid/empty response for "${identifierStr}". Setting loaded=true and identifier to prevent further retries.`)
            setData(null)
            setRetryCount(currentRetry)
            setLoaded(true) // Set state AFTER refs to ensure guard works
            const maxRetriesError = new Error('Invalid response after max retries')
            setError(maxRetriesError)
            if (onError) {
              onError(maxRetriesError)
            }
          }
        }
      } catch (err) {
        // Check if request was aborted
        if (hasAbortController && abortControllerRef.current?.signal.aborted) {
          return
        }

        const error = err instanceof Error ? err : new Error(String(err))
        logError(identifierStr, `Request failed: ${error.message}`)

        if (currentRetry < maxRetries) {
          // Retry on error
          setRetryCount(currentRetry + 1)
          await makeRequest(currentRetry + 1)
        } else {
          // Max retries reached
          setRetryCount(currentRetry)
          loadedRef.current = true // Set ref BEFORE setLoaded
          setLoaded(true)
          setError(error)
          if (onError) {
            onError(error)
          }
          // Don't set identifier on error - allow manual retry via refetch
        }
      } finally {
        if (!hasAbortController || !abortControllerRef.current?.signal.aborted) {
          loadingRef.current = false // Set ref BEFORE setLoading to ensure guard works
          setLoading(false)
        }
        if (hasAbortController) {
          abortControllerRef.current = null
        }
      }
      // NOTE: Removed 'loaded' from dependencies to prevent infinite loops
      // We use loadedRef.current inside makeRequest instead
    },
    [requestFromPlugin, command, paramsKeyForIdentifier, enabled, maxRetries, retryDelay, validateResponse, identifierStr, onSuccess, onError],
  )

  // Keep makeRequestRef in sync with makeRequest
  useEffect(() => {
    makeRequestRef.current = makeRequest
  }, [makeRequest])

  // Refetch function for manual retry
  const refetch = useCallback(async () => {
    reset()
    if (makeRequestRef.current) {
      await makeRequestRef.current(0)
    }
  }, [reset])

  // Auto-trigger request when params change
  useEffect(() => {
    if (!enabled || !requestFromPlugin) {
      return
    }

    // Create identifier from params to track unique requests
    const currentIdentifier = `${identifierStr}:${paramsKeyForIdentifier}`

    // CRITICAL: Skip if already loaded for this identifier to prevent infinite loops
    // Use loadedRef and loadingRef to avoid dependency on state
    // Also check if we're currently loading to prevent duplicate requests
    // lastIdentifierRef is now set BEFORE the request starts, so this guard will catch in-flight requests
    if (lastIdentifierRef.current === currentIdentifier && (loadedRef.current || loadingRef.current)) {
      logDebug(
        identifierStr,
        `useEffect: Skipping request - already loaded/loading for "${currentIdentifier}", loaded=${String(loadedRef.current)}, loading=${String(loadingRef.current)}`,
      )
      return
    }

    logDebug(
      identifierStr,
      `useEffect: Triggering makeRequest for "${currentIdentifier}", loaded=${String(loadedRef.current)}, loading=${String(loadingRef.current)}, lastIdentifier=${
        lastIdentifierRef.current || 'null'
      }`,
    )
    // Use ref to avoid dependency on makeRequest (which changes when dependencies change)
    if (makeRequestRef.current) {
      makeRequestRef.current(0)
    }

    // Cleanup: abort request on unmount or when params change
    return () => {
      if (hasAbortController && abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
    // NOTE: Removed 'makeRequest' and 'loaded' from dependencies to prevent infinite loops
    // We use makeRequestRef.current and loadedRef.current instead
    // NOTE: Added 'loading' to the guard check but NOT to dependencies to avoid loops
  }, [enabled, requestFromPlugin, paramsKeyForIdentifier, identifierStr])

  return {
    data,
    loading,
    loaded,
    error,
    retryCount,
    refetch,
    reset,
  }
}
