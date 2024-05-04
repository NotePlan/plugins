// Switch.jsx
// on/off switch

// @flow
import React from 'react'

type SwitchProps = {
  label: string,
  checked: boolean,
  onChange: (event: SyntheticInputEvent<HTMLInputElement>) => void,
}

const Switch = ({ label, checked, onChange }: SwitchProps): React$Node => {
  return (
    <div className="switch-line">
      <label className="switch-label">{label}</label>
      <input type="checkbox" className="apple-switch switch-input" onChange={onChange} checked={checked} />
    </div>
  )
}

export default Switch
