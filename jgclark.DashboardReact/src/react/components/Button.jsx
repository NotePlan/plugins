// @flow
import React from 'react'

type Props = {
  text: string,
  onClick: () => void,
};

/**
 * A reusable button component.
 */
const Button = ({ text, onClick }: Props):React$Node => (
  <button onClick={onClick}>{text}</button>
)

export default Button
