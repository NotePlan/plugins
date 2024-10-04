/* eslint-disable no-unused-vars */
// @flow
//--------------------------------------------------------------------------
// Renders UI elements based on their type for the dropdown menu or settings dialog.
// Last updated 2024-05-29 for v2.0.5 by @jgclark
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React from 'react'
import { JsonEditor } from 'json-edit-react'
import Switch from './Switch.jsx'
import InputBox from './InputBox.jsx'
import DropdownSelect from './DropdownSelect.jsx'
import TextComponent from './TextComponent.jsx'
import ThemedSelect from './ThemedSelect.jsx'
import type { TSettingItem, TSettingItemType } from './DynamicDialog.jsx'
import { logDebug, logError } from '@helpers/react/reactDev.js'
import { parseObjectString, validateObjectString } from '@helpers/stringTransforms.js'

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
  disabled?: boolean, // Add disabled prop
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
  disabled,
  indent = false,
  className = '',
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
            disabled={disabled}
            onChange={(e) => {
              if (item.key) {
                logDebug('Switch', `onChange "${thisLabel}" (${item.key || ''}) was clicked`, e.target.checked)
                item.key && handleFieldChange(item.key, e.target.checked)
                item.key && handleSwitchChange(item.key, e)
              }
            }}
            labelPosition={labelPosition}
            description={item.description || ''}
            className={indent ? 'indent' : ''}
          />
        )
      case 'input':
        return (
          <InputBox
            disabled={disabled}
            inputType="text"
            key={`ibx${index}`}
            label={thisLabel}
            value={item.value || ''}
            focus={item.focus || false}
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
            className={indent ? 'indent' : ''}
          />
        )
      case 'input-readonly':
        return (
          <InputBox
            inputType="text"
            readOnly={true}
            focus={item.focus || false}
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
            focus={item.focus || false}
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
            compactDisplay={item.compactDisplay || false}
            step={item.step} // Pass the step prop
          />
        )
      case 'combo': {
        logDebug('combo', `combo ${index} ${thisLabel} ${item.value || ''}`)

        return (
          <ThemedSelect
            disabled={disabled}
            key={`cmb${index}`}
            options={item.options ? item.options.map((option) => (typeof option === 'string' ? { label: option, value: option } : option)) : []} // Normalize options to ensure they are in { label, value } format
            value={item.value || item.default || undefined} // Ensure value is not undefined
            onChange={(selectedOption) => {
              const value = selectedOption ? selectedOption.value : null // Get the value from the selected option
              item.key && handleFieldChange(item.key, value)
              item.key && handleComboChange(item.key, value) // Pass the selected option
            }}
            inputRef={inputRef} // Pass inputRef
            compactDisplay={item.compactDisplay || false}
            label={item.label || ''}
            noWrapOptions={item.noWrapOptions || false}
          />
        )
      }
      case 'dropdown':
        return (
          <DropdownSelect
            disabled={disabled}
            key={`cmb${index}`}
            label={thisLabel}
            options={item.options || []}
            value={item.value || ''}
            onChange={(option: string) => {
              item.key && handleFieldChange(item.key, option)
              item.key && handleComboChange(item.key, { target: { value: option } })
            }}
            inputRef={inputRef} // Pass inputRef
            compactDisplay={item.compactDisplay || false}
          />
        )
      case 'text':
        return <TextComponent disabled={disabled} key={`text${index}`} textType={item.textType || 'description'} label={thisLabel} />
      case 'separator':
        return <hr key={`sep${index}`} className={`ui-separator ${item.key || ''}`} />
      case 'heading':
        return (
          <>
            <div key={`hed${index}`} className="ui-heading">
              {thisLabel}
            </div>
            {item.description && <TextComponent textType="description" label={item.description} key={`heddesc${index}`} />}
          </>
        )
      case 'json': {
        const jsonString = item.value || item.default || '{}'
        const validationErrors = validateObjectString(jsonString)
        if (validationErrors.length > 0) {
          logError('JSON Validation Errors:', validationErrors.join('\n'))
          return (
            <div key={`json${index}`} className="ui-json-error">
              <p>Error in JSON data:</p>
              <ul>
                {validationErrors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          )
        }

        let dataToUse
        try {
          dataToUse = parseObjectString(jsonString)
          if (typeof dataToUse !== 'object') {
            throw new Error('Parsed data is not an object or array.')
          }
        } catch (error) {
          logError('Error parsing JSON for field', item.label || 'root', error)
          return (
            <div key={`json${index}`} className="ui-json-error">
              <p>Error parsing JSON data:</p>
              <p>{error.message}</p>
            </div>
          )
        }

        return (
          <div key={`json${index}`} className="ui-json-container">
            <div className="ui-json-label">{thisLabel}</div>
            <JsonEditor
              data={dataToUse}
              setData={(updatedData) => {
                item.key && handleFieldChange(item.key, updatedData)
              }}
              rootFontSize="10pt"
              collapse={2}
              className="ui-json-editor"
              showArrayIndices={true}
              showStringQuotes={true}
              showCollectionCount="when-closed"
            />
          </div>
        )
      }
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
    </div>
  )
}
