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
        const dialogWidth = dialog.offsetWidth
        const dialogHeight = dialog.offsetHeight
        setPositionForDialog(thisOS, dialogWidth, dialogHeight, dialog, clickPosition)
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

  const mousex = event.clientX // Horizontal
  const mousey = event.clientY // Vertical
  const scrollX = window.scrollX
  const scrollY = window.scrollY
  let x = 0
  let y = 0

  const winWidth = window.visualViewport.width
  const winHeight = window.visualViewport.height
  logDebug('setPositionForDialog', `- winWidth=${String(winWidth)} winHeight=${String(winHeight)} / scrollX=${String(scrollX)} scrollY=${String(scrollY)}`)

  if (winWidth < dialogWidth) {
    dialog.style.left = `2%`
    dialog.style.width = `96%`
  } else if (winWidth - dialogWidth < 100) {
    // x = Math.round((winWidth - dialogWidth) / 2) + scrollX
    x = Math.round((winWidth - dialogWidth) / 2)
    dialog.style.left = `${x}px`
  } else {
    // x = mousex - Math.round(dialogWidth / 3) + scrollX
    x = mousex - Math.round(dialogWidth / 3)
    // if (x + dialogWidth > winWidth + scrollX) {
    if (x + dialogWidth > (winWidth - fudgeFactor)) {
      // x = winWidth - fudgeFactor - dialogWidth + scrollX
      x = winWidth - fudgeFactor - dialogWidth
      logDebug('setPositionForDialog', `- moved x left to be in viewport -> x=${String(x)}`)

    }
    // if (x < fudgeFactor + scrollX) {
    if (x < fudgeFactor) {
      // x = fudgeFactor + scrollX
      x = fudgeFactor
    }
    dialog.style.left = `${x}px`
  }

  if (winHeight < dialogHeight) {
    dialog.style.top = `0`
    logDebug('setPositionForDialog', `- move y to top of silly shallow window`)
  } else if (winHeight - dialogHeight < 100) {
    // y = Math.round((winHeight - dialogHeight) / 2) + scrollY
    y = Math.round((winHeight - dialogHeight) / 2)
    dialog.style.top = `${y}px`
    logDebug('setPositionForDialog', `- setting y to be in middle of window as quite shallow -> y=${String(y)}`)
  } else {
    // y = mousey - Math.round(dialogHeight / 2) + scrollY
    y = mousey - Math.round(dialogHeight / 2)
    logDebug('setPositionForDialog', `- setting y to be around mouse -> y=${String(y)}`)
    // if (y + dialogHeight > winHeight + scrollY) {
    if (y + dialogHeight > winHeight) {
      // y = winHeight - fudgeFactor - dialogHeight + scrollY
      y = winHeight - fudgeFactor - dialogHeight
      logDebug('setPositionForDialog', `- moved y up to be in viewport -> y=${String(y)}`)
    }
    // if (y < fudgeFactorTop + scrollY) {
    if (y < fudgeFactorTop) {
      // y = fudgeFactorTop + scrollY
      y = fudgeFactorTop
      logDebug('setPositionForDialog', `- moved y down to be at top of viewport -> y=${String(y)}`)
    }
    dialog.style.top = `${y}px`
  }
  logDebug('setPositionForDialog', `-> left=${dialog.style.left} top=${dialog.style.top}`)
}

export default Dialog
