// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a tooltip when a modifier key is pressed
// Used by many other components.
// Last updated 4.6.2024 for v2.0.0 by @dbw
//--------------------------------------------------------------------------
import React, { useState, useEffect, useRef, useCallback, type ElementRef } from 'react'
import ReactDOM from 'react-dom'
import Tooltip from './Tooltip' // Import the Tooltip component
import { extractModifierKeys } from '@np/helpers/react/reactMouseKeyboard'

type TooltipProps = {
  metaKey?: {
    text: React.ReactNode,
    style?: { [string]: string | number },
  },
  shiftKey?: {
    text: React.ReactNode,
    style?: { [string]: string | number },
  },
  ctrlKey?: {
    text: React.ReactNode,
    style?: { [string]: string | number },
  },
  altKey?: {
    text: React.ReactNode,
    style?: { [string]: string | number },
  },
  disappearAfter?: number, // ms
  children: React.ReactNode,
  enabled?: boolean,
  label?: string, // for debugging
};

const TooltipOnKeyPress = ({
  metaKey,
  shiftKey,
  ctrlKey,
  altKey,
  disappearAfter = 0,
  children,
  enabled = true,
}: TooltipProps): React.ReactNode => {
  const [tooltipState, setTooltipState] = useState<{
    x: number,
    y: number,
    visible: boolean,
    text: React.ReactNode | null,
    iconBounds?: ClientRect,
    width: number,
    height: number,
  }>({
    x: 0,
    y: 0,
    visible: false,
    text: null,
    iconBounds: undefined,
    width: 0,
    height: 0,
  })

  const mousePositionRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 })
  const elementRef = useRef<?ElementRef<'div'>>(null)
  const timeoutRef = useRef<?TimeoutID>(null)

  const measureElement = useCallback((node: any) => {
    if (node !== null) {
      elementRef.current = node
    }
  }, [])

  const isInBounds = (bounds: any) => (
    mousePositionRef.current.x >= bounds.left &&
    mousePositionRef.current.x <= bounds.right &&
    mousePositionRef.current.y >= bounds.top &&
    mousePositionRef.current.y <= bounds.bottom
  )

  const handleMouseMove = (event: MouseEvent) => {
    mousePositionRef.current = { x: event.clientX, y: event.clientY }
    const bounds = elementRef.current && elementRef.current.getBoundingClientRect()
    if (bounds && !isInBounds(bounds)) {
      setTooltipState((prev) => ({ ...prev, visible: false }))
    }
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    const { metaKey: isMetaKey, shiftKey: isShiftKey, ctrlKey: isCtrlKey, altKey: isAltKey, hasModifier } = extractModifierKeys(event)

    if (hasModifier && elementRef.current) {
      const bounds = elementRef.current.getBoundingClientRect()

      if (isInBounds(bounds)) {
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

        setTooltipState((prev) => ({
          ...prev,
          x: mousePositionRef.current.x, // Center the tooltip horizontally at the cursor
          y: bounds.top, // Anchor the tooltip vertically to the bounds
          visible: true,
          iconBounds: bounds,
          text,
        }))

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
  }

  const handleKeyUp = () => {
    setTooltipState((prevState) => ({ ...prevState, visible: false }))
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  const handleTooltipDimensionsChange = (width: number, height: number) => {
    setTooltipState((prev) => {
      let x = prev.x - 10 // Default position with arrow under the cursor
      const y = prev.y - height - 5 // Adjust y to include arrow height

      // Adjust if the tooltip goes off the screen
      if (x < 0) {
        x = 0
      } else if (x + width > window.innerWidth) {
        x = window.innerWidth - width
      }

      return { ...prev, x, y, width, height }
    })
  }

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
  }, [enabled])

  // Portal elements are allowed to float higher in the z-order
  // Is defined with specific X-Y coords for when its needed
  const portalElement = document.getElementById('tooltip-portal')

  return (
    <>
      {portalElement && ReactDOM.createPortal(
        <div>
          {tooltipState.visible && (
            <Tooltip
              text={tooltipState.text}
              x={tooltipState.x}
              y={tooltipState.y}
              visible={tooltipState.visible}
              onDimensionsChange={handleTooltipDimensionsChange}
            />
          )}
        </div>,
        portalElement
      )}
      <span ref={measureElement} style={{ display: 'inline' }}>
        {children}
      </span>
    </>
  )
}

export default TooltipOnKeyPress
