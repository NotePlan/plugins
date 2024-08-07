// CalendarPicker.jsx
// @flow
import React, { useState } from 'react'
import { DayPicker } from 'react-day-picker'
// Import styles directly into component
import 'react-day-picker/dist/style.css' /* https://react-day-picker.js.org/basics/styling */
import '../css/CalendarPicker.css'
import { logDebug } from '@helpers/react/reactDev'

type Props = {
  onSelectDate: (date: Date) => void, // Callback function when date is selected
  numberOfMonths?: number, // Number of months to show in the calendar
  startingSelectedDate?: Date, // Date to start with selected
}

const CalendarPicker = ({ onSelectDate, numberOfMonths = 2, startingSelectedDate }: Props): React$Node => {
  const [selectedDate, setSelectedDate] = useState(startingSelectedDate||new Date())
  const [isOpen, setIsOpen] = useState(false)


  const handleDateChange = (date: Date) => {
    setSelectedDate(date)
    onSelectDate(date) // Propagate the change up to the parent component
  }

  const toggleDatePicker = () => {
    setIsOpen(!isOpen)
  }
  //     '--rdp-cell-size': '20px', // Size down the calendar cells (default is 40px)

  const calendarStyles = { /* note: the non-color styles are set in CalendarPicker.css */
    container: { border: '1px solid #ccc', marginTop: '0px', paddingTop: '0px' },
    caption: { color: 'var(--tint-color)' },
    navButtonPrev: { color: 'var(--tint-color)' },
    navButtonNext: { color: 'var(--tint-color)' },
    weekdays: { backgroundColor: 'var(--bg-main-color)' },
    weekday: { fontWeight: 'bold' },
    weekend: { backgroundColor: 'var(--bg-alt-color)' },
    week: { color: '#333' },
    day: { color: 'var(--fg-main-color)' },
    today: { color: 'var(--hashtag-color)', backgroundColor: 'var(--bg-alt-color)' },
    selected: { color: 'var(--tint-color)', backgroundColor: 'var(--bg-alt-color)' },
  }

  return (
    <>
      <button className="PCButton" onClick={toggleDatePicker}>
        <i className="fa-solid fa-calendar-alt pad-left pad-right" /*style={{ color: 'var(--fg-main-color)', paddingLeft: '5px', paddingRight: '5px' }}*/></i>
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
            styles={calendarStyles}
            className="calendarPickerCustom"
          />
        </div>
      )}
    </>
  )
}

export default CalendarPicker
