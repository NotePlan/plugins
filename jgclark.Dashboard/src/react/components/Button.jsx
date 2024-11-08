// @flow
import React from 'react'

type ButtonProps = {
  text: string | React$Node,
  className?: string,
  clickHandler: () => void,
  disabled: boolean
}

/**
 * A reusable button component.
 */
function Button(props: ButtonProps): React$Node {
  const { text, clickHandler, className, disabled } = props
  return (
    <button onClick={clickHandler} className={className} disabled={disabled}>
      {text}
    </button>
  )
}

export default Button
