// @flow
//----------------------------------------------------------
// Calendar Picker component.
// Used in DialogFor*Items components.
// Last updated 2025-04-05 for v2.2.0.a11
//----------------------------------------------------------
import React, { useState, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
// Import styles directly into component
import 'react-day-picker/dist/style.css' /* https://react-day-picker.js.org/basics/styling */
import '../css/CalendarPicker.css'
import { logDebug } from '@helpers/react/reactDev'

type Props = {
  onSelectDate: (date: Date) => void, // Callback function when date is selected
  numberOfMonths?: number, // Number of months to show in the calendar
  startingSelectedDate?: Date, // Date to start with selected
  positionFunction?: () => {}, // Function to call to reposition the dialog because it will be taller when calendar is open
  resetDateToDefault?: boolean,
  shouldStartOpen?: boolean, // Default is false, so the calendar is closed when it is first rendered
}

const CalendarPicker = ({ onSelectDate, numberOfMonths = 2, startingSelectedDate, positionFunction, resetDateToDefault, shouldStartOpen = false }: Props): React$Node => {
  const [selectedDate, setSelectedDate] = useState(startingSelectedDate)
  const [isOpen, setIsOpen] = useState(shouldStartOpen)

  const handleDateChange = (date: Date) => {
    setSelectedDate(date)
    onSelectDate(date) // Propagate the change up to the parent component
  }

  const callRepositionFunctionAfterOpening = () => (positionFunction ? window.setTimeout(() => positionFunction(), 100) : null)

  const toggleDatePicker = () => {
    if (!isOpen && positionFunction) callRepositionFunctionAfterOpening()
    setIsOpen(!isOpen)
  }

  // Reset selectedDate when resetDateToDefault prop changes
  useEffect(() => {
    if (resetDateToDefault) {
      setSelectedDate(null) // or any default value
    }
  }, [resetDateToDefault])

  //----------------------------------------------------------
  // Render
  //----------------------------------------------------------

  return (
    <>
      <button className="PCButton" title="Open calendar to pick a specific day" onClick={toggleDatePicker}>
        <i className="fa-regular fa-calendar-plus pad-left pad-right"></i>
      </button>
      {isOpen && (
        <div className="dayPicker-container">
          <DayPicker
            selected={selectedDate}
            onSelect={handleDateChange}
            mode="single"
            numberOfMonths={numberOfMonths}
            required
            fixedHeight
            // styles={calendarStyles}
            className="calendarPickerCustom"
          />
        </div>
      )}
    </>
  )
}

export default CalendarPicker
