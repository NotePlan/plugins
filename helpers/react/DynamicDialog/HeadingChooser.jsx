// @flow
//--------------------------------------------------------------------------
// HeadingChooser Component
// Allows users to select a heading from a note, either statically or dynamically based on a note-chooser field
//--------------------------------------------------------------------------

import React, { useState, useEffect, useMemo } from 'react'
import SearchableChooser, { type ChooserConfig } from './SearchableChooser'
import { truncateText } from '@helpers/react/reactUtils.js'
import { logDebug, logError } from '@helpers/react/reactDev.js'
import './HeadingChooser.css'

export type HeadingOption = {
  heading: string, // The heading text (without markdown markers)
  displayText: string, // The text to display (may include special markers like "⏫ (top of note)")
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
  defaultHeading?: ?string, // Default heading to use if none selected
  optionAddTopAndBottom?: boolean, // Whether to include "top of note" and "bottom of note" options
  includeArchive?: boolean, // Whether to include headings in Archive section
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
  defaultHeading,
  optionAddTopAndBottom = true,
  includeArchive = false,
}: HeadingChooserProps): React$Node {
  const [headings, setHeadings] = useState<Array<string>>(staticHeadings)
  const [loading, setLoading] = useState<boolean>(false)
  const [loaded, setLoaded] = useState<boolean>(false)

  // Convert headings array to HeadingOption format
  const headingOptions: Array<HeadingOption> = useMemo(() => {
    return headings.map((heading) => ({
      heading,
      displayText: heading,
    }))
  }, [headings])

  // Load headings from note if noteFilename is provided and we have requestFromPlugin
  useEffect(() => {
    if (noteFilename && requestFromPlugin && !loaded && !loading) {
      setLoading(true)
      logDebug('HeadingChooser', `Loading headings from note: ${noteFilename}`)
      requestFromPlugin('getHeadings', { noteFilename, optionAddTopAndBottom, includeArchive })
        .then((headingsData: Array<string>) => {
          if (Array.isArray(headingsData)) {
            setHeadings(headingsData)
            setLoaded(true)
            logDebug('HeadingChooser', `Loaded ${headingsData.length} headings from note`)
          } else {
            logError('HeadingChooser', 'Invalid response format from getHeadings')
            setHeadings([])
            setLoaded(true)
          }
        })
        .catch((error) => {
          logError('HeadingChooser', `Failed to load headings: ${error.message}`)
          setHeadings([])
          setLoaded(true)
        })
        .finally(() => {
          setLoading(false)
        })
    } else if (!noteFilename && staticHeadings.length > 0) {
      // Use static headings if provided
      setHeadings(staticHeadings)
      setLoaded(true)
    }
  }, [noteFilename, requestFromPlugin, loaded, loading, staticHeadings, optionAddTopAndBottom, includeArchive])

  // Apply default heading if value is empty and defaultHeading is provided
  useEffect(() => {
    if (!value && defaultHeading && headings.length > 0) {
      // Check if defaultHeading exists in headings
      const defaultExists = headings.some((h) => {
        // Remove markdown markers and special markers for comparison
        const cleanHeading = h.replace(/^#{1,5}\s*/, '').replace(/^⏫\s*\(top of note\)$/, '<<top of note>>').replace(/^⏬\s*\(bottom of note\)$/, '<<bottom of note>>')
        return cleanHeading === defaultHeading || h === defaultHeading
      })
      if (defaultExists) {
        onChange(defaultHeading)
      }
    }
  }, [value, defaultHeading, headings, onChange])

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
      // Show heading with markdown markers in dropdown for context
      return option.displayText
    },
    getOptionTitle: (option: HeadingOption) => option.displayText,
    truncateDisplay: truncateText,
    onSelect: (option: HeadingOption) => {
      // Remove markdown markers and return clean heading
      const cleanHeading = option.heading.replace(/^#{1,5}\s*/, '')
      onChange(cleanHeading)
    },
    emptyMessageNoItems: loading ? 'Loading headings...' : 'No headings available',
    emptyMessageNoMatch: 'No headings match your search',
    classNamePrefix: 'heading-chooser',
    iconClass: 'fa-heading',
    fieldType: 'heading-chooser',
    debugLogging: false,
    maxResults: 20,
    inputMaxLength: 60,
    dropdownMaxLength: 80,
  }

  return (
    <div className="heading-chooser-container" data-field-type="heading-chooser">
      <SearchableChooser
        label={label}
        value={value}
        disabled={disabled || loading}
        compactDisplay={compactDisplay}
        placeholder={loading ? 'Loading headings...' : placeholder}
        config={config}
      />
    </div>
  )
}

