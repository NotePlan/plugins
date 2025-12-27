// @flow
//--------------------------------------------------------------------------
// SimpleDialog Component - General-purpose themed dialog
// Supports single OK button, OK/Cancel, or multiple buttons via ButtonGroup
//--------------------------------------------------------------------------

import React, { useEffect, type Node } from 'react'
import { ButtonGroup } from './DynamicDialog/ButtonComponents'
import './SimpleDialog.css'

export type SimpleDialogButton = {
  label: string,
  value: string,
  isDefault?: boolean,
}

type SimpleDialogProps = {
  isOpen: boolean,
  title: string,
  message: string,
  buttons?: Array<SimpleDialogButton>, // If provided, use ButtonGroup (full control)
  buttonLabels?: Array<string>, // Alternative: simple array of button labels (e.g., ["Cancel", "OK"])
  onButtonClick?: (value: string) => void | boolean, // Callback when a button is clicked (receives button label as value). Return false to prevent closing.
  onClose: () => void, // Callback to close the dialog
  className?: string,
  width?: string, // Optional width override (default: more square)
  maxWidth?: string, // Optional max-width override
}

/**
 * SimpleDialog - A general-purpose themed floating dialog
 * @param {boolean} isOpen - Whether the dialog is open
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @param {Array<SimpleDialogButton>} buttons - Optional array of button objects (full control)
 * @param {Array<string>} buttonLabels - Alternative: simple array of button labels (e.g., ["Cancel", "OK"])
 * @param {Function} onButtonClick - Callback when a button is clicked (receives button label/value as value)
 * @param {Function} onClose - Callback to close the dialog
 * @param {string} className - Optional additional CSS class
 */
export function SimpleDialog({ isOpen, title, message, buttons, buttonLabels, onButtonClick, onClose, className = '', width, maxWidth }: SimpleDialogProps): Node {
  // Handle Escape key to close
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Determine which buttons to show
  let buttonOptions: Array<SimpleDialogButton> = []
  if (buttons && buttons.length > 0) {
    // Use provided buttons array (full control)
    buttonOptions = buttons
  } else if (buttonLabels && buttonLabels.length > 0) {
    // Convert buttonLabels array to button objects
    // Last button is default, others are not
    // Value is the label in lowercase with spaces replaced by hyphens for consistency
    buttonOptions = buttonLabels.map((label, index) => ({
      label,
      value: label.toLowerCase().replace(/\s+/g, '-'), // Convert "Open Note" -> "open-note"
      isDefault: index === buttonLabels.length - 1, // Last button is default
    }))
  } else {
    // Default: single OK button
    buttonOptions = [{ label: 'OK', value: 'ok', isDefault: true }]
  }

  const handleButtonClick = (value: string) => {
    if (onButtonClick) {
      const result = onButtonClick(value)
      // If onButtonClick returns false, don't close the dialog
      if (result === false) {
        return
      }
    }
    // Close dialog after button click (unless onButtonClick returned false)
    onClose()
  }

  const containerStyle: { width?: string, maxWidth?: string } = {}
  if (width) containerStyle.width = width
  if (maxWidth) containerStyle.maxWidth = maxWidth

  return (
    <div className={`simple-dialog-overlay ${className}`} onClick={onClose}>
      <div className="simple-dialog-container" style={containerStyle} onClick={(e) => e.stopPropagation()}>
        <div className="simple-dialog-header">
          <h3 className="simple-dialog-title">{title}</h3>
          <button className="simple-dialog-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="simple-dialog-content">
          <p className="simple-dialog-message">{message}</p>
        </div>
        <div className="simple-dialog-footer">
          <ButtonGroup options={buttonOptions} onClick={handleButtonClick} />
        </div>
      </div>
    </div>
  )
}

export default SimpleDialog
