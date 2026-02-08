// @flow
//--------------------------------------------------------------------------
// IconChooser - Single-value SearchableChooser for Font Awesome icon names.
// NotePlan uses short names only (e.g. "circle"), not "fa-solid fa-circle".
// Value stored and output is the short name (e.g. "circle", "star").
//--------------------------------------------------------------------------

import React, { useMemo } from 'react'
import SearchableChooser, { type ChooserConfig } from './SearchableChooser'
import { truncateText } from '@helpers/react/reactUtils.js'
import { FA_ICON_NAMES } from './valueInsertData'

export type IconChooserProps = {
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
 * Single-value SearchableChooser for Font Awesome icon names.
 * Output is short name only (e.g. "circle"), for NotePlan compatibility.
 * @param {IconChooserProps} props
 * @returns {React$Node}
 */
export function IconChooser({
  label,
  value = '',
  onChange,
  disabled = false,
  compactDisplay = false,
  placeholder = 'Type to search icons...',
  width,
  showValue = false,
}: IconChooserProps): React$Node {
  const config: ChooserConfig = useMemo(
    () => ({
      items: FA_ICON_NAMES,
      filterFn: (name: string, searchTerm: string) => name.toLowerCase().includes(searchTerm.toLowerCase()),
      getDisplayValue: (name: string) => name,
      getOptionText: (name: string) => name,
      getOptionTitle: (name: string) => name,
      truncateDisplay: truncateText,
      onSelect: (name: string) => onChange(name),
      emptyMessageNoItems: 'No icons available',
      emptyMessageNoMatch: 'No icons match your search',
      classNamePrefix: 'icon-chooser',
      iconClass: null,
      showArrow: true,
      fieldType: 'icon-chooser',
      getOptionIcon: (name: string) => `fa-solid fa-${name}`,
      maxResults: 0,
      inputMaxLength: 40,
      dropdownMaxLength: 50,
    }),
    [onChange],
  )

  return (
    <div className="icon-chooser-container" data-field-type="icon-chooser">
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

export default IconChooser
