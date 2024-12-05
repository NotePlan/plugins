// @flow
import React from 'react'
import ThemedSelect, { type OptionType } from './ThemedSelect.jsx'

// color this component's output differently in the console
const consoleStyle = 'background: #222; color: #EB6857' //salmon
const logDebug = (msg, ...args) => console.log(`${window.webkit ? '' : '%c'}${msg}`, consoleStyle, ...args)

type Props = { options: Array<OptionType>, onChange: Function, defaultValue?: OptionType }

export function TypeFilter(props: Props): any {
  const { options, onChange, defaultValue } = props
  // eslint-disable-next-line no-unused-vars
  const handleChange = (value, { action }) => {
    // logDebug('TypeFilter.onChange', value, action)
    onChange && onChange(value)
  }
  return (
    <div className="typeFilter">
      <ThemedSelect options={options} onChange={handleChange} defaultValue={defaultValue} />
    </div>
  )
}

export default TypeFilter
