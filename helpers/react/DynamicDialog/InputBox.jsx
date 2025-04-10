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
  onKeyDown?: (e: any) => void,
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
  inputRef?: any, // Use a more permissive type to handle various ref types
}

const InputBox = ({
  label,
  value,
  disabled,
  readOnly,
  onChange,
  onSave,
  onKeyDown,
  inputType,
  showSaveButton = true,
  compactDisplay,
  className = '',
  focus,
  step,
  required,
  validationType,
  inputRef: externalInputRef,
}: InputBoxProps): React$Node => {
  const [inputValue, setInputValue] = useState(value)
  const [isSaveEnabled, setIsSaveEnabled] = useState(false)
  const [wasFocused, setWasFocused] = useState(false)
  const isNumberType = inputType === 'number'
  const internalInputRef = useRef<?HTMLInputElement>(null) // Create a ref for the input element
  const [validationError, setValidationError] = useState<string | null>(null) // Add state for validation error message

  // Use the external ref if provided, otherwise use the internal one
  const inputRefToUse = externalInputRef || internalInputRef

  const validateInput = (value: string): string | null => {
    if (required && value.trim() === '') {
      return 'This field is required.'
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
    if (focus && !wasFocused && internalInputRef.current) {
      internalInputRef.current.focus() // Focus the input if focus is true
      internalInputRef.current?.setSelectionRange(inputValue.length, inputValue.length) // Move cursor to the end
      setWasFocused(true)
    }
  }, [focus, inputValue])

  const handleInputChange = (e: any, firstRun: boolean = false) => {
    const newValue = e.target.value
    setInputValue(newValue)
    if (!firstRun) onChange(e)
    if (required || validationType) {
      const error = validateInput(newValue)
      setValidationError(error)
    } else {
      setValidationError(null)
    }
  }

  const handleSaveClick = () => {
    logDebug('InputBox', `handleSaveClick: inputValue=${inputValue}`)
    if (onSave) {
      onSave(inputValue)
    }
  }

  const handleKeyDown = (e: any) => {
    if (onKeyDown) {
      onKeyDown(e)
    }
  }

  return (
    <>
      <div className={`${disabled ? 'disabled' : ''} ${className} ${compactDisplay ? 'input-box-container-compact' : 'input-box-container'}`}>
        <label className="input-box-label">{label}</label>
        <div className="input-box-wrapper">
          <input
            ref={inputRefToUse} // Use the appropriate ref
            type={inputType}
            readOnly={readOnly}
            className={`input-box-input ${isNumberType ? 'input-box-input-number' : ''} ${isNumberType && (step === undefined || step === 0) ? 'hide-step-buttons' : ''}`}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            step={isNumberType && step !== undefined && step > 0 ? step : undefined} // Conditionally use step attribute
            min="0" // works for 'number' type; ignored for rest.
          />
          {showSaveButton && (
            <button className="input-box-save" onClick={handleSaveClick} disabled={!isSaveEnabled}>
              Save
            </button>
          )}
        </div>
      </div>
      {validationError && (
        <div className="validation-message" style={{ color: 'red', fontSize: 'small' }}>
          {validationError} {/* Display the validation error message */}
        </div>
      )}
    </>
  )
}

export default InputBox
