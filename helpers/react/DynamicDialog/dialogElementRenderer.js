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
import { DropdownSelectChooser } from './DropdownSelectChooser.jsx'
import TextComponent from './TextComponent.jsx'
import ThemedSelect from './ThemedSelect.jsx'
import CalendarPicker from './CalendarPicker.jsx'
import FolderChooser from './FolderChooser.jsx'
import NoteChooser from './NoteChooser.jsx'
import { HeadingChooser } from './HeadingChooser.jsx'
import type { TSettingItem, TSettingItemType } from './DynamicDialog.jsx'
import type { Option } from './DropdownSelect.jsx'
import { Button, ButtonGroup } from './ButtonComponents.jsx'
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
  inputRef?: ?{ current: null | HTMLInputElement }, // Add inputRef prop type
  indent?: boolean,
  className?: string,
  disabled?: boolean, // Add disabled prop
  handleButtonClick?: (key: string, value: any) => void, // Add handleButtonClick prop
  visible?: boolean, // Add visible prop
  buttonText?: string, // Add buttonText prop
  folders?: Array<string>, // For folder-chooser
  notes?: Array<{ title: string, filename: string }>, // For note-chooser
  requestFromPlugin?: (command: string, dataToSend?: any, timeout?: number) => Promise<any>, // For native folder chooser
  updatedSettings?: { [key: string]: any }, // For heading-chooser to watch note-chooser field
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
  buttonText,
  visible,
  handleButtonClick = (key, value) => {}, // Add handleButtonClick prop
  folders = [], // For folder-chooser
  notes = [], // For note-chooser
  requestFromPlugin, // For native folder chooser
  updatedSettings, // For heading-chooser to watch note-chooser field
}: RenderItemProps): React$Node {
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
            required={item.required || false}
            validationType={item.validationType || null}
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
          <div data-field-type="combo">
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
          </div>
        )
      }
      case 'dropdown-select': {
        const label = item.label || ''
        const compactDisplay = item.compactDisplay || false
        const normalizedOptions: Array<Option> =
          item.options && Array.isArray(item.options)
            ? item.options.map((option: string | Option) => {
                if (typeof option === 'string') {
                  return { label: option, value: option }
                } else if (option && typeof option === 'object' && 'label' in option && 'value' in option) {
                  const normalized: Option = {
                    label: option.label || option.value || '',
                    value: option.value || '',
                  }
                  if (option.isDefault) {
                    normalized.isDefault = true
                  }
                  return normalized
                } else {
                  return { label: '', value: '' } // Fallback for invalid options
                }
              })
            : []
        return (
          <div data-field-type="dropdown-select">
            <DropdownSelectChooser
              key={`dropdown-select${index}`}
              label={label}
              options={normalizedOptions}
              value={item.value || item.default || ''}
              onChange={(value: string) => {
                // Don't submit placeholder (empty value)
                if (value !== '') {
                  item.key && handleFieldChange(item.key, value)
                  item.key && handleComboChange(item.key, value)
                }
              }}
              disabled={disabled}
              compactDisplay={compactDisplay}
              placeholder={item.placeholder}
            />
          </div>
        )
      }
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
      case 'button-group': {
        // Normalize options to ensure they're in the format { label, value, isDefault }
        const normalizedButtonOptions: Array<{ label: string, value: string, isDefault?: boolean }> = item.options
          ? item.options.map((option: string | { label: string, value: string, isDefault?: boolean }) => {
              if (typeof option === 'string') {
                return { label: option, value: option }
              } else if (option && typeof option === 'object' && 'label' in option && 'value' in option) {
                const normalized: { label: string, value: string, isDefault?: boolean } = {
                  label: option.label || option.value || '',
                  value: option.value || '',
                }
                if (option.isDefault) {
                  normalized.isDefault = true
                }
                return normalized
              }
              return { label: '', value: '' }
            })
          : []
        // Get current value from item.value or item.default
        const currentValue = item.value || item.default || ''
        return (
          <ButtonGroup
            key={`btn-group${index}`}
            options={normalizedButtonOptions}
            selectedValue={currentValue}
            disabled={disabled}
            onClick={(value) => {
              if (item.key) {
                const key = item.key
                handleButtonClick(key, value)
                handleFieldChange(key, value)
              } else {
                console.error('Button group item is missing a key')
              }
            }}
            vertical={item.vertical}
          />
        )
      }
      case 'calendarpicker': {
        const selectedDate: ?Date = item.selectedDate || null
        const numberOfMonths = item.numberOfMonths || 1
        const label = item.label || ''
        const compactDisplay = item.compactDisplay || false

        const handleDateChange = (date: Date) => {
          if (item.key) {
            handleFieldChange(item.key, date)
          }
        }

        // Render label similar to other fields
        const labelElement = label ? (
          <div className={`calendarpicker-label ${compactDisplay ? 'compact' : ''}`} style={compactDisplay ? { display: 'inline-block', marginRight: '0.5rem' } : {}}>
            {label}
          </div>
        ) : null

        return (
          <div key={`calendarpicker${index}`} className={`calendarpicker-container ${compactDisplay ? 'compact' : ''}`} style={compactDisplay ? { display: 'flex', alignItems: 'center' } : {}}>
            {labelElement}
            <CalendarPicker
              startingSelectedDate={selectedDate ?? undefined}
              onSelectDate={handleDateChange}
              numberOfMonths={numberOfMonths}
              className="calendarPickerCustom"
              buttonText={(item: any).buttonText}
              label={label}
              visible={(item: any).visible}
              size={(item: any).size ?? 0.75}
            />
          </div>
        )
      }
      case 'folder-chooser': {
        const label = item.label || ''
        const compactDisplay = item.compactDisplay || false
        const currentValue = item.value || item.default || ''
        const folderChooserOptions = {
          includeArchive: (item: any).includeArchive,
          includeNewFolderOption: (item: any).includeNewFolderOption,
          startFolder: (item: any).startFolder,
          includeFolderPath: (item: any).includeFolderPath,
          excludeTeamspaces: (item: any).excludeTeamspaces,
        }

        logDebug('dialogElementRenderer', `folder-chooser: folders=${folders?.length || 0}, label=${label}, currentValue="${currentValue}", options=${JSON.stringify(folderChooserOptions)}`)

        const handleFolderChange = (folder: string) => {
          logDebug('dialogElementRenderer', `folder-chooser: handleFolderChange called with folder="${folder}"`)
          if (item.key) {
            handleFieldChange(item.key, folder)
          }
        }

        return (
          <div data-field-type="folder-chooser">
            <FolderChooser
              key={`folder-chooser${index}`}
              label={label}
              value={currentValue}
              folders={folders || []}
              onChange={handleFolderChange}
              disabled={disabled}
              compactDisplay={compactDisplay}
              placeholder={item.placeholder || 'Type to search folders...'}
              includeArchive={folderChooserOptions.includeArchive}
              includeNewFolderOption={folderChooserOptions.includeNewFolderOption}
              startFolder={folderChooserOptions.startFolder}
              includeFolderPath={folderChooserOptions.includeFolderPath}
              excludeTeamspaces={folderChooserOptions.excludeTeamspaces}
              requestFromPlugin={requestFromPlugin}
            />
          </div>
        )
      }
      case 'note-chooser': {
        const label = item.label || ''
        const compactDisplay = item.compactDisplay || false
        const currentValue = item.value || item.default || ''

        const handleNoteChange = (noteTitle: string, noteFilename: string) => {
          if (item.key) {
            // Store both title and filename - using filename as the value for consistency
            // but you could also store as an object: { title: noteTitle, filename: noteFilename }
            handleFieldChange(item.key, noteFilename)
            // If you want to store title separately, you could use a compound key like `${item.key}Title`
            // For now, we'll store filename as the value
          }
        }

        return (
          <div data-field-type="note-chooser">
            <NoteChooser
              key={`note-chooser${index}`}
              label={label}
              value={currentValue}
              notes={notes}
              onChange={handleNoteChange}
              disabled={disabled}
              compactDisplay={compactDisplay}
              placeholder={item.placeholder || 'Type to search notes...'}
            />
          </div>
        )
      }
      case 'heading-chooser': {
        const label = item.label || ''
        const compactDisplay = item.compactDisplay || false
        const currentValue = item.value || item.default || ''
        const dependsOnNoteKey = item.dependsOnNoteKey
        const defaultHeading = item.defaultHeading
        const optionAddTopAndBottom = item.optionAddTopAndBottom ?? true
        const includeArchive = item.includeArchive ?? false
        const staticHeadings = item.staticHeadings || []

        // Get note filename from the dependsOnNoteKey field if specified
        let noteFilename = null
        if (dependsOnNoteKey && updatedSettings && typeof updatedSettings === 'object') {
          const noteValue = updatedSettings[dependsOnNoteKey]
          if (noteValue && typeof noteValue === 'string') {
            noteFilename = noteValue
          }
        }

        const handleHeadingChange = (heading: string) => {
          if (item.key) {
            handleFieldChange(item.key, heading)
          }
        }

        return (
          <div data-field-type="heading-chooser">
            <HeadingChooser
              key={`heading-chooser${index}`}
              label={label}
              value={currentValue}
              headings={staticHeadings}
              noteFilename={noteFilename}
              requestFromPlugin={requestFromPlugin}
              onChange={handleHeadingChange}
              disabled={disabled}
              compactDisplay={compactDisplay}
              placeholder={item.placeholder || 'Type to search headings...'}
              defaultHeading={defaultHeading}
              optionAddTopAndBottom={optionAddTopAndBottom}
              includeArchive={includeArchive}
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

  // TODO: data-settings-key can be used by the Dynamic Dialog to scroll to the element when the gear icon is clicked (see Dashboard/SettingsDialog)
  return (
    <div className={`ui-item ${classNameToUse}`} key={`item${index}`} title={item.description || ''} data-settings-key={item.key || ''}>
      {element()}
    </div>
  )
}
