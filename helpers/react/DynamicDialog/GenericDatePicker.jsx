// @flow
//----------------------------------------------------------
// Generic Date Picker component using standard HTML date input.
// Used in DynamicDialog as a lightweight alternative to react-day-picker.
// Last updated 2024 for GenericDatePicker by @dbw
//----------------------------------------------------------
import React, { useState, useEffect, useRef } from 'react'
import moment from 'moment/min/moment-with-locales'
import './GenericDatePicker.css'

type Props = {
  onSelectDate: (date: Date | string) => void, // Callback function when date is selected (returns Date object or formatted string)
  startingSelectedDate?: Date | string, // Date to start with selected (Date object or formatted string)
  disabled?: boolean, // Whether the input is disabled
  dateFormat?: string, // moment.js format string (e.g., 'YYYY-MM-DD', 'MM/DD/YYYY'). If '__object__', returns Date object. Default: 'YYYY-MM-DD' (ISO 8601)
}

const GenericDatePicker = ({ onSelectDate, startingSelectedDate, disabled = false, dateFormat = 'YYYY-MM-DD' }: Props): React$Node => {
  const inputRef = useRef<?HTMLInputElement>(null)

  // Set locale from NotePlan environment if available
  useEffect(() => {
    if (typeof NotePlan !== 'undefined' && NotePlan.environment) {
      const userLocale = `${NotePlan.environment.languageCode || 'en'}${NotePlan.environment.regionCode ? `-${NotePlan.environment.regionCode}` : ''}`
      moment.locale(userLocale)
    }
  }, [])

  // Ensure startingSelectedDate is a Date object if provided
  // If it's a formatted string, try to parse it using the dateFormat or ISO format
  const normalizeDate = (date: Date | void | string | number): Date | void => {
    if (!date) return undefined
    if (date instanceof Date) {
      if (isNaN(date.getTime())) return undefined
      return date
    }
    // If it's a string, try to parse it with moment
    if (typeof date === 'string') {
      // First try parsing with the current dateFormat (if not '__object__')
      if (dateFormat !== '__object__' && dateFormat) {
        const parsed = moment(date, dateFormat, true) // strict parsing
        if (parsed.isValid()) {
          return parsed.toDate()
        }
      }
      // Also try ISO format (YYYY-MM-DD) which is the default
      const isoParsed = moment(date, 'YYYY-MM-DD', true)
      if (isoParsed.isValid()) {
        return isoParsed.toDate()
      }
      // Try standard Date parsing as fallback
      const parsed = new Date(date)
      if (!isNaN(parsed.getTime())) {
        return parsed
      }
      return undefined
    }
    // Try to convert number to Date
    if (typeof date === 'number') {
      const parsed = new Date(date)
      return isNaN(parsed.getTime()) ? undefined : parsed
    }
    return undefined
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

  // Format date using moment-with-locales based on dateFormat
  const formatDate = (date: Date): string | Date => {
    if (dateFormat === '__object__' || !dateFormat) {
      return date // Return Date object
    }
    // Format using moment-with-locales
    const momentDate = moment(date)
    if (!momentDate.isValid()) {
      return date // Return Date object if invalid
    }
    return momentDate.format(dateFormat)
  }

  // Handle direct input change (user types or picks from native picker)
  const handleInputChange = (e: SyntheticInputEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    const date = inputValueToDate(value)
    if (date) {
      // Format the date according to dateFormat prop, or return Date object
      const formatted = formatDate(date)
      onSelectDate(formatted) // Propagate the change up to the parent component (formatted string or Date object)
    } else if (!value) {
      // Value was cleared
      if (dateFormat === '__object__' || !dateFormat) {
        onSelectDate(new Date(NaN)) // Return invalid Date to indicate cleared
      } else {
        onSelectDate('') // Return empty string if using formatted output
      }
    }
    // Note: Native HTML date picker automatically closes after selection, no need to blur
  }

  // Handle clear button click
  const handleClear = (e: SyntheticEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setInputValue('')
    // Call onSelectDate with empty value to indicate cleared
    if (dateFormat === '__object__' || !dateFormat) {
      onSelectDate(new Date(NaN)) // Return invalid Date to indicate cleared
    } else {
      onSelectDate('') // Return empty string if using formatted output
    }
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
