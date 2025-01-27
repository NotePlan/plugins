// @flow
//-----------------------------------------------------------------------------
// NonModalSpinner component to display a spinner icon centred horizontally with optional text above/below
// Introduced: for v2.1.2
//-----------------------------------------------------------------------------
import React, { type Node } from 'react'
import { logDebug } from '@helpers/react/reactDev'

/**
 * Props for NonModalSpinner component
 * @typedef {Object} Props
 * @property {string} [textAbove] - Optional text to display above the spinner
 * @property {string} [textBelow] - Optional text to display below the spinner
 * @property {Object} [style] - Optional style object to apply to the spinner container and text
 * @property {Object} [style.container] - Style for the spinner container
 * @property {Object} [style.textAbove] - Style for the text above the spinner
 * @property {Object} [style.textBelow] - Style for the text below the spinner
 */

/**
 * NonModalSpinner component to display a spinner icon centred horizontally with optional text above/below
 * @param {Props} props - Component props
 * @returns {Node} Rendered component
 */
function NonModalSpinner({
  textAbove,
  textBelow,
  style = {},
}: {
  onClose?: () => void,
  textAbove?: string,
  textBelow?: string,
  style?: {
    container?: { [string]: any },
    textAbove?: { [string]: any },
    textBelow?: { [string]: any },
    spinner?: { [string]: any },
  },
}): Node {
  logDebug('NonModalSpinner', 'Rendering spinner')
  return (
    <div style={style.container}>
      {textAbove && (
        <div className="spinner-text-above" style={style.textAbove}>
          {textAbove}
        </div>
      )}
      <i className="fa fa-spinner fa-spin fa-2x" style={style.spinner} />
      {textBelow && (
        <div className="spinner-text-below" style={style.textBelow}>
          {textBelow}
        </div>
      )}
    </div>
  )
}

export default NonModalSpinner
