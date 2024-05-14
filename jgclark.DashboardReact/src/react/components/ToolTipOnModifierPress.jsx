// TooltipOnKeyPress.jsx
// Show a tooltip on modifier key press
// TODO: figure out if it's possible for the window to receive focus so this works without clicking
// @flow

import React, { useState, useEffect, useRef } from 'react'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard'
import { logDebug } from '@helpers/react/reactDev'

/**
 * Props for TooltipOnKeyPress component.
 * @typedef {Object} TooltipProps
 * @property {Object} [metaKey] - Configuration for the meta key.
 * @property {React.Node} metaKey.text - Text to display for meta key.
 * @property {React.CSSProperties} [metaKey.style] - Style for meta key.
 * @property {Object} [shiftKey] - Configuration for the shift key.
 * @property {React.Node} shiftKey.text - Text to display for shift key.
 * @property {React.CSSProperties} [shiftKey.style] - Style for shift key.
 * @property {Object} [ctrlKey] - Configuration for the ctrl key.
 * @property {React.Node} ctrlKey.text - Text to display for ctrl key.
 * @property {React.CSSProperties} [ctrlKey.style] - Style for ctrl key.
 * @property {Object} [altKey] - Configuration for the alt key.
 * @property {React.Node} altKey.text - Text to display for alt key.
 * @property {React.CSSProperties} [altKey.style] - Style for alt key.
 * @property {number} [disappearAfter] - Time in milliseconds after which the tooltip disappears.
 */

type TooltipProps = {
  metaKey?: {
    text: React$Node,
    style?: { [string]: string | number },
  },
  shiftKey?: {
    text: React$Node,
    style?: { [string]: string | number },
  },
  ctrlKey?: {
    text: React$Node,
    style?: { [string]: string | number },
  },
  altKey?: {
    text: React$Node,
    style?: { [string]: string | number },
  },
  disappearAfter?: number, // ms
};

/**
 * TooltipOnKeyPress component displays a tooltip when specific modifier keys are pressed.
 *
 * @component
 * @example
 * // Example usage:
 * const metaKeyConfig = { text: 'Meta Key Pressed', style: { color: 'red' } };
 * const shiftKeyConfig = { text: 'Shift Key Pressed', style: { color: 'blue' } };
 * const ctrlKeyConfig = { text: 'Ctrl Key Pressed', style: { color: 'green' } };
 * const altKeyConfig = { text: 'Alt Key Pressed', style: { color: 'yellow' } };
 * 
 * <TooltipOnKeyPress
 *   metaKey={metaKeyConfig}
 *   shiftKey={shiftKeyConfig}
 *   ctrlKey={ctrlKeyConfig}
 *   altKey={altKeyConfig}
 *   disappearAfter={3000} // ms
 * />
 */
const TooltipOnKeyPress = ({
  metaKey,
  shiftKey,
  ctrlKey,
  altKey,
  disappearAfter = 0,
}: TooltipProps): React$Node => {
  if (!metaKey && !shiftKey && !ctrlKey && !altKey) {
    console.error('TooltipOnKeyPress requires at least one of metaKey, shiftKey, ctrlKey, or altKey to be set.')
  }

  const [tooltipState, setTooltipState] = useState<{
    x: number,
    y: number,
    visible: boolean,
    text: React$Node | null,
    style: { [string]: string | number },
  }>({
    x: 0,
    y: 0,
    visible: false,
    text: null,
    style: {},
  })

  const [mousePosition, setMousePosition] = useState<{ x: number, y: number }>({ x: 0, y: 0 })
  const timeoutRef = useRef<?TimeoutID>(null)

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setMousePosition({ x: event.clientX, y: event.clientY })
      if (tooltipState.visible) {
        setTooltipState((prevState) => ({ ...prevState, x: event.clientX, y: event.clientY }))
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const { metaKey: isMetaKey, shiftKey: isShiftKey, ctrlKey: isCtrlKey, altKey: isAltKey, hasModifier } = extractModifierKeys(event)

      if (hasModifier) {
        let text = null
        let style = {}

        if (isMetaKey && metaKey) {
          text = metaKey.text
          style = metaKey.style || {}
        } else if (isShiftKey && shiftKey) {
          text = shiftKey.text
          style = shiftKey.style || {}
        } else if (isCtrlKey && ctrlKey) {
          text = ctrlKey.text
          style = ctrlKey.style || {}
        } else if (isAltKey && altKey) {
          text = altKey.text
          style = altKey.style || {}
        }

        setTooltipState({ x: mousePosition.x, y: mousePosition.y, visible: true, text, style })

        if (disappearAfter > 0) {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
          }
          timeoutRef.current = setTimeout(() => {
            setTooltipState((prevState) => ({ ...prevState, visible: false }))
            timeoutRef.current = null
          }, disappearAfter)
        }
      }
    }

    const handleKeyUp = () => {
      setTooltipState((prevState) => ({ ...prevState, visible: false }))
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [metaKey, shiftKey, ctrlKey, altKey, mousePosition, disappearAfter])

  // $FlowFixMe[cannot-spread-indexer]
  const combinedStyle = {
    position: 'absolute',
    left: tooltipState.x,
    top: tooltipState.y,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '4px',
    ...tooltipState.style, // spreading the style last
  }

  return (
    <>
      {tooltipState.visible && (
        <div style={combinedStyle}>
          {tooltipState.text}
        </div>
      )}
    </>
  )
}

export default TooltipOnKeyPress
