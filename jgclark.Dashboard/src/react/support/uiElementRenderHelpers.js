/* eslint-disable no-unused-vars */
// @flow
//--------------------------------------------------------------------------
// Renders UI elements based on their type for the dropdown menu or settings dialog.
// Last updated 2024-05-26 for v2.0.0 by @dwertheimer
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React from 'react'
import Switch from '../components/Switch.jsx'
import InputBox from '../components/InputBox.jsx'
import ComboBox from '../components/ComboBox.jsx'
import TextComponent from '../components/TextComponent.jsx'
import type { TSettingItem } from '../../types'
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
  handleSwitchChange = (key, e) => { },
  handleInputChange = (key, e) => { },
  handleComboChange = (key, e) => { },
  handleSaveInput = (key, newValue) => { },
  showSaveButton = true,
  inputRef, // Destructure inputRef
}: RenderItemProps): React$Node {
  const element = () => {
    const thisLabel = item.label || '?'
    // logDebug('renderItem', `${item.type} / ${String(index)} / '${thisLabel}'`)
    switch (item.type) {
      case 'switch':
        return (
          <Switch
            key={`sw${index}`}
            label={thisLabel}
            checked={item.checked || false}
            onChange={(e) => {
              if (item.key) {
                logDebug('Switch', `onChange "${thisLabel}" (${item.key || ''}) was clicked`, e.target.checked)
                item.key && handleFieldChange(item.key, e.target.checked)
                item.key && handleSwitchChange(item.key, e)
              }
            }}
            labelPosition={labelPosition}
            description={item.description || ''}
          />
        )
      case 'input':
        return (
          <InputBox
            inputType="text"
            key={`ibx${index}`}
            label={thisLabel}
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
          />
        )
      case 'number':
        return (
          <InputBox
            inputType="number"
            key={`ibx${index}`}
            label={thisLabel}
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
          />
        )
      case 'combo':
        return (
          <ComboBox
            key={`cmb${index}`}
            label={thisLabel}
            options={item.options || []}
            value={item.value || ''}
            onChange={(option: string) => {
              item.key && handleFieldChange(item.key, option)
              item.key && handleComboChange(item.key, { target: { value: option } })
            }}
            inputRef={inputRef} // Pass inputRef
          />
        )
      case 'text':
        return (
          <TextComponent
            key={`text${index}`}
            textType={item.textType || 'description'}
            label={thisLabel}
          />
        )
      case 'separator':
        return <hr key={`sep${index}`} className={`ui-separator ${item.key || ''}`} />
      case 'heading':
        return <div key={`hed${index}`} className="ui-heading">{thisLabel}</div>
      default:
        return null
    }
  }

  return (
    <div className="ui-item" key={`item${index}`} title={item.description || ''}>
      {element()}
    </div>
  )
}
