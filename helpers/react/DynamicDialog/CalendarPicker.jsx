// @flow
//----------------------------------------------------------
// Calendar Picker component.
// Used in DialogFor*Items components.
// Last updated 2024-08-14 for v2.1.0.a7 by @dbw
//----------------------------------------------------------
import React, { useState, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
// Import styles directly into component
import 'react-day-picker/dist/style.css' /* https://react-day-picker.js.org/basics/styling */
import './CalendarPicker.css'
import { logDebug } from '@helpers/react/reactDev'

type Props = {
  onSelectDate: (date: Date) => void, // Callback function when date is selected
  numberOfMonths?: number, // Number of months to show in the calendar
  startingSelectedDate?: Date, // Date to start with selected
  positionFunction?: () => {}, // Function to call to reposition the dialog because it will be taller when calendar is open
  reset?: boolean, // Whether the calendar is open/shown or not
  visible?: boolean, // Whether the calendar is shown or not
  className?: string, // Additional CSS class name for the calendar container
  label?: string, // Label for the text next to the button
  buttonText?: string, // Text for the button
  leaveOpen?: boolean, // Whether the calendar should stay open after a date is selected
  size?: number, // Size scale factor (0.5 = 50%, 1.0 = 100%, etc.) - default is 0.5
}

const CalendarPicker = ({
  onSelectDate,
  numberOfMonths = 2,
  startingSelectedDate,
  positionFunction,
  reset,
  visible,
  className,
  buttonText,
  label,
  leaveOpen,
  size = 0.75,
}: Props): React$Node => {
  // Ensure startingSelectedDate is a Date object if provided
  const normalizeDate = (date: Date | void | string | number): Date | void => {
    if (!date) return undefined
    if (date instanceof Date) return date
    // Try to convert string or number to Date
    const parsed = new Date(date)
    return isNaN(parsed.getTime()) ? undefined : parsed
  }

  const [selectedDate, setSelectedDate] = useState<Date | void>(normalizeDate(startingSelectedDate))
  const [isOpen, setIsOpen] = useState(visible ?? true)

  const handleDateChange = (date: Date) => {
    setSelectedDate(date)
    onSelectDate(date) // Propagate the change up to the parent component
    if (!leaveOpen) setIsOpen(false)
  }

  const callRepositionFunctionAfterOpening = () => (positionFunction ? window.setTimeout(() => positionFunction(), 100) : null)

  const toggleDatePicker = () => {
    if (!isOpen && positionFunction) callRepositionFunctionAfterOpening()
    setIsOpen(!isOpen)
  }

  // Reset selectedDate when reset prop changes
  useEffect(() => {
    if (reset) {
      setSelectedDate(undefined) // or any default value
    }
  }, [reset])

  // Update selectedDate when startingSelectedDate changes
  useEffect(() => {
    if (startingSelectedDate) {
      setSelectedDate(normalizeDate(startingSelectedDate))
    }
  }, [startingSelectedDate])

  // If visible is true and no buttonText, don't show button at all - just show the calendar
  const showButton = !(visible && !buttonText)

  // Safely format date for display
  const formatDateForDisplay = (date: Date | void): string => {
    if (!date) return ''
    if (!(date instanceof Date) || isNaN(date.getTime())) return ''
    return date.toLocaleDateString()
  }

  return (
    <>
      {showButton && (
        <button className="PCButton" title="Open calendar to pick a specific day" onClick={toggleDatePicker}>
          <i className="fa-solid fa-calendar-alt pad-left pad-right"></i>
          {buttonText && <span className="calendar-picker-button-text">{buttonText}</span>}
          {!isOpen && selectedDate && <span className="calendar-picker-label">: {formatDateForDisplay(selectedDate)}</span>}
        </button>
      )}
      {isOpen && (
        <div style={{ display: 'inline-block', verticalAlign: 'top', lineHeight: 0 }}>
          <div
            className="dayPicker-container"
            style={{
              transform: `scale(${size})`,
              transformOrigin: 'top left',
              display: 'inline-block',
              marginBottom: size !== 1 ? `${((1 - size) / size) * -100}%` : '0',
            }}
          >
            <DayPicker
              selected={selectedDate}
              onSelect={handleDateChange}
              mode="single"
              numberOfMonths={numberOfMonths}
              required
              fixedHeight
              label
              className={`calendarPickerCustom ${className || ''}`}
            />
          </div>
        </div>
      )}
    </>
  )
}

export default CalendarPicker
