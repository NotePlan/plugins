// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show an HTML ComboBox control, with various possible settings.
// Author: @dwertheimer
// Author: @jgclark, 2024-07-29 made a @helper/react function
// Last updated 2024-07-29 for Dashboard 2.0.x by @jgclark
//--------------------------------------------------------------------------

// TODO: What we don't have is a useful 'gentle red' for warnings, and 'gentle green' for a positive indicator. I think I'll need to find a way to do that, perhaps with this chroma library(which I've read but not used).

// Note: To see this in action in the original place:
// noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskAutomations&command=Process%20Overdue%20Items%20in%20a%20Separate%20Window

import React from 'react'
import Select from 'react-select'
import chroma from 'chroma-js'
// import { menuStyles } from './dataTableFormatting.jsx'

declare var NP_THEME: any

type StyleObject = { [key: string]: mixed }

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
const bgColor = chroma(NP_THEME.base.backgroundColor)
const bOrW = chroma.contrast(bgColor, 'white') > 2 ? 'white' : 'black'
const lighterBG = chroma.average([NP_THEME.base.backgroundColor, NP_THEME.base.altColor, bOrW]).css()
// const mixedBG = chroma.mix(NP_THEME.base.backgroundColor, NP_THEME.base.altColor).css()
const colourStyles = {
  /* size of the control, but colors don't seem to do anything */
  clearIndicator: (styles: StyleObject) => ({ ...styles, color: '#00FF00' }),
  // clearIndicator: (styles: StyleObject) => ({ ...styles, color: '#00FF00' }),

  container: (styles: StyleObject) => ({ ...styles, width: '100%', backgroundColor: NP_THEME.base.backgroundColor, color: NP_THEME.base.textColor, borderRadius: 5 }),
  /* color of the entire select box before dropped down */
  control: (styles: StyleObject) => ({
    ...styles,
    backgroundColor: NP_THEME.base.backgroundColor ?? 'white',
    color: NP_THEME.base.textColor ?? 'black',
    /* border around the dropdown */
    borderColor: chroma('white').alpha(0.25).css(),
  }),
  dropdownIndicator: (styles: StyleObject) => ({ ...styles, color: NP_THEME.base.textColor }),
  group: (styles: StyleObject) => ({ ...styles, color: '#00FF00' }),
  groupHeading: (styles: StyleObject) => ({ ...styles, color: '#00FF00' }),
  indicatorsContainer: (styles: StyleObject) => ({ ...styles, color: '#00FF00', padding: '2px' }),
  indicatorSeparator: (styles: StyleObject) => ({ ...styles, color: '#00FF00' }),
  /* seems to be part of the placeholder and also after selection, the following styles are applied */
  /* strange that sometimes the dot shows up after selection and sometimes it doesn't */
  input: (styles: StyleObject) => ({ ...styles, color: NP_THEME.base.textColor }),
  /* just the text and part of the background of the control on load - does not contain the padding */
  // placeholder: (styles: StyleObject) => ({ ...styles, ...dot(NP_THEME.base.tintColor), color: NP_THEME.base.textColor, fontSize: '0.8rem' }),
  loadingIndicator: (styles: StyleObject) => ({ ...styles, color: '#00FF00' }),
  loadingMessage: (styles: StyleObject) => ({ ...styles, color: '#00FF00' }),
  menu: (styles: StyleObject) => ({ ...styles, backgroundColor: lighterBG }),
  menuList: (styles: StyleObject) => ({ ...styles, backgroundColor: lighterBG }),
  menuPortal: (styles: StyleObject) => ({ ...styles, backgroundColor: '#00FF00' }),
  multiValue: (styles: StyleObject) => ({ ...styles, backgroundColor: '#00FF00' }),
  multiValueLabel: (styles: StyleObject) => ({ ...styles, backgroundColor: '#00FF00' }),
  multiValueRemove: (styles: StyleObject) => ({ ...styles, backgroundColor: '#00FF00' }),
  noOptionsMessage: (styles: StyleObject) => ({ ...styles, backgroundColor: '#00FF00' }),
  placeholder: (styles: StyleObject) => ({ ...styles, color: NP_THEME.base.textColor, fontSize: '0.8rem', backgroundColor: NP_THEME.base.backgroundColor }),
  /* singleValue is the selected value */
  // singleValue: (styles, { data }) => ({ ...styles, color: NP_THEME.base.textColor, ...dot(NP_THEME.base.tintColor) }),
  // singleValue: (styles: StyleObject) => ({ ...styles, ...menuStyles.base, ...dot(NP_THEME.base.tintColor) }),
  singleValue: (styles: StyleObject) => ({ ...styles, ...dot(NP_THEME.base.tintColor) }),
  // tester: (styles: StyleObject) => ({ ...styles, backgroundColor: 'green', color: 'red' }),
  /* the options in the dropdown, background and text color */
  // option: (styles: StyleObject) => ({ ...styles, backgroundColor: NP_THEME.base.backgroundColor, color: NP_THEME.base.textColor ?? 'black' }),
  // option: (styles, { data, isDisabled, isFocused, isSelected }) => {
  option: (styles: StyleObject, { isDisabled, isSelected }) => {
    return {
      ...styles,
      // backgroundColor: isDisabled ? undefined : isSelected ? bgColor.css() : isFocused ? bgColor.alpha(0.1).css() : bgColor.css(),
      // ...menuStyles.base,
      // borderTop: `1px solid ${mixedBG}`,
      fontSize: '0.92rem',
      // color: isDisabled ? '#ccc' : isSelected ? (chroma.contrast(bgColor, 'white') > 2 ? 'white' : 'black') : NP_THEME.base.textColor,
      cursor: isDisabled ? 'not-allowed' : 'default',
      ':hover': {
        ...styles[':hover'],
        // ...menuStyles.hover,
        // backgroundColor: !isDisabled ? (isSelected ? bgColor.lighten().css() : bgColor.alpha(0.3).css()) : undefined,
      },
      ':active': {
        ...styles[':active'],
        backgroundColor: !isDisabled ? (isSelected ? bgColor.css() : bgColor.alpha(0.3).css()) : undefined,
      },
    }
  },
  // square box around the text part of the control when closed
  // valueContainer: (styles: StyleObject) => ({ ...styles, backgroundColor: '#FF0000' }),
}

type Props = {
  options: Array<OptionType>,
  onSelect?: Function,
  onChange?: Function,
  defaultValue?: OptionType,
  // id: string, // TEST: what was this doing?
}
export function ThemedSelect(props: Props): any {
  const { options, onSelect, onChange, defaultValue } = props
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
