// Switch.jsx
// on/off switch

// @flow
import React from 'react'
import {logDebug} from '@helpers/react/reactDev.js'

const Switch = ({ label, checked, onChange }: SwitchProps): React$Node => {
  return (
    <div className="switch-line">
      <label className="switch-label">{label}</label>
      <input
        key={checked}
        type="checkbox"
        className="apple-switch switch-input"
        onChange={(e) => {
          logDebug('Switch',`"${label}" was clicked`, e.target.checked)
          onChange(e)
        }}
        checked={checked}
      />
    </div>
  )
}


export default Switch
