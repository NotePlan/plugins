// @flow
//--------------------------------------------------------------------------
// TemplateTagInserter Component
// A SearchableChooser-based component for inserting template tags into text fields
//--------------------------------------------------------------------------

import React, { useState, useMemo } from 'react'
import SearchableChooser, { type ChooserConfig } from '@helpers/react/DynamicDialog/SearchableChooser'
import { truncateText } from '@helpers/react/reactUtils.js'
import moment from 'moment/min/moment-with-locales'
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
      // Use a sample date to generate locale-specific examples
      // Use a date that shows various aspects: weekday, month, day, year, time
      const sampleDate = moment('2024-12-22 14:30:45') // Sunday, December 22, 2024, 2:30 PM
      
      // Set locale from NotePlan environment if available
      if (typeof NotePlan !== 'undefined' && NotePlan.environment) {
        const userLocale = `${NotePlan.environment.languageCode || 'en'}${NotePlan.environment.regionCode ? `-${NotePlan.environment.regionCode}` : ''}`
        moment.locale(userLocale)
      }
      
      // Generate locale-specific examples for common date formats
      const dateFormats = [
        // ISO and standard formats
        { format: 'YYYY-MM-DD', description: 'ISO date format' },
        { format: 'YYYY-MM-DD HH:mm', description: 'ISO date and time (24-hour)' },
        { format: 'YYYY-MM-DD HH:mm:ss', description: 'ISO date and time with seconds' },
        
        // US date formats
        { format: 'MM/DD/YYYY', description: 'US date format' },
        { format: 'MM/DD/YY', description: 'US date format (short year)' },
        { format: 'M/D/YYYY', description: 'US date format (no leading zeros)' },
        
        // European date formats
        { format: 'DD/MM/YYYY', description: 'European date format' },
        { format: 'DD/MM/YY', description: 'European date format (short year)' },
        { format: 'D/M/YYYY', description: 'European date format (no leading zeros)' },
        
        // Long date formats
        { format: 'MMMM Do, YYYY', description: 'Long date format (e.g., December 22nd, 2024)' },
        { format: 'dddd, MMMM Do, YYYY', description: 'Full date with weekday' },
        { format: 'MMMM Do', description: 'Month and day (e.g., December 22nd)' },
        
        // Time formats (12-hour with AM/PM)
        { format: 'h:mm A', description: 'Time (12-hour with AM/PM)' },
        { format: 'hh:mm A', description: 'Time (12-hour with AM/PM, leading zero)' },
        { format: 'h:mm:ss A', description: 'Time with seconds (12-hour with AM/PM)' },
        
        // Time formats (24-hour)
        { format: 'HH:mm', description: 'Time (24-hour)' },
        { format: 'HH:mm:ss', description: 'Time with seconds (24-hour)' },
        
        // Date and time combinations
        { format: 'MM/DD/YYYY h:mm A', description: 'US date and time (12-hour)' },
        { format: 'MM/DD/YYYY HH:mm', description: 'US date and time (24-hour)' },
        { format: 'DD/MM/YYYY h:mm A', description: 'European date and time (12-hour)' },
        { format: 'DD/MM/YYYY HH:mm', description: 'European date and time (24-hour)' },
        { format: 'MMMM Do, YYYY h:mm A', description: 'Long date and time (12-hour)' },
        { format: 'MMMM Do, YYYY HH:mm', description: 'Long date and time (24-hour)' },
        
        // Individual components
        { format: 'dddd', description: 'Day of week (full name)' },
        { format: 'ddd', description: 'Day of week (abbreviated)' },
        { format: 'MMMM', description: 'Month name (full)' },
        { format: 'MMM', description: 'Month name (abbreviated)' },
        { format: 'YYYY', description: 'Year (4 digits)' },
        { format: 'YY', description: 'Year (2 digits)' },
        { format: 'Do', description: 'Day of month with ordinal (e.g., 22nd)' },
        { format: 'D', description: 'Day of month (no leading zero)' },
        { format: 'DD', description: 'Day of month (with leading zero)' },
        
        // Week and quarter
        { format: 'wo [week of] YYYY', description: 'Week number and year' },
        { format: 'Qo [quarter] YYYY', description: 'Quarter and year' },
      ]
      
      opts.push(
        ...dateFormats.map((df) => {
          // Generate locale-specific example using moment
          const example = sampleDate.format(df.format)
          return {
            label: `${df.format} (${example})`,
            value: `<%- date.format("${df.format}") %>`,
            description: df.description,
            category: null, // Don't show category for dates
          }
        }),
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
    maxResults: 100, // Show all date formats (we have ~34 date formats + field keys)
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

