// @flow
//--------------------------------------------------------------------------
// InfoIcon Component
// Displays an information icon with a tooltip on hover/click
//--------------------------------------------------------------------------

import React, { useState, useRef, useEffect } from 'react'
import './InfoIcon.css'

export type InfoIconProps = {
  text: string | React$Node, // The tooltip text to display
  position?: 'top' | 'bottom' | 'left' | 'right', // Tooltip position relative to icon
  className?: string,
}

/**
 * InfoIcon Component
 * Displays an (i) icon that shows a tooltip on hover or click
 * @param {InfoIconProps} props
 * @returns {React$Node}
 */
export function InfoIcon({ text, position = 'top', className = '' }: InfoIconProps): React$Node {
  const [isVisible, setIsVisible] = useState(false)
  const iconRef = useRef<?HTMLSpanElement>(null)
  const tooltipRef = useRef<?HTMLDivElement>(null)

  // Handle click outside to close tooltip
  useEffect(() => {
    if (!isVisible) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return

      const icon = iconRef.current
      const tooltip = tooltipRef.current
      if (icon && tooltip && !icon.contains(target) && !tooltip.contains(target)) {
        setIsVisible(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isVisible])

  // Position tooltip relative to icon
  useEffect(() => {
    if (!isVisible || !iconRef.current || !tooltipRef.current) return

    const iconRect = iconRef.current.getBoundingClientRect()
    const tooltip = tooltipRef.current
    if (!tooltip) return

    const tooltipRect = tooltip.getBoundingClientRect()

    let top = 0
    let left = 0

    switch (position) {
      case 'top':
        top = iconRect.top - tooltipRect.height - 8
        left = iconRect.left + iconRect.width / 2 - tooltipRect.width / 2
        break
      case 'bottom':
        top = iconRect.bottom + 8
        left = iconRect.left + iconRect.width / 2 - tooltipRect.width / 2
        break
      case 'left':
        top = iconRect.top + iconRect.height / 2 - tooltipRect.height / 2
        left = iconRect.left - tooltipRect.width - 8
        break
      case 'right':
        top = iconRect.top + iconRect.height / 2 - tooltipRect.height / 2
        left = iconRect.right + 8
        break
    }

    // Keep tooltip within viewport
    const padding = 8
    if (left < padding) left = padding
    if (left + tooltipRect.width > window.innerWidth - padding) {
      left = window.innerWidth - tooltipRect.width - padding
    }
    if (top < padding) top = padding
    if (top + tooltipRect.height > window.innerHeight - padding) {
      top = window.innerHeight - tooltipRect.height - padding
    }

    tooltip.style.top = `${top}px`
    tooltip.style.left = `${left}px`
  }, [isVisible, position])

  return (
    <>
      <span
        ref={iconRef}
        className={`info-icon ${className}`}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsVisible(!isVisible)
        }}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        role="button"
        tabIndex={0}
        aria-label="Show information"
        title="Click or hover for more information"
      >
        ⓘ
      </span>
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`info-tooltip info-tooltip-${position}`}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => setIsVisible(true)}
          onMouseLeave={() => setIsVisible(false)}
        >
          <div className="info-tooltip-content">{typeof text === 'string' ? text : text}</div>
          <div className={`info-tooltip-arrow info-tooltip-arrow-${position}`} />
        </div>
      )}
    </>
  )
}

export default InfoIcon
