// Switch.jsx
// on/off switch

// @flow
import React from 'react'
import { logDebug } from '@helpers/react/reactDev.js'

type SwitchProps = {
  label: string,
  checked: boolean,
  onChange: (e: any) => void,
  labelPosition?: 'left' | 'right',
};

const Switch = ({ label, checked, onChange, labelPosition = 'right' }: SwitchProps): React$Node => {
  return (
    <div className={`switch-line ${labelPosition === 'right' ? 'label-right' : 'label-left'}`}>
      {labelPosition === 'left' && <label className="switch-label">{label}</label>}
      <input
        type="checkbox"
        className="apple-switch switch-input"
        onChange={(e) => {
          logDebug('Switch', `"${label}" was clicked`, e.target.checked)
          onChange(e)
        }}
        checked={checked}
      />
      {labelPosition === 'right' && <label className="switch-label">{label}</label>}
    </div>
  )
}

export default Switch
