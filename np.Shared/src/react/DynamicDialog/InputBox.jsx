// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show an HTML Input control, with various possible settings.
// Last updated 2024-07-29 for v2.0.5 by @jgclark
//--------------------------------------------------------------------------
// InputBox.jsx
import React, { useState, useEffect } from 'react'
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
  step?: number, // Add step prop
};

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
  step, // Remove default step value
}: InputBoxProps): React$Node => {
  const [inputValue, setInputValue] = useState(value)
  const [isSaveEnabled, setIsSaveEnabled] = useState(false)
  const isNumberType = inputType === 'number'

  useEffect(() => {
    setIsSaveEnabled(inputValue !== value)
  }, [inputValue, value])

  const handleInputChange = (e: any) => {
    setInputValue(e.target.value)
    onChange(e)
  }

  const handleSaveClick = () => {
    logDebug('InputBox', `handleSaveClick: inputValue=${inputValue}`)
    if (onSave) {
      onSave(inputValue)
    }
  }

  return (
    <div className={`${disabled ? 'disabled' : ''} ${className} ${compactDisplay ? "input-box-container-compact" : "input-box-container"}`} >
      <label className="input-box-label">{label}</label>
      <div className="input-box-wrapper">
        <input
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
          <button
            className="input-box-save"
            onClick={handleSaveClick}
            disabled={!isSaveEnabled}
          >
            Save
          </button>
        )}
      </div>
    </div>
  )
}

export default InputBox
