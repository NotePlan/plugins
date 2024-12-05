// @flow
// DBW NOTE: HAVE SPENT MANY HOURS TRYING TO STYLE THIS COMPONENT. IT'S ALMOST IMPOSSIBLE. I AM USIN
import React, { useEffect, useState } from 'react'
import Select from 'react-select'
import chroma from 'chroma-js'
import { logDebug, clo } from '@np/helpers/react/reactDev'

declare var NP_THEME: any

/** @typedef {Object} OptionType
 *  @property {string} label
 *  @property {string} value
 *  @property {number=} id
 *  @property {boolean=} isModified
 */

export type OptionType = {
  label: string,
  value: string,
  id?: number,
  isModified?: boolean,
}

// Define the Props type using Flow
export type Props = {
  options: Array<OptionType | string>,
  onSelect?: (option: OptionType | string) => void,
  onChange?: (option: OptionType | string) => void,
  value?: OptionType | string,
  id?: string,
  compactDisplay?: boolean,
  disabled?: boolean,
  inputRef?: { current: null | HTMLInputElement },
  label?: string,
  noWrapOptions?: boolean,
  focus?: boolean,
  style?: {
    container?: Object,
    control?: Object,
    label?: Object,
    // Add other style properties as needed
  },
}

/**
 * ThemedSelect Component
 *
 * @param {Props} props - The properties for the component.
 * @returns {React.Node} The ThemedSelect component.
 */
