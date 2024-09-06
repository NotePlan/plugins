// @flow
// This component is a simple version of the showModal() backdrop with click handling
// Creates a backdrop for a modal dialog, and calls onClose() when user clicks outside the dialog
// Assumes that the modal content div is passed as children
// The children are given an automatic z-index of 101 (to be above the backdrop)
import React, { type Node } from 'react'
import './Modal.css'

/**
 * Props for Modal component
 * @typedef {Object} Props
 * @property {() => void} onClose - Function to close the modal
 * @property {Node} children - Content of the modal
 */

/**
 * Modal component to display content in a modal dialog
 * @param {Props} props - Component props
 * @returns {Node} Rendered component
 */
const Modal = ({ onClose, children }: { onClose: () => void, children: Node }): Node => {

  const handleBackdropClick = (event: SyntheticEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      {children}
    </div>
  )
}

export default Modal
