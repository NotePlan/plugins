// @flow
import React from 'react'

type ButtonProps = {
  label: string,
  value: string,
  isDefault?: boolean,
  disabled?: boolean,
  onClick: (value: string) => void,
}

export const Button = ({ label, value, isDefault, disabled, onClick }: ButtonProps): React$Node => {
  const buttonClass = isDefault ? 'ui-button default-button' : 'ui-button'
  return (
    <button className={buttonClass} disabled={disabled} onClick={() => onClick(value)}>
      {label}
    </button>
  )
}

type ButtonGroupProps = {
  options: Array<{ label: string, value: string, isDefault?: boolean }>,
  disabled?: boolean,
  onClick: (value: string) => void,
  vertical?: boolean,
}

export const ButtonGroup = ({ options, disabled, onClick, vertical }: ButtonGroupProps): React$Node => {
  return (
    <div className={`ui-button-group ${vertical ? 'vertical' : 'horizontal'}`}>
      {options.map((option, idx) => (
        <Button key={`btn-group-${idx}`} label={option.label} value={option.value} isDefault={option.isDefault} disabled={disabled} onClick={onClick} />
      ))}
    </div>
  )
}
