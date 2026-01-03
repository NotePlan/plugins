// @flow
//--------------------------------------------------------------------------
// Tooltip.js
// Displays a fancy tooltip
// Last updated @jgclark 2026-01-01
//--------------------------------------------------------------------------
import React, { useEffect, useRef } from 'react'
import '../css/Tooltip.css'

type TooltipProps = {
  text: React$Node,
  x: number,
  y: number,
  onDimensionsChange: (width: number, height: number) => void,
  visible: boolean,
};

const Tooltip = ({ text, x, y, onDimensionsChange, visible }: TooltipProps): React$Node => {
  const tooltipRef = useRef<?HTMLDivElement>(null)

  useEffect(() => {
    if (tooltipRef.current) {
      const { width, height } = tooltipRef.current.getBoundingClientRect()
      onDimensionsChange(width, height)
    }
  }, [text])

  const tooltipStylesFromProps = {
    left: `${x}px`,
    top: `${y}px`,
    visibility: visible ? 'visible' : 'hidden',
  }

  return (
    <div ref={tooltipRef} className="tooltipMain" style={tooltipStylesFromProps}>
      {text}
      <div className="tooltipArrow"></div>
    </div>
  )
}

export default Tooltip
