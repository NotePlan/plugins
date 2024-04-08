// @flow
import React from 'react'

type ButtonProps = {
  text: string,
  className?: string,
  clickHandler: () => void,
}

/**
 * A reusable button component.
 */
function Button(props: ButtonProps): React$Node {
  const { text, clickHandler, className } = props
  return (
    <button onClick={clickHandler} className={className}>
      {text}
    </button>
  )
}

export default Button