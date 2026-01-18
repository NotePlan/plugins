// @flow
//--------------------------------------------------------------------------
// FormPreview Component - Right column showing live preview of the form
//--------------------------------------------------------------------------

import React, { useMemo, useRef, useEffect, useState, useCallback, type Node } from 'react'
import { useAppContext } from './AppContext.jsx'
import DynamicDialog from '@helpers/react/DynamicDialog/DynamicDialog.jsx'
import FormErrorBanner from './FormErrorBanner.jsx'
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
  onFrontmatterChange?: (key: string, value: any) => void, // Optional callback to update frontmatter (for Form Builder)
  showScaledDisclaimer?: boolean, // If true, show toast warning when preview is scaled (only for Form Builder)
  aiAnalysisResult?: string, // Optional: AI analysis result from template rendering errors
  formSubmissionError?: string, // Optional: Form submission error message
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
  onFrontmatterChange,
  showScaledDisclaimer = false,
  aiAnalysisResult = '',
  formSubmissionError = '',
}: FormPreviewProps): Node {
  const containerRef = useRef<?HTMLDivElement>(null)
  const previewWindowRef = useRef<?HTMLDivElement>(null)
  const [containerDimensions, setContainerDimensions] = useState<{ width: number, height: number }>({ width: 0, height: 0 })
  const [previewWindowDimensions, setPreviewWindowDimensions] = useState<{ width: number, height: number }>({ width: 0, height: 0 })
  const { dispatch } = useAppContext()
  const prevShowScaledDisclaimerRef = useRef<boolean>(false)

  // Always use smart sizing for previews (both Form Browser and Form Builder)
  // The key difference is that Form Browser doesn't show the preview header

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
    // Always use smart sizing for previews (both Form Browser and Form Builder)
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
  }, [frontmatter.width, frontmatter.height, intendedWidth, intendedHeight, containerDimensions.width, containerDimensions.height])

  // Measure container dimensions - initial measurement and when needed
  useEffect(() => {
    // Always measure container for smart sizing
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
  }, [measureContainer, measurePreviewWindow])

  // Measure preview window when its dimensions are set
  useEffect(() => {
    // Small delay to allow DOM to update with new styles
    const timeoutId = setTimeout(() => {
      measurePreviewWindow()
    }, 50)
    return () => clearTimeout(timeoutId)
  }, [previewDimensions.style, measurePreviewWindow])

  const isScaled = previewDimensions.isScaled.width || previewDimensions.isScaled.height

  // Calculate warning message when preview is scaled (only for Form Builder)
  const scaledWarningMessage = useMemo(() => {
    if (!isScaled) {
      return ''
    }
    const isWidthScaled = previewDimensions.isScaled.width
    const isHeightScaled = previewDimensions.isScaled.height
    let reducedText = ''
    if (isWidthScaled && isHeightScaled) {
      reducedText = 'width and height'
    } else if (isWidthScaled) {
      reducedText = 'width'
    } else if (isHeightScaled) {
      reducedText = 'height'
    }
    const intendedSize = `${intendedWidth ? `${intendedWidth}px` : 'auto'} x ${intendedHeight ? `${intendedHeight}px` : 'auto'}`
    const actualSize = `${previewWindowDimensions.width > 0 ? `${previewWindowDimensions.width}px` : '...'} x ${
      previewWindowDimensions.height > 0 ? `${previewWindowDimensions.height}px` : '...'
    }`
    return `Form settings are set to ${intendedSize}, but preview window is ${actualSize}. ${
      reducedText.charAt(0).toUpperCase() + reducedText.slice(1)
    } is reduced for the preview window.`
  }, [
    isScaled,
    previewDimensions.isScaled.width,
    previewDimensions.isScaled.height,
    intendedWidth,
    intendedHeight,
    previewWindowDimensions.width,
    previewWindowDimensions.height,
  ])

  // Compare current preview dimensions with frontmatter settings
  // Only show "set window to this size" link if dimensions don't match
  const dimensionsMatch = useMemo(() => {
    if (!previewWindowDimensions.width || !previewWindowDimensions.height) {
      return false // Don't show link until dimensions are measured
    }
    const currentWidth = previewWindowDimensions.width
    const currentHeight = previewWindowDimensions.height
    const frontmatterWidth = calculateIntendedWindowDimension(frontmatter.width, 'width')
    const frontmatterHeight = calculateIntendedWindowDimension(frontmatter.height, 'height')

    // If frontmatter has no width/height, they don't match
    if (frontmatterWidth === null || frontmatterHeight === null) {
      return false
    }

    // Compare with small tolerance (within 2px)
    // Flow type guard: we know these are numbers after null check
    const widthNum: number = (frontmatterWidth: any)
    const heightNum: number = (frontmatterHeight: any)
    const widthDiff = Math.abs(currentWidth - widthNum)
    const heightDiff = Math.abs(currentHeight - heightNum)
    return widthDiff <= 2 && heightDiff <= 2
  }, [previewWindowDimensions.width, previewWindowDimensions.height, frontmatter.width, frontmatter.height])

  // Handle setting window size from preview dimensions
  const handleSetWindowSize = useCallback(() => {
    if (!onFrontmatterChange || !previewWindowDimensions.width || !previewWindowDimensions.height) {
      return
    }

    const width = String(previewWindowDimensions.width)
    const height = String(previewWindowDimensions.height)

    onFrontmatterChange('width', width)
    onFrontmatterChange('height', height)

    // Show success toast
    dispatch('SHOW_TOAST', {
      type: 'SUCCESS',
      msg: `Window size set to ${width}x${height}px`,
      timeout: 3000,
    })
  }, [onFrontmatterChange, previewWindowDimensions.width, previewWindowDimensions.height, dispatch])

  // Show warning toast when preview is scaled (only when showScaledDisclaimer prop is true, e.g., in Form Builder)
  useEffect(() => {
    if (showScaledDisclaimer && isScaled && !prevShowScaledDisclaimerRef.current) {
      const isWidthScaled = previewDimensions.isScaled.width
      const isHeightScaled = previewDimensions.isScaled.height
      let reducedText = ''
      if (isWidthScaled && isHeightScaled) {
        reducedText = 'width+height'
      } else if (isWidthScaled) {
        reducedText = 'width'
      } else if (isHeightScaled) {
        reducedText = 'height'
      }
      const intendedSize = `${intendedWidth ? `${intendedWidth}px` : 'auto'} x ${intendedHeight ? `${intendedHeight}px` : 'auto'}`
      const actualSize = `${previewWindowDimensions.width > 0 ? `${previewWindowDimensions.width}px` : '...'} x ${
        previewWindowDimensions.height > 0 ? `${previewWindowDimensions.height}px` : '...'
      }`
      const message = `Form settings are set to ${intendedSize}, but preview DIV is ${actualSize}\n${reducedText} is reduced for the preview window.`
      dispatch('SHOW_TOAST', {
        type: 'WARN',
        msg: message,
        timeout: 10000,
      })
    }
    prevShowScaledDisclaimerRef.current = isScaled
  }, [
    showScaledDisclaimer,
    isScaled,
    intendedWidth,
    intendedHeight,
    previewWindowDimensions.width,
    previewWindowDimensions.height,
    previewDimensions.isScaled.width,
    previewDimensions.isScaled.height,
    dispatch,
  ])

  return (
    <div className="form-builder-preview">
      {!hidePreviewHeader && (
        <div className="form-section-header">
          <h3>Preview</h3>
        </div>
      )}
      <div className="form-preview-container" ref={containerRef}>
        {/* Error banner - only show when not in Form Builder (when onFrontmatterChange is not provided) */}
        {!onFrontmatterChange && (aiAnalysisResult || formSubmissionError) && (
          <div style={{ position: 'relative', width: '100%', marginBottom: '1rem' }}>
            <FormErrorBanner
              aiAnalysisResult={aiAnalysisResult}
              formSubmissionError={formSubmissionError}
              requestFromPlugin={requestFromPlugin}
            />
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
              title={frontmatter.formTitle != null ? stripDoubleQuotes(frontmatter.formTitle) || '' : ''}
              items={fields}
              hideHeaderButtons={hideHeaderButtons}
              onSave={onSave || (() => {})}
              onCancel={onCancel || (() => {})}
              handleButtonClick={() => {}}
              style={{
                width: '100%',
                maxWidth: '100%',
                margin: 0,
                content: { paddingLeft: '1.5rem', paddingRight: '1.5rem' },
                '--template-form-compact-label-width': frontmatter?.compactLabelWidth || undefined,
                '--template-form-compact-input-width': frontmatter?.compactInputWidth || undefined,
              }}
              allowEmptySubmit={allowEmptySubmit || frontmatter.allowEmptySubmit || false}
              hideDependentItems={frontmatter.hideDependentItems || false}
              folders={folders}
              notes={(notes: any)} // NoteOption array - cast to any to avoid Flow invariant array type issues
              requestFromPlugin={requestFromPlugin}
              keepOpenOnSubmit={keepOpenOnSubmit}
              className="template-form"
            />
          </div>
        </div>
        {/* Warning message when preview is scaled - only show in Form Builder (when onFrontmatterChange is provided) */}
        {onFrontmatterChange && isScaled && scaledWarningMessage && <div className="form-preview-scaled-warning">{scaledWarningMessage}</div>}
        {/* Dimension display - only show in Form Builder (when onFrontmatterChange is provided) */}
        {onFrontmatterChange && previewWindowDimensions.width > 0 && previewWindowDimensions.height > 0 && (
          <div className="form-preview-dimensions">
            <span className="form-preview-dimensions-text">
              Preview Dimensions: {previewWindowDimensions.width}x{previewWindowDimensions.height}
            </span>
            {!dimensionsMatch && (
              <button type="button" className="form-preview-dimensions-link" onClick={handleSetWindowSize} title="Set window size to this dimension">
                set window to this size
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default FormPreview
