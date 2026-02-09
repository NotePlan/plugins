// @flow
//--------------------------------------------------------------------------
// TagChooser Component
// A multi-select chooser for hashtags using ContainedMultiSelectChooser
//--------------------------------------------------------------------------

import React, { useState, useEffect, useCallback, useRef } from 'react'
import ContainedMultiSelectChooser from './ContainedMultiSelectChooser.jsx'
import { DropdownSelectChooser, type DropdownOption } from './DropdownSelectChooser.jsx'
import { logDebug, logError } from '@helpers/react/reactDev.js'
import './TagChooser.css'

export type TagChooserProps = {
  label?: string,
  value?: string | Array<string>, // Can be string "#tag1,#tag2" or array ["#tag1", "#tag2"]
  onChange: (value: string | Array<string>) => void,
  disabled?: boolean,
  compactDisplay?: boolean,
  placeholder?: string,
  returnAsArray?: boolean, // If true, return as array, otherwise return as string (default: false)
  valueSeparator?: 'comma' | 'commaSpace' | 'space', // When returnAsArray false: 'comma'=no space, 'commaSpace'=comma+space, 'space'=space-separated (default: 'commaSpace')
  defaultChecked?: boolean, // If true, all items checked by default (default: false)
  includePattern?: string, // Regex pattern to include tags
  excludePattern?: string, // Regex pattern to exclude tags
  maxHeight?: string, // Max height for scrollable list (default: '200px')
  maxRows?: number, // Max number of result rows to show (overrides maxHeight if provided)
  width?: string, // Custom width for the entire control (e.g., '300px', '80%')
  height?: string, // Custom height for the entire control (e.g., '400px')
  allowCreate?: boolean, // If true, show "+New" button to create new tags (default: true)
  singleValue?: boolean, // If true, allow selecting only one value (no checkboxes, returns single value) (default: false)
  renderAsDropdown?: boolean, // If true and singleValue is true, render as dropdown-select instead of filterable chooser (default: false)
  requestFromPlugin?: (command: string, dataToSend?: any, timeout?: number) => Promise<any>, // Function to request data from plugin
  fieldKey?: string, // Unique key for this field instance (used to generate unique input id)
  initialHashtags?: Array<string>, // Preloaded hashtags for static HTML testing
}

/**
 * TagChooser Component
 * A multi-select chooser for hashtags
 * @param {TagChooserProps} props
 * @returns {React$Node}
 */