export function ThemedSelect(props: Props): any {
  const { options, onSelect, onChange, value, compactDisplay, disabled, inputRef, label, noWrapOptions, focus, style = {} } = props

  const [wasFocused, setWasFocused] = useState(false)

  if (typeof NP_THEME === 'undefined') {
    throw new Error('ThemedSelect: NP_THEME is not defined')
  }

  /**
   * Returns style object for the dot indicator.
   *
   * @param {string} [color='transparent'] - The color of the dot.
   * @returns {Object} Style object for the dot.
   */
  const dot = (color: string = 'transparent') => ({
    alignItems: 'center',
    display: 'flex',

    ':before': {
      backgroundColor: color,
      borderRadius: 10,
      content: '" "',
      display: 'block',
      marginRight: 8,
      height: 10,
      width: 10,
    },
  })

  const isDark = (bgColor: string) => chroma(bgColor).luminance() < 0.5
  const isLight = (bgColor: string) => !isDark(bgColor)

  /**
   * Calculates an alternative color based on background color and strength.
   *
   * @param {string} bgColor - The background color.
   * @param {number} [strength=0.2] - The strength of change.
   * @returns {string} The calculated alternative color.
   */
  const getAltColor = (bgColor: string, strength: number = 0.2) => {
    const calcAltFromBGColor = isLight(bgColor) ? chroma(bgColor).darken(strength).css() : chroma(bgColor).brighten(strength).css()
    return calcAltFromBGColor
  }

  const getMenuStyles = () => {
    return {
      base: {
        backgroundColor: getAltColor(NP_THEME.base.backgroundColor),
        color: getAltColor(NP_THEME.base.textColor),
      },
      hover: {
        backgroundColor: getAltColor(NP_THEME.base.backgroundColor, 0.75),
        color: getAltColor(NP_THEME.base.textColor, 0.75),
        border: '1px solid',
        borderColor: NP_THEME.base.textColor,
      },
      icon: {
        color: getAltColor(NP_THEME.base.textColor, 0.75),
      },
    }
  }

  const menuStyles = getMenuStyles()

  const bgColor = chroma(NP_THEME.base.backgroundColor)
  // const bOrW = chroma.contrast(bgColor, 'white') > 2 ? 'white' : 'black'
  // const lighterBG = chroma.average([NP_THEME.base.backgroundColor, NP_THEME.base.altColor, bOrW]).css()

  const defaultStyles = {
    clearIndicator: (styles: any) => ({
      ...styles,
      color: '#00FF00',
      paddingTop: 3,
      paddingBottom: 3,
    }),
    container: (styles: any) => ({
      ...styles,
      width: '100%',
      minWidth: '100%', // Default minimum width
      maxWidth: '100%', // Default maximum width
      minHeight: '20px', // Default minimum height
      maxHeight: '60px', // Default maximum height
      backgroundColor: NP_THEME.base.backgroundColor,
      color: NP_THEME.base.textColor,
      borderRadius: 5,
      boxSizing: 'border-box', // Ensure padding and borders are included in the element's total width and height
    }),
    valueContainer: (provided: any) => ({
      ...provided,
      height: '20px',
      padding: '0 6px',
    }),

    input: (provided: any) => ({
      ...provided,
      color: NP_THEME.base.textColor,
      margin: '0px',
      width: '50px',
      height: '20px',
      display: 'flex',
      alignItems: 'center',
    }),
    indicatorSeparator: (provided: any) => ({
      ...provided,
      display: 'none',
      color: '#00FF00',
    }),
    indicatorsContainer: (provided: any) => ({
      ...provided,
      height: '30px',
      color: '#00FF00',
    }),
    control: (styles: any) => ({
      ...styles,
      height: '30px', // Set the desired height
      width: '100px', // Set the desired width
      backgroundColor: NP_THEME.base.backgroundColor ?? 'white',
      color: NP_THEME.base.textColor ?? 'black',
      borderColor: chroma('white').alpha(0.25).css(),
    }),
    dropdownIndicator: (styles: any) => ({
      ...styles,
      paddingTop: 3,
      paddingBottom: 3,
      color: NP_THEME.base.textColor,
    }),
    group: (styles: any) => ({ ...styles, color: '#00FF00' }),
    groupHeading: (styles: any) => ({ ...styles, color: '#00FF00' }),
    loadingIndicator: (styles: any) => ({ ...styles, color: '#00FF00' }),
    loadingMessage: (styles: any) => ({ ...styles, color: '#00FF00' }),
    menu: (styles: any) => ({
      ...styles,
      backgroundColor: NP_THEME.base.backgroundColor ?? 'white',
    }),
    menuList: (styles: any) => ({
      ...styles,
      backgroundColor: NP_THEME.base.backgroundColor ?? 'white',
    }),
    menuPortal: (styles: any) => ({ ...styles, backgroundColor: '#00FF00' }),
    multiValue: (styles: any) => ({ ...styles, backgroundColor: '#00FF00' }),
    multiValueLabel: (styles: any) => ({ ...styles, backgroundColor: '#00FF00' }),
    multiValueRemove: (styles: any) => ({
      ...styles,
      backgroundColor: '#00FF00',
    }),
    noOptionsMessage: (styles: any) => ({
      ...styles,
      backgroundColor: '#00FF00',
    }),
    placeholder: (styles: any) => ({
      ...styles,
      color: NP_THEME.base.textColor,
      fontSize: '0.8rem',
      backgroundColor: NP_THEME.base.backgroundColor,
    }),
    singleValue: (styles: any, { data }: { data: OptionType }) => ({
      ...styles,
      marginTop: 2,
      color: NP_THEME.base.textColor,
      ...(data.isModified ? dot(NP_THEME.base.tintColor) : {}),
      display: 'flex',
      alignItems: 'center',
      ':before': {
        content: '" "',
        display: 'inline-block',
        width: '10px', // Same width as the dot
        height: '10px', // Same height as the dot
        marginRight: '8px',
        backgroundColor: data.isModified ? NP_THEME.base.tintColor : 'transparent',
        borderRadius: '50%',
      },
    }),
    option: (styles: any, { isDisabled, isSelected }: { isDisabled: boolean, isSelected: boolean }) => {
      // Note: wrapping the option will be updated later in the component
      return {
        ...styles,
        ...menuStyles,
        fontSize: '0.8rem',
        cursor: isDisabled ? 'not-allowed' : 'default',
        ':hover': {
          ...styles[':hover'],
          ...menuStyles.hover,
        },
        ':active': {
          ...styles[':active'],
          backgroundColor: !isDisabled ? (isSelected ? bgColor.css() : bgColor.alpha(0.3).css()) : undefined,
        },
      }
    },
  }

  /**
   * Normalizes an option to ensure it is in { label, value } format.
   *
   * @param {OptionType|string} option - The option to normalize.
   * @returns {OptionType} The normalized option.
   */
  const normalizeOption = (option: OptionType | string) => {
    return typeof option === 'string' ? { label: option, value: option } : option
  }

  // Normalize options to ensure they are in { label, value } format
  const normalizedOptions = options.map((option) => normalizeOption(option))

  /**
   * Finds an option in the options list.
   *
   * @param {OptionType|string} option - The option to find.
   * @returns {OptionType|undefined} The found option or undefined.
   */
  const findOption = (option: OptionType | string) => {
    return option ? normalizedOptions.find((opt) => opt.value === (typeof option === 'string' ? option : option.value)) : undefined
  }

  const defaultValue = value ? findOption(value) : undefined
  if (value && !defaultValue) {
    const optionToAdd = normalizeOption(value)
    normalizedOptions.unshift(optionToAdd)
  }

  if (noWrapOptions) {
    defaultStyles.option = (provided: any) => ({
      ...provided,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    })
  }

  // Focus the input when the component mounts if focus is true
  useEffect(() => {
    if (focus && !wasFocused && inputRef?.current) {
      inputRef.current.focus()
      setWasFocused(true)
    }
  }, [focus, inputRef])

  // Merge custom styles with default styles
  const mergedStyles = {
    ...defaultStyles,
    container: (base: any) => ({
      ...defaultStyles.container(base),
      ...style.container,
    }),
    control: (base: any) => ({
      ...defaultStyles.control(base),
      ...style.control,
    }),
    // Add other style functions as needed
  }

  return (
    <div className={`${disabled ? 'disabled' : ''} ${compactDisplay ? 'input-box-container-compact' : 'input-box-container'}`}>
      {label && (
        <label
          className="input-box-label"
          style={{
            display: 'inline-block',
            verticalAlign: 'middle',
            marginRight: compactDisplay ? '10px' : '0',
            marginBottom: compactDisplay ? '0' : '5px',
            ...style.label, // Allow overriding label styles
          }}
        >
          {label}
        </label>
      )}
      <div
        className="input-box-wrapper"
        style={{
          display: 'inline-block',
          verticalAlign: 'middle',
          width: compactDisplay ? 'auto' : '100%',
          ...style.container, // Allow overriding container styles
        }}
      >
        <Select
          options={normalizedOptions}
          onSelect={onSelect}
          onChange={onChange}
          value={value ? findOption(value) : undefined}
          defaultValue={value ? findOption(value) : undefined}
          styles={mergedStyles}
          autosize={true}
          isDisabled={disabled}
          ref={inputRef}
        />
      </div>
    </div>
  )
}

export default ThemedSelect
