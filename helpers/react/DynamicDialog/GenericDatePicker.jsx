// @flow
//----------------------------------------------------------
// Generic Date Picker component using standard HTML date input.
// Used in DynamicDialog as a lightweight alternative to react-day-picker.
// Last updated 2024 for GenericDatePicker by @dbw
//----------------------------------------------------------
import React, { useState, useEffect, useRef } from 'react'
import './GenericDatePicker.css'

type Props = {
  onSelectDate: (date: Date) => void, // Callback function when date is selected
  startingSelectedDate?: Date, // Date to start with selected
  disabled?: boolean, // Whether the input is disabled
}

const GenericDatePicker = ({ onSelectDate, startingSelectedDate, disabled = false }: Props): React$Node => {
  const inputRef = useRef<?HTMLInputElement>(null)

  // Ensure startingSelectedDate is a Date object if provided
  const normalizeDate = (date: Date | void | string | number): Date | void => {
    if (!date) return undefined
    if (date instanceof Date) return date
    // Try to convert string or number to Date
    const parsed = new Date(date)
    return isNaN(parsed.getTime()) ? undefined : parsed
  }

  // Convert Date to YYYY-MM-DD format for HTML date input
  const dateToInputValue = (date: Date | void): string => {
    if (!date) return ''
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Convert YYYY-MM-DD string to Date
  const inputValueToDate = (value: string): Date | void => {
    if (!value) return undefined
    const parsed = new Date(`${value}T00:00:00`) // Add time to avoid timezone issues
    return isNaN(parsed.getTime()) ? undefined : parsed
  }

  const [inputValue, setInputValue] = useState<string>(dateToInputValue(normalizeDate(startingSelectedDate)))

  // Handle direct input change (user types or picks from native picker)
  const handleInputChange = (e: SyntheticInputEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    const date = inputValueToDate(value)
    if (date) {
      onSelectDate(date) // Propagate the change up to the parent component
    } else if (!value) {
      // Value was cleared, call onSelectDate with an invalid date (parent will convert to null)
      onSelectDate(new Date(NaN))
    }
    // Note: Native HTML date picker automatically closes after selection, no need to blur
  }

  // Handle clear button click
  const handleClear = (e: SyntheticEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setInputValue('')
    // Call onSelectDate with an invalid date to indicate cleared
    onSelectDate(new Date(NaN))
  }

  // Handle input focus to show picker
  const handleInputFocus = () => {
    const current = inputRef.current
    if (current instanceof HTMLInputElement) {
      try {
        // $FlowFixMe[prop-missing] $FlowFixMe[method-unbinding] - showPicker is a modern browser API
        const inputAny: any = current
        if (inputAny.showPicker && typeof inputAny.showPicker === 'function') {
          inputAny.showPicker()
        }
      } catch (e) {
        // showPicker not supported, ignore
      }
    }
  }

  // Update inputValue when startingSelectedDate changes
  useEffect(() => {
    if (startingSelectedDate) {
      const normalized = normalizeDate(startingSelectedDate)
      if (normalized && !isNaN(normalized.getTime())) {
        setInputValue(dateToInputValue(normalized))
      } else {
        // Date is null/undefined/invalid, clear the input
        setInputValue('')
      }
    } else {
      // No starting date provided, clear the input
      setInputValue('')
    }
  }, [startingSelectedDate])

  return (
    <div className="input-box-wrapper generic-date-picker-wrapper">
      <input
        ref={inputRef}
        type="date"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        disabled={disabled}
        className="generic-date-picker-input input-box-input"
      />
      {inputValue && !disabled && (
        <button type="button" className="generic-date-picker-clear-button" onClick={handleClear} title="Clear date" aria-label="Clear date">
          <i className="fa-solid fa-xmark"></i>
        </button>
      )}
      {/* Placeholder div to reserve space for validation message */}
      <div className="validation-message validation-message-placeholder" aria-hidden="true"></div>
    </div>
  )
}

export default GenericDatePicker