export function TagChooser({
  label,
  value,
  onChange,
  disabled = false,
  compactDisplay = false,
  placeholder = 'Type to search hashtags...',
  returnAsArray = false,
  valueSeparator = 'commaSpace',
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
  requestFromPlugin,
  fieldKey,
  initialHashtags,
}: TagChooserProps): React$Node {
  // Initialize from preloaded data if available (for static HTML testing)
  const hasInitialHashtags = Array.isArray(initialHashtags) && initialHashtags.length > 0
  const [hashtags, setHashtags] = useState<Array<string>>(() => {
    if (hasInitialHashtags && initialHashtags) {
      logDebug('TagChooser', `Using initial hashtags: ${initialHashtags.length} hashtags`)
      return initialHashtags
    }
    return []
  })
  const [loaded, setLoaded] = useState<boolean>(hasInitialHashtags) // If preloaded, mark as loaded
  const [loading, setLoading] = useState<boolean>(false)
  // Ref to track if component is mounted (prevents callbacks after unmount)
  const isMountedRef = useRef<boolean>(true)

  // Track mount state to prevent callbacks after unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Load hashtags from plugin via REQUEST (skip if initial data was provided)
  // Delay the request to yield to TOC rendering and other critical UI elements
  // This prevents blocking the initial render with data loading
  useEffect(() => {
    if (requestFromPlugin && !loaded && !loading && !hasInitialHashtags) {
      // Use setTimeout to delay the request, allowing TOC and other UI to render first
      const timeoutId = setTimeout(() => {
        // CRITICAL: Check if component is still mounted before setting state
        if (!isMountedRef.current) {
          return
        }
        setLoading(true)
        logDebug('TagChooser', 'Loading hashtags from plugin (delayed)')
        requestFromPlugin('getHashtags', {})
          .then((hashtagsData: Array<string>) => {
            // CRITICAL: Check if component is still mounted before setting state
            if (!isMountedRef.current) {
              return
            }
            if (Array.isArray(hashtagsData)) {
              // DataStore.hashtags returns items without # prefix, so we can use them directly
              setHashtags(hashtagsData)
              setLoaded(true)
              logDebug('TagChooser', `Loaded ${hashtagsData.length} hashtags`)
            } else {
              logError('TagChooser', 'Invalid response format from getHashtags')
              setHashtags([])
              setLoaded(true)
            }
          })
          .catch((error) => {
            logError('TagChooser', `Failed to load hashtags: ${error.message}`)
            // CRITICAL: Check if component is still mounted before setting state
            if (isMountedRef.current) {
              setHashtags([])
              setLoaded(true)
            }
          })
          .finally(() => {
            // CRITICAL: Check if component is still mounted before setting state
            if (isMountedRef.current) {
              setLoading(false)
            }
          })
      }, 200) // 200ms delay to yield to TOC rendering

      return () => {
        clearTimeout(timeoutId)
      }
    }
  }, [requestFromPlugin, loaded, loading, hasInitialHashtags])

  // Function to format hashtag for display (add # prefix only if not already present)
  // Memoized with useCallback to prevent recreation on every render
  const getItemDisplayLabel = useCallback((tag: string): string => {
    return tag.startsWith('#') ? tag : `#${tag}`
  }, [])

  // Handle creating a new tag
  // Note: Tags in NotePlan are derived from notes, so we can't "create" them in DataStore
  // Instead, we add the new tag to our local list so it can be selected and used in the form
  const handleCreateTag = useCallback(async (newTag: string): Promise<void> => {
    // Remove # prefix if present (we store tags without prefix internally)
    const cleanedTag = newTag.startsWith('#') ? newTag.substring(1) : newTag
    const trimmedTag = cleanedTag.trim()

    if (!trimmedTag) {
      return
    }

    // Add the new tag to our local list if it doesn't already exist
    setHashtags((prev) => {
      if (!prev.includes(trimmedTag)) {
        logDebug('TagChooser', `Added new tag to local list: ${trimmedTag}`)
        return [...prev, trimmedTag]
      }
      return prev
    })
  }, [])

  // If renderAsDropdown is true and singleValue is true, render as dropdown
  if (renderAsDropdown && singleValue) {
    // Convert hashtags to dropdown options
    const dropdownOptions: Array<string | DropdownOption> = hashtags.map((tag: string): DropdownOption => ({
      label: getItemDisplayLabel(tag),
      value: getItemDisplayLabel(tag),
    }))
    // Get current value (remove # prefix if present for matching)
    const currentValue = typeof value === 'string' ? value : Array.isArray(value) && value.length > 0 ? value[0] : ''
    return (
      <div className="tag-chooser-wrapper" data-field-type="tag-chooser">
        <DropdownSelectChooser
          label={label}
          value={currentValue}
          options={dropdownOptions}
          onChange={(selectedValue: string) => {
            onChange(selectedValue)
          }}
          disabled={disabled || loading}
          compactDisplay={compactDisplay}
          placeholder={loading ? 'Loading hashtags...' : placeholder}
          width={width}
          allowCreate={allowCreate}
          onCreate={handleCreateTag}
        />
      </div>
    )
  }

  return (
    <div className="tag-chooser-wrapper" data-field-type="tag-chooser">
      <ContainedMultiSelectChooser
        label={label}
        value={value}
        onChange={onChange}
        disabled={disabled || loading}
        compactDisplay={compactDisplay}
        placeholder={loading ? 'Loading hashtags...' : placeholder}
        items={hashtags}
        getItemDisplayLabel={getItemDisplayLabel}
        returnAsArray={returnAsArray}
        valueSeparator={valueSeparator}
        defaultChecked={defaultChecked}
        includePattern={includePattern}
        excludePattern={excludePattern}
        maxHeight={maxHeight}
        maxRows={maxRows}
        width={width}
        height={height}
        emptyMessageNoItems="No hashtags available"
        emptyMessageNoMatch="No hashtags match"
        fieldType="tag-chooser"
        allowCreate={allowCreate}
        singleValue={singleValue}
        onCreate={handleCreateTag}
        fieldKey={fieldKey}
      />
    </div>
  )
}

export default TagChooser
