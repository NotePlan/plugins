/* global Select */
// import {Select} from 'react-select'
// TODO: use style classes from @jgclark CSS embedded in the HTML

/* NOTES:
  // Styles: https://react-select.com/styles
  // overriding the whole theme: https://react-select.com/styles#overriding-the-theme
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

const dot = (color = 'transparent') => ({
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

//TODO: can probably get rid of Chroma, but they use it in the Select docs: https://www.npmjs.com/package/chroma-js
const colourStyles: StylesConfig<ColourOption> = {
  container: (styles) => ({ ...styles, width: '100%' }),
  control: (styles) => ({ ...styles, backgroundColor: 'white', color: 'black' }),
  option: (styles, { data, isDisabled, isFocused, isSelected }) => {
    const color = chroma(data.color || '#00B8D9') //TODO: replace default color with a theme color (where to get it though?)
    return {
      ...styles,
      backgroundColor: isDisabled ? undefined : isSelected ? data.color : isFocused ? color.alpha(0.1).css() : undefined,
      color: isDisabled ? '#ccc' : isSelected ? (chroma.contrast(color, 'white') > 2 ? 'white' : 'black') : data.color,
      cursor: isDisabled ? 'not-allowed' : 'default',

      ':active': {
        ...styles[':active'],
        backgroundColor: !isDisabled ? (isSelected ? data.color : color.alpha(0.3).css()) : undefined,
      },
    }
  },
  input: (styles) => ({ ...styles, ...dot() }),
  placeholder: (styles) => ({ ...styles, ...dot('#ccc') }),
  singleValue: (styles, { data }) => ({ ...styles, ...dot(data.color) }),
}

function ThemedSelect(props) {
  const { options, onSelect, onChange } = props
  return <Select options={props.options} onSelect={props.onSelect} styles={colourStyles} menuPortalTarget={document.body} autosize={true} onChange={onChange} />
}
