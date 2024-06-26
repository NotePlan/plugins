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
const EditableInputBox: React$AbstractComponent<Props, RefType> = React.forwardRef<Props, RefType>((props, ref): React.Element<'input'> => {
  const [inputValue, setInputValue] = React.useState(props.initialValue || '')
  const useTextArea = props.useTextArea || false

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

  // Ensuring useImperativeHandle uses the correct type
  React.useImperativeHandle(ref, () => ({
    getValue: () => inputValue,
  }))

  return useTextArea ? (
    <textarea type="text" className={`${props.className || ''} fullTextArea`} value={inputValue} onChange={handleChange} />
  ) : (
    <input type="text" className={props.className || ''} value={inputValue} onChange={handleChange} />
  )
})

EditableInputBox.displayName = 'EditableInputBox' // Setting display name for the component

export default EditableInputBox
