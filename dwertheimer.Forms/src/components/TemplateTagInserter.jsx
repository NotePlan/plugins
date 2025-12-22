// @flow
//--------------------------------------------------------------------------
// TemplateTagInserter Component
// A SearchableChooser-based component for inserting template tags into text fields
//--------------------------------------------------------------------------

import React, { useState, useMemo } from 'react'
import SearchableChooser, { type ChooserConfig } from '@helpers/react/DynamicDialog/SearchableChooser'
import { truncateText } from '@helpers/react/reactUtils.js'
import './TemplateTagInserter.css'

export type TemplateTagOption = {
  label: string,
  value: string,
  description?: string,
  category?: string,
}

export type TemplateTagInserterProps = {
  isOpen: boolean,
  onClose: () => void,
  onInsert: (tag: string) => void,
  fieldKeys?: Array<string>, // Available form field keys for <%- fieldKey %>
  showDateFormats?: boolean, // Show date format options
}

/**
 * TemplateTagInserter Component
 * A searchable dropdown for selecting template tags to insert
 * @param {TemplateTagInserterProps} props
 * @returns {React$Node}
 */
export function TemplateTagInserter({
  isOpen,
  onClose,
  onInsert,
  fieldKeys = [],
  showDateFormats = true,
}: TemplateTagInserterProps): React$Node {
  const [searchTerm, setSearchTerm] = useState('')

  // Build options list
  const options: Array<TemplateTagOption> = useMemo(() => {
    const opts: Array<TemplateTagOption> = []

    // Add field keys
    if (fieldKeys.length > 0) {
      fieldKeys.forEach((key) => {
        opts.push({
          label: `Field: ${key}`,
          value: `<%- ${key} %>`,
          description: `Insert value of form field "${key}"`,
          category: 'Form Fields',
        })
      })
    }

    // Add date formats
    if (showDateFormats) {
      const dateFormats = [
        { label: 'Date: YYYY-MM-DD', value: `<%- date.format("YYYY-MM-DD") %>`, description: 'ISO date format' },
        { label: 'Date: MM/DD/YYYY', value: `<%- date.format("MM/DD/YYYY") %>`, description: 'US date format' },
        { label: 'Date: DD/MM/YYYY', value: `<%- date.format("DD/MM/YYYY") %>`, description: 'European date format' },
        { label: 'Date: YYYY-MM-DD HH:mm', value: `<%- date.format("YYYY-MM-DD HH:mm") %>`, description: 'Date and time' },
        { label: 'Date: MMMM Do, YYYY', value: `<%- date.format("MMMM Do, YYYY") %>`, description: 'Long date format' },
        { label: 'Date: dddd', value: `<%- date.format("dddd") %>`, description: 'Day of week' },
        { label: 'Date: MMMM', value: `<%- date.format("MMMM") %>`, description: 'Month name' },
        { label: 'Date: YYYY', value: `<%- date.format("YYYY") %>`, description: 'Year' },
      ]
      opts.push(...dateFormats.map((df) => ({ ...df, category: 'Date Formats' })))
    }

    return opts
  }, [fieldKeys, showDateFormats])

  // Configure the SearchableChooser
  const config: ChooserConfig = {
    items: options,
    filterFn: (option: TemplateTagOption, term: string): boolean => {
      const search = term.toLowerCase()
      return (
        option.label.toLowerCase().includes(search) ||
        option.value.toLowerCase().includes(search) ||
        (option.description ? option.description.toLowerCase().includes(search) : false) ||
        (option.category ? option.category.toLowerCase().includes(search) : false)
      )
    },
    getDisplayValue: (option: TemplateTagOption) => option.label,
    getOptionText: (option: TemplateTagOption) => option.label,
    getOptionTitle: (option: TemplateTagOption) => option.description || option.value,
    truncateDisplay: truncateText,
    onSelect: (option: TemplateTagOption) => {
      onInsert(option.value)
      onClose()
    },
    emptyMessageNoItems: 'No template tags available',
    emptyMessageNoMatch: 'No tags match your search',
    classNamePrefix: 'template-tag-inserter',
    iconClass: null,
    fieldType: 'template-tag-inserter',
    debugLogging: false,
    maxResults: 25,
    inputMaxLength: 60,
    dropdownMaxLength: 80,
    getOptionShortDescription: (option: TemplateTagOption) => option.category || null,
  }

  if (!isOpen) return null

  return (
    <div className="template-tag-inserter-overlay" onClick={onClose}>
      <div className="template-tag-inserter-container" onClick={(e) => e.stopPropagation()}>
        <div className="template-tag-inserter-header">
          <h3>Insert Template Tag</h3>
          <button type="button" onClick={onClose} className="template-tag-inserter-close">
            ×
          </button>
        </div>
        <SearchableChooser
          label=""
          value=""
          disabled={false}
          compactDisplay={false}
          placeholder="Type to search template tags..."
          showValue={false}
          config={config}
        />
      </div>
    </div>
  )
}

export default TemplateTagInserter

