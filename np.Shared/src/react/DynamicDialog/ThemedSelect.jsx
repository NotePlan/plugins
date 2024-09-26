// @flow
import React from 'react'
import Select from 'react-select'
import chroma from 'chroma-js'
import { logDebug, clo } from '@helpers/react/reactDev'

declare var NP_THEME: any

export type OptionType = { label: string, value: string, id?: number }

// TODO: use style classes from @jgclark CSS embedded in the HTML

/* NOTES:
  // Styles: https://react-select.com/styles
  // overriding the whole theme: https://react-select.com/styles#overriding-the-theme
  chroma: https://gka.github.io/chroma.js/
*/

/* NP_THEME
    "base": {
        "backgroundColor": "#1D1E1F",
        "textColor": "#DAE3E8",
        "h1": "#CC6666",
        "h2": "#E9C062",
        "h3": "#E9C062",
        "h4": "#E9C062",
        "tintColor": "#E9C0A2",
        "altColor": "#2E2F30"
    }
*/
// This worked but was basic so I am replacing it with below. delete this when it all works.
// const customStyles = {
//     container: (provided) => ({
//       ...provided,
//       width: '100%',
//     }),
//     option: (provided) => ({
//       ...provided,
//       color: 'black',
//     }),
//     control: (provided) => ({
//       ...provided,
//       color: 'black',
//     }),
//     singleValue: (provided) => ({
//       ...provided,
//       color: 'black',
//     }),
//   }

/*
 *
 Option styling... simplifying for now, but ultimately we can go back and customize like this:
  https://react-select.com/styles (see "Customized Styles for a Single Select")

   option: (styles, { data, isDisabled, isFocused, isSelected }) => {
    const color = chroma(data.color);
    return {
      ...styles,
      backgroundColor: isDisabled
        ? undefined
        : isSelected
        ? data.color
        : isFocused
        ? color.alpha(0.1).css()
        : undefined,
      color: isDisabled
        ? '#ccc'
        : isSelected
        ? chroma.contrast(color, 'white') > 2
          ? 'white'
          : 'black'
        : data.color,
      cursor: isDisabled ? 'not-allowed' : 'default',

      ':active': {
        ...styles[':active'],
        backgroundColor: !isDisabled
          ? isSelected
            ? data.color
            : color.alpha(0.3).css()
          : undefined,
      },
    };

 */

// NOTE: This theme calculating is not working by itself, so most of it is ignored and using the specific item overrides below.
// Maybe come back to this theme stuff later, but I'm not sure it's worth it.
// const primary = { primary: NP_THEME.base.textColor }
// const primaries = [25, 50, 75].reduce((acc, opacity) => {
//   acc[`primary${opacity}`] = chroma(primary.primary)
//     .alpha(opacity / 100)
//     .css()
//   return acc
// }, primary)
// const neutralScale = chroma.scale([NP_THEME.base.backgroundColor, NP_THEME.base.altColor]).mode('lch').colors(11)
// const neutrals = [0, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90].reduce((acc, scale, i) => {
//   acc[`neutral${scale}`] = chroma(neutralScale[i]).css()
//   return acc
// }, {})
// const theme = (theme) => {
//   return {
//     ...theme,
//     borderRadius: '10px',
//     colors: {
//       ...primaries,
//       ...neutrals,
//     },
//   }
// }

/* React Select's inner components
    clearIndicator
    container - size of the control, but colors don't seem to do anything
    control - color of the entire select box before dropped down
    dropdownIndicator
    group
    groupHeading
    indicatorsContainer
    indicatorSeparator
    input
    loadingIndicator
    loadingMessage
    menu
    menuList
    menuPortal
    multiValue
    multiValueLabel
    multiValueRemove
    noOptionsMessage
    option -- the options in the dropdown, background and text color
    placeholder -- just the text and part of the background of the control on load - does not contain the padding
    singleValue - the selected text and background of part of the control after selection
    valueContainer  -- the left 7/8 of the selected item in the control 
*/

/* the dot is the little coloured circle next to the selected value */
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
 * Calculate a lightly-offset altColor based on the background color
 * Useful for striped rows (default) and highlight on hover
 * @param {string} bgColor
 * @param {number} strength - 0-1 (default 0.2)
 * @returns
 */
