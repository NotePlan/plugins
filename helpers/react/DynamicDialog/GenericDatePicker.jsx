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

  // Convert input string to Date - tries multiple parsing strategies
  // First tries as YYYY-MM-DD (HTML date input format)
  // Then tries parsing with current dateFormat if it's not '__object__'
  // Finally falls back to standard Date parsing
  const inputValueToDate = (value: string): Date | void => {
    if (!value || value.trim() === '') return undefined

    // First try: HTML date input format (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
      const parsed = new Date(`${value.trim()}T00:00:00`) // Add time to avoid timezone issues
      if (!isNaN(parsed.getTime())) {
        return parsed
      }
    }

    // Second try: Parse with current dateFormat (if not '__object__')
    if (dateFormat !== '__object__' && dateFormat) {
      const parsed = moment(value.trim(), dateFormat, true) // strict parsing
      if (parsed.isValid()) {
        return parsed.toDate()
      }
    }

    // Third try: Standard Date parsing (handles various formats)
    const parsed = new Date(value.trim())
    if (!isNaN(parsed.getTime())) {
      return parsed
    }

    // Fourth try: Try ISO format as fallback
    const isoParsed = moment(value.trim(), 'YYYY-MM-DD', true)
    if (isoParsed.isValid()) {
      return isoParsed.toDate()
    }

    return undefined
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

  // Track the last value we sent to parent to prevent unnecessary callbacks
  const lastSentValueRef = useRef<?(Date | string)>(null)
  // Track the last normalized date we received from parent to prevent loops
  const lastReceivedDateRef = useRef<?Date>(null)

  // Handle direct input change (user types or picks from native picker)
  // For HTML date inputs (type="date"), the browser only accepts complete YYYY-MM-DD dates
  // So we only get valid dates here, not partial input
  const handleInputChange = (e: SyntheticInputEvent<HTMLInputElement>) => {
    const value = e.target.value
    // HTML date input only provides complete dates in YYYY-MM-DD format
    const date = inputValueToDate(value)

    if (date) {
      // Date was successfully parsed - format it according to dateFormat
      const formatted = formatDate(date)
      // For HTML date input (type="date"), we need to keep it as YYYY-MM-DD format
      const newInputValue = dateToInputValue(date)

      // Only update inputValue if it's different (prevents unnecessary re-renders)
      if (newInputValue !== inputValue) {
        setInputValue(newInputValue)
      }

      // Only call onSelectDate if the value actually changed (prevents infinite loops)
      const lastSent = lastSentValueRef.current
      const valueChanged = formatted instanceof Date && lastSent instanceof Date ? formatted.getTime() !== lastSent.getTime() : formatted !== lastSent

      if (valueChanged) {
        lastSentValueRef.current = formatted
        onSelectDate(formatted) // Propagate the formatted value to parent
      }
    } else if (!value || value.trim() === '') {
      // Value was cleared
      if (inputValue !== '') {
        setInputValue('')
      }
      const clearedValue = dateFormat === '__object__' || !dateFormat ? new Date(NaN) : ''

      // Only call onSelectDate if the value actually changed
      if (lastSentValueRef.current !== clearedValue) {
        lastSentValueRef.current = clearedValue
        onSelectDate(clearedValue)
      }
    }
    // Note: Native HTML date picker automatically closes after selection, no need to blur
  }

  // Handle input blur - for HTML date inputs, this is mainly for validation
  // Since HTML date inputs only accept complete dates, this should rarely be needed
  const handleInputBlur = (e: SyntheticInputEvent<HTMLInputElement>) => {
    const value = e.target.value.trim()
    if (!value) {
      // Already handled in onChange
      return
    }

    // For HTML date inputs, the value should already be valid from onChange
    // But we'll validate one more time just in case
    const date = inputValueToDate(value)
    if (date) {
      const newInputValue = dateToInputValue(date)
      const formatted = formatDate(date)

      // Only update if value changed (prevents unnecessary updates)
      if (newInputValue !== inputValue) {
        setInputValue(newInputValue)
      }

      // Only call onSelectDate if the value actually changed
      const lastSent = lastSentValueRef.current
      const valueChanged = formatted instanceof Date && lastSent instanceof Date ? formatted.getTime() !== lastSent.getTime() : formatted !== lastSent

      if (valueChanged) {
        lastSentValueRef.current = formatted
        onSelectDate(formatted)
      }
    }
    // If invalid, onChange already handled it
  }

  // Handle Enter key to prevent form submission
  const handleKeyDown = (e: SyntheticKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      // Blur the input to trigger validation
      if (inputRef.current) {
        inputRef.current.blur()
      }
    }
  }

  // Handle clear button click
  const handleClear = (e: SyntheticEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setInputValue('')
    const clearedValue = dateFormat === '__object__' || !dateFormat ? new Date(NaN) : ''

    // Only call onSelectDate if the value actually changed
    if (lastSentValueRef.current !== clearedValue) {
      lastSentValueRef.current = clearedValue
      onSelectDate(clearedValue)
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

  // Update inputValue when startingSelectedDate changes (but only if it's different from what we last received)
  // This prevents infinite loops when the parent updates the prop in response to our onChange
  useEffect(() => {
    if (startingSelectedDate) {
      const normalized = normalizeDate(startingSelectedDate)
      if (normalized && !isNaN(normalized.getTime())) {
        // Only update if this is a different date than what we last received
        const lastReceived = lastReceivedDateRef.current
        const dateChanged = !lastReceived || normalized.getTime() !== lastReceived.getTime()

        if (dateChanged) {
          lastReceivedDateRef.current = normalized
          const newInputValue = dateToInputValue(normalized)
          // Only update if the value actually changed (prevents unnecessary re-renders)
          if (newInputValue !== inputValue) {
            setInputValue(newInputValue)
            // Also update lastSentValueRef to match, so we don't trigger onChange unnecessarily
            const formatted = formatDate(normalized)
            lastSentValueRef.current = formatted
          }
        }
      } else {
        // Date is null/undefined/invalid, clear the input (only if not already empty)
        if (inputValue !== '' && lastReceivedDateRef.current !== null) {
          lastReceivedDateRef.current = null
          setInputValue('')
        }
      }
    } else {
      // No starting date provided, clear the input (only if not already empty)
      if (inputValue !== '' && lastReceivedDateRef.current !== null) {
        lastReceivedDateRef.current = null
        setInputValue('')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Note: We intentionally don't include inputValue in deps to prevent loops
    // We only want to sync when startingSelectedDate or dateFormat changes externally
  }, [startingSelectedDate, dateFormat])

  return (
    <div className="input-box-wrapper generic-date-picker-wrapper">
      <input
        ref={inputRef}
        type="date"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
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
