// @flow
//--------------------------------------------------------------------------
// FrontmatterKeyChooser Component
// A multi-select chooser for frontmatter key values using ContainedMultiSelectChooser
//--------------------------------------------------------------------------

import React, { useState, useEffect, useCallback, useRef } from 'react'
import ContainedMultiSelectChooser from './ContainedMultiSelectChooser.jsx'
import { DropdownSelectChooser, type DropdownOption } from './DropdownSelectChooser.jsx'
import { logDebug, logError } from '@helpers/react/reactDev.js'
import './FrontmatterKeyChooser.css'

export type FrontmatterKeyChooserProps = {
  label?: string,
  value?: string | Array<string>, // Can be string "value1,value2" or array ["value1", "value2"]
  onChange: (value: string | Array<string>) => void,
  disabled?: boolean,
  compactDisplay?: boolean,
  placeholder?: string,
  returnAsArray?: boolean, // If true, return as array, otherwise return as comma-separated string (default: false)
  defaultChecked?: boolean, // If true, all items checked by default (default: false)
  includePattern?: string, // Regex pattern to include values
  excludePattern?: string, // Regex pattern to exclude values
  maxHeight?: string, // Max height for scrollable list (default: '200px')
  maxRows?: number, // Max number of result rows to show (overrides maxHeight if provided)
  width?: string, // Custom width for the entire control (e.g., '300px', '80%')
  height?: string, // Custom height for the entire control (e.g., '400px')
  allowCreate?: boolean, // If true, show "+New" button to create new values (default: true)
  singleValue?: boolean, // If true, allow selecting only one value (no checkboxes, returns single value) (default: false)
  renderAsDropdown?: boolean, // If true and singleValue is true, render as dropdown-select instead of filterable chooser (default: false)
  frontmatterKey?: string, // The frontmatter key to get values for (can be fixed or from sourceKeyKey)
  noteType?: 'Notes' | 'Calendar' | 'All', // Type of notes to search (default: 'All')
  caseSensitive?: boolean, // Whether to perform case-sensitive search (default: false)
  folderString?: string, // Folder to limit search to (optional)
  fullPathMatch?: boolean, // Whether to match full path (default: false)
  requestFromPlugin?: (command: string, dataToSend?: any, timeout?: number) => Promise<any>, // Function to request data from plugin
  fieldKey?: string, // Unique key for this field instance (used to generate unique input id)
}

/**
 * FrontmatterKeyChooser Component
 * A multi-select chooser for frontmatter key values
 * @param {FrontmatterKeyChooserProps} props
 * @returns {React$Node}
 */
