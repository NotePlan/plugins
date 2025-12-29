// @flow
//--------------------------------------------------------------------------
// FormPreview Component - Right column showing live preview of the form
//--------------------------------------------------------------------------

import React, { useMemo, useRef, useEffect, useState, useCallback, type Node } from 'react'
import DynamicDialog from '@helpers/react/DynamicDialog/DynamicDialog.jsx'
import { type TSettingItem } from '@helpers/react/DynamicDialog/DynamicDialog.jsx'
import { type NoteOption } from '@helpers/react/DynamicDialog/NoteChooser.jsx'
import { stripDoubleQuotes } from '@helpers/stringTransforms'

type FormPreviewProps = {
  frontmatter: { [key: string]: any },
  fields: Array<TSettingItem>,
  folders: Array<string>,
  notes: Array<NoteOption>,
  requestFromPlugin: (command: string, data?: any) => Promise<any>,
  onSave?: (formValues: { [key: string]: any }, windowId?: string) => void,
  onCancel?: () => void,
  hideHeaderButtons?: boolean,
  allowEmptySubmit?: boolean,
  hidePreviewHeader?: boolean,
  hideWindowTitlebar?: boolean,
  keepOpenOnSubmit?: boolean, // If true, don't close the window after submit (e.g., for Form Browser context)
}

/**
 * Get screen dimensions for calculating intended window size
 * Uses window.screen if available, otherwise defaults to common desktop size
 * @returns {{width: number, height: number}} Screen dimensions
 */
function getScreenDimensions(): { width: number, height: number } {
  // Use window.screen if available (browser context)
  if (typeof window !== 'undefined' && window.screen) {
    return {
      width: window.screen.width || 1920,
      height: window.screen.height || 1080,
    }
  }
  // Default to common desktop size
  return { width: 1920, height: 1080 }
}

/**
 * Calculate the intended window dimension in pixels
 * This is what the window would be when actually opened
 * @param {string | number | void} value - The dimension value from frontmatter
 * @param {'width' | 'height'} dimensionType - Whether this is width or height
 * @returns {number | null} Intended dimension in pixels, or null if not specified
 */
function calculateIntendedWindowDimension(value: ?(number | string), dimensionType: 'width' | 'height'): ?number {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    const trimmedValue = value.trim()
    // If it's a percentage, convert to pixels based on screen size
    if (trimmedValue.endsWith('%')) {
      const percentValue = parseFloat(trimmedValue)
      if (!isNaN(percentValue)) {
        const screenDimensions = getScreenDimensions()
        const screenDimension = dimensionType === 'width' ? screenDimensions.width : screenDimensions.height
        return Math.round((percentValue / 100) * screenDimension)
      }
    }
    // If it already has px units, parse it
    const pxMatch = trimmedValue.match(/^(\d+)px$/)
    if (pxMatch) {
      return parseInt(pxMatch[1], 10)
    }
    // If it's a plain number string, parse it
    const numValue = parseInt(trimmedValue, 10)
    if (!isNaN(numValue)) {
      return numValue
    }
  }
  return null
}

/**
 * Calculate preview dimension with constraints
 * Ensures the preview shows the intended size when possible, but respects container limits
 * @param {number | null} intendedSize - The intended window size in pixels
 * @param {number} containerSize - The available container size in pixels
 * @param {number} minSize - Minimum size to display
 * @returns {{size: number, isScaled: boolean}} Preview size and whether it's scaled from intended
 */
function calculatePreviewDimension(intendedSize: ?number, containerSize: number, minSize: number = 200): { size: number, isScaled: boolean } {
  // If no intended size, use 90% of container
  if (intendedSize === null || intendedSize === undefined) {
    return {
      size: Math.round(containerSize * 0.9),
      isScaled: false,
    }
  }

  // Calculate 90% of container (max allowed)
  const maxSize = Math.round(containerSize * 0.9)

  // Use intended size, but constrain to max
  const constrainedSize = Math.min(intendedSize, maxSize)

  // Ensure minimum size
  const finalSize = Math.max(constrainedSize, minSize)

  // If we had to scale down, mark as scaled
  const isScaled = finalSize < intendedSize

  return {
    size: finalSize,
    isScaled,
  }
}

