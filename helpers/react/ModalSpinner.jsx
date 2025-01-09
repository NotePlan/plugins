// @flow
import React, { type Node } from 'react'
import Modal from './Modal'
import { logDebug } from '@helpers/react/reactDev'

/**
 * Props for ModalSpinner component
 * @typedef {Object} Props
 * @property {() => void} [onClose] - Optional function to close the modal
 * @property {string} [textAbove] - Optional text to display above the spinner
 * @property {string} [textBelow] - Optional text to display below the spinner
 * @property {Object} [style] - Optional style object to apply to the spinner container and text
 * @property {Object} [style.container] - Style for the spinner container
 * @property {Object} [style.textAbove] - Style for the text above the spinner
 * @property {Object} [style.textBelow] - Style for the text below the spinner
 */

/**
 * ModalSpinner component to display a large spinner icon in a modal dialog
 * @param {Props} props - Component props
 * @returns {Node} Rendered component
 */
function ModalSpinner({
  onClose,
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
  const handleClose = onClose || (() => {})

  logDebug('ModalSpinner', 'Rendering modal spinner')
  return (
    <Modal onClose={handleClose}>
      <div style={{ textAlign: 'center', marginTop: '50px', ...style.container }}>
        {textAbove && (
          <div className="spinner-text-above" style={style.textAbove}>
            {textAbove}
          </div>
        )}
        <i className="fa fa-spinner fa-spin fa-5x" style={style.spinner} />
        {textBelow && (
          <div className="spinner-text-below" style={style.textBelow}>
            {textBelow}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default ModalSpinner
