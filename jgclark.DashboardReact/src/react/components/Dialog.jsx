// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Item Control and Project dialogs.
// Last updated 20.4.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------

import React from 'react'
import Button from './Button.jsx' // Note: Imported Button is not used, consider removing it if it's not needed.
import DialogForProjectItems from './DialogForProjectItems.jsx'
import DialogForTaskItems from './DialogForTaskItems.jsx'

type Props = {
  isOpen: boolean,
  isTask: boolean,
  onClose: () => void,
  children: ?React$Node,
}

/**
 * Represents dialogues for item control and project control.
 * @param {Props} props The properties for the Dialog component.
 * @return {?React$Node} Renderable React node or null.
 */
const Dialog = ({ isOpen, onClose, isTask }: Props): ?React$Node => {
  return isOpen ? isTask ? <DialogForTaskItems onClose={onClose} isOpen={isOpen} /> : <DialogForProjectItems onClose={onClose} isOpen={isOpen} /> : null
}

export default Dialog
