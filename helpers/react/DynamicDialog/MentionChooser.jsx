// @flow
//--------------------------------------------------------------------------
// MentionChooser Component
// A multi-select chooser for mentions using ContainedMultiSelectChooser
//--------------------------------------------------------------------------

import React, { useState, useEffect, useCallback } from 'react'
import ContainedMultiSelectChooser from './ContainedMultiSelectChooser.jsx'
import { DropdownSelectChooser, type DropdownOption } from './DropdownSelectChooser.jsx'
import { logDebug, logError } from '@helpers/react/reactDev.js'
import './MentionChooser.css'

export type MentionChooserProps = {
  label?: string,
  value?: string | Array<string>, // Can be string "@mention1,@mention2" or array ["@mention1", "@mention2"]
  onChange: (value: string | Array<string>) => void,
  disabled?: boolean,
  compactDisplay?: boolean,
  placeholder?: string,
  returnAsArray?: boolean, // If true, return as array, otherwise return as comma-separated string (default: false)
  defaultChecked?: boolean, // If true, all items checked by default (default: false)
  includePattern?: string, // Regex pattern to include mentions
  excludePattern?: string, // Regex pattern to exclude mentions
  maxHeight?: string, // Max height for scrollable list (default: '200px')
  maxRows?: number, // Max number of result rows to show (overrides maxHeight if provided)
  width?: string, // Custom width for the entire control (e.g., '300px', '80%')
  height?: string, // Custom height for the entire control (e.g., '400px')
  allowCreate?: boolean, // If true, show "+New" button to create new mentions (default: true)
  singleValue?: boolean, // If true, allow selecting only one value (no checkboxes, returns single value) (default: false)
  renderAsDropdown?: boolean, // If true and singleValue is true, render as dropdown-select instead of filterable chooser (default: false)
  requestFromPlugin?: (command: string, dataToSend?: any, timeout?: number) => Promise<any>, // Function to request data from plugin
  fieldKey?: string, // Unique key for this field instance (used to generate unique input id)
  initialMentions?: Array<string>, // Preloaded mentions for static HTML testing
}

/**
 * MentionChooser Component
 * A multi-select chooser for mentions
 * @param {MentionChooserProps} props
 * @returns {React$Node}
 */
export function MentionChooser({
  label,
  value,
  onChange,
  disabled = false,
  compactDisplay = false,
  placeholder = 'Type to search mentions...',
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
  requestFromPlugin,
  fieldKey,
  initialMentions,
}: MentionChooserProps): React$Node {
  // Initialize from preloaded data if available (for static HTML testing)
  const hasInitialMentions = Array.isArray(initialMentions) && initialMentions.length > 0
  const [mentions, setMentions] = useState<Array<string>>(() => {
    if (hasInitialMentions && initialMentions) {
      logDebug('MentionChooser', `Using initial mentions: ${initialMentions.length} mentions`)
      return initialMentions
    }
    return []
  })
  const [loaded, setLoaded] = useState<boolean>(hasInitialMentions) // If preloaded, mark as loaded
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

  // Load mentions from plugin via REQUEST (skip if initial data was provided)
  // Delay the request to yield to TOC rendering and other critical UI elements
  // This prevents blocking the initial render with data loading
  useEffect(() => {
    if (requestFromPlugin && !loaded && !loading && !hasInitialMentions) {
      // Use setTimeout to delay the request, allowing TOC and other UI to render first
      const timeoutId = setTimeout(() => {
        // CRITICAL: Check if component is still mounted before setting state
        if (!isMountedRef.current) {
          return
        }
        setLoading(true)
        logDebug('MentionChooser', 'Loading mentions from plugin (delayed)')
        requestFromPlugin('getMentions', {})
          .then((mentionsData: Array<string>) => {
            // CRITICAL: Check if component is still mounted before setting state
            if (!isMountedRef.current) {
              return
            }
            if (Array.isArray(mentionsData)) {
              // DataStore.mentions returns items without @ prefix, so we can use them directly
              setMentions(mentionsData)
              setLoaded(true)
              logDebug('MentionChooser', `Loaded ${mentionsData.length} mentions`)
            } else {
              logError('MentionChooser', 'Invalid response format from getMentions')
              setMentions([])
              setLoaded(true)
            }
          })
          .catch((error) => {
            logError('MentionChooser', `Failed to load mentions: ${error.message}`)
            // CRITICAL: Check if component is still mounted before setting state
            if (isMountedRef.current) {
              setMentions([])
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
  }, [requestFromPlugin, loaded, loading, hasInitialMentions])

  // Function to format mention for display (add @ prefix only if not already present)
  // Memoized with useCallback to prevent recreation on every render
  const getItemDisplayLabel = useCallback((mention: string): string => {
    return mention.startsWith('@') ? mention : `@${mention}`
  }, [])

  // Handle creating a new mention
  // Note: Mentions in NotePlan are derived from notes, so we can't "create" them in DataStore
  // Instead, we add the new mention to our local list so it can be selected and used in the form
  const handleCreateMention = useCallback(
    async (newMention: string): Promise<void> => {
      // Remove @ prefix if present (we store mentions without prefix internally)
      const cleanedMention = newMention.startsWith('@') ? newMention.substring(1) : newMention
      const trimmedMention = cleanedMention.trim()

      if (!trimmedMention) {
        return
      }

      // Add the new mention to our local list if it doesn't already exist
      setMentions((prev) => {
        if (!prev.includes(trimmedMention)) {
          logDebug('MentionChooser', `Added new mention to local list: ${trimmedMention}`)
          return [...prev, trimmedMention]
        }
        return prev
      })
    },
    [],
  )

  // If renderAsDropdown is true and singleValue is true, render as dropdown
  if (renderAsDropdown && singleValue) {
    // Convert mentions to dropdown options
    const dropdownOptions: Array<string | DropdownOption> = mentions.map((mention: string): DropdownOption => ({
      label: getItemDisplayLabel(mention),
      value: getItemDisplayLabel(mention),
    }))
    // Get current value (remove @ prefix if present for matching)
    const currentValue = typeof value === 'string' ? value : Array.isArray(value) && value.length > 0 ? value[0] : ''
    return (
      <div className="mention-chooser-wrapper" data-field-type="mention-chooser">
        <DropdownSelectChooser
          label={label}
          value={currentValue}
          options={dropdownOptions}
          onChange={(selectedValue: string) => {
            onChange(selectedValue)
          }}
          disabled={disabled || loading}
          compactDisplay={compactDisplay}
          placeholder={loading ? 'Loading mentions...' : placeholder}
          width={width}
          allowCreate={allowCreate}
          onCreate={handleCreateMention}
        />
      </div>
    )
  }

  return (
    <div className="mention-chooser-wrapper" data-field-type="mention-chooser">
      <ContainedMultiSelectChooser
        label={label}
        value={value}
        onChange={onChange}
        disabled={disabled || loading}
        compactDisplay={compactDisplay}
        placeholder={loading ? 'Loading mentions...' : placeholder}
        items={mentions}
        getItemDisplayLabel={getItemDisplayLabel}
        returnAsArray={returnAsArray}
        defaultChecked={defaultChecked}
        includePattern={includePattern}
        excludePattern={excludePattern}
        maxHeight={maxHeight}
        maxRows={maxRows}
        width={width}
        height={height}
        emptyMessageNoItems="No mentions available"
        emptyMessageNoMatch="No mentions match"
        fieldType="mention-chooser"
        allowCreate={allowCreate}
        singleValue={singleValue}
        onCreate={handleCreateMention}
        fieldKey={fieldKey}
      />
    </div>
  )
}

export default MentionChooser
