// Tooltip.js
// @flow
import React, { useEffect, useRef } from 'react'

type TooltipProps = {
  text: React$Node,
  x: number,
  y: number,
  onDimensionsChange: (width: number, height: number) => void,
  visible: boolean,
};

const Tooltip = ({ text, x, y, onDimensionsChange, visible }: TooltipProps) => {
  const tooltipRef = useRef<?HTMLDivElement>(null)

  useEffect(() => {
    if (tooltipRef.current) {
      const { width, height } = tooltipRef.current.getBoundingClientRect()
      onDimensionsChange(width, height)
    }
  }, [text])

  const tooltipStyles = {
    position: 'fixed',
    left: `${x}px`,
    top: `${y}px`,
    backgroundColor: 'var(--bg-main-color)',
    color: 'var(--fg-main-color)',
    padding: '0.15rem 0.25rem',
    fontSize: '0.85rem',
    border: '1px solid var(--tint-color)',
    borderRadius: '6px',
    visibility: visible ? 'visible' : 'hidden',
    whiteSpace: 'nowrap',
    zIndex: 1001,
  }

  const arrowStyles = {
    position: 'absolute',
    left: '1px',
    bottom: '-10px',
    content: '""',
    borderWidth: '10px 8px 0 8px',
    borderStyle: 'solid',
    borderColor: 'var(--tint-color) transparent transparent transparent',
  }

  return (
    <div ref={tooltipRef} style={tooltipStyles}>
      {text}
      <div style={arrowStyles}></div>
    </div>
  )
}

export default Tooltip
