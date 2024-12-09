/* eslint-disable no-unused-vars */
// @flow
//--------------------------------------------------------------------------
// Renders UI elements based on their type for the dropdown menu or settings dialog.
// Last updated 2024-08-27 for v2.1.a10 by @jgclark
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React from 'react'
import Switch from '../components/Switch.jsx'
import InputBox from '../components/InputBox.jsx'
import DropdownSelect, { type Option } from '../../../../np.Shared/src/react/DynamicDialog/DropdownSelect.jsx'
import TextComponent from '../components/TextComponent.jsx'
import PerspectiveSettings from '../components/PerspectiveSettings.jsx'
import type { TSettingItem, TPerspectiveDef } from '../../types'
import { logDebug, logError } from '@helpers/react/reactDev.js'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------
type RenderItemProps = {
  index: number,
  item: TSettingItem,
  labelPosition: 'left' | 'right',
  handleFieldChange: (key: string, value: any) => void,
  handleSwitchChange?: (key: string, e: any) => void,
  handleInputChange?: (key: string, e: any) => void,
  handleComboChange?: (key: string, e: any) => void,
  handleSaveInput?: (key: string, newValue: string) => void,
  showSaveButton?: boolean,
  inputRef?: { current: null | HTMLInputElement }, // Add inputRef prop type
  indent?: boolean,
  className?: string,
  disabled?: boolean,
  showDescAsTooltips?: boolean,
}

/**
 * Renders a UI element based on its type.
 *
 * @param {RenderItemProps} props - The properties for rendering the item.
 * @returns {React$Node} The rendered item.
 */
export function renderItem({
  index,
  item,
  labelPosition,
  handleFieldChange,
  handleSwitchChange = (key, e) => {},
  handleInputChange = (key, e) => {},
  handleComboChange = (key, e) => {},
  handleSaveInput = (key, newValue) => {},
  showSaveButton = true,
  inputRef, // Destructure inputRef
  indent = false,
  className = '',
  disabled = false,
  showDescAsTooltips = false, // if true, then don't show the description as text, but only tooltip
}: RenderItemProps): React$Node {
  const element = () => {
    const thisLabel = item.label || '?'
    // logDebug('renderItem', `${item.type} / ${String(index)} / '${thisLabel}' / ${showDescAsTooltips ? 'tooltip' : 'text'}`)

    switch (item.type) {
      case 'switch':
        return (
          <Switch
            key={`sw${index}`}
            label={thisLabel}
            checked={item.checked || false}
            disabled={disabled}
            onChange={(e) => {
              if (item.key) {
                // logDebug('Switch', `onChange "${thisLabel}" (${item.key || ''}) was clicked`, e.target.checked)
                item.key && handleFieldChange(item.key, e.target.checked)
                item.key && handleSwitchChange(item.key, e)
              }
            }}
            labelPosition={labelPosition}
            description={showDescAsTooltips ? item.description || '' : ''} // Only send the description if showDescAsTooltips is true, to show as a tooltip
            className={className}
          />
        )
      case 'input':
        return (
          <InputBox
            inputType="text"
            key={`ibx${index}`}
            label={thisLabel}
            value={item.value || ''}
            disabled={disabled}
            onChange={(e) => {
              item.key && handleFieldChange(item.key, (e.currentTarget: HTMLInputElement).value)
              item.key && handleInputChange(item.key, e)
            }}
            onSave={(newValue) => {
              item.key && handleFieldChange(item.key, newValue)
              item.key && handleSaveInput(item.key, newValue)
            }}
            showSaveButton={showSaveButton}
            compactDisplay={item.compactDisplay || false}
            className={className}
          />
        )
      case 'input-readonly':
        return (
          <InputBox
            inputType="text"
            readOnly={true}
            key={`ibxro${index}`}
            label={thisLabel}
            disabled={disabled}
            value={item.value || ''}
            onChange={() => {}}
            showSaveButton={false}
            compactDisplay={item.compactDisplay || false}
            className={className}
          />
        )
      case 'number':
        return (
          <InputBox
            inputType="number"
            key={`ibx${index}`}
            label={thisLabel}
            disabled={disabled}
            value={item.value || ''}
            onChange={(e) => {
              item.key && handleFieldChange(item.key, (e.currentTarget: HTMLInputElement).value)
              item.key && handleInputChange(item.key, e)
            }}
            onSave={(newValue) => {
              item.key && handleFieldChange(item.key, newValue)
              item.key && handleSaveInput(item.key, newValue)
            }}
            showSaveButton={showSaveButton}
            compactDisplay={item.compactDisplay || false}
          />
        )
      case 'dropdown-select':
        return (
          <DropdownSelect
            key={`cmb${index}`}
            label={thisLabel}
            options={(item.options || []).map((option) => (typeof option === 'string' ? { label: option, value: option } : option))}
            value={item.value || ''}
            // $FlowIgnore[incompatible-type]
            onChange={(option: Option) => {
              item.key && handleFieldChange(item.key, option.value)
              item.key && handleComboChange(item.key, { target: { value: option.value } })
            }}
            inputRef={inputRef} // Pass inputRef
            compactDisplay={item.compactDisplay || false}
            fixedWidth={item.fixedWidth}
          />
        )
      case 'text':
        return (
          <TextComponent
            key={`text${index}`}
            textType={item.textType || 'description'}
            label={thisLabel}
            // className={className}
          />
        )
      case 'separator':
        return <hr key={`sep${index}`} className={`ui-separator ${item.key || ''}`} />
      case 'heading':
        return (
          <>
            <div key={`hed${index}`} className="ui-heading">
              {thisLabel}
            </div>
            {item.description && (
              <TextComponent
                textType="description"
                // label={item.description}
                label=""
                key={`heddesc${index}`}
              />
            )}
          </>
        )
      // $FlowIgnore[incompatible-type] don't understand this
      case 'perspectiveList':
        return <PerspectiveSettings handleFieldChange={handleFieldChange} className={className} />
      default:
        return null
    }
  }

  let classNameToUse = className
  if (indent) classNameToUse += ' indent'
  if (disabled) classNameToUse += ' disabled'

  return (
    <div className={`ui-item ${classNameToUse}`} key={`item${index}`} title={item.description || ''}>
      {element()}
      {/* $FlowIgnore[incompatible-type] don't understand this */}
      {!showDescAsTooltips && item.type !== 'hidden' && item.description && <div className="item-description">{item.description}</div>}
    </div>
  )
}
