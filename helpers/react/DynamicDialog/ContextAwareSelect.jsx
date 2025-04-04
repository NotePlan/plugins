// ContextAwareSelect.jsx
// NOTE: DBW TRIED TO INCLUDE THIS IN THE DIALOG ELEMENT RENDERER, BUT
// THE CONTEXT PART OF IT WAS WAY TOO COMPLICATED, SO USE IT STAND-ALONE FOR NOW
// @flow
import React, { useContext, useEffect, useState, useMemo } from 'react'
import Select from 'react-select'
import isEqual from 'lodash/isEqual'
import './DropdownSelect.css' // Reuse the same CSS

type OptionType = {|
  value: string | number,
  label: string,
  [string]: any, // Allow additional properties
|}

type Styles = {
  container?: { [string]: mixed },
  label?: { [string]: mixed },
  wrapper?: { [string]: mixed },
  inputContainer?: { [string]: mixed },
  input?: { [string]: mixed },
  arrow?: { [string]: mixed },
  dropdown?: { [string]: mixed },
  option?: { [string]: mixed },
  indicator?: { [string]: mixed },
  separator?: { [string]: mixed },
}

type Props = {|
  /** Label for the select */
  label: string,
  /** Context getter function that returns options */
  getContextOptions: () => OptionType[],
  /** Initial options to populate before context loads */
  initialOptions?: OptionType[],
  /** Default selected value (must exist in options) */
  defaultValue?: OptionType,
  /** Callback when new options are detected in context */
  onNewOptions?: (newOptions: OptionType[]) => void,
  /** Whether to display in compact mode */
  compactDisplay?: boolean,
  /** Whether the select is disabled */
  disabled?: boolean,
  /** Custom styles for different parts of the select */
  styles?: Styles,
  /** Whether options should take full width */
  fullWidthOptions?: boolean,
  /** Property name to determine if an indicator should be shown */
  showIndicatorOptionProp?: string,
  /** Whether to allow non-matching labels */
  allowNonMatchingLabel?: boolean,
  /** Whether to prevent options from wrapping */
  noWrapOptions?: boolean,
  /** Fixed width for the select */
  fixedWidth?: number,
  /** Additional class names for the container */
  className?: string,
  /** Additional class names for the select component */
  selectClassName?: string,
  /** Additional styles for the select component */
  selectStyle?: { [string]: mixed },
  /** Whether the select input is editable */
  isEditable?: boolean,
  /** Placeholder text when no option is selected */
  placeholder?: string,
  /** Whether the select is clearable */
  isClearable?: boolean,
  /** Whether the select is searchable */
  isSearchable?: boolean,
  /** Whether to show the loading indicator */
  isLoading?: boolean,
  /** Whether to show the menu when the select is focused */
  openMenuOnFocus?: boolean,
  /** Whether to show the menu when the select is clicked */
  openMenuOnClick?: boolean,
  /** Whether to close the menu when a value is selected */
  closeMenuOnSelect?: boolean,
  /** Whether to blur the input when a value is selected */
  blurInputOnSelect?: boolean,
  /** Whether to hide the selected options from the menu */
  hideSelectedOptions?: boolean,
  /** Whether to show the menu at the top of the select */
  menuPlacement?: 'auto' | 'bottom' | 'top',
  /** Maximum height of the menu */
  maxMenuHeight?: number,
  /** Minimum height of the menu */
  minMenuHeight?: number,
  /** Standard react-select props */
  ...$Exact<React.ElementConfig<typeof Select>>,
|}

/**
 * ContextAwareSelect component that:
 * 1. Accepts initial options
 * 2. Watches context for updates
 * 3. Only updates when options actually change
 * 4. Filters options based on label only
 * 5. Matches DropdownSelect styling
 */
