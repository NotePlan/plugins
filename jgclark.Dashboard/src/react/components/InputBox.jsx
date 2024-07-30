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
  inputType?: string,
  showSaveButton?: boolean,
  compactDisplay?: boolean,
  className?: string,
};

const InputBox = ({ label, value, onChange, onSave, inputType, showSaveButton = true, compactDisplay, className = '' }: InputBoxProps): React$Node => {
  logDebug('InputBox', `label='${label}', compactDisplay? ${String(compactDisplay)}`)
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
    <div className={`${className} ${compactDisplay ? "input-box-container-compact" : "input-box-container"}`} >
      <label className="input-box-label">{label}</label>
      <div className="input-box-wrapper">
        <input
          type={inputType}
          className={`input-box-input ${isNumberType ? 'input-box-input-number' : ''}`}
          value={inputValue}
          onChange={handleInputChange}
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
