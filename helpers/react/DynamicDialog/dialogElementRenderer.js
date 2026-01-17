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
import GenericDatePicker from './GenericDatePicker.jsx'
import FolderChooser from './FolderChooser.jsx'
import NoteChooser, { type NoteOption } from './NoteChooser.jsx'
import { SpaceChooser } from './SpaceChooser.jsx'
import { HeadingChooser } from './HeadingChooser.jsx'
import EventChooser from './EventChooser.jsx'
import MultiSelectChooser from './MultiSelectChooser.jsx'
import TagChooser from './TagChooser.jsx'
import MentionChooser from './MentionChooser.jsx'
import FrontmatterKeyChooser from './FrontmatterKeyChooser.jsx'
import { ExpandableTextarea } from './ExpandableTextarea.jsx'
import { TemplateJSBlock } from './TemplateJSBlock.jsx'
import { MarkdownPreview } from './MarkdownPreview.jsx'
import AutosaveField from './AutosaveField.jsx'
import { TableOfContents } from './TableOfContents.jsx'
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
  notes?: Array<NoteOption>, // For note-chooser
  requestFromPlugin?: (command: string, dataToSend?: any, timeout?: number) => Promise<any>, // For native folder chooser
  updatedSettings?: { [key: string]: any }, // For heading-chooser to watch note-chooser field
  onFoldersChanged?: () => void, // Callback to reload folders after creating a new folder
  onNotesChanged?: () => void, // Callback to reload notes after creating a new note
  formTitle?: string, // Form title for autosave field
  templateFilename?: string, // Template filename for autosave field
  templateTitle?: string, // Template title for autosave field
  onRegisterAutosaveTrigger?: (triggerFn: () => Promise<void>) => void, // Register autosave trigger function
  fieldLoadingStates?: { [fieldKey: string]: boolean }, // Loading states for dependent fields
  preloadedTeamspaces?: Array<{ id: string, title: string }>, // Preloaded teamspaces for static HTML testing
  preloadedMentions?: Array<string>, // Preloaded mentions for static HTML testing
  preloadedHashtags?: Array<string>, // Preloaded hashtags for static HTML testing
  preloadedEvents?: Array<any>, // Preloaded events for static HTML testing
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
  onFoldersChanged, // Callback to reload folders after creating a new folder
  onNotesChanged, // Callback to reload notes after creating a new note
  formTitle, // Form title for autosave field
  templateFilename, // Template filename for autosave field
  templateTitle, // Template title for autosave field
  onRegisterAutosaveTrigger, // Register autosave trigger function
  fieldLoadingStates = {}, // Loading states for dependent fields
  preloadedTeamspaces = [], // Preloaded teamspaces for static HTML testing
  preloadedMentions = [], // Preloaded mentions for static HTML testing
  preloadedHashtags = [], // Preloaded hashtags for static HTML testing
  preloadedEvents = [], // Preloaded events for static HTML testing
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
            labelPosition={(item: any).labelPosition || labelPosition}
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
            validationType={item.validationType || undefined}
            debounceOnChange={(item: any).debounceOnChange !== false} // Default to true, allow opt-out
            debounceMs={(item: any).debounceMs || 500}
            id={item.key ? `input-${item.key}` : undefined}
            name={item.key || undefined}
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
      case 'textarea':
        return (
          <ExpandableTextarea
            key={`textarea${index}`}
            label={thisLabel}
            value={item.value || item.default || ''}
            onChange={(e) => {
              if (item.key) {
                handleFieldChange(item.key, e.target.value)
              }
            }}
            disabled={disabled}
            placeholder={item.placeholder || ''}
            compactDisplay={item.compactDisplay || false}
            className={indent ? 'indent' : ''}
            minRows={item.minRows || 3}
            maxRows={item.maxRows || 10}
            required={item.required || false}
          />
        )
      case 'templatejs-block':
        // TemplateJS blocks are edited in the Form Builder only and intentionally hidden in the DynamicDialog preview.
        return null
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
            debounceOnChange={(item: any).debounceOnChange !== false} // Default to true, allow opt-out
            debounceMs={(item: any).debounceMs || 500}
            id={item.key ? `input-${item.key}` : undefined}
            name={item.key || undefined}
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
        const normalizedOptions: Array<string | Option> =
          item.options && Array.isArray(item.options)
            ? item.options.map((option: string | Option) => {
                if (typeof option === 'string') {
                  return option
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
              options={(normalizedOptions: Array<string | any>)}
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
              width={(item: any).width}
              showValue={item.showValue ?? false}
            />
          </div>
        )
      }
      case 'text':
        return <TextComponent disabled={disabled} key={`text${index}`} textType={item.textType || 'description'} label={item.label || ''} />
      case 'separator':
        return <hr key={`sep${index}`} className={`ui-separator ${item.key || ''}`} />
      case 'heading': {
        // Generate a URL-safe ID from the heading label
        const generateHeadingId = (label: string): string => {
          return label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
        }
        const headingId = generateHeadingId(thisLabel)
        // Ensure unique ID by appending index if needed
        let uniqueId = headingId
        let counter = 0
        while (document.getElementById(uniqueId)) {
          counter++
          uniqueId = `${headingId}-${counter}`
        }

        const underline = (item: any).underline || false

        return (
          <>
            <div key={`hed${index}`} id={uniqueId} className={`ui-heading ${underline ? 'ui-heading-underline' : ''}`}>
              {thisLabel}
            </div>
            {item.description && <TextComponent textType="description" label={item.description} key={`heddesc${index}`} />}
          </>
        )
      }
      case 'json': {
        // JsonEditor returns objects, but we need a string for validation
        // Convert to string if it's an object, otherwise use as-is
        let jsonString = item.value || item.default || '{}'
        if (typeof jsonString !== 'string') {
          // If it's an object/array, stringify it
          try {
            jsonString = JSON.stringify(jsonString, null, 2)
          } catch (error) {
            jsonString = '{}'
          }
        }
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
                // JsonEditor returns an object, but we need to store it as a string
                // Convert to JavaScript object notation string (not JSON, as parseObjectString expects unquoted keys)
                if (item.key) {
                  try {
                    // Convert object to string representation that parseObjectString can handle
                    const jsonString = JSON.stringify(updatedData, null, 2)
                      .replace(/"([^"]+)":/g, '$1:') // Remove quotes from keys
                      .replace(/:\s*"([^"]*)"/g, ': "$1"') // Keep quotes on string values
                    handleFieldChange(item.key, jsonString)
                  } catch (error) {
                    logError('JsonEditor', `Error converting data to string: ${error.message}`)
                    // Fallback: just stringify as JSON
                    handleFieldChange(item.key, JSON.stringify(updatedData, null, 2))
                  }
                }
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
        const label = item.label || ''
        const compactDisplay = item.compactDisplay || false

        // Render similar to InputBox/calendarpicker - label and button group in a container
        // Use div instead of label since button-group has no form input to associate with
        return (
          <div
            key={`btn-group${index}`}
            className={`${disabled ? 'disabled' : ''} ${compactDisplay ? 'input-box-container-compact' : 'input-box-container'} ${indent ? 'indent' : ''}`}
          >
            {label && <div className="input-box-label">{label}</div>}
            <ButtonGroup
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
          </div>
        )
      }
      case 'calendarpicker': {
        const selectedDate: ?Date | ?string = item.selectedDate || null
        const label = item.label || ''
        const compactDisplay = item.compactDisplay || false
        const dateFormat = (item: any).dateFormat || 'YYYY-MM-DD' // Default to ISO 8601

        const handleDateChange = (date: Date | string) => {
          if (item.key) {
            // Handle cleared date/string
            if (date instanceof Date && isNaN(date.getTime())) {
              handleFieldChange(item.key, null)
            } else if (typeof date === 'string' && date === '') {
              handleFieldChange(item.key, null)
            } else {
              // Store the value as-is (formatted string or Date object)
              handleFieldChange(item.key, date)
            }
          }
        }

        // Render similar to InputBox - label and input in a container
        return (
          <div
            key={`calendarpicker${index}`}
            className={`${disabled ? 'disabled' : ''} ${compactDisplay ? 'input-box-container-compact' : 'input-box-container'} ${indent ? 'indent' : ''}`}
          >
            <label className="input-box-label">{label}</label>
            <GenericDatePicker
              startingSelectedDate={selectedDate ?? undefined}
              onSelectDate={handleDateChange}
              disabled={disabled}
              dateFormat={dateFormat}
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
          staticOptions: (item: any).staticOptions,
        }
        // Support both old (dependsOnSpaceKey) and new (sourceSpaceKey) property names for backward compatibility
        const itemAny = (item: any)
        const sourceSpaceKey = itemAny.sourceSpaceKey ?? itemAny.dependsOnSpaceKey

        // Get space value from the sourceSpaceKey field if specified
        let spaceFilter: ?string = null
        if (sourceSpaceKey && updatedSettings && typeof updatedSettings === 'object') {
          const spaceValue = updatedSettings[sourceSpaceKey]
          // spaceValue can be:
          // - empty string ('') for Private space
          // - teamspace ID (UUID string) for a specific teamspace
          // - "__all__" for all spaces
          // - "Private" (display value - need to convert to '')
          // - null/undefined if not set
          if (spaceValue !== null && spaceValue !== undefined) {
            if (spaceValue === '__all__') {
              spaceFilter = null // null means show all spaces
            } else if (spaceValue === 'Private' || spaceValue === '') {
              // Handle both empty string and display value "Private"
              spaceFilter = ''
            } else {
              // Teamspace ID
              spaceFilter = String(spaceValue)
            }
          }
          // If spaceValue is null/undefined, spaceFilter stays null (show all)
        } else {
          // If no dependency, use item.spaceFilter if provided
          spaceFilter = itemAny.spaceFilter
        }

        logDebug(
          'dialogElementRenderer',
          `folder-chooser: folders=${folders?.length || 0}, label=${label}, currentValue="${currentValue}", spaceFilter="${
            spaceFilter != null && spaceFilter !== '' ? String(spaceFilter) : spaceFilter === '' ? 'empty_string(Private)' : 'null(all)'
          }", sourceSpaceKey="${sourceSpaceKey || 'none'}", spaceValue="${
            sourceSpaceKey && updatedSettings && typeof updatedSettings === 'object' ? String(updatedSettings[sourceSpaceKey] || 'undefined') : 'N/A'
          }", options=${JSON.stringify(folderChooserOptions)}`,
        )

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
              width={(item: any).width}
              includeArchive={folderChooserOptions.includeArchive}
              includeNewFolderOption={folderChooserOptions.includeNewFolderOption}
              startFolder={folderChooserOptions.startFolder}
              includeFolderPath={folderChooserOptions.includeFolderPath}
              excludeTeamspaces={folderChooserOptions.excludeTeamspaces}
              staticOptions={folderChooserOptions.staticOptions}
              spaceFilter={spaceFilter}
              requestFromPlugin={requestFromPlugin}
              showValue={item.showValue ?? false}
              onFoldersChanged={onFoldersChanged}
              shortDescriptionOnLine2={item.shortDescriptionOnLine2 ?? false}
            />
          </div>
        )
      }
      case 'note-chooser': {
        const label = item.label || ''
        const compactDisplay = item.compactDisplay || false
        const currentValue = item.value || item.default || ''
        // Support both old (dependsOnFolderKey) and new (sourceFolderKey) property names for backward compatibility
        const sourceFolderKey = item.sourceFolderKey ?? item.dependsOnFolderKey
        // Support both old (dependsOnSpaceKey) and new (sourceSpaceKey) property names for backward compatibility
        const itemAny = (item: any)
        const sourceSpaceKey = itemAny.sourceSpaceKey ?? itemAny.dependsOnSpaceKey

        // Get folder value from the sourceFolderKey field if specified
        let folderFilter = null
        if (sourceFolderKey && updatedSettings && typeof updatedSettings === 'object') {
          const folderValue = updatedSettings[sourceFolderKey]
          if (folderValue && typeof folderValue === 'string') {
            folderFilter = folderValue
          }
        }

        // Get space value from the sourceSpaceKey field if specified
        let spaceFilter: ?string = null
        if (sourceSpaceKey && updatedSettings && typeof updatedSettings === 'object') {
          const spaceValue = updatedSettings[sourceSpaceKey]
          // spaceValue can be:
          // - empty string ('') for Private space
          // - teamspace ID (UUID string) for a specific teamspace
          // - "__all__" for all spaces
          // - "Private" (display value - need to convert to '')
          // - null/undefined if not set
          if (spaceValue !== null && spaceValue !== undefined) {
            if (spaceValue === '__all__') {
              spaceFilter = null // null means show all spaces
            } else if (spaceValue === 'Private' || spaceValue === '') {
              // Handle both empty string and display value "Private"
              spaceFilter = ''
            } else {
              // Teamspace ID
              spaceFilter = String(spaceValue)
            }
          }
          // If spaceValue is null/undefined, spaceFilter stays null (show all)
        } else {
          // If no dependency, use item.spaceFilter if provided
          spaceFilter = itemAny.spaceFilter
        }

        const handleNoteChange = (noteTitle: string, noteFilename: string) => {
          logDebug(
            'dialogElementRenderer',
            `note-chooser: handleNoteChange called with noteTitle="${noteTitle}", noteFilename="${noteFilename}", item.key="${item.key || 'undefined'}"`,
          )
          if (item.key) {
            // For multi-select mode, noteTitle contains the formatted string and noteFilename is empty
            // For single-select mode, noteFilename contains the filename
            const valueToStore = (item: any).allowMultiSelect ? noteTitle : noteFilename
            logDebug('dialogElementRenderer', `note-chooser: Calling handleFieldChange with key="${item.key}", value="${valueToStore}"`)
            handleFieldChange(item.key, valueToStore)
          } else {
            logError('dialogElementRenderer', `note-chooser: handleNoteChange called but item.key is undefined`)
          }
        }

        // Get loading state for this field if it's a dependent field
        const fieldKey = item.key || ''
        const isLoading = fieldLoadingStates && fieldLoadingStates[fieldKey] === true

        return (
          <div data-field-type="note-chooser">
            <NoteChooser
              key={`note-chooser${index}`}
              label={label}
              value={currentValue}
              notes={notes}
              onChange={handleNoteChange}
              disabled={disabled || isLoading}
              compactDisplay={compactDisplay}
              width={(item: any).width}
              includeCalendarNotes={item.includeCalendarNotes ?? false}
              includePersonalNotes={item.includePersonalNotes ?? true}
              includeRelativeNotes={item.includeRelativeNotes ?? false}
              includeTeamspaceNotes={item.includeTeamspaceNotes ?? true}
              includeTemplatesAndForms={item.includeTemplatesAndForms ?? false}
              includeNewNoteOption={item.includeNewNoteOption ?? false}
              dependsOnFolderKey={sourceFolderKey}
              folderFilter={folderFilter}
              spaceFilter={spaceFilter}
              requestFromPlugin={requestFromPlugin}
              onNotesChanged={onNotesChanged}
              onOpen={(item: any).onOpen}
              placeholder={item.placeholder || 'Type to search notes...'}
              showValue={item.showValue ?? false}
              shortDescriptionOnLine2={item.shortDescriptionOnLine2 ?? false}
              showTitleOnly={item.showTitleOnly ?? false}
              showCalendarChooserIcon={(() => {
                // Only show calendar picker if:
                // 1. Calendar notes are included (includeCalendarNotes is true), OR
                // 2. Explicitly enabled (showCalendarChooserIcon is true)
                // If explicitly set to false, respect that and hide it
                const includeCalendar = item.includeCalendarNotes ?? false
                const explicitSetting = (item: any).showCalendarChooserIcon
                if (explicitSetting === false) {
                  return false // Explicitly disabled
                }
                if (explicitSetting === true) {
                  return true // Explicitly enabled
                }
                // Default: only show if calendar notes are included
                return includeCalendar
              })()}
              isLoading={isLoading}
              allowMultiSelect={Boolean((item: any).allowMultiSelect)}
              noteOutputFormat={(item: any).noteOutputFormat || 'wikilink'}
              noteSeparator={(item: any).noteSeparator || 'space'}
            />
          </div>
        )
      }
      case 'heading-chooser': {
        const label = item.label || ''
        const compactDisplay = item.compactDisplay || false
        const currentValue = item.value || item.default || ''
        // Support both old (dependsOnNoteKey) and new (sourceNoteKey) property names for backward compatibility
        const sourceNoteKey = item.sourceNoteKey ?? item.dependsOnNoteKey
        const defaultHeading = item.defaultHeading
        const optionAddTopAndBottom = item.optionAddTopAndBottom ?? true
        const includeArchive = item.includeArchive ?? false
        const staticHeadings = item.staticHeadings || []

        // Get note filename from the sourceNoteKey field if specified
        let noteFilename = null
        if (sourceNoteKey && updatedSettings && typeof updatedSettings === 'object') {
          const noteValue = updatedSettings[sourceNoteKey]
          // Check if noteValue is a non-empty string (empty string means no note selected)
          if (noteValue != null && typeof noteValue === 'string' && noteValue.trim() !== '') {
            noteFilename = noteValue.trim()
          }
          logDebug(
            'dialogElementRenderer',
            `heading-chooser: sourceNoteKey="${String(sourceNoteKey)}", noteValue="${String(noteValue || '')}", noteFilename="${String(
              noteFilename || 'null',
            )}", hasRequestFromPlugin=${!!requestFromPlugin}`,
          )
        } else {
          logDebug('dialogElementRenderer', `heading-chooser: sourceNoteKey="${String(sourceNoteKey || 'undefined')}", updatedSettings=${!!updatedSettings}, noteFilename=null`)
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
              width={(item: any).width}
              defaultHeading={defaultHeading}
              optionAddTopAndBottom={optionAddTopAndBottom}
              includeArchive={includeArchive}
              showValue={item.showValue ?? false}
              shortDescriptionOnLine2={item.shortDescriptionOnLine2 ?? false}
            />
          </div>
        )
      }
      case 'event-chooser': {
        const label = item.label || ''
        const compactDisplay = item.compactDisplay || false
        // Handle both string (ID) and object (full event) values for backward compatibility
        const rawValue = item.value || item.default
        const currentValue = typeof rawValue === 'string' ? rawValue : rawValue && typeof rawValue === 'object' && rawValue.id ? rawValue.id : ''
        const eventDate = item.eventDate
        // Support both old (dependsOnDateKey) and new (sourceDateKey) property names for backward compatibility
        const sourceDateKey = item.sourceDateKey ?? item.dependsOnDateKey

        // Get date value from the sourceDateKey field if specified
        let dateFromField = null
        if (sourceDateKey && updatedSettings && typeof updatedSettings === 'object') {
          const dateValue = updatedSettings[sourceDateKey]
          if (dateValue !== null && dateValue !== undefined) {
            dateFromField = dateValue
            logDebug(
              'dialogElementRenderer',
              `event-chooser: got date from ${sourceDateKey}: ${
                typeof dateValue === 'string' ? dateValue : dateValue instanceof Date ? dateValue.toISOString() : String(dateValue)
              }`,
            )
          }
        }

        // Get calendar and reminder settings from item
        const selectedCalendars = item.selectedCalendars
        const allCalendars = item.allCalendars || false
        const calendarFilterRegex = item.calendarFilterRegex
        const eventFilterRegex = item.eventFilterRegex
        const includeReminders = item.includeReminders || false
        const reminderLists = item.reminderLists

        const handleEventChange = (eventId: string, event: any) => {
          if (item.key) {
            // Store the full event object (with all CalendarItem properties) as the value
            // Convert Date objects to ISO strings for JSON serialization
            const serializedEvent = {
              ...event,
              date: event.date instanceof Date ? event.date.toISOString() : event.date,
              endDate: event.endDate instanceof Date ? event.endDate.toISOString() : event.endDate,
              occurrences: event.occurrences ? event.occurrences.map((d: Date | string) => (d instanceof Date ? d.toISOString() : d)) : [],
            }
            handleFieldChange(item.key, serializedEvent)
          }
        }

        return (
          <div data-field-type="event-chooser">
            <EventChooser
              key={`event-chooser${index}`}
              label={label}
              value={currentValue}
              date={eventDate}
              dateFromField={dateFromField}
              onChange={handleEventChange}
              disabled={disabled}
              compactDisplay={compactDisplay}
              placeholder={item.placeholder || 'Type to search events...'}
              width={(item: any).width}
              showValue={item.showValue ?? false}
              requestFromPlugin={requestFromPlugin}
              selectedCalendars={selectedCalendars}
              allCalendars={allCalendars}
              calendarFilterRegex={calendarFilterRegex}
              eventFilterRegex={eventFilterRegex}
              includeReminders={includeReminders}
              reminderLists={reminderLists}
              shortDescriptionOnLine2={item.shortDescriptionOnLine2 ?? false}
              initialEvents={preloadedEvents.length > 0 ? preloadedEvents : undefined}
            />
          </div>
        )
      }
      case 'multi-select': {
        const label = item.label || ''
        const compactDisplay = item.compactDisplay || false
        const currentValue = Array.isArray(item.value) ? item.value : item.value ? [item.value] : []

        const handleMultiSelectChange = (selectedValues: Array<string>) => {
          if (item.key) {
            handleFieldChange(item.key, selectedValues)
          }
        }

        if (!item.multiSelectItems || !item.multiSelectGetLabel || !item.multiSelectGetValue) {
          logError('dialogElementRenderer', 'multi-select: missing required props (multiSelectItems, multiSelectGetLabel, multiSelectGetValue)')
          return <div>Error: multi-select field missing required configuration</div>
        }

        const config = {
          items: item.multiSelectItems || [],
          filterFn: item.multiSelectFilterFn,
          getItemLabel: item.multiSelectGetLabel,
          getItemValue: item.multiSelectGetValue,
          getItemTitle: item.multiSelectGetTitle,
          emptyMessageNoItems: item.multiSelectEmptyMessage || 'No items available',
          emptyMessageNoMatch: item.multiSelectEmptyMessage || 'No items match',
          classNamePrefix: 'multi-select',
          fieldType: 'multi-select',
          maxHeight: item.multiSelectMaxHeight || '200px',
        }

        return (
          <div data-field-type="multi-select">
            <MultiSelectChooser
              key={`multi-select${index}`}
              label={label}
              value={currentValue}
              onChange={handleMultiSelectChange}
              disabled={disabled}
              compactDisplay={compactDisplay}
              placeholder={item.placeholder || 'Type to search...'}
              config={config}
            />
          </div>
        )
      }
      case 'form-state-viewer': {
        // Read-only field that displays the current form state as JSON
        // This is useful for testing/debugging to see what values will be submitted
        const formState = updatedSettings || {}
        const formStateJson = JSON.stringify(formState, null, 2)

        return (
          <div data-field-type="form-state-viewer" className="form-state-viewer-container">
            {item.label && <label className="input-box-label">{item.label}</label>}
            <div className="form-state-viewer-content">
              <pre className="form-state-viewer-json">{formStateJson}</pre>
            </div>
            {/* Description is rendered by DynamicDialog.jsx, don't render it here to avoid duplication */}
          </div>
        )
      }
      case 'table-of-contents': {
        const label = item.label || 'Table of Contents'
        const compactDisplay = item.compactDisplay || false

        return (
          <div data-field-type="table-of-contents">
            <TableOfContents label={label} description={item.description} compactDisplay={compactDisplay} />
          </div>
        )
      }
      case 'markdown-preview': {
        const label = item.label || ''
        const compactDisplay = item.compactDisplay || false
        // Support both old (dependsOnNoteKey) and new (sourceNoteKey) property names for backward compatibility
        const sourceNoteKey = item.sourceNoteKey ?? item.dependsOnNoteKey

        // Get note value from the sourceNoteKey field if specified
        let sourceNoteValue = null
        if (sourceNoteKey && updatedSettings && typeof updatedSettings === 'object') {
          const noteValue = updatedSettings[sourceNoteKey]
          if (noteValue && typeof noteValue === 'string') {
            sourceNoteValue = noteValue
          }
        }

        return (
          <div data-field-type="markdown-preview">
            <MarkdownPreview
              key={`markdown-preview${index}`}
              label={label}
              markdownText={item.markdownText}
              noteFilename={item.markdownNoteFilename}
              noteTitle={item.markdownNoteTitle}
              sourceNoteKey={sourceNoteKey}
              sourceNoteValue={sourceNoteValue}
              requestFromPlugin={requestFromPlugin}
              disabled={disabled}
              compactDisplay={compactDisplay}
              className={indent ? 'indent' : ''}
            />
          </div>
        )
      }
      case 'comment': {
        // Comment fields are Form Builder only - they don't render in form output
        return null
      }
      case 'space-chooser': {
        const label = item.label || ''
        const compactDisplay = item.compactDisplay || false
        const currentValue = item.value || item.default || ''

        const handleSpaceChange = (spaceId: string) => {
          if (item.key) {
            handleFieldChange(item.key, spaceId)
          }
        }

        return (
          <div data-field-type="space-chooser">
            <SpaceChooser
              key={`space-chooser${index}`}
              label={label}
              value={currentValue}
              onChange={handleSpaceChange}
              disabled={disabled}
              compactDisplay={compactDisplay}
              placeholder={item.placeholder || 'Type to search spaces...'}
              width={(item: any).width}
              requestFromPlugin={requestFromPlugin}
              showValue={item.showValue ?? false}
              includeAllOption={item.includeAllOption ?? false}
              shortDescriptionOnLine2={item.shortDescriptionOnLine2 ?? false}
              initialSpaces={preloadedTeamspaces.length > 0 ? preloadedTeamspaces : undefined}
            />
          </div>
        )
      }
      case 'tag-chooser': {
        const label = item.label || ''
        const compactDisplay = item.compactDisplay || false
        const currentValue = item.value || item.default || ''
        const returnAsArray = (item: any).returnAsArray ?? false
        const defaultChecked = (item: any).defaultChecked ?? false
        const includePattern = (item: any).includePattern || ''
        const excludePattern = (item: any).excludePattern || ''
        const maxHeight = (item: any).maxHeight || '200px'
        const maxRows = (item: any).maxRows
        const width = (item: any).width
        const height = (item: any).height
        const allowCreate = (item: any).allowCreate ?? true
        const singleValue = (item: any).singleValue ?? false
        const renderAsDropdown = (item: any).renderAsDropdown ?? false

        const handleTagChange = (tags: string | Array<string>) => {
          if (item.key) {
            handleFieldChange(item.key, tags)
          }
        }

        return (
          <div data-field-type="tag-chooser">
            <TagChooser
              key={`tag-chooser${index}`}
              label={label}
              value={currentValue}
              onChange={handleTagChange}
              disabled={disabled}
              compactDisplay={compactDisplay}
              placeholder={item.placeholder || 'Type to search hashtags...'}
              returnAsArray={returnAsArray}
              defaultChecked={defaultChecked}
              includePattern={includePattern}
              excludePattern={excludePattern}
              maxHeight={maxHeight}
              maxRows={maxRows}
              width={width}
              height={height}
              allowCreate={allowCreate}
              singleValue={singleValue}
              renderAsDropdown={renderAsDropdown}
              requestFromPlugin={requestFromPlugin}
              fieldKey={item.key}
              initialHashtags={preloadedHashtags.length > 0 ? preloadedHashtags : undefined}
            />
          </div>
        )
      }
      case 'mention-chooser': {
        const label = item.label || ''
        const compactDisplay = item.compactDisplay || false
        const currentValue = item.value || item.default || ''
        const returnAsArray = (item: any).returnAsArray ?? false
        const defaultChecked = (item: any).defaultChecked ?? false
        const includePattern = (item: any).includePattern || ''
        const excludePattern = (item: any).excludePattern || ''
        const maxHeight = (item: any).maxHeight || '200px'
        const maxRows = (item: any).maxRows
        const width = (item: any).width
        const height = (item: any).height
        const allowCreate = (item: any).allowCreate ?? true
        const singleValue = (item: any).singleValue ?? false
        const renderAsDropdown = (item: any).renderAsDropdown ?? false

        const handleMentionChange = (mentions: string | Array<string>) => {
          if (item.key) {
            handleFieldChange(item.key, mentions)
          }
        }

        return (
          <div data-field-type="mention-chooser">
            <MentionChooser
              key={`mention-chooser${index}`}
              label={label}
              value={currentValue}
              onChange={handleMentionChange}
              disabled={disabled}
              compactDisplay={compactDisplay}
              placeholder={item.placeholder || 'Type to search mentions...'}
              returnAsArray={returnAsArray}
              defaultChecked={defaultChecked}
              includePattern={includePattern}
              excludePattern={excludePattern}
              maxHeight={maxHeight}
              maxRows={maxRows}
              width={width}
              height={height}
              allowCreate={allowCreate}
              singleValue={singleValue}
              renderAsDropdown={renderAsDropdown}
              requestFromPlugin={requestFromPlugin}
              fieldKey={item.key}
              initialMentions={preloadedMentions.length > 0 ? preloadedMentions : undefined}
            />
          </div>
        )
      }
      case 'frontmatter-key-chooser': {
        const label = item.label || ''
        const compactDisplay = item.compactDisplay || false
        const currentValue = item.value || item.default || ''
        const returnAsArray = (item: any).returnAsArray ?? false
        const defaultChecked = (item: any).defaultChecked ?? false
        const includePattern = (item: any).includePattern || ''
        const excludePattern = (item: any).excludePattern || ''
        const maxHeight = (item: any).maxHeight || '200px'
        const maxRows = (item: any).maxRows
        const width = (item: any).width
        const height = (item: any).height
        const allowCreate = (item: any).allowCreate ?? true
        const singleValue = (item: any).singleValue ?? false
        const renderAsDropdown = (item: any).renderAsDropdown ?? false
        // Support both old (dependsOnKeyKey) and new (sourceKeyKey) property names for backward compatibility
        const sourceKeyKey = (item: any).sourceKeyKey ?? (item: any).dependsOnKeyKey
        const noteType = (item: any).noteType || 'All'
        const caseSensitive = (item: any).caseSensitive ?? false
        const folderString = (item: any).folderString || ''
        const fullPathMatch = (item: any).fullPathMatch ?? false

        // Get frontmatter key from fixed value or from sourceKeyKey field if specified
        let frontmatterKey = (item: any).frontmatterKey || ''
        if (sourceKeyKey && updatedSettings && typeof updatedSettings === 'object') {
          const keyValue = updatedSettings[sourceKeyKey]
          if (keyValue && typeof keyValue === 'string') {
            frontmatterKey = keyValue
            logDebug('dialogElementRenderer', `frontmatter-key-chooser: got key from ${sourceKeyKey}: "${frontmatterKey}"`)
          }
        }

        const handleValueChange = (values: string | Array<string>) => {
          if (item.key) {
            handleFieldChange(item.key, values)
          }
        }

        return (
          <div data-field-type="frontmatter-key-chooser">
            <FrontmatterKeyChooser
              key={`frontmatter-key-chooser${index}`}
              label={label}
              value={currentValue}
              onChange={handleValueChange}
              disabled={disabled}
              compactDisplay={compactDisplay}
              placeholder={item.placeholder || 'Type to search values...'}
              returnAsArray={returnAsArray}
              defaultChecked={defaultChecked}
              includePattern={includePattern}
              excludePattern={excludePattern}
              maxHeight={maxHeight}
              maxRows={maxRows}
              width={width}
              height={height}
              allowCreate={allowCreate}
              singleValue={singleValue}
              renderAsDropdown={renderAsDropdown}
              frontmatterKey={frontmatterKey}
              noteType={noteType}
              caseSensitive={caseSensitive}
              folderString={folderString}
              fullPathMatch={fullPathMatch}
              requestFromPlugin={requestFromPlugin}
              fieldKey={item.key}
            />
          </div>
        )
      }
      case 'autosave': {
        const label = item.label || ''
        const compactDisplay = item.compactDisplay || false
        const autosaveInterval = item.autosaveInterval ?? 2
        const autosaveFilename = item.autosaveFilename
        const invisible = (item: any).invisible || false
        const templateFilename = (item: any).templateFilename
        const templateTitle = (item: any).templateTitle

        return (
          <div data-field-type="autosave">
            <AutosaveField
              key={`autosave${index}`}
              label={label}
              updatedSettings={updatedSettings || {}}
              requestFromPlugin={requestFromPlugin}
              autosaveInterval={autosaveInterval}
              autosaveFilename={autosaveFilename}
              formTitle={formTitle}
              templateFilename={templateFilename}
              templateTitle={templateTitle}
              compactDisplay={compactDisplay}
              disabled={disabled}
              invisible={invisible}
              onRegisterTrigger={onRegisterAutosaveTrigger}
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
  // Add itemkey-XXX class for easy CSS targeting
  if (item.key) classNameToUse += ` itemkey-${item.key}`

  // TODO: data-settings-key can be used by the Dynamic Dialog to scroll to the element when the gear icon is clicked (see Dashboard/SettingsDialog)
  return (
    <div className={`ui-item ${classNameToUse}`} key={`item${index}`} title={item.description || ''} data-settings-key={item.key || ''}>
      {element()}
    </div>
  )
}