export function FormPreview({
  frontmatter,
  fields,
  folders,
  notes,
  requestFromPlugin,
  onSave,
  onCancel,
  hideHeaderButtons = true,
  allowEmptySubmit = false,
  hidePreviewHeader = false,
  hideWindowTitlebar = false,
  keepOpenOnSubmit = false,
}: FormPreviewProps): Node {
  const containerRef = useRef<?HTMLDivElement>(null)
  const previewWindowRef = useRef<?HTMLDivElement>(null)
  const [containerDimensions, setContainerDimensions] = useState<{ width: number, height: number }>({ width: 0, height: 0 })
  const [previewWindowDimensions, setPreviewWindowDimensions] = useState<{ width: number, height: number }>({ width: 0, height: 0 })

  // Check if we're in a preview/browser context (where we need smart sizing)
  // We use hidePreviewHeader as a proxy - if it's true, we're in Form Browser
  const isPreviewContext = hidePreviewHeader

  // Calculate intended window dimensions (what they would be when actually opened)
  const intendedWidth = useMemo(() => {
    return calculateIntendedWindowDimension(frontmatter.width, 'width')
  }, [frontmatter.width])

  const intendedHeight = useMemo(() => {
    return calculateIntendedWindowDimension(frontmatter.height, 'height')
  }, [frontmatter.height])

  // Measure container dimensions
  const measureContainer = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setContainerDimensions({
        width: rect.width,
        height: rect.height,
      })
    }
  }, [])

  // Measure preview window dimensions
  const measurePreviewWindow = useCallback(() => {
    if (previewWindowRef.current) {
      const rect = previewWindowRef.current.getBoundingClientRect()
      setPreviewWindowDimensions({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      })
    }
  }, [])

  // Calculate preview dimensions with constraints
  const previewDimensions = useMemo(() => {
    if (!isPreviewContext) {
      // In Form Builder, use simple dimension parsing (original behavior)
      const style: { [key: string]: string } = {}
      if (frontmatter.width) {
        const widthValue =
          typeof frontmatter.width === 'number'
            ? `${frontmatter.width}px`
            : frontmatter.width.toString().trim().endsWith('%')
            ? frontmatter.width.toString()
            : /^\d+px$/.test(frontmatter.width.toString().trim())
            ? frontmatter.width.toString()
            : `${frontmatter.width}px`
        style.width = widthValue
        style.maxWidth = widthValue
      }
      if (frontmatter.height) {
        const heightValue =
          typeof frontmatter.height === 'number'
            ? `${frontmatter.height}px`
            : frontmatter.height.toString().trim().endsWith('%')
            ? frontmatter.height.toString()
            : /^\d+px$/.test(frontmatter.height.toString().trim())
            ? frontmatter.height.toString()
            : `${frontmatter.height}px`
        style.height = heightValue
      }
      return { style, isScaled: { width: false, height: false } }
    }

    // In preview context (Form Browser), use smart sizing
    // Only calculate dimensions if we have valid container dimensions
    if (containerDimensions.width === 0 && containerDimensions.height === 0) {
      // Container not measured yet, return empty style (will be recalculated after measurement)
      return { style: {}, isScaled: { width: false, height: false } }
    }

    // Calculate both width and height - if not specified, use 90% of container
    const widthResult = calculatePreviewDimension(intendedWidth, containerDimensions.width)
    const heightResult = calculatePreviewDimension(intendedHeight, containerDimensions.height)

    const style: { [key: string]: string } = {}
    style.width = `${widthResult.size}px`
    style.maxWidth = `${widthResult.size}px`
    style.minWidth = `${widthResult.size}px`

    // Always set height (either calculated from intended or 90% if not specified)
    style.height = `${heightResult.size}px`
    style.minHeight = `${heightResult.size}px`

    return { style, isScaled: { width: widthResult.isScaled, height: heightResult.isScaled } }
  }, [isPreviewContext, frontmatter.width, frontmatter.height, intendedWidth, intendedHeight, containerDimensions.width, containerDimensions.height])

  // Measure container dimensions - initial measurement and when needed
  useEffect(() => {
    if (!isPreviewContext) {
      return
    }

    // Initial measurement after a brief delay to ensure container is rendered
    const timeoutId = setTimeout(() => {
      measureContainer()
      measurePreviewWindow()
    }, 0)

    const handleResize = () => {
      measureContainer()
      measurePreviewWindow()
    }

    window.addEventListener('resize', handleResize)

    // Use ResizeObserver for more accurate container measurement
    let containerResizeObserver = null
    const containerElement = containerRef.current
    if (containerElement && typeof ResizeObserver !== 'undefined') {
      containerResizeObserver = new ResizeObserver(() => {
        measureContainer()
      })
      containerResizeObserver.observe(containerElement)
    }

    // Use ResizeObserver for preview window measurement
    let previewResizeObserver = null
    const previewElement = previewWindowRef.current
    if (previewElement && typeof ResizeObserver !== 'undefined') {
      previewResizeObserver = new ResizeObserver(() => {
        measurePreviewWindow()
      })
      previewResizeObserver.observe(previewElement)
    }

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', handleResize)
      if (containerResizeObserver && containerElement) {
        containerResizeObserver.unobserve(containerElement)
      }
      if (previewResizeObserver && previewElement) {
        previewResizeObserver.unobserve(previewElement)
      }
    }
  }, [isPreviewContext, measureContainer, measurePreviewWindow])

  // Measure preview window when its dimensions are set
  useEffect(() => {
    if (!isPreviewContext) {
      return
    }
    // Small delay to allow DOM to update with new styles
    const timeoutId = setTimeout(() => {
      measurePreviewWindow()
    }, 50)
    return () => clearTimeout(timeoutId)
  }, [isPreviewContext, previewDimensions.style, measurePreviewWindow])

  const showScaledDisclaimer = isPreviewContext && (previewDimensions.isScaled.width || previewDimensions.isScaled.height)

  return (
    <div className="form-builder-preview">
      {!hidePreviewHeader && (
        <div className="form-section-header">
          <h3>Preview</h3>
        </div>
      )}
      <div className="form-preview-container" ref={containerRef}>
        {showScaledDisclaimer && (
          <div className="form-preview-scaled-disclaimer">
            Note: Form settings want {intendedWidth ? `${intendedWidth}px` : 'auto'} × {intendedHeight ? `${intendedHeight}px` : 'auto'}, but preview DIV is{' '}
            {previewWindowDimensions.width > 0 ? `${previewWindowDimensions.width}px` : '...'} ×{' '}
            {previewWindowDimensions.height > 0 ? `${previewWindowDimensions.height}px` : '...'}
          </div>
        )}
        <div className="form-preview-window" ref={previewWindowRef} style={previewDimensions.style}>
          {!hideWindowTitlebar && (
            <div className="form-preview-window-titlebar">
              <span className="form-preview-window-title">{stripDoubleQuotes(frontmatter.windowTitle || '') || 'Form Window'}</span>
            </div>
          )}
          <div className="form-preview-window-content">
            <DynamicDialog
              isOpen={true}
              isModal={false}
              title={stripDoubleQuotes(frontmatter.formTitle || '') || 'Form Heading'}
              items={fields}
              hideHeaderButtons={hideHeaderButtons}
              onSave={onSave || (() => {})}
              onCancel={onCancel || (() => {})}
              handleButtonClick={() => {}}
              style={{ width: '100%', maxWidth: '100%', margin: 0 }}
              allowEmptySubmit={allowEmptySubmit || frontmatter.allowEmptySubmit || false}
              hideDependentItems={frontmatter.hideDependentItems || false}
              folders={folders}
              notes={(notes: any)} // NoteOption array - cast to any to avoid Flow invariant array type issues
              requestFromPlugin={requestFromPlugin}
              keepOpenOnSubmit={keepOpenOnSubmit}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default FormPreview
