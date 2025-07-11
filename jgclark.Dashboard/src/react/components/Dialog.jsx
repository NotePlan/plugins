// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Item Control and Project dialogs.
// Last updated 30.6.2024 for v2.0.0-b17 by @dbw
//--------------------------------------------------------------------------

import React, { useEffect } from 'react'
import { type TClickPosition } from '../../types'
import DialogForProjectItems from './DialogForProjectItems.jsx'
import DialogForTaskItems from './DialogForTaskItems.jsx'
import { useAppContext } from './AppContext.jsx'
import Modal from './Modal'
import { clo, JSP, logDebug } from '@helpers/react/reactDev.js'
import '../css/DashboardDialog.css'

type RefType<T> = {| current: null | T |}

type Props = {
  isOpen: boolean,
  isTask: boolean,
  onClose: (xWasClicked: boolean) => void,
  children?: React$Node,
  details: any,
}

/**
 * Display a Dialog for a Task or Project if reactSettings.dialogData.isOpen is true
 * @param {Props} props The properties for the Dialog component.
 * @return {?React$Node} Renderable React node or null.
 */
const Dialog = ({ isOpen, onClose, isTask, details }: Props): React$Node => {
  const { reactSettings, pluginData } = useAppContext()

  function onDialogClose(xWasClicked: boolean) {
    onClose(xWasClicked) // do nothing special here; pass it on to Dashboard::handleDialogClose
  }

  // the child dialogs (Task & Project) will call this function to position the dialog after they render
  function positionDialog(dialogRef: RefType<any>): any {
    if (isOpen && dialogRef.current) {
      // dialogRef.current.showModal() // tooltips won't work because of portaling if we use showModal, so we will use Modal to fake it
      const clickPosition = reactSettings?.dialogData?.clickPosition
      const dialog = dialogRef.current
      const thisOS = pluginData.platform

      if (clickPosition && dialog) {
        // Use a more reliable method to get dimensions
        const getDialogDimensions = () => {
          // Try multiple methods to get accurate dimensions
          const rect = dialog.getBoundingClientRect()
          const scrollWidth = dialog.scrollWidth
          const scrollHeight = dialog.scrollHeight
          const offsetWidth = dialog.offsetWidth
          const offsetHeight = dialog.offsetHeight
          const clientWidth = dialog.clientWidth
          const clientHeight = dialog.clientHeight

          // Use the largest available dimension to account for any rendering delays
          const dialogWidth = Math.max(rect.width, scrollWidth, offsetWidth, clientWidth) || offsetWidth
          const dialogHeight = Math.max(rect.height, scrollHeight, offsetHeight, clientHeight) || offsetHeight

          logDebug('positionDialog', `Dialog dimensions: rect(${rect.width}x${rect.height}), scroll(${scrollWidth}x${scrollHeight}), offset(${offsetWidth}x${offsetHeight}), client(${clientWidth}x${clientHeight}) -> using(${dialogWidth}x${dialogHeight})`)

          // If the height is still suspiciously small, use an estimated height based on content
          if (dialogHeight < 200) { // Increased threshold
            logDebug('positionDialog', `Dialog height too small (${dialogHeight}), using estimated height...`)

            // Estimate height based on typical dialog content
            // Task dialog has: title (~40px) + content line (~30px) + move controls (~30px) + other actions (~30px) + padding (~20px) = ~150px minimum
            const estimatedHeight = 250 // Conservative estimate for task dialog
            const estimatedWidth = dialogWidth || 400 // Fallback width

            logDebug('positionDialog', `Using estimated dimensions: ${estimatedWidth}x${estimatedHeight}`)
            setPositionForDialog(thisOS, estimatedWidth, estimatedHeight, dialog, clickPosition)
            return
          }

          setPositionForDialog(thisOS, dialogWidth, dialogHeight, dialog, clickPosition)
        }

        // Force a reflow to ensure all content is rendered, then measure
        dialog.offsetHeight // Force reflow

        // Check if there's an animation running that might affect dimensions
        const computedStyle = window.getComputedStyle(dialog)
        const transform = computedStyle.transform

        if (transform && transform !== 'none') {
          logDebug('positionDialog', `Dialog has transform: ${transform}, waiting for animation...`)
          // Wait for animation to complete (zoom-in takes 300ms)
          setTimeout(() => {
            getDialogDimensions()
          }, 350) // Slightly longer than the animation duration
        } else {
          getDialogDimensions()
        }
      }
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onDialogClose(true)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return isOpen ? (
    <Modal onClose={() => onDialogClose(true)}>
      {isTask ? (
        <DialogForTaskItems 
          onClose={onDialogClose} 
          details={details} 
          positionDialog={positionDialog} 
        />
      ) : (
        <DialogForProjectItems 
          onClose={onDialogClose} 
          details={details} 
          positionDialog={positionDialog} 
        />
      )}
    </Modal>
  ) : null
}


/**
 * @jgclark's original function but fixed to take into account where you are in the scroll
 * Note: to which @jgclark has taken out the scroll position as it was breaking the positioning.
 * Set place in the HTML window for dialog to appear
 * @param {string} thisOS - The operating system
 * @param {number} dialogWidth - The width of the dialog
 * @param {number} dialogHeight - The height of the dialog
 * @param {HTMLElement} dialog - The dialog element
 * @param {TClickPosition} event - The event containing click position
 */
function setPositionForDialog(thisOS: string, dialogWidth: number, dialogHeight: number, dialog: HTMLElement, event: TClickPosition) {
  logDebug('setPositionForDialog', `starting: thisOS=${thisOS} dialogWidth=${dialogWidth} dialogHeight=${dialogHeight} event=${JSON.stringify(event)}`)
  const fudgeFactor = 12 // small border (in pixels) to take account of scrollbars etc. round Left, Right, Bottom sides
  const fudgeFactorTop = 40 // border (in pixels) to take account of header bar which floats over the top
  const fudgeFactorBottom = 40 // allow more bottom space, as the dialog may be taller than expected

  // Get mouse positions (viewport-relative)
  const mousex = event.clientX
  const mousey = event.clientY

  // Get viewport dimensions
  const winWidth = window.visualViewport.width
  const winHeight = window.visualViewport.height
  logDebug('setPositionForDialog', `- winWidth=${String(winWidth)} winHeight=${String(winHeight)}`)

  let x = 0
  let y = 0

  // Handle X positioning
  if (winWidth < dialogWidth) {
    dialog.style.left = `2%`
    dialog.style.width = `96%`
  } else if (winWidth - dialogWidth < 100) {
    x = Math.round((winWidth - dialogWidth) / 2)
    dialog.style.left = `${x}px`
  } else {
    // Position relative to mouse in viewport coordinates
    x = mousex - Math.round(dialogWidth / 3)

    // Check if dialog would go outside right edge of viewport
    if (x + dialogWidth > winWidth - fudgeFactor) {
      x = winWidth - fudgeFactor - dialogWidth
      logDebug('setPositionForDialog', `- moved x left to be in viewport -> x=${String(x)}`)
    }

    // Check if dialog would go outside left edge of viewport
    if (x < fudgeFactor) {
      x = fudgeFactor
    }
    dialog.style.left = `${x}px`
  }

  // Handle Y positioning
  if (winHeight < dialogHeight) {
    dialog.style.top = `0`
    logDebug('setPositionForDialog', `- move y to top of silly shallow window`)
  } else if (winHeight - dialogHeight < 100) {
    y = Math.round((winHeight - dialogHeight) / 2)
    dialog.style.top = `${y}px`
    logDebug('setPositionForDialog', `- setting y to be in middle of window as quite shallow -> y=${String(y)}`)
  } else {
    // Position relative to mouse in viewport coordinates
    y = mousey - Math.round(dialogHeight / 2)
    logDebug('setPositionForDialog', `- setting y to be around mouse -> y=${String(y)}`)

    // Check if dialog would go below viewport
    if (y + dialogHeight > winHeight - fudgeFactorBottom) {
      logDebug('setPositionForDialog', `- about to move y (${String(y)}) up to be in viewport as height is ${String(winHeight)}`)
      y = winHeight - fudgeFactor - dialogHeight
      logDebug('setPositionForDialog', `- moved y up to be in viewport -> y=${String(y)}`)
    }

    // Check if dialog would go above viewport
    if (y < fudgeFactorTop) {
      y = fudgeFactorTop
      logDebug('setPositionForDialog', `- moved y down to be at top of viewport -> y=${String(y)}`)
    }
    dialog.style.top = `${y}px`
  }
  logDebug('setPositionForDialog', `-> left=${dialog.style.left} top=${dialog.style.top}`)
}

export default Dialog
