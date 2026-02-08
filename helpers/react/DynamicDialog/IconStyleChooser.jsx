// @flow
//--------------------------------------------------------------------------
// IconStyleChooser - Single-value SearchableChooser for Font Awesome style
// names (solid, light, regular). Used in Form Builder and forms.
//--------------------------------------------------------------------------

import React, { useMemo } from 'react'
import SearchableChooser, { type ChooserConfig } from './SearchableChooser'
import { truncateText } from '@helpers/react/reactUtils.js'
import { ICON_STYLES } from './valueInsertData'

export type IconStyleChooserProps = {
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
 * Single-value SearchableChooser for icon style names (solid, light, regular).
 * @param {IconStyleChooserProps} props
 * @returns {React$Node}
 */
export function IconStyleChooser({
  label,
  value = '',
  onChange,
  disabled = false,
  compactDisplay = false,
  placeholder = 'Type to search icon styles...',
  width,
  showValue = false,
}: IconStyleChooserProps): React$Node {
  const config: ChooserConfig = useMemo(
    () => ({
      items: ICON_STYLES,
      filterFn: (name: string, searchTerm: string) => name.toLowerCase().includes(searchTerm.toLowerCase()),
      getDisplayValue: (name: string) => name,
      getOptionText: (name: string) => name,
      getOptionTitle: (name: string) => name,
      truncateDisplay: truncateText,
      onSelect: (name: string) => onChange(name),
      emptyMessageNoItems: 'No icon styles available',
      emptyMessageNoMatch: 'No icon styles match your search',
      classNamePrefix: 'icon-style-chooser',
      iconClass: null,
      showArrow: true,
      fieldType: 'icon-style-chooser',
      maxResults: 0,
      inputMaxLength: 40,
      dropdownMaxLength: 50,
    }),
    [onChange],
  )

  return (
    <div className="icon-style-chooser-container" data-field-type="icon-style-chooser">
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

export default IconStyleChooser
