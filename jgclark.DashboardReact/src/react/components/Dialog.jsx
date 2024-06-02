// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Item Control and Project dialogs.
// Last updated 18.5.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------

import React from 'react'
import { type TClickPosition } from '../../types'
import DialogForProjectItems from './DialogForProjectItems.jsx'
import DialogForTaskItems from './DialogForTaskItems.jsx'
import { useAppContext } from './AppContext.jsx'
import { clo, JSP, logDebug } from '@helpers/react/reactDev.js'
import '../css/dashboardDialog.css'

type RefType<T> = {| current: null | T |}

type Props = {
  isOpen: boolean,
  isTask: boolean,
  onClose: () => void,
  children?: React$Node,
  details: any,
}

/**
 * Display a Dialog for a Task or Project if reactSettings.dialogData.isOpen is true
 * @param {Props} props The properties for the Dialog component.
 * @return {?React$Node} Renderable React node or null.
 */
const Dialog = ({ isOpen, onClose, isTask, details }: Props): React$Node => {

  // isOpen ? logDebug(`Dialog`, `starting for ${isTask ? 'task' : 'project'} isOpen: ${isOpen ? 'true' : ''} details: ${JSP(details)}`) : null
  const { reactSettings, pluginData } = useAppContext()

  // 5s hack timer to work around cache not being reliable (only runs for users, not DEVs)  
  function onDialogClose(xWasClicked: boolean) {
    // Send 'refresh' action to plugin after [5000] ms - this is a bit of a hack
    // to get around the updateCache not being reliable.
    // only forces a refresh if not in logLevel === DEV
    onClose(xWasClicked) // send to parent
  }
  
  // the child dialogs (Task & Project) will call this function to position the dialog
  // after they render
  function positionDialog(dialogRef: RefType<any>): any {
    if (isOpen && dialogRef.current) {
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

  return isOpen ? (
      isTask ? (
        <DialogForTaskItems onClose={onDialogClose} details={details} positionDialog={positionDialog} />
      ) : (
        <DialogForProjectItems onClose={onDialogClose} details={details} positionDialog={positionDialog} />
      )
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

  // Safari naturally leaves quite a clear area around edge of window where it will not put the dialog.
  // Note: in the future the draft spec for CSS Anchor Positioning could be helpful for positioning this dialog relative to other things
  // Note: accessing dialog.clientWidth doesn't work, as dialog is not yet drawn
  const winHeight = window.visualViewport.height
  const winWidth = window.visualViewport.width
  // logDebug(`Window dimensions (approx): w${winWidth} x h${winHeight}`)
  // logDebug(`Mouse at x${mousex}, y${mousey}`)
  // logDebug(`Dialog ~ w${dialogWidth} x h${dialogHeight}`)

  // WIDTH + X position
  if (winWidth < dialogWidth) {
    dialog.style.left = `2%`
    dialog.style.width = `96%`
    // logDebug(`Forcing narrower dialog to fit inside window: now centred with width 96%`)
  } else if (winWidth - dialogWidth < 100) {
    x = Math.round((winWidth - dialogWidth) / 2) + scrollX
    dialog.style.left = `${x}px`
    // logDebug(`Forcing narrower dialog to be centred horizontally inside window: now x${x}`)
  } else {
    x = mousex - Math.round(dialogWidth / 3) + scrollX
    if (x + dialogWidth > winWidth + scrollX) {
      x = winWidth - fudgeFactor - dialogWidth + scrollX
      // logDebug(`Move left: now x${x}`)
    }
    if (x < fudgeFactor + scrollX) {
      x = fudgeFactor + scrollX
      // logDebug(`Off left: now x=${x}; width=${dialog.style.width}`)
    }
    dialog.style.left = `${x}px`
  }

  // HEIGHT + Y position
  if (winHeight < dialogHeight) {
    dialog.style.top = `0`
    // logDebug(`Forcing shorter dialog to start inside window: now fixed to top`)
  } else if (winHeight - dialogHeight < 100) {
    y = Math.round((winHeight - dialogHeight) / 2) + scrollY
    dialog.style.top = `${y}px`
    // logDebug(`Forcing shorter dialog to be centred vertically inside viewport: now y${y}`)
  } else {
    y = mousey - Math.round(dialogHeight / 2) + scrollY
    if (y + dialogHeight > winHeight + scrollY) {
      y = winHeight - fudgeFactor - dialogHeight + scrollY
      // logDebug(`Move up: now y${y}`)
    }
    if (y < fudgeFactorTop + scrollY) {
      y = fudgeFactorTop + scrollY
      // logDebug(`Off top: now y=${y}; height=${dialog.style.height}`)
    }
    dialog.style.top = `${y}px`
  }

  // logDebug(`-> x${x}, y${y} / w${dialog.style.width} x h${dialog.style.height}`)
  // const winDetailsSpan = document.getElementById('winDebugDetails')
  // winDetailsSpan.innerHTML = `f${fudgeFactor} / vw${winWidth} x vh${winHeight} / x${dialog.style.left} y${dialog.style.top} w${dialog.style.width} x h${dialog.style.height}`
}

export default Dialog
