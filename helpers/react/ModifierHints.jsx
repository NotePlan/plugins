// @flow
/**
 * ModifierHints Component
 * Displays visual hints when modifier keys (Option/Alt, Cmd/Meta) are pressed
 * Can be used to show what action will occur when clicking with modifier keys
 */

import React, { useState, useEffect, type Node } from 'react'
import './ModifierHints.css'

export type ModifierHint = {
  icon?: string,
  text?: string,
  key?: 'option' | 'command', // Which modifier key triggers this hint
}

type Props = {
  // Hints to show for different modifier keys
  optionHint?: ModifierHint, // Shown when Alt/Option is pressed
  commandHint?: ModifierHint, // Shown when Cmd/Meta is pressed
  // Display mode
  displayMode?: 'decoration' | 'tooltip' | 'inline' | 'cursor', // How to display the hint
  // Whether to show the hint (e.g., based on hover state)
  show?: boolean,
  // Custom className
  className?: string,
  // Position for tooltip mode
  position?: 'top' | 'bottom' | 'left' | 'right',
  // Cursor position for cursor mode (x, y coordinates)
  cursorX?: number,
  cursorY?: number,
  // Margin offset for cursor mode
  cursorMargin?: number, // Default: 10px
}

/**
 * ModifierHints Component
 * Tracks modifier keys and displays hints when they are pressed
 * @param {Props} props
 * @returns {React$Node}
 */
export function ModifierHints({
  optionHint,
  commandHint,
  displayMode = 'decoration',
  show = true,
  className = '',
  position = 'right',
  cursorX,
  cursorY,
  cursorMargin = 10,
}: Props): Node {
  const [modifierKeys, setModifierKeys] = useState<{ alt: boolean, meta: boolean }>({ alt: false, meta: false })

  // Track modifier keys globally
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setModifierKeys({
        alt: e.altKey, // Option on Mac, Alt on Windows
        meta: e.metaKey || (e.ctrlKey && !e.altKey), // Cmd on Mac, Ctrl on Windows (but not if Alt is also pressed)
      })
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      setModifierKeys({
        alt: e.altKey,
        meta: e.metaKey || (e.ctrlKey && !e.altKey),
      })
    }
    const handleMouseMove = (e: MouseEvent) => {
      // For mouse events, check the actual modifier keys
      setModifierKeys({
        alt: e.altKey,
        meta: e.metaKey || (e.ctrlKey && !e.altKey),
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  // Determine which hint to show (command takes precedence if both are pressed)
  const activeHint = modifierKeys.meta && commandHint
    ? commandHint
    : modifierKeys.alt && optionHint
    ? optionHint
    : null

  if (!show || !activeHint) {
    return null
  }

  const hintContent = (
    <>
      {activeHint.icon && <i className={`fa ${activeHint.icon} modifier-hint-icon`} />}
      {activeHint.text && <span className="modifier-hint-text">{activeHint.text}</span>}
    </>
  )

  const baseClassName = `modifier-hint modifier-hint-${displayMode} modifier-hint-${position} ${className}`

  switch (displayMode) {
    case 'cursor':
      // Position at cursor coordinates with margin
      const style: { position: string, left?: string, top?: string, zIndex: number } = {
        position: 'fixed',
        left: cursorX != null ? `${cursorX + cursorMargin}px` : undefined,
        top: cursorY != null ? `${cursorY + cursorMargin}px` : undefined,
        zIndex: 1000,
      }
      return (
        <div className={baseClassName} style={style} role="tooltip">
          {hintContent}
        </div>
      )
    case 'tooltip':
      return (
        <div className={baseClassName} role="tooltip">
          {hintContent}
        </div>
      )
    case 'inline':
      return (
        <span className={baseClassName}>
          {hintContent}
        </span>
      )
    case 'decoration':
    default:
      return (
        <div className={baseClassName}>
          {hintContent}
        </div>
      )
  }
}

