// @flow
//--------------------------------------------------------------------------
// PatternChooser - Single-value SearchableChooser for pattern names
// (lined, squared, mini-squared, dotted). Used in Form Builder and forms.
//--------------------------------------------------------------------------

import React, { useMemo } from 'react'
import SearchableChooser, { type ChooserConfig } from './SearchableChooser'
import { truncateText } from '@helpers/react/reactUtils.js'
import { PATTERNS } from './valueInsertData'

export type PatternChooserProps = {
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
 * Single-value SearchableChooser for pattern names.
 * @param {PatternChooserProps} props
 * @returns {React$Node}
 */
export function PatternChooser({
  label,
  value = '',
  onChange,
  disabled = false,
  compactDisplay = false,
  placeholder = 'Type to search patterns...',
  width,
  showValue = false,
}: PatternChooserProps): React$Node {
  const config: ChooserConfig = useMemo(
    () => ({
      items: PATTERNS,
      filterFn: (name: string, searchTerm: string) => name.toLowerCase().includes(searchTerm.toLowerCase()),
      getDisplayValue: (name: string) => name,
      getOptionText: (name: string) => name,
      getOptionTitle: (name: string) => name,
      truncateDisplay: truncateText,
      onSelect: (name: string) => onChange(name),
      emptyMessageNoItems: 'No patterns available',
      emptyMessageNoMatch: 'No patterns match your search',
      classNamePrefix: 'pattern-chooser',
      iconClass: null,
      showArrow: true,
      fieldType: 'pattern-chooser',
      maxResults: 0,
      inputMaxLength: 40,
      dropdownMaxLength: 50,
    }),
    [onChange],
  )

  return (
    <div className="pattern-chooser-container" data-field-type="pattern-chooser">
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

export default PatternChooser