const getAltColor = (bgColor: string, strength: number = 0.2) => {
  const calcAltFromBGColor = isLight(bgColor) ? chroma(bgColor).darken(strength).css() : chroma(bgColor).brighten(strength).css()
  // if (!altColor || chroma.deltaE(bgColor,altColor) < ) return calcAltFromBGColor
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
const bOrW = chroma.contrast(bgColor, 'white') > 2 ? 'white' : 'black'
const lighterBG = chroma.average([NP_THEME.base.backgroundColor, NP_THEME.base.altColor, bOrW]).css()
// const mixedBG = chroma.mix(NP_THEME.base.backgroundColor, NP_THEME.base.altColor).css()
const colourStyles = {
  /* size of the control, but colors don't seem to do anything */
  clearIndicator: (styles: any) => ({ ...styles, color: '#00FF00' }),
  // clearIndicator: (styles:any) => ({ ...styles, color: '#00FF00' }),

  container: (styles: any) => ({ ...styles, width: '100%', backgroundColor: NP_THEME.base.backgroundColor, color: NP_THEME.base.textColor, borderRadius: 5 }),
  /* color of the entire select box before dropped down */
  control: (styles: any) => ({
    ...styles,
    backgroundColor: NP_THEME.base.backgroundColor ?? 'white',
    color: NP_THEME.base.textColor ?? 'black',
    /* border around the dropdown */
    borderColor: chroma('white').alpha(0.25).css(),
  }),
  dropdownIndicator: (styles: any) => ({ ...styles, color: NP_THEME.base.textColor }),
  group: (styles: any) => ({ ...styles, color: '#00FF00' }),
  groupHeading: (styles: any) => ({ ...styles, color: '#00FF00' }),
  indicatorsContainer: (styles: any) => ({ ...styles, color: '#00FF00' }),
  indicatorSeparator: (styles: any) => ({ ...styles, color: '#00FF00' }),
  /* seems to be part of the placeholder and also after selection, the following styles are applied */
  /* strange that sometimes the dot shows up after selection and sometimes it doesn't */
  input: (styles: any) => ({ ...styles, color: NP_THEME.base.textColor }),
  /* just the text and part of the background of the control on load - does not contain the padding */
  // placeholder: (styles:any) => ({ ...styles, ...dot(NP_THEME.base.tintColor), color: NP_THEME.base.textColor, fontSize: '0.8rem' }),
  loadingIndicator: (styles: any) => ({ ...styles, color: '#00FF00' }),
  loadingMessage: (styles: any) => ({ ...styles, color: '#00FF00' }),
  menu: (styles: any) => ({ ...styles, backgroundColor: lighterBG }),
  menuList: (styles: any) => ({ ...styles, backgroundColor: lighterBG }),
  menuPortal: (styles: any) => ({ ...styles, backgroundColor: '#00FF00' }),
  multiValue: (styles: any) => ({ ...styles, backgroundColor: '#00FF00' }),
  multiValueLabel: (styles: any) => ({ ...styles, backgroundColor: '#00FF00' }),
  multiValueRemove: (styles: any) => ({ ...styles, backgroundColor: '#00FF00' }),
  noOptionsMessage: (styles: any) => ({ ...styles, backgroundColor: '#00FF00' }),
  placeholder: (styles: any) => ({ ...styles, color: NP_THEME.base.textColor, fontSize: '0.8rem', backgroundColor: NP_THEME.base.backgroundColor }),
  /* singleValue is the selected value */
  // singleValue: (styles, { data }) => ({ ...styles, color: NP_THEME.base.textColor, ...dot(NP_THEME.base.tintColor) }),
  singleValue: (styles: any) => ({ ...styles, ...menuStyles.base, ...dot(NP_THEME.base.tintColor) }),
  // tester: (styles:any) => ({ ...styles, backgroundColor: 'green', color: 'red' }),
  /* the options in the dropdown, background and text color */
  // option: (styles:any) => ({ ...styles, backgroundColor: NP_THEME.base.backgroundColor, color: NP_THEME.base.textColor ?? 'black' }),
  // option: (styles, { data, isDisabled, isFocused, isSelected }) => {
  // $FlowIgnore
  option: (styles: any, { isDisabled, isSelected }) => {
    // console.log('option', styles, data, isDisabled, isFocused, isSelected)
    return {
      ...styles,
      // backgroundColor: isDisabled ? undefined : isSelected ? bgColor.css() : isFocused ? bgColor.alpha(0.1).css() : bgColor.css(),
      ...menuStyles.base,
      // borderTop: `1px solid ${mixedBG}`,
      fontSize: '0.8rem',
      // color: isDisabled ? '#ccc' : isSelected ? (chroma.contrast(bgColor, 'white') > 2 ? 'white' : 'black') : NP_THEME.base.textColor,
      cursor: isDisabled ? 'not-allowed' : 'default',
      ':hover': {
        ...styles[':hover'],
        ...menuStyles.hover,
        // backgroundColor: !isDisabled ? (isSelected ? bgColor.lighten().css() : bgColor.alpha(0.3).css()) : undefined,
      },
      ':active': {
        ...styles[':active'],
        backgroundColor: !isDisabled ? (isSelected ? bgColor.css() : bgColor.alpha(0.3).css()) : undefined,
      },
    }
  },
  // square box around the text part of the control when closed
  // valueContainer: (styles:any) => ({ ...styles, backgroundColor: '#FF0000' }),
}

type Props = {
  options: Array<OptionType>,
  onSelect?: Function,
  onChange?: Function,
  defaultValue?: OptionType,
  id?: string,
}
export function ThemedSelect(props: Props): any {
  const { options, onSelect, onChange, defaultValue } = props
  clo(props, `ThemedSelect props`)
  return (
    <Select
      options={options}
      onSelect={onSelect}
      /* theme={theme} */
      styles={colourStyles}
      menuPortalTarget={document.body}
      autosize={true}
      onChange={onChange}
      defaultValue={defaultValue}
    />
  )
}

export default ThemedSelect
