/* eslint-disable no-unused-vars */
// @flow
//--------------------------------------------------------------------------
// Renders UI elements based on their type for the dropdown menu or settings dialog.
// Last updated for v2.1.0.a
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
import CalendarPicker from './CalendarPicker.jsx'
import type { TSettingItem, TSettingItemType } from './DynamicDialog.jsx'
import { logDebug, logError } from '@np/helpers/react/reactDev.js'
import { parseObjectString, validateObjectString } from '@np/helpers/stringTransforms.js'
import type { Option } from './DropdownSelect.jsx'
import { Button, ButtonGroup } from './ButtonComponents.jsx'

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
  handleButtonClick?: (key: string, value: any) => void, // Add handleButtonClick prop
}

/**
 * Renders a UI element based on its type.
 *
 * @param {RenderItemProps} props - The properties for rendering the item.
 * @returns {React.ReactNode} The rendered item.
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
  handleButtonClick = (key, value) => {}, // Add handleButtonClick prop
}: RenderItemProps): React.ReactNode {
  const element = () => {
    const thisLabel = item.label || '?'
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
            focus={false}
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
            fixedWidth={item.fixedWidth}
            options={
              item.options
                ? item.options.map((option) => {
                    if (typeof option === 'string') {
                      return { label: option, value: option }
                    } else if (option && typeof option === 'object' && 'label' in option && 'value' in option) {
                      return option
                    }
                    return { label: '', value: '' } // Fallback for invalid options
                  })
                : []
            }
            value={item.value || ''}
            onChange={(selectedOption: Option | null) => {
              if (selectedOption && typeof selectedOption.value === 'string') {
                const value = selectedOption.value
                item.key && handleFieldChange(item.key, value)
                item.key && handleComboChange(item.key, value)
              }
            }}
            inputRef={inputRef}
            compactDisplay={item.compactDisplay || false}
            noWrapOptions={item.noWrapOptions || true}
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
      case 'button':
        return (
          <Button
            key={`btn${index}`}
            label={item.label || 'Button'}
            value={item.value || ''}
            isDefault={item.isDefault}
            disabled={disabled}
            onClick={(value) => {
              if (item.key) {
                handleButtonClick(item.key, value)
              } else {
                console.error('Button item is missing a key')
              }
            }}
          />
        )
      case 'button-group':
        return (
          <ButtonGroup
            key={`btn-group${index}`}
            options={item.options || []}
            disabled={disabled}
            onClick={(value) => {
              if (item.key) {
                handleButtonClick(item.key, value)
              } else {
                console.error('Button group item is missing a key')
              }
            }}
            vertical={item.vertical}
          />
        )
      case 'calendarpicker': {
        const selectedDate = item.selectedDate || null
        const numberOfMonths = item.numberOfMonths || 1

        const handleDateChange = (date) => {
          if (item.key) {
            handleFieldChange(item.key, date)
          }
        }

        return (
          <div key={`calendarpicker${index}`} className="calendarpicker-container">
            <CalendarPicker startingSelectedDate={selectedDate} onSelectDate={handleDateChange} numberOfMonths={numberOfMonths} className="calendarPickerCustom" />
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
