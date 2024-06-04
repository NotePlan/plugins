// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a tooltip on modifier key press when the mouse is within the bounds of the wrapped component.
// Called by various components to display tooltips based on modifier key presses.
// Last updated 2024-06-03 for v2.0.0 by @dwertheimer
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useState, useEffect, useRef, type ElementRef, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard'
import { logDebug } from '@helpers/react/reactDev'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------

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
 * @property {React.Node} children - Components to wrap.
 * @property {boolean} [enabled] - Whether tooltips are enabled or not.
 * @property {string} [label] - Label for debugging.
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
  children: React$Node,
  enabled?: boolean,
  label?: string, // for debugging
};

//--------------------------------------------------------------------------
// TooltipOnKeyPress Component Definition
//--------------------------------------------------------------------------

const TooltipOnKeyPress = ({
  metaKey,
  shiftKey,
  ctrlKey,
  altKey,
  disappearAfter = 0,
  children,
  enabled = true,
  /* label, */
}: TooltipProps): React$Node => {
  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------

  const [tooltipState, setTooltipState] = useState < {
    x: number,
    y: number,
    visible: boolean,
    text: React$Node | null,
    iconBounds?: ClientRect,
  } > ({
    x: 0,
    y: 0,
    visible: false,
    text: null,
    iconBounds: undefined,
  })

  const mousePositionRef = useRef < { x: number, y: number } > ({ x: 0, y: 0 })
  const [ /* modifierActive */, setModifierActive] = useState < boolean > (false)
  const elementRef = useRef <? ElementRef < 'div' >> (null)
  const timeoutRef = useRef <? TimeoutID > (null)

  const measureElement = useCallback((node:any) => {
    if (node !== null) {
      elementRef.current = node
    }
  }, [])

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------
  const handleMouseMove = (event: MouseEvent) => {
    mousePositionRef.current = { x: event.clientX, y: event.clientY }
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    const { metaKey: isMetaKey, shiftKey: isShiftKey, ctrlKey: isCtrlKey, altKey: isAltKey, hasModifier } = extractModifierKeys(event)

    if (hasModifier && elementRef.current) {
      const bounds = elementRef.current.getBoundingClientRect()
      const isInBounds = (
        mousePositionRef.current.x >= bounds.left &&
        mousePositionRef.current.x <= bounds.right &&
        mousePositionRef.current.y >= bounds.top &&
        mousePositionRef.current.y <= bounds.bottom
      )

      if (isInBounds) {
        // logDebug('handleKeyDown', `Label: ${label}, Element bounds: ${JSON.stringify(bounds)}, Mouse position: ${JSON.stringify(mousePositionRef.current)}, isInBounds: ${isInBounds}`)
        setModifierActive(true)
        let text = null

        if (isMetaKey && metaKey) {
          text = metaKey.text
        } else if (isShiftKey && shiftKey) {
          text = shiftKey.text
        } else if (isCtrlKey && ctrlKey) {
          text = ctrlKey.text
        } else if (isAltKey && altKey) {
          text = altKey.text
        }
        
        if (!text) return

        setTooltipState({
          x: mousePositionRef.current.x,
          y: mousePositionRef.current.y,
          visible: true,
          iconBounds: bounds,
          text,
        })
        // logDebug('handleKeyDown', `Tooltip set to visible with text: ${text}`)

        if (disappearAfter > 0) {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
          }
          timeoutRef.current = setTimeout(() => {
            setTooltipState((prevState) => ({ ...prevState, visible: false }))
            timeoutRef.current = null
            // logDebug('handleKeyDown', 'Tooltip set to invisible after timeout')
          }, disappearAfter)
        }
      }
    }
  }

  const handleKeyUp = () => {
    setModifierActive(false)
    setTooltipState((prevState) => ({ ...prevState, visible: false }))
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------

  useEffect(() => {
    if (!enabled) return

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
  }, [enabled]) // Only run once when enabled changes

  //----------------------------------------------------------------------
  // Styles
  //----------------------------------------------------------------------

  // const mousePosition = tooltipState

  const iconCenter = tooltipState?.iconBounds?.left || 0 + (tooltipState?.iconBounds?.width || 0) / 2
  const tooltipStyles = {
    wrapper: {
      position: 'fixed', // Use fixed position to ensure it stays in the same place relative to the viewport
      zIndex: 1001,
      whiteSpace: 'nowrap',
      pointerEvents: 'none', // Add this to prevent the tooltip from interfering with other elements
    },
    tooltipContent: { // text with a border and background
      position: 'fixed',
      backgroundColor: 'var(--bg-main-color)',
      color: 'var(--fg-main-color)',
      padding: '0.3rem',
      fontSize: '0.85rem',
      border: '1px solid var(--tint-color)',
      borderRadius: '6px',
      bottom: `${window.innerHeight - tooltipState?.iconBounds?.bottom+10||0}px`, // Adjust bottom to align with the arrow
      left: `${iconCenter-5}px`,
    },
    arrowBefore: {
      position: 'fixed',
      left: `${iconCenter}px`,
      content: '""',
      borderWidth: '10px 8px 0 8px',
      borderStyle: 'solid',
      borderColor: 'var(--tint-color) transparent transparent transparent',
      marginLeft: `0px`,
      bottom: `${window.innerHeight - tooltipState?.iconBounds?.bottom||0}px`, // Align bottom of the arrow with the tooltip
      // transform: 'translateY(50%)',
    },
  }
  

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------

  const portalElement = document.getElementById('tooltip-portal')

  // if (tooltipState.visible) {
  //   logDebug('render', `TooltipState for ${label}: ${JSON.stringify(tooltipState)}`)
  //   logDebug('render', `PortalElement for ${label}:`, portalElement)
  // }

  return (
    <>
      {portalElement && ReactDOM.createPortal(
        <div className="modifier-tooltip wrapper"
          style={tooltipStyles.wrapper} // Ensure correct positioning
        >
          {tooltipState.visible && (
            <div className="modifier-tooltip-inner">
              <div className="modifier-tooltip-text" style={tooltipStyles.tooltipContent}>
                {tooltipState.text}
              </div>
              <div className="modifier-tooltip-arrow" style={tooltipStyles.arrowBefore}></div>
            </div>
          )}
        </div>,
        portalElement
      )}
      <div ref={measureElement}>
        {children}
      </div>
    </>
  )
}

export default TooltipOnKeyPress
