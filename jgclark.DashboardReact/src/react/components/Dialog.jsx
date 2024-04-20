// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Item Control and Project dialogs.
// Last updated 20.4.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------

// TODO: Move most dialog HTML code into here. DW says he has ideas for modularising it.

import React from 'react'
import Button from './Button.jsx'

type Props = {
  isOpen: boolean,
  onClose: () => void,
  children: React$Node,
}

/**
 * Represents dialogues for item control and project control.
 */
const Dialog = ({ isOpen, onClose, children }: Props): React$Node =>
  isOpen ? (
    <div className="dialogBackdrop">
      <div className="dialogContent">
        {children}
        <Button text="Close" clickHandler={onClose} />
      </div>
    </div>
  ) : null

export default Dialog
