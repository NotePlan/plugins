// @flow
// This component is a demo for adding tooltips to native HTML <dialog> component.
// Creates a backdrop for a modal dialog, and calls onClose() when user clicks outside the dialog or presses ESC
// Assumes that the modal content div is passed as children
// The children are given an automatic z-index of 101 (to be above the backdrop)

import React, { useState } from 'react'
import { logDebug } from '@helpers/react/reactDev'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard'

/**
 * Props for ModalWithTooltip component
 * @property {function?} onClose - Function to close the modal
 * @property {string?} tooltipText
 * @property {string?} tooltipTextCmdModifier
 */
export type Props = {
  onClose?: () => void,
  tooltipTextNoModifier?: string,
  tooltipTextCmdModifier?: string,
}

/**
 * Modal component to display content in a modal dialog
 * @param {Props} props - Component props
 * @returns {Node} Rendered component
 */
function ModalWithTooltip({
  onClose,
  tooltipTextNoModifier = 'This is the tooltip!',
  tooltipTextCmdModifier = 'This is the tooltip with ⌘ key!'
}: Props): React$Node {
  const [isTooltipVisible, setTooltipVisible] = useState(false)
  const [tooltipText, setTooltipText] = useState(tooltipTextNoModifier)

  const handleMouseOver = (event: MouseEvent) => {
    const { metaKey: isMetaKey, shiftKey: isShiftKey, ctrlKey: isCtrlKey, altKey: isAltKey, hasModifier } = extractModifierKeys(event)
    if (isMetaKey && metaKey) {
      setTooltipText(tooltipTextCmdModifier)
    } else {
      setTooltipText(tooltipTextNoModifier)
    }
    setTooltipVisible(true)
  }

  const handleMouseOut = () => {
    setTooltipVisible(false)
  }

  return (
    <dialog open>
      <form method="dialog">
        <p>This is a modal dialog demo.</p>
        <button
          onMouseOver={handleMouseOver}
          onMouseOut={handleMouseOut}
        >
          Hover over me!
        </button>
        {isTooltipVisible && (
          <div className="tooltip">
            {tooltipText}
          </div>
        )}
        <menu>
          <button type="submit">Close</button>
        </menu>
      </form>
    </dialog>
  )
}

export default ModalWithTooltip
