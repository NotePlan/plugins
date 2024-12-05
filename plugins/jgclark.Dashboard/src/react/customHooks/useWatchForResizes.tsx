// @flow
import { useEffect } from 'react'
import type { MessageDataObject } from '../../types'
import { logDebug } from '@np/helpers/react/reactDev'

/**
 * Custom hook to listen for window resize events and send them to the plugin
 * After waiting a certain amount of time for a user to fiddle with the window size
 * @param {function(WindowDimensions): void} sendActionToPlugin - Function to send the window dimensions.
 * @returns {void}
 * @usage useWindowDimensions(sendActionToPlugin)
 */
export default function useWatchForResizes(
  sendActionToPlugin: (actionType:string, dataToSend: MessageDataObject) => void
): void {
  useEffect(() => {
    let debounceTimeout: TimeoutID

    /**
     * Event handler for window resize.
     */
    function handleResize() {
      const newDimensions = {
        width: window.innerWidth,
        height: window.innerHeight,
      }
      // logDebug('useWatchForResizes', `Window was resized to: ${JSON.stringify(newDimensions)}`)

      if (debounceTimeout) {
        clearTimeout(debounceTimeout)
      }

      debounceTimeout = setTimeout(() => {
        logDebug('useWatchForResizes', `Sending to plugin final dimensions: ${JSON.stringify(newDimensions)}`)
        sendActionToPlugin('windowWasResized', { actionType: 'windowWasResized', newDimensions })
      }, 5000) // Wait time for the user to fiddle with the window before assuming it's done
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (debounceTimeout) {
        clearTimeout(debounceTimeout)
      }
    }
  }, [sendActionToPlugin])
}

