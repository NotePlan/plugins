// dbw Note: Maybe not used anymore. Trying to move all to the DashboardDialog version

// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show an HTML ComboBox control, with various possible settings.
// Based on basic HTML controls, not a fancy React Component.
// Last updated 2024-07-30 for v2.0.5 by @jgclark
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useState, useEffect, useRef, type ElementRef } from 'react'
import { logDebug } from '@np/helpers/react/reactDev'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------
type ComboBoxProps = {
  label: string,
  options: Array<string>,
  value: string,
  onChange: (value: string) => void,
  inputRef?: { current: null | HTMLInputElement },
  compactDisplay?: boolean,
}

//--------------------------------------------------------------------------
// ComboBox Component Definition
//--------------------------------------------------------------------------
const ComboBox = ({ label, options, value, onChange, inputRef, compactDisplay = false }: ComboBoxProps): React.ReactNode => {
  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------
  const [isOpen, setIsOpen] = useState(false)
  const [selectedValue, setSelectedValue] = useState(value)
  const comboboxRef = useRef<?ElementRef<'div'>>(null)
  const comboboxInputRef = useRef<?ElementRef<'input'>>(null)

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------

  /**
   * Toggles the dropdown open or closed.
   */
  const toggleDropdown = () => {
    logDebug(`Dashboard toggleDropdown, isOpen: ${String(isOpen)}`)
    setIsOpen(!isOpen)
  }

  /**
   * Handles the selection of an option.
   * @param {string} option - The selected option.
   */
  const handleOptionClick = (option: string) => {
    logDebug(`Dashboard handleOptionClick, option: ${option}`)
    setSelectedValue(option)
    onChange(option)
    setIsOpen(false)
  }

  /**
   * Closes the dropdown if a click occurs outside of it.
   * @param {any} event - The click event.
   */
  const handleClickOutside = (event: any) => {
    if (comboboxRef.current && !comboboxRef.current.contains(event.target)) {
      setIsOpen(false)
    }
  }

  /**
   * Scrolls the combobox fully into view.
   */
  // const handleComboboxOpen = () => {
  //   setTimeout(() => {
  //     if (comboboxInputRef.current instanceof HTMLInputElement) {
  //       comboboxInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
  //       console.log('Found comboboxInputRef so added scroll handler')
  //     } else {
  //       console.log('Could not find comboboxInputRef')
  //     }
  //   }, 100) // Delay to account for rendering/animation
  // }

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------

  useEffect(() => {
    if (isOpen) {
      logDebug(`Dashboard ComboBox useEffect: Adding mousedown listener`)
      document.addEventListener('mousedown', handleClickOutside)
    } else {
      logDebug(`Dashboard ComboBox useEffect: Removing mousedown listener`)
      document.removeEventListener('mousedown', handleClickOutside)
    }

    // Cleanup function to ensure the listener is removed when the component unmounts or isOpen changes
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // useEffect(() => {
  //   const combobox = comboboxInputRef.current
  //   if (combobox instanceof HTMLInputElement) {
  //     console.log('adding event listener for comboboxInputRef')
  //     combobox.addEventListener('click', handleComboboxOpen)
  //   }
  //   return () => {
  //     if (combobox instanceof HTMLInputElement) {
  //       console.log('removing event listener for comboboxInputRef')
  //       combobox.removeEventListener('click', handleComboboxOpen)
  //     }
  //   }
  // }, [])

  // useEffect(() => {
  //   setSelectedValue(value)
  // }, [value])

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------
  logDebug(`Dashboard ComboBox render, isOpen: ${String(isOpen)}`, { options })
  return (
    <div className={compactDisplay ? 'combobox-container-compact' : 'combobox-container'}>
      <label className="combobox-label">{label}</label>
      <div className="combobox-wrapper" onClick={toggleDropdown}>
        <input
          type="text"
          className="combobox-input"
          value={selectedValue}
          readOnly
          ref={inputRef || comboboxInputRef} // Pass the inputRef to the input element
        />
        <span className="combobox-arrow">&#9662;</span>
        {isOpen && (
          <div className="combobox-dropdown" ref={comboboxRef}>
            {options.map((option: string) => (
              <div key={option} className="combobox-option" onClick={() => handleOptionClick(option)}>
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
