// @flow
import React from 'react'
import Button from './Button.jsx'

type Props = {
  isOpen: boolean,
  onClose: () => void,
  children: React$Node,
};

/**
 * Represents dialogues for item control and project control.
 */
const Dialog = ({ isOpen, onClose, children }: Props):React$Node => (
  isOpen ? (
    <div className="dialogBackdrop">
      <div className="dialogContent">
        {children}
        <Button text="Close" onClick={onClose} />
      </div>
    </div>
  ) : null
)

export default Dialog
