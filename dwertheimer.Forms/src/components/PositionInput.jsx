// @flow
//--------------------------------------------------------------------------
// PositionInput Component
// Input field with dropdown choices for window position (X or Y)
// Allows selecting from predefined choices or entering custom values (e.g., "60%")
//--------------------------------------------------------------------------

import React, { type Node } from 'react'

export type PositionType = 'x' | 'y'

type PositionInputProps = {
  type: PositionType, // 'x' or 'y'
  value?: string | number,
  onChange: (value: string | void) => void,
  onBlur?: (e: any) => void,
  placeholder?: string,
  style?: { [key: string]: any },
}

/**
 * PositionInput Component
 * Input field with datalist for predefined position choices
 * @param {PositionInputProps} props
 * @returns {React$Node}
 */
export function PositionInput({
  type,
  value = '',
  onChange,
  onBlur,
  placeholder,
  style = {},
}: PositionInputProps): Node {
  const listId = `position-${type}-list`
  
  // Define choices based on type
  const choices = type === 'x' 
    ? ['-', 'center', 'left', 'right']
    : ['-', 'center', 'top', 'bottom']

  // Convert value to string for input
  const stringValue = value === null || value === undefined ? '' : String(value)

  const handleChange = (e: any) => {
    const newValue = e.currentTarget.value.trim()
    onChange(newValue || undefined)
  }

  const handleBlur = (e: any) => {
    const inputValue = e.currentTarget.value.trim()
    if (inputValue) {
      // Validate: must be a number, percentage, or one of the predefined choices
      const isValidChoice = choices.includes(inputValue.toLowerCase())
      const isPercentage = inputValue.endsWith('%')
      const isNumber = !isNaN(parseFloat(inputValue))
      
      if (!isValidChoice && !isPercentage && !isNumber) {
        alert(`Window ${type.toUpperCase()} position must be a number (e.g., 100), a percentage (e.g., 25%), or one of: ${choices.join(', ')}.`)
        onChange(undefined)
      }
    }
    if (onBlur) {
      onBlur(e)
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        list={listId}
        value={stringValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder || (type === 'x' ? '100 or 25% or center' : '100 or 25% or center')}
        style={Object.assign({ width: '100%', padding: '0.4rem', fontSize: '0.85rem' }, style)}
      />
      <datalist id={listId}>
        {choices.map((choice) => (
          <option key={choice} value={choice} />
        ))}
      </datalist>
    </div>
  )
}

export default PositionInput