const ContextAwareSelect = ({
  label,
  getContextOptions,
  initialOptions = [],
  defaultValue,
  onNewOptions,
  compactDisplay = false,
  disabled = false,
  styles = {},
  fullWidthOptions = false,
  showIndicatorOptionProp = '',
  noWrapOptions = true,
  fixedWidth,
  className = '',
  selectClassName = '',
  selectStyle = {},
  isEditable = true,
  placeholder = 'Select...',
  isClearable = false,
  isSearchable = true,
  isLoading = false,
  openMenuOnFocus = true,
  openMenuOnClick = true,
  closeMenuOnSelect = true,
  blurInputOnSelect = true,
  hideSelectedOptions = false,
  menuPlacement = 'auto',
  maxMenuHeight = 300,
  minMenuHeight = 100,
  ...selectProps
}: Props): React$Node => {
  // State for current options
  const [options, setOptions] = useState<OptionType[]>(initialOptions)

  // Handle context updates
  useEffect(() => {
    try {
      const newOptions = getContextOptions()
      if (!isEqual(newOptions, options)) {
        setOptions(newOptions)
        if (onNewOptions) onNewOptions(newOptions)
      }
    } catch (error) {
      console.error('Error getting context options:', error)
    }
  }, [getContextOptions, options, onNewOptions])

  // Memoized default value to prevent recreation on every render
  const memoizedDefaultValue = useMemo(() => {
    if (!defaultValue) return undefined
    return options.find((opt) => isEqual(opt, defaultValue))
  }, [defaultValue, options])

  // Filter function that only checks the label property
  const filterOption = (option: OptionType, inputValue: string): boolean => {
    return option.label.toLowerCase().includes(inputValue.toLowerCase())
  }

  // Custom styles for react-select
  const customStyles = {
    container: (provided: { [string]: mixed }) => ({
      ...provided,
      ...styles.container,
      width: '100%',
    }),
    control: (provided: { [string]: mixed }) => ({
      ...provided,
      minHeight: compactDisplay ? '32px' : '40px',
      width: '100%',
      ...styles.inputContainer,
    }),
    valueContainer: (provided: { [string]: mixed }) => ({
      ...provided,
      padding: compactDisplay ? '0 8px' : '2px 8px',
      width: '100%',
    }),
    singleValue: (provided: { [string]: mixed }) => ({
      ...provided,
      ...styles.input,
      width: '100%',
    }),
    menu: (provided: { [string]: mixed }) => ({
      ...provided,
      ...styles.dropdown,
      maxHeight: maxMenuHeight,
      minHeight: minMenuHeight,
      width: '100%',
    }),
    option: (provided: { [string]: mixed }, state: { isSelected: boolean }) => ({
      ...provided,
      ...styles.option,
      whiteSpace: noWrapOptions ? 'nowrap' : 'normal',
      overflow: noWrapOptions ? 'hidden' : 'visible',
      textOverflow: noWrapOptions ? 'ellipsis' : 'clip',
      backgroundColor: state.isSelected ? 'var(--selected-bg-color)' : 'transparent',
      color: state.isSelected ? 'var(--selected-text-color)' : 'var(--text-color)',
      '&:hover': {
        backgroundColor: 'var(--hover-bg-color)',
        color: 'var(--hover-text-color)',
      },
    }),
  }

  return (
    <div className={`${compactDisplay ? 'dropdown-select-container-compact' : 'dropdown-select-container'} ${disabled ? 'disabled' : ''} ${className}`}>
      <label className="dropdown-select-label" style={styles.label}>
        {label}
      </label>
      <div className="dropdown-select-wrapper" style={{ width: fixedWidth ? `${fixedWidth}px` : '100%', minWidth: '200px' }}>
        <Select
          {...selectProps}
          options={options}
          defaultValue={memoizedDefaultValue}
          filterOption={filterOption}
          isDisabled={disabled}
          isClearable={isClearable}
          isSearchable={isSearchable}
          isLoading={isLoading}
          placeholder={placeholder || 'Select...'}
          openMenuOnFocus={openMenuOnFocus}
          openMenuOnClick={openMenuOnClick}
          closeMenuOnSelect={closeMenuOnSelect}
          blurInputOnSelect={blurInputOnSelect}
          hideSelectedOptions={hideSelectedOptions}
          menuPlacement={menuPlacement}
          styles={customStyles}
          className={selectClassName}
          style={selectStyle}
          classNamePrefix="react-select"
        />
      </div>
    </div>
  )
}

export default ContextAwareSelect
