// @flow
import React, { useState, useEffect, useRef } from 'react'
import type { TDropdownItemType } from '../../types'
import {logDebug,JSP} from '@helpers/react/reactDev.js'

type ComboBoxProps = {
  label: string,
  options: Array<string>,
  value: string,
  onChange: (value: string) => void,
};

const ComboBox = ({ label, options, value, onChange }: ComboBoxProps): React$Node => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedValue, setSelectedValue] = useState(value)
  const dropdownRef = useRef(null)

  const toggleDropdown = () => setIsOpen(!isOpen)
  const handleOptionClick = (option: string) => {
    setSelectedValue(option)
    onChange(option)
    setIsOpen(false)
  }

  const handleClickOutside = (event) => {
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
      <div className="combobox-wrapper" ref={dropdownRef} onClick={toggleDropdown}>
        <input
          type="text"
          className="combobox-input"
          value={selectedValue}
          readOnly
        />
        <span className="combobox-arrow">&#9662;</span>
        {isOpen && (
          <div className="combobox-dropdown">
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
