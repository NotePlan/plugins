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
  category?: ?string, // Can be null to hide category
}

export type TemplateTagInserterProps = {
  isOpen: boolean,
  onClose: () => void,
  onInsert: (tag: string) => void,
  fieldKeys?: Array<string>, // Available form field keys for <%- fieldKey %>
  showDateFormats?: boolean, // Show date format options
  mode?: 'field' | 'date' | 'both', // Mode: 'field' = only fields, 'date' = only dates, 'both' = both (default)
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
  mode = 'both',
}: TemplateTagInserterProps): React$Node {
  const [searchTerm, setSearchTerm] = useState('')

  // Build options list
  const options: Array<TemplateTagOption> = useMemo(() => {
    const opts: Array<TemplateTagOption> = []

    // Add field keys (only if mode is 'field' or 'both')
    if ((mode === 'field' || mode === 'both') && fieldKeys.length > 0) {
      fieldKeys.forEach((key) => {
        opts.push({
          label: key,
          value: `<%- ${key} %>`,
          description: `Insert value of form field "${key}"`,
          category: null, // Don't show category for fields
        })
      })
    }

    // Add date formats (only if mode is 'date' or 'both')
    if ((mode === 'date' || mode === 'both') && showDateFormats) {
      const dateFormats = [
        { format: 'YYYY-MM-DD', example: '2024-12-22', description: 'ISO date format' },
        { format: 'MM/DD/YYYY', example: '12/22/2024', description: 'US date format' },
        { format: 'DD/MM/YYYY', example: '22/12/2024', description: 'European date format' },
        { format: 'YYYY-MM-DD HH:mm', example: '2024-12-22 14:30', description: 'Date and time' },
        { format: 'MMMM Do, YYYY', example: 'December 22nd, 2024', description: 'Long date format' },
        { format: 'dddd', example: 'Sunday', description: 'Day of week' },
        { format: 'MMMM', example: 'December', description: 'Month name' },
        { format: 'YYYY', example: '2024', description: 'Year' },
      ]
      opts.push(
        ...dateFormats.map((df) => ({
          label: `${df.format} (${df.example})`,
          value: `<%- date.format("${df.format}") %>`,
          description: df.description,
          category: null, // Don't show category for dates
        })),
      )
    }

    return opts
  }, [fieldKeys, showDateFormats, mode])

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
    showArrow: true, // Show down arrow like a select
    fieldType: 'template-tag-inserter',
    debugLogging: false,
    maxResults: 25,
    inputMaxLength: 60,
    dropdownMaxLength: 80,
    getOptionShortDescription: (option: TemplateTagOption) => null, // Don't show category
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

