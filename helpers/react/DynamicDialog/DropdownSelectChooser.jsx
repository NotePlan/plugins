// @flow
//--------------------------------------------------------------------------
// DropdownSelectChooser Component
// A searchable version of DropdownSelect using SearchableChooser
//--------------------------------------------------------------------------

import React, { useMemo } from 'react'
import SearchableChooser, { type ChooserConfig } from './SearchableChooser'
import { truncateText } from '@helpers/react/reactUtils.js'
import { logDebug } from '@helpers/react/reactDev.js'
import './DropdownSelectChooser.css'

export type DropdownOption = {
  label: string,
  value: string,
  [string]: any, // Allow additional properties (e.g. isModified, isDefault)
}

// Re-export Option type for compatibility with existing code
export type Option = DropdownOption

export type DropdownSelectChooserProps = {
  label?: string,
  value?: string, // The selected option value
  options: Array<string | DropdownOption>, // Array of options (strings or objects)
  onChange: (value: string) => void,
  disabled?: boolean,
  compactDisplay?: boolean,
  placeholder?: string,
  width?: string, // Custom width for the chooser input (e.g., '80vw', '79%', '300px'). Overrides default width even in compact mode.
  showIndicatorOptionProp?: string, // Property name to determine if an indicator should be shown
  showValue?: boolean, // If true, display the selected value below the input
  allowCreate?: boolean, // If true, allow creating new items by typing and pressing Enter (default: false)
  onCreate?: (newValue: string) => Promise<void> | void, // Callback when creating a new item
}

/**
 * Normalize options to a consistent format
 */
const normalizeOption = (option: string | DropdownOption): DropdownOption => {
  return typeof option === 'string' ? { label: option, value: option } : option
}

/**
 * DropdownSelectChooser Component
 * A searchable dropdown for selecting from a list of options
 * @param {DropdownSelectChooserProps} props
 * @returns {React$Node}
 */
export function DropdownSelectChooser({
  label,
  value = '',
  options = [],
  onChange,
  disabled = false,
  compactDisplay = false,
  placeholder = 'Type to search...',
  width,
  showIndicatorOptionProp,
  showValue = false,
  allowCreate = false,
  onCreate,
}: DropdownSelectChooserProps): React$Node {
  // Normalize options to DropdownOption format
  const normalizedOptions: Array<DropdownOption> = useMemo(() => {
    return options.map(normalizeOption)
  }, [options])

  // Find the selected option by value
  const selectedOption: ?DropdownOption = useMemo(() => {
    if (!value) return null
    return normalizedOptions.find((opt) => opt.value === value) || null
  }, [value, normalizedOptions])

  // Configure the generic SearchableChooser for dropdown options
  const config: ChooserConfig = {
    items: normalizedOptions,
    filterFn: (option: DropdownOption, searchTerm: string) => {
      const term = searchTerm.toLowerCase()
      return option.label.toLowerCase().includes(term) || option.value.toLowerCase().includes(term)
    },
    getDisplayValue: (option: DropdownOption) => option.label,
    getOptionText: (option: DropdownOption) => option.label,
    getOptionTitle: (option: DropdownOption) => option.label,
    truncateDisplay: truncateText,
    onSelect: (option: DropdownOption | { __manualEntry__: boolean, value: string, display: string }): void => {
      // Handle manual entry (when allowCreate is true and user types a new value)
      if ((option: any).__manualEntry__ && allowCreate && onCreate) {
        const newValue = (option: any).value
        // Call onCreate asynchronously, but don't wait for it (onSelect should be synchronous)
        const createPromise = onCreate(newValue)
        if (createPromise && typeof (createPromise: any).then === 'function') {
          (createPromise: any).catch((error: any) => {
            logDebug('DropdownSelectChooser', `Error creating new item: ${error.message}`)
          })
        }
        onChange(newValue)
      } else {
        // Normal selection from existing options
        const dropdownOption: DropdownOption = (option: any)
        onChange(dropdownOption.value)
      }
    },
    emptyMessageNoItems: 'No options available',
    emptyMessageNoMatch: 'No options match your search',
    classNamePrefix: 'dropdown-select-chooser',
    iconClass: null, // Use arrow instead of icon
    showArrow: true, // Show down arrow on the right
    fieldType: 'dropdown-select-chooser',
    debugLogging: false, // Disable debug logging by default (set to true only when debugging)
    maxResults: 25,
    inputMaxLength: 60,
    dropdownMaxLength: 80,
    allowManualEntry: allowCreate, // Enable manual entry if allowCreate is true
    isManualEntry: allowCreate
      ? (value: string, items: Array<DropdownOption>) => {
          // Don't show manual entry indicator for empty values
          if (!value || value.trim() === '') {
            return false
          }
          // Don't show manual entry indicator if items list is empty (still loading)
          if (!items || items.length === 0) {
            return false
          }
          // A value is a manual entry if it's not in the items list
          return !items.some((item) => item.value === value || item.label === value)
        }
      : undefined,
    getOptionIcon: showIndicatorOptionProp
      ? (option: DropdownOption) => {
          const showIndicator = option[showIndicatorOptionProp] === true
          return showIndicator ? 'fa-circle' : null
        }
      : undefined,
    getOptionColor: showIndicatorOptionProp
      ? (option: DropdownOption) => {
          const showIndicator = option[showIndicatorOptionProp] === true
          return showIndicator ? 'black' : null
        }
      : undefined,
  }

  // Get the display value for the current selection
  const displayValue = selectedOption ? selectedOption.label : placeholder || ''

  return (
    <div className={`dropdown-select-chooser-container ${compactDisplay ? 'compact' : ''}`} data-field-type="dropdown-select-chooser">
      <SearchableChooser label={label} value={displayValue} disabled={disabled} compactDisplay={compactDisplay} placeholder={placeholder} showValue={showValue} width={width} config={config} />
    </div>
  )
}
