import React, { useEffect, useState } from 'react'

const InputBox = ({ type, placeholder, required, className, onChange, ...otherProps }) => {
  const [inputValue, setInputValue] = useState('')
  const [validationError, setValidationError] = useState('')

  const handleInputChange = (e) => {
    const newValue = e.target.value
    setInputValue(newValue)
    if (onChange) {
      onChange(e)
    }
    // Validate input on change
    validateInput(newValue)
  }

  const validateInput = (value) => {
    if (required && !value.trim()) {
      setValidationError('This field is required')
      return false
    }
    setValidationError('')
    return true
  }

  useEffect(() => {
    validateInput(inputValue)
  }, [inputValue, required])

  return (
    <div className={`input-box ${className || ''}`}>
      <input
        type={type}
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        className={`input-box-input ${validationError ? 'invalid' : ''}`}
        required={required}
        {...otherProps}
      />
      {validationError && <div className="input-box-error">{validationError}</div>}
    </div>
  )
}

export default InputBox
