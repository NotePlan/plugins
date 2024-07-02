// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Item Control and Project dialogs.
// Last updated 18.5.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------

import React, { useEffect } from 'react'
import { type TClickPosition } from '../../types'
import DialogForProjectItems from './DialogForProjectItems.jsx'
import DialogForTaskItems from './DialogForTaskItems.jsx'
import { useAppContext } from './AppContext.jsx'
import Modal from './Modal'
import { clo, JSP, logDebug } from '@helpers/react/reactDev.js'
import '../css/dashboardDialog.css'

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
    onClose(xWasClicked) // send to parent
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
      logDebug('Dialog', `Event.key: ${event.key}`)
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
 * Set place in the HTML window for dialog to appear
 * @param {string} thisOS - The operating system
 * @param {number} dialogWidth - The width of the dialog
 * @param {number} dialogHeight - The height of the dialog
 * @param {HTMLElement} dialog - The dialog element
 * @param {TClickPosition} event - The event containing click position
 */
function setPositionForDialog(thisOS: string, dialogWidth: number, dialogHeight: number, dialog: HTMLElement, event: TClickPosition) {
  logDebug(`ENTERING setPositionForDialog() thisOS=${thisOS} dialogWidth=${dialogWidth} dialogHeight=${dialogHeight} event=${JSON.stringify(event)}`)
  const fudgeFactor = 8 // small border (in pixels) to take account of scrollbars etc. round Left, Right, Bottom sides
  const fudgeFactorTop = 40 // small border (in pixels) to take account of header bar which floats over the top
  const mousex = event.clientX // Horizontal
  const mousey = event.clientY // Vertical
  const scrollX = window.scrollX
  const scrollY = window.scrollY
  let x = 0
  let y = 0

  const winHeight = window.visualViewport.height
  const winWidth = window.visualViewport.width

  if (winWidth < dialogWidth) {
    dialog.style.left = `2%`
    dialog.style.width = `96%`
  } else if (winWidth - dialogWidth < 100) {
    x = Math.round((winWidth - dialogWidth) / 2) + scrollX
    dialog.style.left = `${x}px`
  } else {
    x = mousex - Math.round(dialogWidth / 3) + scrollX
    if (x + dialogWidth > winWidth + scrollX) {
      x = winWidth - fudgeFactor - dialogWidth + scrollX
    }
    if (x < fudgeFactor + scrollX) {
      x = fudgeFactor + scrollX
    }
    dialog.style.left = `${x}px`
  }

  if (winHeight < dialogHeight) {
    dialog.style.top = `0`
  } else if (winHeight - dialogHeight < 100) {
    y = Math.round((winHeight - dialogHeight) / 2) + scrollY
    dialog.style.top = `${y}px`
  } else {
    y = mousey - Math.round(dialogHeight / 2) + scrollY
    if (y + dialogHeight > winHeight + scrollY) {
      y = winHeight - fudgeFactor - dialogHeight + scrollY
    }
    if (y < fudgeFactorTop + scrollY) {
      y = fudgeFactorTop + scrollY
    }
    dialog.style.top = `${y}px`
  }
}

export default Dialog
