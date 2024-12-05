// @flow
import * as React from 'react'

type Props = {
  /** The initial value for the input box, defaults to an empty string if not provided. */
  initialValue?: string,
  /** Optional CSS class for custom styling of the input box. */
  className?: string,
  /** Optional onChange handler that provides the current value to the parent component whenever it changes. */
  onChange?: (value: string) => void,
  useTextArea?: boolean,
  placeholder?: string,
}

type RefType = {
  /** Method to retrieve the current value of the input. */
  getValue: () => string,
}

/**
 * EditableInputBox is a reusable component that renders an editable text input.
 * It allows for external retrieval of its state via a ref and can notify parent components of changes.
 *
 * Props:
 * - `initialValue`: Optional. The text to display initially in the input field. Defaults to an empty string.
 * - `className`: Optional. A CSS class for styling the component.
 * - `onChange`: Optional. A function that is called whenever the input value changes.
 *
 * Ref Methods:
 * - `getValue`: Returns the current text value of the input.
 */
const EditableInputBox: React$AbstractComponent<Props, RefType> = React.forwardRef<Props, RefType>((props, ref) => {
  const [inputValue, setInputValue] = React.useState(props.initialValue || '')
  const useTextArea = props.useTextArea || false
  const divRef = React.useRef<HTMLDivElement | null>(null)

  // Effect to update state if initialValue prop changes
  React.useEffect(() => {
    setInputValue(props.initialValue || '')
  }, [props.initialValue])

  const handleChange = (event: SyntheticInputEvent<HTMLInputElement>) => {
    const newValue = event.target.value
    setInputValue(newValue)
    if (props.onChange) {
      props.onChange(newValue)
    }
  }

  const handleDivInput = () => {
    const newValue = divRef.current ? divRef.current.textContent || '' : ''
    setInputValue(newValue)
    if (props.onChange) {
      props.onChange(newValue)
    }
  }

  const handleBlur = () => {
    if (divRef.current && !divRef.current.textContent) {
      divRef.current.innerHTML = `<span class="placeholder">${props.placeholder || ''}</span>`
    }
  }

  const handleFocus = () => {
    if (divRef.current && divRef.current.querySelector('.placeholder')) {
      divRef.current.innerHTML = ''
    }
  }

  React.useImperativeHandle(ref, () => ({
    getValue: () => inputValue,
  }))

  React.useEffect(() => {
    if (useTextArea && divRef.current) {
      if (!inputValue) {
        divRef.current.innerHTML = `<span class="placeholder">${props.placeholder || ''}</span>`
      } else if (divRef.current.textContent !== inputValue) {
        divRef.current.textContent = inputValue
      }
    }
  }, [inputValue, useTextArea, props.placeholder])

  return useTextArea ? (
    <div ref={divRef} contentEditable className={`${props.className || ''} fullTextArea`} onInput={handleDivInput} onBlur={handleBlur} onFocus={handleFocus} />
  ) : (
    <input type="text" className={props.className || ''} value={inputValue} onChange={handleChange} />
  )
})

EditableInputBox.displayName = 'EditableInputBox' // Setting display name for the component

export default EditableInputBox
