// @flow
import React from 'react'

type Props = {
  text: string,
  className?: string,
  clickHandler: () => void,
}

/**
 * A reusable button component.
 */
const Button = ({ text, clickHandler, className }: Props): React$Node => (
  <button onClick={clickHandler} className={className}>
    {text}
  </button>
)

export default Button
