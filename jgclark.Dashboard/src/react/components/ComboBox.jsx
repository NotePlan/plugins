// @flow
import React, { useState, useEffect, useRef, type ElementRef } from 'react'

type ComboBoxProps = {
  label: string,
  options: Array<string>,
  value: string,
  onChange: (value: string) => void,
  inputRef?: { current: null | HTMLInputElement }, // Add inputRef prop type
};

const ComboBox = ({ label, options, value, onChange, inputRef }: ComboBoxProps): React$Node => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedValue, setSelectedValue] = useState(value)
  const dropdownRef = useRef<?ElementRef<'div'>>(null)

  const toggleDropdown = () => setIsOpen(!isOpen)
  const handleOptionClick = (option: string) => {
    setSelectedValue(option)
    onChange(option)
    setIsOpen(false)
  }

  const handleClickOutside = (event: any) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setIsOpen(false)
    }
  }

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className="combobox-container">
      <label className="combobox-label">{label}</label>
      <div className="combobox-wrapper" onClick={toggleDropdown}>
        <input
          type="text"
          className="combobox-input"
          value={selectedValue}
          readOnly
          ref={inputRef} // Pass the inputRef to the input element
        />
        <span className="combobox-arrow">&#9662;</span>
        {isOpen && (
          <div className="combobox-dropdown" ref={dropdownRef} >
            {options.map((option: string) => (
              <div
                key={option}
                className="combobox-option"
                onClick={() => handleOptionClick(option)}
              >
                {option}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ComboBox
