// Dialog.jsx

// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Item Control and Project dialogs.
// Last updated 17.5.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------

import React from 'react'
import { useAppContext } from './AppContext.jsx'
import DialogForProjectItems from './DialogForProjectItems.jsx'
import DialogForTaskItems from './DialogForTaskItems.jsx'
import '../css/dashboardDialog.css'
import { clo, logDebug } from '@helpers/react/reactDev.js'

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
  console.log(`Dialog: starting for ${isTask ? 'task' : 'project'}`)
  const { reactSettings } = useAppContext()

  const positionDialog = (dialogRef: RefType<any>): any => {
    if (!dialogRef.current) return

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
    isTask ? (
      <DialogForTaskItems onClose={onClose} details={details} positionDialog={positionDialog} />
    ) : (
      <DialogForProjectItems onClose={onClose} details={details} positionDialog={positionDialog} />
    )
  ) : null
}

export default Dialog
