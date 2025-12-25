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
}

/**
 * Parse window dimension for preview (simplified version - doesn't need screen dimensions for preview)
 * @param {string | number | void} value - The dimension value
 * @returns {string} - CSS value (px or % or undefined)
 */
function parsePreviewDimension(value: ?(number | string)): ?string {
  if (typeof value === 'number') {
    return `${value}px`
  }
  if (typeof value === 'string') {
    const trimmedValue = value.trim()
    // If it's already a percentage or has units, return as-is
    if (trimmedValue.endsWith('%') || /^\d+px$/.test(trimmedValue)) {
      return trimmedValue
    }
    // If it's a plain number string, add px
    const numValue = parseInt(trimmedValue, 10)
    if (!isNaN(numValue)) {
      return `${numValue}px`
    }
    // If it's a percentage without %, try to parse it
    if (trimmedValue.match(/^\d+$/)) {
      // Could be a percentage, but we'll treat it as pixels for preview
      return `${trimmedValue}px`
    }
  }
  return undefined
}

export function FormPreview({ frontmatter, fields, folders, notes, requestFromPlugin }: FormPreviewProps): Node {
  // Parse width and height from frontmatter for preview window dimensions
  const windowStyle = useMemo(() => {
    const style: { [key: string]: string } = {}
    const width = parsePreviewDimension(frontmatter.width)
    const height = parsePreviewDimension(frontmatter.height)
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
      <div className="form-section-header">
        <h3>Preview</h3>
      </div>
      <div className="form-preview-container">
        <div className="form-preview-window" style={windowStyle}>
          <div className="form-preview-window-titlebar">
            <span className="form-preview-window-title">{stripDoubleQuotes(frontmatter.windowTitle || '') || 'Form Window'}</span>
          </div>
          <div className="form-preview-window-content">
            <DynamicDialog
              isOpen={true}
              isModal={false}
              title={stripDoubleQuotes(frontmatter.formTitle || '') || 'Form Heading'}
              items={fields}
              hideHeaderButtons={true}
              onSave={() => {}}
              onCancel={() => {}}
              handleButtonClick={() => {}}
              style={{ width: '100%', maxWidth: '100%', margin: 0 }}
              allowEmptySubmit={frontmatter.allowEmptySubmit || false}
              hideDependentItems={frontmatter.hideDependentItems || false}
              folders={folders}
              notes={(notes: any)} // NoteOption array - cast to any to avoid Flow invariant array type issues
              requestFromPlugin={requestFromPlugin}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default FormPreview

