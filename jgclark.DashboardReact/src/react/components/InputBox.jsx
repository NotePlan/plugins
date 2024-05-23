// @flow
import React, { useState, useEffect } from 'react'
import { logDebug } from '@helpers/react/reactDev'

type InputBoxProps = {
  label: string,
  value: string,
  onChange: (e: any) => void,
  onSave: (newValue: string) => void,
};

const InputBox = ({ label, value, onChange, onSave }: InputBoxProps): React$Node => {
  const [inputValue, setInputValue] = useState(value)
  const [isSaveEnabled, setIsSaveEnabled] = useState(false)

  useEffect(() => {
    setIsSaveEnabled(inputValue !== value)
  }, [inputValue, value])

  const handleInputChange = (e: any) => {
    setInputValue(e.target.value)
    onChange(e)
  }

  const handleSaveClick = () => {
    logDebug('InputBox', `handleSaveClick: inputValue=${inputValue}`)
    onSave(inputValue)
  }

  return (
    <div className="input-box-container">
      <label className="input-box-label">{label}</label>
      <div className="input-box-wrapper">
        <input
          type="text"
          className="input-box-input"
          value={inputValue}
          onChange={handleInputChange}
        />
        <button
          className="input-box-save"
          onClick={handleSaveClick}
          disabled={!isSaveEnabled}
        >
          Save
        </button>
      </div>
    </div>
  )
}

export default InputBox
