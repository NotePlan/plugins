// @flow
import React from 'react'
import { logDebug } from '@helpers/react/reactDev.js'

type SwitchProps = {
  label: string,
  checked: boolean,
  onChange: (e: any) => void,
  labelPosition?: 'left' | 'right',
  description?: string,
};

const Switch = ({ label, checked, onChange, labelPosition = 'right', description = '' }: SwitchProps): React$Node => {
  return (
    <div className={`switch-line ${labelPosition === 'right' ? 'label-right' : 'label-left'}`} title={description||null}>
      {labelPosition === 'left' && <label className="switch-label" htmlFor={label}>{label}</label>}
      <input
        id={label}
        type="checkbox"
        className="apple-switch switch-input"
        onChange={(e) => {
          logDebug('Switch Component', `"${label}" was clicked`, e.target.checked)
          onChange(e)
        }}
        checked={checked}
      />
      {labelPosition === 'right' && <label className="switch-label" htmlFor={label}>{label}</label>}
    </div>
  )
}

export default Switch
