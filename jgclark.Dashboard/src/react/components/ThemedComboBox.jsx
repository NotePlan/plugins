// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show an HTML ComboBox control, with various possible settings.
// Last updated 2024-07-30 for v2.0.x by @jgclark
//
// WARNING: Not yet ready for use.
//--------------------------------------------------------------------------
import React, { useState, useEffect, useRef, type ElementRef } from 'react'
import { ThemedSelect, type OptionType } from '@helpers/react/ThemedSelect'
import { logDebug } from '@helpers/react/reactDev'

type ComboBoxProps = {
  label: string,
  description?: string,
  options: Array<string>,
  value: string,
  onChange: Function,
  onSelect: Function,
  inputRef?: { current: null | HTMLInputElement }, // Add inputRef prop type
  compactDisplay?: boolean,
  defaultValue?: OptionType,
};

const ThemedComboBox = ({ label, description = '', options, value, onChange, onSelect, inputRef, compactDisplay, defaultValue }: ComboBoxProps): React$Node => {
  logDebug('ThemedComboBox', `label='${label}', compactDisplay? ${String(compactDisplay)}`)

  const optionsWithID: Array<OptionType> = options.map((option, index) => ({ label: option, value: option, id: index }))

  const [isOpen, setIsOpen] = useState(false)
  const [menuIsOpen, setMenuIsOpen] = useState(false)
  const [selectedValue, setSelectedValue] = useState(value)
  const comboboxRef = useRef <? ElementRef < 'div' >> (null)
  const comboboxInputRef = useRef <? ElementRef < 'input' >> (null)
  // logDebug('ComboBox', `${String(compactDisplay)}`)


  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------

  const handleChange = (inputValue: string, { action }: string) => {
    logDebug('ComboBox.handleChange', inputValue, action)
    onChange && onChange(value)
    // if (action === 'input-change') return inputValue
    // if (action === 'menu-close') {
    //   if (prevInputValue) setMenuIsOpen(true)
    //   else setMenuIsOpen(false)
    // }
    // return prevInputValue
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
        comboboxInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
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

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------

  return (
    <div className={compactDisplay ? 'combobox-container-compact' : 'combobox-container'} >
      <label className="combobox-label">{label}</label>
      <div className="combobox-wrapper" > {/* FIXME: (@jgclark): This said onClick={toggleDropdown} -- What were you hoping to do with this variable (which doesn't exist)? */}
        <ThemedSelect
          // className="combobox-input"
          options={optionsWithID}
          onSelect={onSelect}
          onChange={handleChange}
          defaultValue={options[0]} /* FIXME: (@jgclark): this doesn't match the types and may not be set */
        // selectionOption={onInputChange}
        // isDisabled={false}
        // isLoading={false}
        // isClearable={true}
        // isRtl={false}
        // isSearchable={true}
        />
      </div>
    </div>
  )
}

export default ThemedComboBox
