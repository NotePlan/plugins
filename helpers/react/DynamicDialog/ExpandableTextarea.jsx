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
}: ExpandableTextareaProps): React$Node {
  const [textareaValue, setTextareaValue] = useState(value)
  const textareaRef = useRef<?HTMLTextAreaElement>(null)

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

  return (
    <div className={`expandable-textarea-container ${compactDisplay ? 'compact' : ''} ${className}`}>
      {label && <label className="expandable-textarea-label">{label}</label>}
      <textarea
        ref={textareaRef}
        className="expandable-textarea"
        value={textareaValue}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder}
        required={required}
        rows={minRows}
        style={{
          minHeight: `${minRows * 20}px`, // Approximate line height
          maxHeight: `${maxRows * 20}px`, // Maximum height before scrolling
          overflowY: 'auto',
        }}
      />
    </div>
  )
}

export default ExpandableTextarea
