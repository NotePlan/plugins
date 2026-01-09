// @flow
//--------------------------------------------------------------------------
// HeadingChooser Component
// Allows users to select a heading from a note, either statically or dynamically based on a note-chooser field
//--------------------------------------------------------------------------

import React, { useState, useEffect, useMemo, useRef } from 'react'
import SearchableChooser, { type ChooserConfig } from './SearchableChooser'
import { useRequestWithRetry } from './useRequestWithRetry.js'
import { truncateText } from '@helpers/react/reactUtils.js'
import { logDebug, logError } from '@helpers/react/reactDev.js'
import './HeadingChooser.css'

export type HeadingOption = {
  heading: string, // The heading text (with markdown markers)
  displayText: string, // The text to display (may include special markers like "⏫ (top of note)")
  headingLevel?: number, // The heading level (1-5) extracted from markdown markers
  shortDescription?: ?string, // Optional descriptive text for right side (e.g., "Top", "Bottom", "Add new")
  color?: ?string, // Optional color for icon (e.g., "orange-500", "blue-500")
  icon?: ?string, // Optional custom icon (e.g., "angles-up", "angles-down" for special options)
}

export type HeadingChooserProps = {
  label?: string,
  value?: string, // The selected heading text
  headings?: Array<string>, // Static list of headings (if not depending on a note)
  noteFilename?: ?string, // Filename of note to load headings from (if dynamic)
  requestFromPlugin?: (command: string, dataToSend?: any, timeout?: number) => Promise<any>, // Function to request headings from plugin
  onChange: (heading: string) => void,
  disabled?: boolean,
  compactDisplay?: boolean,
  placeholder?: string,
  width?: string, // Custom width for the chooser input (e.g., '80vw', '79%', '300px'). Overrides default width even in compact mode.
  defaultHeading?: ?string, // Default heading to use if none selected
  optionAddTopAndBottom?: boolean, // Whether to include "top of note" and "bottom of note" options
  includeArchive?: boolean, // Whether to include headings in Archive section
  showValue?: boolean, // If true, display the selected value below the input
  shortDescriptionOnLine2?: boolean, // If true, render short description on second line (default: false)
}

/**
 * HeadingChooser Component
 * A searchable dropdown for selecting headings from a note
 * @param {HeadingChooserProps} props
 * @returns {React$Node}
 */
