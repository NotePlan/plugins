// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show an HTML Input control, with various possible settings.
// Last updated 2024-07-29 for v2.0.5 by @jgclark
//--------------------------------------------------------------------------
// InputBox.jsx
import React, { useState, useEffect, useRef } from 'react'
import { logDebug } from '@helpers/react/reactDev'

type InputBoxProps = {
  label: string,
  value: string,
  onChange: (e: any) => void,
  onSave?: (newValue: string) => void,
  readOnly?: boolean,
  inputType?: string,
  showSaveButton?: boolean,
  compactDisplay?: boolean,
  className?: string,
  disabled?: boolean,
  focus?: boolean,
  step?: number, // Add step prop
  required?: boolean,
  validationType?: 'email' | 'number' | 'date-interval',
  debounceOnChange?: boolean, // If true, debounce onChange callback (useful when this input provides a key for another field)
  debounceMs?: number, // Debounce delay in milliseconds (default: 500ms)
  id?: string, // Optional unique id for the input (if not provided, will be generated)
  name?: string, // Optional name attribute for the input
}

const InputBox = ({
  label,
  value,
  disabled,
  readOnly,
  onChange,
  onSave,
  inputType,
  showSaveButton = true,
  compactDisplay,
  className = '',
  focus,
  step,
  required,
  validationType,
  debounceOnChange = true, // Default to true: debounce onChange to prevent excessive updates when input provides a key for another field
  debounceMs = 500,
  id,
  name,
}: InputBoxProps): React$Node => {
  const [inputValue, setInputValue] = useState(value)
  const [isSaveEnabled, setIsSaveEnabled] = useState(false)
  const [wasFocused, setWasFocused] = useState(false)
  const isNumberType = inputType === 'number'
  const inputRef = useRef<?HTMLInputElement>(null) // Create a ref for the input element
  const [validationError, setValidationError] = useState<string | null>(null) // Add state for validation error message
  const debounceTimeoutRef = useRef<?TimeoutID>(null) // Track debounce timeout
  
  // Generate unique id if not provided - use label or fallback
  const inputId = id || `input-${label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${Math.random().toString(36).substr(2, 9)}`
  const inputName = name || id || inputId // Use name if provided, otherwise use id or generated id

  const validateInput = (value: string): string | null => {
    if (required && value.trim() === '') {
      return 'required' // Simplified message - will be displayed with icon
    }
    if (validationType) {
      switch (validationType) {
        case 'email':
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'Please enter a valid email address.'
        case 'number':
          return !isNaN(value) ? null : 'Please enter a valid number.'
        case 'date-interval':
          return /^[0-9]+[bdwmqy]$/.test(value) ? null : 'Please enter a valid date interval in the format: nn[bdwmqy].'
        default:
          return 'Invalid input.'
      }
    }
    return null
  }

  useEffect(() => {
    if (required) handleInputChange({ target: { value: value }, currentTarget: { value: value } }, true)
  }, [])

  useEffect(() => {
    setIsSaveEnabled(inputValue !== value)
  }, [inputValue, value])

  useEffect(() => {
    if (focus && !wasFocused && inputRef.current) {
      inputRef.current.focus() // Focus the input if focus is true
      inputRef.current?.setSelectionRange(inputValue.length, inputValue.length) // Move cursor to the end
      setWasFocused(true)
    }
  }, [focus, inputValue])

  const handleInputChange = (e: any, firstRun: boolean = false) => {
    const newValue = e.target.value
    setInputValue(newValue) // Update local state immediately for responsive UI
    
    // Validate immediately
    if (required || validationType) {
      const error = validateInput(newValue)
      setValidationError(error)
    } else {
      setValidationError(null)
    }

    // Handle onChange: debounce if enabled, otherwise call immediately
    if (!firstRun) {
      if (debounceOnChange) {
        // Clear existing timeout
        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current)
        }
        // Set new debounced timeout
        // CRITICAL: Capture the value immediately because the event object will be nullified
        // by React after the handler completes. Create a synthetic event object with the value.
        const capturedValue = newValue
        debounceTimeoutRef.current = setTimeout(() => {
          // Create a synthetic event object with the captured value
          // This ensures e.currentTarget.value works even after the original event is nullified
          const syntheticEvent = {
            target: { value: capturedValue },
            currentTarget: { value: capturedValue },
          }
          onChange(syntheticEvent)
          debounceTimeoutRef.current = null
        }, debounceMs)
      } else {
        // No debouncing, call immediately
        onChange(e)
      }
    }
  }

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  const handleSaveClick = () => {
    logDebug('InputBox', `handleSaveClick: inputValue=${inputValue}`)
    if (onSave) {
      onSave(inputValue)
    }
  }

  return (
    <div className={`${disabled ? 'disabled' : ''} ${className} ${compactDisplay ? 'input-box-container-compact' : 'input-box-container'}`}>
      <label className="input-box-label" htmlFor={inputId}>{label}</label>
      <div className="input-box-wrapper">
        <input
          id={inputId}
          name={inputName}
          ref={inputRef} // Attach the ref to the input element
          type={inputType}
          readOnly={readOnly}
          className={`input-box-input ${isNumberType ? 'input-box-input-number' : ''} ${isNumberType && (step === undefined || step === 0) ? 'hide-step-buttons' : ''}`}
          value={inputValue}
          onChange={handleInputChange}
          disabled={disabled}
          step={isNumberType && step !== undefined && step > 0 ? step : undefined} // Conditionally use step attribute
          min="0" // works for 'number' type; ignored for rest.
        />
        {showSaveButton && (
          <button className="input-box-save" onClick={handleSaveClick} disabled={!isSaveEnabled}>
            Save
          </button>
        )}
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

export default InputBox
