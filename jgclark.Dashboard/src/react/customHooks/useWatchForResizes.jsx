// @flow
// Custom hook to watch for window resizes and persist them to the plugin.
// Pure moves are saved only on hide/close (onViewWillDisappear).
// Last updated 2026-08-06 for v2.4.0.62 by @jgclark + @CursorAI

import { useEffect } from 'react'
import type { MessageDataObject } from '../../types'
import { logDebug } from '@helpers/dev'

/** How long to wait after the last size change before asking the plugin to persist. */
const RESIZE_DEBOUNCE_MS = 1000

/**
 * Custom hook to persist Dashboard floating-window position and size.
 * - Debounced DOM `resize` covers size changes
 * - Pure *moves* have no browser event; those (and unfinished resizes) are saved on onViewWillDisappear
 * - showHTMLV2 also saves rect when re-opening an already-open window
 * @param {function(string, MessageDataObject, string=, boolean=): void} sendActionToPlugin
 * @returns {void}
 * @usage useWatchForResizes(sendActionToPlugin)
 */
export default function useWatchForResizes(
  sendActionToPlugin: (actionType: string, dataToSend: MessageDataObject, additionalInfo?: string, updateGlobalData?: boolean) => void,
): void {
  useEffect(() => {
    let debounceTimeout: TimeoutID

    /**
     * Ask plugin to read the live windowRect (plugin side has real x/y/w/h) and store it.
     * @param {string} reason - Why we are saving (for logs)
     * @returns {void}
     */
    function notifyWindowGeometryChanged(reason: string): void {
      const newDimensions = {
        width: window.innerWidth,
        height: window.innerHeight,
      }
      logDebug('useWatchForResizes', `Sending windowResized (${reason}) dimensions: ${JSON.stringify(newDimensions)}`)
      // updateGlobalData false: avoid Root re-render / scroll-pass-through for a geometry-only save
      sendActionToPlugin(
        'windowResized',
        {
          actionType: 'windowResized',
          newDimensions,
          reason,
        },
        `windowResized ${reason}`,
        false,
      )
    }

    /**
     * Debounced handler for DOM resize (size change only - pure moves do not fire this).
     * @returns {void}
     */
    function handleResize(): void {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout)
      }
      debounceTimeout = setTimeout(() => {
        notifyWindowGeometryChanged('resize')
      }, RESIZE_DEBOUNCE_MS)
    }

    /**
     * Save immediately when the window is hidden/closed (covers pure moves and unfinished resizes).
     * @returns {void}
     */
    function handleWillDisappear(): void {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout)
      }
      notifyWindowGeometryChanged('willDisappear')
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('onViewWillDisappear', handleWillDisappear)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('onViewWillDisappear', handleWillDisappear)
      if (debounceTimeout) {
        clearTimeout(debounceTimeout)
      }
    }
  }, [sendActionToPlugin])
}
