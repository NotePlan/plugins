// @flow
import React from 'react'

type ButtonProps = {
  text: string | React$Node,
  className?: string,
  clickHandler: () => void,
  disabled: boolean,
  /** Native tooltip (e.g. for icon-only or compact controls). */
  title?: string,
}

/**
 * A reusable button component.
 */
function Button(props: ButtonProps): React$Node {
  const { text, clickHandler, className, disabled, title } = props
  return (
    <button onClick={clickHandler} className={className} disabled={disabled} title={title}>
      {text}
    </button>
  )
}

export default Button
