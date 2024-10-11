// @flow
import React, { useEffect, useState } from 'react'
import Select from 'react-select'
import chroma from 'chroma-js'
import { logDebug, clo } from '@helpers/react/reactDev'

declare var NP_THEME: any

export type OptionType = { label: string, value: string, id?: number }

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

const colourStyles = {
  clearIndicator: (styles: any) => ({ ...styles, color: '#00FF00' }),
  container: (styles: any) => ({ ...styles, width: '100%', backgroundColor: NP_THEME.base.backgroundColor, color: NP_THEME.base.textColor, borderRadius: 5 }),
  control: (styles: any) => ({
    ...styles,
    backgroundColor: NP_THEME.base.backgroundColor ?? 'white',
    color: NP_THEME.base.textColor ?? 'black',
    borderColor: chroma('white').alpha(0.25).css(),
  }),
  dropdownIndicator: (styles: any) => ({ ...styles, color: NP_THEME.base.textColor }),
  group: (styles: any) => ({ ...styles, color: '#00FF00' }),
  groupHeading: (styles: any) => ({ ...styles, color: '#00FF00' }),
  indicatorsContainer: (styles: any) => ({ ...styles, color: '#00FF00' }),
  indicatorSeparator: (styles: any) => ({ ...styles, color: '#00FF00' }),
  input: (styles: any) => ({ ...styles, color: NP_THEME.base.textColor }),
  loadingIndicator: (styles: any) => ({ ...styles, color: '#00FF00' }),
  loadingMessage: (styles: any) => ({ ...styles, color: '#00FF00' }),
  menu: (styles: any) => ({ ...styles, backgroundColor: NP_THEME.base.backgroundColor ?? 'white' }),
  menuList: (styles: any) => ({ ...styles, backgroundColor: NP_THEME.base.backgroundColor ?? 'white' }),
  menuPortal: (styles: any) => ({ ...styles, backgroundColor: '#00FF00' }),
  multiValue: (styles: any) => ({ ...styles, backgroundColor: '#00FF00' }),
  multiValueLabel: (styles: any) => ({ ...styles, backgroundColor: '#00FF00' }),
  multiValueRemove: (styles: any) => ({ ...styles, backgroundColor: '#00FF00' }),
  noOptionsMessage: (styles: any) => ({ ...styles, backgroundColor: '#00FF00' }),
  placeholder: (styles: any) => ({ ...styles, color: NP_THEME.base.textColor, fontSize: '0.8rem', backgroundColor: NP_THEME.base.backgroundColor }),
  singleValue: (styles: any) => ({ ...styles, color: NP_THEME.base.textColor, ...dot(NP_THEME.base.tintColor) }),
  option: (styles: any, { isDisabled, isSelected }: { isDisabled: boolean, isSelected: boolean }) => {
    // note wrapping the option will be updated later in the component
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

type Props = {
  options: Array<OptionType | string>,
  onSelect?: Function,
  onChange?: Function,
  value?: OptionType | string, // Use value instead of defaultValue
  id?: string,
  compactDisplay?: boolean, // Add compactDisplay prop
  disabled?: boolean, // Add disabled prop
  inputRef?: { current: null | HTMLInputElement }, // Add inputRef prop
  label?: string, // Add label prop
  noWrapOptions?: boolean, // truncate, do not wrap the label
  focus?: boolean, // Add focus prop
}

export function ThemedSelect(props: Props): any {
  const { options, onSelect, onChange, value, compactDisplay, disabled, inputRef, label, noWrapOptions, focus } = props

  const [wasFocused, setWasFocused] = useState(false)

  const normalizeOption = (option: OptionType | string) => {
    return typeof option === 'string' ? { label: option, value: option } : option
  }

  // Normalize options to ensure they are in { label, value } format
  const normalizedOptions = options.map(option =>
    normalizeOption(option)
  )

  const findOption = (option: OptionType | string) => {
    return option ? normalizedOptions.find(opt => opt.value === (typeof option === 'string' ? option : option.value)) : undefined
  }

  const defaultValue = value ? findOption(value) : undefined
  if (value && !defaultValue) {
    const optionToAdd = normalizeOption(value)
    normalizedOptions.unshift(optionToAdd)
  }

  colourStyles.option =  noWrapOptions ? (provided) => ({
      ...provided,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }) : colourStyles.option

  // Focus the input when the component mounts if focus is true
  useEffect(() => {
    if (focus && !wasFocused && inputRef?.current) {
      inputRef.current.focus()
      setWasFocused(true)
    }
  }, [focus, inputRef])

  return (
    <div className={`${disabled ? 'disabled' : ''} ${compactDisplay ? 'input-box-container-compact' : 'input-box-container'}`}>
      {label && <label className="input-box-label">{label}</label>}
      <div className="input-box-wrapper">
        <Select
          options={normalizedOptions}
          onSelect={onSelect}
          onChange={onChange}
          value={value ? findOption(value) : undefined} // Use value instead of defaultValue
          defaultValue={value ? findOption(value) : undefined} // Just to be sure
          styles={colourStyles}
          autosize={true}
          isDisabled={disabled} // Use disabled prop
          ref={inputRef} // Use inputRef prop
        />
      </div>
    </div>
  )
}

export default ThemedSelect