// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a simple Switch control (based on <input>, with various possible settings.
// Last updated 2026-10-02 by @jgclark + @CursorAI
//--------------------------------------------------------------------------

import React from 'react'
import { logDebug } from '@helpers/dev'

type SwitchProps = {
  label: string,
  checked: boolean,
  onChange: (e: any) => void,
  disabled?: boolean,
  labelPosition?: 'left' | 'right',
  description?: string,
  className?: string,
  // 'inline' keeps the toggle beside the label (menus). 'trailing' emits the label and toggle as siblings so a settings row can place the toggle on the right.
  layout?: 'inline' | 'trailing',
};

const Switch = ({ label, checked, onChange, disabled = false, labelPosition = 'right', description = '', className = '', layout = 'inline' }: SwitchProps): React.Node => {
  // logDebug('Switch', `${disabled ? 'DISABLED ' : ''}${checked ? '' : ' NOT'} checked: '${label}'`)
  // FIXME: Why is a tooltip still appearing when description is null?
  const input = (
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
  )
  const labelEl = <label className="switch-label" htmlFor={label}>{label}</label>

  // Trailing layout: label then toggle, with no wrapper, so the settings row grid can put the toggle in the right column.
  if (layout === 'trailing') {
    return (
      <>
        {labelEl}
        {input}
      </>
    )
  }

  return (
    <div className={`switch-line ${className} ${disabled ? 'disabled' : ''} ${labelPosition === 'right' ? 'label-right' : 'label-left'}`} title={description || null}>
      {labelPosition === 'left' && labelEl}
      {input}
      {labelPosition === 'right' && labelEl}
    </div>
  )
}

export default Switch
