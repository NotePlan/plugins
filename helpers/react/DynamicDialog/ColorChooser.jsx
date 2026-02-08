// @flow
//--------------------------------------------------------------------------
// ColorChooser - Single-value SearchableChooser for Tailwind color names.
// Used in Form Builder and forms for picking bg/text colors (e.g. amber-200).
// First column shows a color swatch; name uses standard fg color for readability.
//--------------------------------------------------------------------------

import React, { useMemo } from 'react'
import SearchableChooser, { type ChooserConfig } from './SearchableChooser'
import { truncateText } from '@helpers/react/reactUtils.js'
import { TAILWIND_COLOR_NAMES, getColorStyle } from '@helpers/colors'
import './ColorChooser.css'

export type ColorChooserProps = {
  label?: string,
  value?: string,
  onChange: (value: string) => void,
  disabled?: boolean,
  compactDisplay?: boolean,
  placeholder?: string,
  width?: string,
  showValue?: boolean,
}

/**
 * Single-value SearchableChooser for Tailwind color names.
 * Renders swatch in first column and name in standard fg color (no highlight).
 * @param {ColorChooserProps} props
 * @returns {React$Node}
 */
export function ColorChooser({
  label,
  value = '',
  onChange,
  disabled = false,
  compactDisplay = false,
  placeholder = 'Type to search colors...',
  width,
  showValue = false,
}: ColorChooserProps): React$Node {
  const config: ChooserConfig = useMemo(
    () => ({
      items: TAILWIND_COLOR_NAMES,
      filterFn: (name: string, searchTerm: string) => name.toLowerCase().includes(searchTerm.toLowerCase()),
      getDisplayValue: (name: string) => name,
      getOptionText: (name: string) => name,
      getOptionTitle: (name: string) => name,
      truncateDisplay: truncateText,
      onSelect: (name: string) => onChange(name),
      emptyMessageNoItems: 'No colors available',
      emptyMessageNoMatch: 'No colors match your search',
      classNamePrefix: 'color-chooser',
      iconClass: null,
      showArrow: true,
      fieldType: 'color-chooser',
      maxResults: 0,
      inputMaxLength: 40,
      dropdownMaxLength: 80,
      renderOption: (item: string, helpers: any) => {
        const hex = getColorStyle(item) || 'transparent'
        return (
          <div
            className={`searchable-chooser-option color-chooser-option-with-swatch ${helpers.classNamePrefix}-option ${helpers.isSelected ? 'option-selected' : ''}`}
          >
            <span
              className="color-chooser-swatch"
              style={{
                backgroundColor: hex,
                border: '1px solid var(--divider-color, #CDCFD0)',
              }}
            />
            <span className="searchable-chooser-option-text color-chooser-option-name">{item}</span>
          </div>
        )
      },
    }),
    [onChange],
  )

  return (
    <div className="color-chooser-container" data-field-type="color-chooser">
      <SearchableChooser
        label={label}
        value={value}
        disabled={disabled}
        compactDisplay={compactDisplay}
        placeholder={placeholder}
        showValue={showValue}
        width={width}
        config={config}
      />
    </div>
  )
}

export default ColorChooser