export function FrontmatterKeyChooser({
  label,
  value,
  onChange,
  disabled = false,
  compactDisplay = false,
  placeholder = 'Type to search values...',
  returnAsArray = false,
  defaultChecked = false,
  includePattern = '',
  excludePattern = '',
  maxHeight = '200px',
  maxRows,
  width,
  height,
  allowCreate = true,
  singleValue = false,
  renderAsDropdown = false,
  frontmatterKey = '',
  noteType = 'All',
  caseSensitive = false,
  folderString = '',
  fullPathMatch = false,
  requestFromPlugin,
  fieldKey,
}: FrontmatterKeyChooserProps): React$Node {
  const [values, setValues] = useState<Array<string>>([])
  const [loaded, setLoaded] = useState<boolean>(false)
  // Initialize loading as true if we have a frontmatterKey
  // This prevents the placeholder from flipping from "Type to search values..." to "Loading Values..."
  const [loading, setLoading] = useState<boolean>(() => Boolean(frontmatterKey))
  const lastLoadedKeyRef = useRef<string>('') // Track the last key we loaded data for
  const debounceTimeoutRef = useRef<?TimeoutID>(null) // Track debounce timeout
  const loadingKeyRef = useRef<string>('') // Track the key we're currently loading (to detect changes during async)

  // Load values from plugin via REQUEST
  // Delay the request to yield to TOC rendering and other critical UI elements
  // This prevents blocking the initial render with data loading
  // For fixed keys, load once. For dynamic keys (from sourceKeyKey), debounce changes.
  useEffect(() => {
    // Clear any existing debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
      debounceTimeoutRef.current = null
    }

    if (!frontmatterKey) {
      // No key provided, reset values immediately
      setValues([])
      setLoaded(false)
      setLoading(false)
      lastLoadedKeyRef.current = ''
      loadingKeyRef.current = ''
      return
    }

    // If we've already loaded data for this exact key, don't reload
    if (lastLoadedKeyRef.current === frontmatterKey && loaded && !loading) {
      return
    }

    // If we have a key but haven't loaded yet (or key changed), set loading to true immediately
    // This prevents the placeholder from flipping from "Type to search values..." to "Loading Values..."
    if (frontmatterKey && lastLoadedKeyRef.current !== frontmatterKey) {
      setLoading(true)
      setLoaded(false) // Reset loaded state when key changes
    }

    // Debounce: wait 500ms after the last key change before loading
    // This prevents loading on every keystroke when key comes from another field
    debounceTimeoutRef.current = setTimeout(() => {
      // Double-check the key hasn't changed during the debounce delay
      if (lastLoadedKeyRef.current === frontmatterKey && loaded) {
        setLoading(false) // Reset loading if already loaded
        return // Already loaded for this key
      }

      if (requestFromPlugin && frontmatterKey) {
        // Only set loading if not already loading (to avoid redundant state updates)
        if (!loading) {
          setLoading(true)
        }
        // Capture the key at the start of the async call to detect if it changes during load
        loadingKeyRef.current = frontmatterKey
        logDebug('FrontmatterKeyChooser', `Loading values for key "${frontmatterKey}" from plugin`)
        requestFromPlugin('getFrontmatterKeyValues', {
          frontmatterKey,
          noteType,
          caseSensitive,
          folderString,
          fullPathMatch,
        })
          .then((valuesData: Array<string>) => {
            // Check if key changed during async operation by comparing to the captured key
            if (loadingKeyRef.current !== frontmatterKey) {
              logDebug('FrontmatterKeyChooser', `Key changed during load (was "${loadingKeyRef.current}", now "${frontmatterKey}"), ignoring results`)
              setLoading(false)
              return
            }

            if (Array.isArray(valuesData)) {
              // Convert all values to strings (frontmatter values can be various types)
              const stringValues = valuesData.map((v: any) => String(v))
              setValues(stringValues)
              setLoaded(true)
              lastLoadedKeyRef.current = frontmatterKey
              logDebug('FrontmatterKeyChooser', `Loaded ${stringValues.length} values for key "${frontmatterKey}"`)
            } else {
              logError('FrontmatterKeyChooser', 'Invalid response format from getFrontmatterKeyValues')
              setValues([])
              setLoaded(true)
              lastLoadedKeyRef.current = frontmatterKey
            }
          })
          .catch((error) => {
            logError('FrontmatterKeyChooser', `Failed to load values: ${error.message}`)
            setValues([])
            setLoaded(true)
            lastLoadedKeyRef.current = frontmatterKey
          })
          .finally(() => {
            setLoading(false)
            loadingKeyRef.current = ''
          })
      }
    }, 500) // 500ms debounce delay for dynamic keys

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
        debounceTimeoutRef.current = null
      }
    }
  }, [requestFromPlugin, frontmatterKey, noteType, caseSensitive, folderString, fullPathMatch]) // Removed loaded and loading from dependencies to prevent loops

  // Function to format value for display (no prefix needed, just return as-is)
  // Memoized with useCallback to prevent recreation on every render
  const getItemDisplayLabel = useCallback((val: string): string => {
    return val
  }, [])

  // Handle creating a new value
  // Note: New values are added to the local list so they can be selected and used in the form
  const handleCreateValue = useCallback(
    async (newValue: string): Promise<void> => {
      const trimmedValue = newValue.trim()

      if (!trimmedValue) {
        return
      }

      // Add the new value to our local list if it doesn't already exist
      setValues((prev) => {
        if (!prev.includes(trimmedValue)) {
          logDebug('FrontmatterKeyChooser', `Added new value to local list: ${trimmedValue}`)
          return [...prev, trimmedValue]
        }
        return prev
      })
    },
    [],
  )

  // If renderAsDropdown is true and singleValue is true, render as dropdown
  if (renderAsDropdown && singleValue) {
    // Convert values to dropdown options
    const dropdownOptions: Array<string | DropdownOption> = values.map((val: string): DropdownOption => ({
      label: getItemDisplayLabel(val),
      value: getItemDisplayLabel(val),
    }))
    // Get current value
    const currentValue = typeof value === 'string' ? value : Array.isArray(value) && value.length > 0 ? value[0] : ''
    return (
      <div className="frontmatter-key-chooser-wrapper" data-field-type="frontmatter-key-chooser">
        <DropdownSelectChooser
          label={label}
          value={currentValue}
          options={(dropdownOptions: any)}
          onChange={(selectedValue: string) => {
            onChange(selectedValue)
          }}
          disabled={disabled || loading || !frontmatterKey}
          compactDisplay={compactDisplay}
          placeholder={loading ? 'Loading values...' : !frontmatterKey ? 'No key specified' : placeholder}
          width={width}
          allowCreate={allowCreate}
          onCreate={handleCreateValue}
          isLoading={loading}
        />
      </div>
    )
  }

  return (
    <div className="frontmatter-key-chooser-wrapper" data-field-type="frontmatter-key-chooser">
      <ContainedMultiSelectChooser
        label={label}
        value={value}
        onChange={onChange}
        disabled={disabled || loading || !frontmatterKey}
        compactDisplay={compactDisplay}
        placeholder={loading ? 'Loading values...' : !frontmatterKey ? 'No key specified' : placeholder}
        items={values}
        getItemDisplayLabel={getItemDisplayLabel}
        returnAsArray={returnAsArray}
        defaultChecked={defaultChecked}
        includePattern={includePattern}
        excludePattern={excludePattern}
        maxHeight={maxHeight}
        maxRows={maxRows}
        width={width}
        height={height}
        emptyMessageNoItems="No values available"
        emptyMessageNoMatch="No values match"
        fieldType="frontmatter-key-chooser"
        allowCreate={allowCreate}
        singleValue={singleValue}
        onCreate={handleCreateValue}
        fieldKey={fieldKey}
        isLoading={loading}
      />
    </div>
  )
}

export default FrontmatterKeyChooser

