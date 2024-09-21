// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a simple Switch control (based on <input>, with various possible settings.
// Last updated 2024-09-07 for v2.1.0.a10 by @jgclark
//--------------------------------------------------------------------------

import React from 'react'
import { logDebug } from '@helpers/react/reactDev.js'

type SwitchProps = {
  label: string,
  checked: boolean,
  onChange: (e: any) => void,
  disabled?: boolean,
  labelPosition?: 'left' | 'right',
  description?: string,
  className?: string,
};

const Switch = ({ label, checked, onChange, disabled = false, labelPosition = 'right', description = '', className = '' }: SwitchProps): React$Node => {
  logDebug('Switch', `${disabled ? 'DISABLED ' : ''}${checked ? '' : ' NOT'} checked: '${label}'`)
  // FIXME: Why is a tooltip still appearing when description is null?
  return (
    <div className={`switch-line ${className} ${disabled ? 'disabled' : ''} ${labelPosition === 'right' ? 'label-right' : 'label-left'}`} title={description || null}>
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
        disabled={disabled}
      />
      {labelPosition === 'right' && <label className="switch-label" htmlFor={label}>{label}</label>}
    </div>
  )
}

export default Switch
