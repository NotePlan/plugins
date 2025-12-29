// @flow
import React from 'react'

type ButtonProps = {
  label: string,
  value: string,
  isDefault?: boolean,
  isSelected?: boolean,
  disabled?: boolean,
  onClick: (value: string) => void,
}

export const Button = ({ label, value, isDefault, isSelected, disabled, onClick }: ButtonProps): React$Node => {
  // Build button class: base class + default/selected state
  let buttonClass = 'ui-button'
  if (isSelected) {
    buttonClass += ' default-button'
  } else if (isDefault && !isSelected) {
    // Only apply default styling if not selected (selected takes precedence)
    buttonClass += ' default-button'
  }

  return (
    <button className={buttonClass} disabled={disabled} onClick={() => onClick(value)}>
      {label}
    </button>
  )
}

type ButtonGroupProps = {
  options: Array<{ label: string, value: string, isDefault?: boolean }>,
  selectedValue?: string,
  disabled?: boolean,
  onClick: (value: string) => void,
  vertical?: boolean,
}

export const ButtonGroup = ({ options, selectedValue, disabled, onClick, vertical }: ButtonGroupProps): React$Node => {
  return (
    <div className={`ui-button-group ${vertical ? 'vertical' : 'horizontal'}`}>
      {options.map((option, idx) => (
        <Button
          key={`btn-group-${idx}`}
          label={option.label}
          value={option.value}
          isDefault={option.isDefault}
          isSelected={selectedValue === option.value}
          disabled={disabled}
          onClick={onClick}
        />
      ))}
    </div>
  )
}
