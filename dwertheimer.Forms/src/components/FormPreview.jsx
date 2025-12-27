// @flow
//--------------------------------------------------------------------------
// FormPreview Component - Right column showing live preview of the form
//--------------------------------------------------------------------------

import React, { useMemo, type Node } from 'react'
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
 * Parse window dimension for preview
 * Converts percentages to pixel values based on actual window size for accurate preview
 * @param {string | number | void} value - The dimension value
 * @param {'width' | 'height'} dimensionType - Whether this is width or height
 * @returns {string} - CSS value (px or undefined)
 */
function parsePreviewDimension(value: ?(number | string), dimensionType: 'width' | 'height'): ?string {
  if (typeof value === 'number') {
    return `${value}px`
  }
  if (typeof value === 'string') {
    const trimmedValue = value.trim()
    // If it's a percentage, convert to pixels based on actual window size
    if (trimmedValue.endsWith('%')) {
      const percentValue = parseFloat(trimmedValue)
      if (!isNaN(percentValue)) {
        // Get actual window dimension
        const windowDimension = dimensionType === 'width' ? window.innerWidth : window.innerHeight
        // Calculate pixel value
        const pixelValue = Math.round((percentValue / 100) * windowDimension)
        return `${pixelValue}px`
      }
    }
    // If it already has px units, return as-is
    if (/^\d+px$/.test(trimmedValue)) {
      return trimmedValue
    }
    // If it's a plain number string, add px
    const numValue = parseInt(trimmedValue, 10)
    if (!isNaN(numValue)) {
      return `${numValue}px`
    }
  }
  return undefined
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
  // Parse width and height from frontmatter for preview window dimensions
  // Convert percentages to pixel values based on actual window size for accurate preview
  const windowStyle = useMemo(() => {
    const style: { [key: string]: string } = {}
    const width = parsePreviewDimension(frontmatter.width, 'width')
    const height = parsePreviewDimension(frontmatter.height, 'height')
    if (width) {
      style.width = width
      style.maxWidth = width
    }
    if (height) {
      style.height = height
    }
    return style
  }, [frontmatter.width, frontmatter.height])

  return (
    <div className="form-builder-preview">
      {!hidePreviewHeader && (
        <div className="form-section-header">
          <h3>Preview</h3>
        </div>
      )}
      <div className="form-preview-container">
        <div className="form-preview-window" style={windowStyle}>
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
