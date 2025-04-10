// @flow
import React from 'react'
import { logDebug } from '@helpers/react/reactDev.js'
import './Switch.css'

/**
 * @typedef {Object} SwitchProps
 * @property {boolean} [disabled] - Whether the switch is disabled
 * @property {string|string[]} label - The label(s) for the switch. When labelPosition is 'both', this should be an array [leftLabel, rightLabel]
 * @property {boolean} checked - Whether the switch is checked
 * @property {Function} onChange - Function called when the switch is toggled
 * @property {'left'|'right'|'both'} [labelPosition='right'] - Position of the label(s)
 * @property {string} [description] - Tooltip description
 * @property {string} [className] - Additional CSS class name
 * @property {string} [id] - Optional ID for the input element
 */
type SwitchProps = {
  disabled?: boolean,
  label: string | Array<string>,
  checked: boolean,
  onChange: (e: any) => void,
  labelPosition?: 'left' | 'right' | 'both',
  description?: string,
  className?: string,
  id?: string,
}

/**
 * Switch Component
 *
 * @param {SwitchProps} props - Component props
 * @returns {React$Node} The Switch component
 */
const Switch = ({
  label,
  checked,
  onChange,
  disabled = false,
  labelPosition = 'right',
  description = '',
  className = '',
  id = `switch-${typeof label === 'string' ? label.replace(/\s+/g, '-').toLowerCase() : 'component'}`,
}: SwitchProps): React$Node => {
  // Determine left and right labels based on labelPosition and label prop
  let leftLabel = ''
  let rightLabel = ''

  if (labelPosition === 'both' && Array.isArray(label) && label.length >= 2) {
    leftLabel = label[0]
    rightLabel = label[1]
  } else if (labelPosition === 'left') {
    leftLabel = typeof label === 'string' ? label : ''
  } else if (labelPosition === 'right') {
    rightLabel = typeof label === 'string' ? label : ''
  }

  // Determine CSS class for label positioning
  const positionClass = labelPosition === 'both' ? 'label-both' : labelPosition === 'right' ? 'label-right' : 'label-left'

  return (
    <div className={`switch-line ${className} ${positionClass} ${disabled ? 'disabled' : ''} `} title={description || null}>
      {(labelPosition === 'left' || labelPosition === 'both') && (
        <label className="switch-label switch-label-left" htmlFor={id}>
          {leftLabel}
        </label>
      )}
      <div className="switch-wrapper">
        <input
          id={id}
          type="checkbox"
          className="apple-switch switch-input"
          onChange={(e) => {
            logDebug('Switch Component', `Switch was clicked (${checked ? 'unchecked' : 'checked'})`, e.target.checked)
            onChange(e)
          }}
          checked={checked}
          disabled={disabled}
        />
      </div>
      {(labelPosition === 'right' || labelPosition === 'both') && (
        <label className="switch-label switch-label-right" htmlFor={id}>
          {rightLabel}
        </label>
      )}
    </div>
  )
}

export default Switch