export function HeadingChooser({
  label,
  value = '',
  headings: staticHeadings = [],
  noteFilename,
  requestFromPlugin,
  onChange,
  disabled = false,
  compactDisplay = false,
  placeholder = 'Type to search headings...',
  width,
  defaultHeading,
  optionAddTopAndBottom = true,
  includeArchive = false,
  showValue = false,
  shortDescriptionOnLine2 = false,
}: HeadingChooserProps): React$Node {
  const [headings, setHeadings] = useState<Array<string>>(staticHeadings)
  const lastLoadedNoteFilenameRef = useRef<?string>(null) // Track the last note filename we loaded headings for
  const lastHeadingsRef = useRef<Array<string>>([]) // Track previous headings to detect when new data loads
  const currentValueRef = useRef<string>(value) // Track current value to check when headings change
  const hasAutoSelectedRef = useRef<boolean>(false) // Track if we've auto-selected on this headings set
  const onChangeRef = useRef(onChange) // Store onChange in ref to avoid dependency issues

  // Memoize requestParams to prevent unnecessary recalculations and re-renders
  const requestParams = useMemo(
    () =>
      noteFilename
        ? {
            noteFilename,
            optionAddTopAndBottom,
            includeArchive,
          }
        : null,
    [noteFilename, optionAddTopAndBottom, includeArchive],
  )

  // Use useRequestWithRetry hook for automatic retry logic and request management
  const {
    data: headingsData,
    loading,
    loaded,
    error,
  } = useRequestWithRetry({
    requestFromPlugin,
    command: 'getHeadings',
    requestParams,
    enabled: !!noteFilename && !!requestFromPlugin, // Only enable if noteFilename and requestFromPlugin are provided
    maxRetries: 2, // Retry up to 2 times
    retryDelay: 200, // 200ms delay between retries
    identifier: `HeadingChooser:${noteFilename || 'static'}`,
    validateResponse: (data: any) => {
      // Validate response: must be an array (empty array is valid - means note has no headings)
      return Array.isArray(data)
    },
    onSuccess: (data: Array<string>) => {
      // Update headings state when request succeeds
      if (Array.isArray(data)) {
        setHeadings(data)
        lastLoadedNoteFilenameRef.current = noteFilename || null
        logDebug('HeadingChooser', `Loaded ${data.length} headings from note: ${noteFilename || 'static'}`)
      }
    },
    onError: (err: Error) => {
      logError('HeadingChooser', `Failed to load headings from ${noteFilename || 'static'}: ${err.message}`)
      setHeadings([])
      lastLoadedNoteFilenameRef.current = noteFilename || null // Set ref to prevent infinite retries
    },
  })

  // Handle static headings or clear when no noteFilename
  // NOTE: headingsData is handled by onSuccess callback in useRequestWithRetry, so we don't need to watch it here
  // This prevents infinite loops when headingsData changes
  useEffect(() => {
    if (!noteFilename) {
      if (staticHeadings.length > 0) {
        // Use static headings if provided
        logDebug('HeadingChooser', `Using static headings: ${staticHeadings.length} items`)
        setHeadings(staticHeadings)
        lastLoadedNoteFilenameRef.current = null // Clear ref for static headings
      } else {
        // No note selected and no static headings - clear everything
        logDebug('HeadingChooser', 'No noteFilename and no static headings - clearing')
        setHeadings([])
        lastLoadedNoteFilenameRef.current = null // Clear ref
      }
    } else if (noteFilename && !requestFromPlugin) {
      logError('HeadingChooser', `noteFilename provided (${noteFilename}) but requestFromPlugin is not available`)
      setHeadings([])
      lastLoadedNoteFilenameRef.current = null // Clear ref
    }
    // NOTE: When noteFilename and requestFromPlugin are provided, headingsData is handled by onSuccess callback
    // We don't need to watch headingsData here to avoid infinite loops
  }, [noteFilename, requestFromPlugin, staticHeadings])

  // Convert headings array to HeadingOption format
  // Filter out blank/empty headings (trim and check for empty strings)
  // Extract heading level and handle special options like "top of note" and "bottom of note"
  const headingOptions: Array<HeadingOption> = useMemo(() => {
    return headings
      .map((heading) => heading.trim()) // Trim whitespace
      .filter((heading) => heading.length > 0) // Filter out empty strings
      .map((heading) => {
        // Check for special options first (before extracting heading level)
        const cleanHeading = heading.replace(/^#{1,5}\s*/, '')
        const isTopOfNote = cleanHeading.includes('top of note') || cleanHeading.includes('⏫') || heading.includes('⏫')
        const isBottomOfNote = cleanHeading.includes('bottom of note') || cleanHeading.includes('⏬') || heading.includes('⏬')

        let shortDescription: ?string = null
        let color: ?string = null
        let icon: ?string = null
        let headingLevel: number = 2 // Default to h2

        if (isTopOfNote) {
          // Top of note: use angles-up icon (matching chooseHeadingV2)
          icon = 'angles-up'
          shortDescription = 'Top'
          color = 'blue-500'
        } else if (isBottomOfNote) {
          // Bottom of note: use angles-down icon (matching chooseHeadingV2)
          icon = 'angles-down'
          shortDescription = 'Bottom'
          color = 'blue-500'
        } else {
          // Regular heading: extract heading level from markdown markers (# = h1, ## = h2, etc.)
          const headingLevelMatch = heading.match(/^#{1,5}/)
          headingLevel = headingLevelMatch ? headingLevelMatch[0].length : 2 // Default to h2 if no markers
        }

        const option: HeadingOption = {
          heading,
          displayText: heading,
          headingLevel,
          shortDescription,
          color,
          icon, // Custom icon for special options
        }
        return option
      })
  }, [headings])

  // Update refs when props change (but don't trigger auto-select effect)
  useEffect(() => {
    currentValueRef.current = value
    onChangeRef.current = onChange
  }, [value, onChange])

  // Apply default heading if value is empty and defaultHeading is provided, or select first item
  // Only auto-select when headings change (new data loaded), not when user manually selects
  useEffect(() => {
    if (headings.length > 0) {
      // Check if headings have actually changed (new data loaded)
      // Compare current headings with last stored headings to detect changes
      const headingsChanged = 
        lastHeadingsRef.current.length === 0 || // Initial load
        headings.length !== lastHeadingsRef.current.length || 
        headings.some((h, idx) => h !== lastHeadingsRef.current[idx])
      
      // Only auto-select when headings change (new data loaded), not on every render
      if (headingsChanged) {
        lastHeadingsRef.current = [...headings] // Store copy for comparison
        hasAutoSelectedRef.current = false // Reset flag when new headings load
        
        // Use ref for current value (always up-to-date, avoids stale closure issues)
        const currentValue = currentValueRef.current
        
        const valueExists = currentValue
          ? headings.some((h) => {
              // Remove markdown markers for comparison
              const cleanHeading = h.replace(/^#{1,5}\s*/, '').trim()
              const cleanValue = currentValue.replace(/^#{1,5}\s*/, '').trim()
              // Compare both clean versions and original versions
              return cleanHeading === cleanValue || h === currentValue || cleanHeading === currentValue
            })
          : false

        // Only auto-select if value is empty or doesn't exist in the new headings
        // AND we haven't already auto-selected for this headings set
        if ((!currentValue || !valueExists) && !hasAutoSelectedRef.current) {
          // First, check if defaultHeading is provided and exists in headings
          if (defaultHeading) {
            const defaultExists = headings.some((h) => {
              // Remove markdown markers and special markers for comparison
              const cleanHeading = h
                .replace(/^#{1,5}\s*/, '')
                .replace(/^⏫\s*\(top of note\)$/, '<<top of note>>')
                .replace(/^⏬\s*\(bottom of note\)$/, '<<bottom of note>>')
              return cleanHeading === defaultHeading || h === defaultHeading
            })
            if (defaultExists) {
              logDebug('HeadingChooser', `Using defaultHeading: "${defaultHeading}"`)
              onChangeRef.current(defaultHeading)
              hasAutoSelectedRef.current = true
              currentValueRef.current = defaultHeading
              return
            }
          }

          // If no defaultHeading or defaultHeading doesn't exist, select the first item
          // Remove markdown markers to get the clean heading value (matching onSelect behavior)
          const firstHeading = headings[0]
          const cleanFirstHeading = firstHeading.replace(/^#{1,5}\s*/, '')
          logDebug('HeadingChooser', `Auto-selecting first heading: "${cleanFirstHeading}"`)
          onChangeRef.current(cleanFirstHeading)
          hasAutoSelectedRef.current = true
          currentValueRef.current = cleanFirstHeading
        } else if (valueExists) {
          // Value exists in new headings, so it's valid - mark as not needing auto-select
          hasAutoSelectedRef.current = true
        }
      }
    } else {
      // If headings are empty, reset tracking
      lastHeadingsRef.current = []
      hasAutoSelectedRef.current = false
    }
    // Only depend on headings and defaultHeading - don't include value or onChange to avoid re-running on user selection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headings, defaultHeading])

  // Configure the generic SearchableChooser for headings
  const config: ChooserConfig = {
    items: headingOptions,
    filterFn: (option: HeadingOption, searchTerm: string) => {
      const term = searchTerm.toLowerCase()
      return option.heading.toLowerCase().includes(term) || option.displayText.toLowerCase().includes(term)
    },
    getDisplayValue: (option: HeadingOption) => {
      // Remove markdown markers for display
      return option.heading.replace(/^#{1,5}\s*/, '')
    },
    getOptionText: (option: HeadingOption) => {
      // Return heading text with indentation (4 spaces per level, like chooseHeadingV2)
      const cleanHeading = option.heading.replace(/^#{1,5}\s*/, '')
      const level = option.headingLevel || 2
      const indent = '    '.repeat(level - 1) // 4 spaces per level
      return indent + cleanHeading
    },
    getOptionTitle: (option: HeadingOption) => option.displayText,
    // Add heading level icon (h1, h2, h3, etc.) to left div, matching chooseHeadingV2
    // For special options (top/bottom of note), use custom icon (angles-up/angles-down)
    getOptionIcon: (option: HeadingOption) => {
      // If custom icon is provided (for special options), use it
      if (option.icon) {
        return option.icon
      }
      // Otherwise, use heading level icon (h1, h2, h3, etc.)
      const level = option.headingLevel || 2
      return 'h' + String(level) // Returns 'h1', 'h2', 'h3', etc.
    },
    // Get color for icon (for special options like top/bottom of note)
    getOptionColor: (option: HeadingOption) => option.color || null,
    // Put descriptive text in right div (like "Top", "Bottom", "Add new")
    getOptionShortDescription: (option: HeadingOption) => {
      return option.shortDescription || null
    },
    truncateDisplay: truncateText,
    // $FlowFixMe[incompatible-type] - Flow can't properly narrow union type in onSelect handler
    onSelect: (option: any) => {
      // Handle both regular selections and manual entries
      // Type guard: check if this is a manual entry option
      const isManualEntry = option && typeof option === 'object' && '__manualEntry__' in option && option.__manualEntry__
      if (isManualEntry) {
        // Manual entry option
        onChange(option.value)
      } else {
        // Regular heading option - remove markdown markers and return clean heading
        const cleanHeading = option.heading.replace(/^#{1,5}\s*/, '')
        onChange(cleanHeading)
      }
    },
    emptyMessageNoItems: loading ? 'Loading headings...' : 'No headings available',
    emptyMessageNoMatch: 'No headings match your search',
    classNamePrefix: 'heading-chooser',
    iconClass: null, // No icon for heading chooser
    fieldType: 'heading-chooser',
    debugLogging: false,
    maxResults: 25,
    inputMaxLength: 60,
    dropdownMaxLength: 80,
    allowManualEntry: true,
    manualEntryIndicator: '✏️ Manual entry',
    isManualEntry: (value: string, items: Array<HeadingOption>) => {
      // Check if value is not in the items list
      return !items.some((item) => {
        const cleanHeading = item.heading.replace(/^#{1,5}\s*/, '')
        return cleanHeading === value || item.heading === value || item.displayText === value
      })
    },
    shortDescriptionOnLine2: false, // Keep single-line layout: icon in left, text in right
  }

  return (
    <div className="heading-chooser-container" data-field-type="heading-chooser">
      <SearchableChooser
        label={label}
        value={value}
        disabled={disabled || loading}
        compactDisplay={compactDisplay}
        placeholder={loading ? 'Loading headings...' : placeholder}
        showValue={showValue}
        width={width}
        config={config}
      />
    </div>
  )
}
