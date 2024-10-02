// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show an HTML ComboBox control, with various possible settings. Based on basic HTML controls, not a fancy React Component.
//--------------------------------------------------------------------------
import React, { useState, useEffect, useRef, type ElementRef } from 'react'
import ThemedSelect from './ThemedSelect.jsx'

type ComboProps = {
  label: string,
  options: Array<string>,
  value: string,
  onChange: (value: string) => void,
  inputRef?: { current: null | HTMLInputElement }, // Add inputRef prop type
  compactDisplay?: boolean,
  disabled?: boolean,
}

const ComboBox = ({ label, options, value, onChange, disabled, inputRef, compactDisplay = false }: ComboProps): React$Node => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedValue, setSelectedValue] = useState(value)
  const comboboxRef = useRef<?ElementRef<'div'>>(null)
  const comboboxInputRef = useRef<?ElementRef<'input'>>(null)

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------

  const toggleDropdown = () => setIsOpen(!isOpen)
  const handleOptionClick = (option: string) => {
    setSelectedValue(option)
    onChange(option)
    setIsOpen(false)
  }

  const handleClickOutside = (event: any) => {
    if (comboboxRef.current && !comboboxRef.current.contains(event.target)) {
      setIsOpen(false)
    }
  }

  // Scroll combobox fully into view
  // FIXME(@dbw): please can you help? I've added this but it's not working.
  const handleComboboxOpen = () => {
    setTimeout(() => {
      if (comboboxInputRef.current instanceof HTMLInputElement) {
        // comboboxInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
        console.log('Found comboboxInputRef so added scroll handler')
      } else {
        console.log('Could not find comboboxInputRef')
      }
    }, 100) // Delay to account for rendering/animation
  }

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    const combobox = comboboxInputRef.current
    if (combobox instanceof HTMLInputElement) {
      console.log('adding event listener for comboboxInputRef')
      combobox.addEventListener('click', handleComboboxOpen)
    }
    return () => {
      if (combobox instanceof HTMLInputElement) {
        console.log('removing event listener for comboboxInputRef')
        combobox.removeEventListener('click', handleComboboxOpen)
      }
    }
  }, [])

  const opts = options.map((option: string) => ({ label: option, value: option }))
  return (
    <div className={`${compactDisplay ? 'combobox-container-compact' : 'combobox-container'} ${disabled ? 'disabled' : ''}`}>
      <label className="combobox-label">{label}</label>
      {/* TODO: finish wiring up the ThemedSelect */}
      {/* options, onSelect, onChange, defaultValue */}
      <ThemedSelect options={opts} onSelect={() => {}} onChange={() => {}} defaultValue={selectedValue}></ThemedSelect>
      {/* probably get rid of this div below; just keeping in case */}
      <div className="combobox-dropdown" ref={comboboxRef}></div>
    </div>
  )
}

export default ComboBox
