// @flow
//--------------------------------------------------------------------------
// ExpandableTextarea Component
// A textarea that starts small and expands as the user types
//--------------------------------------------------------------------------

import React, { useState, useEffect, useRef } from 'react'
import { logDebug } from '@helpers/react/reactDev.js'
import './ExpandableTextarea.css'

export type ExpandableTextareaProps = {
  label?: string,
  value?: string,
  onChange: (e: any) => void,
  disabled?: boolean,
  placeholder?: string,
  compactDisplay?: boolean,
  className?: string,
  minRows?: number, // Minimum number of rows (default: 3)
  maxRows?: number, // Maximum number of rows before scrolling (default: 10)
  required?: boolean,
  style?: { [key: string]: any },
  onFocus?: (e: any) => void,
  onKeyDown?: (e: any) => void,
  ref?: ?(ref: ?HTMLTextAreaElement) => void, // Callback ref
}

/**
 * ExpandableTextarea Component
 * A textarea that automatically expands as the user types
 * @param {ExpandableTextareaProps} props
 * @returns {React$Node}
 */
export function ExpandableTextarea({
  label,
  value = '',
  onChange,
  disabled = false,
  placeholder = '',
  compactDisplay = false,
  className = '',
  minRows = 3,
  maxRows = 10,
  required = false,
  style = {},
  onFocus,
  onKeyDown,
  ref: refCallback,
}: ExpandableTextareaProps): React$Node {
  const [textareaValue, setTextareaValue] = useState(value)
  const textareaRef = useRef<?HTMLTextAreaElement>(null)

  // Call ref callback if provided
  useEffect(() => {
    if (refCallback) {
      refCallback(textareaRef.current)
    }
  }, [refCallback])

  // Update internal state when value prop changes
  useEffect(() => {
    setTextareaValue(value)
  }, [value])

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto'

      // Calculate the number of lines
      const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight, 10) || 20
      const lines = textarea.value.split('\n').length
      const calculatedRows = Math.max(minRows, Math.min(maxRows, lines))

      // Set height based on calculated rows
      textarea.style.height = `${calculatedRows * lineHeight}px`
    }
  }, [textareaValue, minRows, maxRows])

  const handleChange = (e: any) => {
    const newValue = e.target.value
    setTextareaValue(newValue)
    onChange(e)
  }

  const handleFocus = (e: any) => {
    if (onFocus) {
      onFocus(e)
    }
    // Also call ref callback on focus
    if (refCallback) {
      refCallback(textareaRef.current)
    }
  }

  const handleKeyDown = (e: any) => {
    // Allow Tab key to insert a tab character instead of moving focus
    if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      const textarea = e.currentTarget
      const start = textarea.selectionStart || 0
      const end = textarea.selectionEnd || 0
      const newValue = textareaValue.substring(0, start) + '\t' + textareaValue.substring(end)
      setTextareaValue(newValue)
      // Trigger onChange with synthetic event
      const syntheticEvent = {
        target: { value: newValue },
        currentTarget: textarea,
      }
      onChange(syntheticEvent)
      // Set cursor position after the inserted tab
      setTimeout(() => {
        textarea.focus()
        const newCursorPos = start + 1
        textarea.setSelectionRange(newCursorPos, newCursorPos)
      }, 0)
      return
    }
    // Allow all other keys including Enter to work normally
    // Call custom onKeyDown if provided
    if (onKeyDown) {
      onKeyDown(e)
    }
  }

  // Validate if required and empty
  const validationError = required && textareaValue.trim() === '' ? 'required' : null

  return (
    <div className={`expandable-textarea-container ${compactDisplay ? 'compact' : ''} ${className}`} data-field-type="textarea">
      {label && <label className="expandable-textarea-label">{label}</label>}
      <div className="expandable-textarea-wrapper">
        <textarea
          ref={textareaRef}
          className="expandable-textarea"
          value={textareaValue}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          required={required}
          rows={minRows}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          style={Object.assign(
            {
              minHeight: `${minRows * 20}px`, // Approximate line height
              maxHeight: `${maxRows * 20}px`, // Maximum height before scrolling
              overflowY: 'auto',
            },
            style || {},
          )}
        />
        {validationError ? (
          <div className="validation-message">
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span>{validationError}</span>
          </div>
        ) : (
          <div className="validation-message validation-message-placeholder" aria-hidden="true"></div>
        )}
      </div>
    </div>
  )
}

export default ExpandableTextarea
