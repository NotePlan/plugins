// Dialog.jsx

// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Item Control and Project dialogs.
// Last updated 18.5.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------

import React, { useRef } from 'react'
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
  const dialogRef = useRef <? HTMLDivElement > (null)

  isOpen ? logDebug(`Dialog`, `starting for ${isTask ? 'task' : 'project'} isOpen: ${isOpen ? 'true' : ''} details: ${JSP(details)}`) : null
  const { reactSettings, pluginData } = useAppContext()

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

  const positionDialog_dbw = (dialogRef: RefType<any>): any => {
    if (!dialogRef.current) return
    //TODO: delete all this code and passing it to DialogForProjectItems and DialogForTaskItems
    logDebug(`Dialog`, `ENTERING positionDialog() TODO: delete this code`)
    return

    const clickPosition = reactSettings?.dialogData?.clickPosition

    const dialog = dialogRef.current
    if (!dialog) return


    const dialogHeight = dialog.offsetHeight

    // Calculate the vertical position of the dialog
    let dialogTop
    if (clickPosition) {
      // If there's a click event, position the dialog under the click Y if it fits in the screen
      const clickY = clickPosition.clientY + window.scrollY - 15 // Account for scroll position
      const clickX = clickPosition.clientX
      const spaceBelow = window.innerHeight - clickY
      if (spaceBelow >= dialogHeight) {
        dialogTop = clickY // Dialog fits below the clicked point
      } else {
        // Dialog doesn't fit below the clicked point, position it at the bottom of the viewport
        dialogTop = window.innerHeight - dialogHeight
      }
      console.log(
        `Dialog`,
        `Have click data: clickX=${clickX} clickY=${clickY} spaceBelow=${spaceBelow} dialogTop=${dialogTop} dialogHeight=${dialogHeight} window.innerHeight=${window.innerHeight}`,
      )
    } else {
      // If no click event, center the dialog vertically in the viewport, accounting for the scroll position
      dialogTop = (window.innerHeight - dialogHeight) / 2 + window.scrollY
      logDebug(`Dialog`, `No click data: positionDialog dialogTop=${dialogTop}`)
    }

    // Center the dialog horizontally in the viewport
    const dialogWidth = dialog.offsetWidth
    const dialogLeft = (window.innerWidth - dialogWidth) / 2

    // Apply the calculated position to the dialog
    dialog.style.top = `${dialogTop}px`
    dialog.style.left = `${dialogLeft}px`
    logDebug(`Dialog`, `LEAVING positionDialog() set: top=${dialogTop} left=${dialogLeft}`)
    return {}
  }

  return isOpen ? (
    <div ref={dialogRef}>
      {isTask ? (
        <DialogForTaskItems onClose={onClose} details={details} positionDialog={positionDialog} />
      ) : (
        <DialogForProjectItems onClose={onClose} details={details} positionDialog={positionDialog} />
      )}
    </div>
  ) : null
}

//--------------------------------------------------------------------------------------
// @jgclark dialog positioning code
// Set place in the HTML window for dialog to appear
// Note: JGC's iPhone reports 375x812, but screen shots are 3x (1124x2436)
function setPositionForDialog(thisOS: string, dialogWidth: number, dialogHeight: number, dialog: any, event: TClickPosition) {
  logDebug(`Dialog`, `ENTERING setPositionForDialog() thisOS=${thisOS} dialogWidth=${dialogWidth} dialogHeight=${dialogHeight} event=${JSON.stringify(event)}`)
  const fudgeFactor = 8 // small border (in pixels) to take account of scrollbars etc.
  const mousex = event.clientX // Horizontal
  const mousey = event.clientY // Vertical
  let x = 0
  let y = 0

  // Safari naturally leaves quite a clear area around edge of window where it will not put the dialog.
  // Note: in the future the draft spec for CSS Anchor Positioning could be helpful for positioning this dialog relative to other things
  // Note: accessing dialog.clientWidth doesn't work, as dialog is not yet drawn
  // const winHeight = window.innerHeight - fudgeFactor
  const winHeight = window.visualViewport.height
  // const winWidth = window.innerWidth - fudgeFactor
  const winWidth = window.visualViewport.width
  console.log(`Window dimensions (approx): w${winWidth} x h${winHeight}`)
  // TODO: remove after testing
  console.log(`Mouse at x${mousex}, y${mousey}`)
  console.log(`Dialog ~ w${dialogWidth} x h${dialogHeight}`)

  // WIDTH + X position
  // First deal with windows narrower than the dialog
  if (winWidth < dialogWidth) {
    // dialog.style.width = `${String(winWidth)}px`
    dialog.style.left = `2%`
    dialog.style.width = `96%`
    console.log(`Forcing narrower dialog to fit inside window: now centred with width 96%`)
  }
  // then deal with narrow windows
  else if (winWidth - dialogWidth < 100) {
    x = Math.round((winWidth - dialogWidth) / 2)
    dialog.style.left = `${String(x)}px`
    console.log(`Forcing narrower dialog to be centred horizontally inside window: now x${String(x)}`)
  }
  // otherwise place dialog near mouse x position, but keep within screen
  else {
    x = mousex - Math.round(dialogWidth / 3)
    if (x + dialogWidth > winWidth) {
      x = winWidth - fudgeFactor - dialogWidth
      console.log(`Move left: now x${String(x)}`)
    }
    if (x < fudgeFactor) {
      x = fudgeFactor
      console.log(`Off left: now x=${fudgeFactor}; width=${dialog.style.width}`)
    }
    dialog.style.left = `${String(x)}px`
  }

  // HEIGHT + Y position
  // First deal with viewport shorter than the dialog
  if (winHeight < dialogHeight) {
    // dialog.style.Height = `${String(winHeight)}px`
    dialog.style.top = `0`
    console.log(`Forcing shorter dialog to start inside window: now fixed to top`)
  }
  // then deal with quite short viewport
  else if (winHeight - dialogHeight < 100) {
    y = Math.round((winHeight - dialogHeight) / 2)
    dialog.style.top = `${String(y)}px`
    console.log(`Forcing shorter dialog to be centred vertically inside viewport: now y${String(y)}`)
  }
  // otherwise place dialog near mouse y position, but keep within screen
  else {
    logDebug(`Dialog`, `Vertical pos: Mouse y${mousey} winHeight=${winHeight} - dialogHeight=${dialogHeight}`)
    y = mousey - Math.round(dialogHeight / 2)
    if (y + dialogHeight > winHeight) {
      y = winHeight - fudgeFactor - dialogHeight
      console.log(`Move up: now y${String(y)}`)
    }
    if (y < fudgeFactor) {
      y = fudgeFactor
      // dialog.style.height = `${String(winHeight - fudgeFactor)}px`
      console.log(`Off top: now y=${fudgeFactor}; height=${dialog.style.height}`)
    }
    logDebug(`Dialog`, `Setting top to Final value y=${y}`)
    dialog.style.top = `${String(y)}px`
  }

  console.log(`-> x${x}, y${y} / w${dialog.style.width} x h${dialog.style.height}`)
  // const winDetailsSpan = document.getElementById('winDebugDetails')
  // winDetailsSpan.innerHTML = `f${fudgeFactor} / vw${winWidth} x vh${winHeight} / x${dialog.style.left} y${dialog.style.top} w${dialog.style.width} x h${dialog.style.height}`
}

export default Dialog

