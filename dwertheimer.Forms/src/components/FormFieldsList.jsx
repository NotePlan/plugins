// @flow
//--------------------------------------------------------------------------
// FormFieldsList Component - Middle column showing list of form fields
//--------------------------------------------------------------------------

import React, { useState, useEffect, type Node } from 'react'
import { type TSettingItem } from '@helpers/react/DynamicDialog/DynamicDialog.jsx'
import { MarkdownPreview } from '@helpers/react/DynamicDialog/MarkdownPreview.jsx'

type FormFieldsListProps = {
  fields: Array<TSettingItem>,
  editingIndex: ?number,
  draggedIndex: ?number,
  dragOverIndex: ?number,
  onAddField: () => void,
  onEditField: (index: number) => void,
  onDeleteField: (index: number) => void,
  onDragStart: (e: any, index: number) => void,
  onDragOver: (e: any, index: number) => void,
  onDragLeave: () => void,
  onDrop: (e: any, index: number) => void,
  onDragEnd: () => void,
  requestFromPlugin?: (command: string, data?: any) => Promise<any>,
}

export function FormFieldsList({
  fields,
  editingIndex,
  draggedIndex,
  dragOverIndex,
  onAddField,
  onEditField,
  onDeleteField,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  requestFromPlugin,
}: FormFieldsListProps): Node {
  // Track expanded state for comment fields (by index as string)
  const [expandedComments, setExpandedComments] = useState<{ [key: string]: boolean }>(() => {
    const initial: { [key: string]: boolean } = {}
    fields.forEach((field, index) => {
      if (field.type === 'comment') {
        // Use field.expanded if set, otherwise default to true
        const indexStr = String(index)
        initial[indexStr] = (field: any).expanded !== false
      }
    })
    return initial
  })

  const toggleComment = (index: number) => {
    const indexStr = String(index)
    setExpandedComments((prev) => ({
      ...prev,
      [indexStr]: !prev[indexStr],
    }))
  }

  // Sync expanded state when fields change (e.g., when comment fields are added/removed)
  useEffect(() => {
    const newExpanded: { [key: string]: boolean } = {}
    fields.forEach((field, index) => {
      if (field.type === 'comment') {
        const indexStr = String(index)
        // Preserve existing state if field still exists, otherwise use field.expanded or default to true
        newExpanded[indexStr] = expandedComments[indexStr] !== undefined ? expandedComments[indexStr] : (field: any).expanded !== false
      }
    })
    setExpandedComments(newExpanded)
  }, [fields.length]) // Only update when number of fields changes

  return (
    <div className="form-builder-main">
      <div className="form-builder-editor">
        <div className="form-section-header">
          <h3>Form Fields</h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button className="add-field-button-small" onClick={onAddField}>
              + Add Field
            </button>
            {requestFromPlugin && (
              <button
                className="PCButton"
                onClick={async () => {
                  try {
                    await requestFromPlugin('testFormFieldRender', {})
                  } catch (error) {
                    console.error('Error opening form field examples:', error)
                  }
                }}
                title="Open a test form showing examples of all field types"
                style={{ fontSize: '0.85rem', padding: '4px 8px' }}
              >
                Examples
              </button>
            )}
          </div>
        </div>
        <div className="form-fields-list">
          {fields.length === 0 ? (
            <div className="empty-state">No fields yet. Click &quot;Add Field&quot; to get started.</div>
          ) : (
            fields.map((field, index) => {
              const isDragging = draggedIndex === index
              const isDragOver = dragOverIndex === index
              const showDropIndicator = isDragOver && draggedIndex != null && draggedIndex !== index
              const isDraggingDown = draggedIndex != null && typeof draggedIndex === 'number' && draggedIndex < index
              const isComment = field.type === 'comment'
              const indexStr = String(index)
              const isExpanded = expandedComments[indexStr] !== false // Default to true if not set

              return (
                <React.Fragment key={`field-${index}`}>
                  {showDropIndicator && !isDraggingDown && <div className="field-drop-indicator" />}
                  <div
                    className={`form-field-item ${isDragging ? 'dragging' : ''} ${editingIndex === index ? 'editing' : ''} ${isComment ? 'comment-field' : ''}`}
                    draggable={true}
                    onDragStart={(e) => onDragStart(e, index)}
                    onDragOver={(e) => onDragOver(e, index)}
                    onDragLeave={onDragLeave}
                    onDrop={(e) => onDrop(e, index)}
                    onDragEnd={onDragEnd}
                  >
                    <div className="field-handle">
                      <i className="fa-solid fa-grip-vertical"></i>
                    </div>
                    <div
                      className="field-content"
                      onClick={() => {
                        // Don't open editor for separator - it has no editable properties
                        // For comment fields, clicking the header toggles expand/collapse
                        if (isComment) {
                          toggleComment(index)
                        } else if (field.type !== 'separator') {
                          onEditField(index)
                        }
                      }}
                      style={{ cursor: field.type === 'separator' ? 'default' : 'pointer' }}
                    >
                      <div className="field-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {isComment && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              transition: 'transform 0.2s',
                              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                              display: 'inline-block',
                            }}
                          >
                            ▶
                          </span>
                        )}
                        <span className="field-label-preview">{field.label || field.key || ''}</span>
                        <span className="field-type-badge">{field.type}</span>
                      </div>
                      {!isComment && field.description && <div className="field-description-preview">{field.description}</div>}
                      {!isComment && field.key && (
                        <div className="field-key-preview">
                          <code>key: {field.key}</code>
                        </div>
                      )}
                      {isComment && isExpanded && (field: any).commentText && (
                        <div style={{ marginTop: '0.5rem', padding: '0.5rem', border: '1px solid var(--divider-color, #CDCFD0)', borderRadius: '4px' }}>
                          <MarkdownPreview markdownText={(field: any).commentText} requestFromPlugin={requestFromPlugin} compactDisplay={true} />
                        </div>
                      )}
                    </div>
                    <div className="field-actions">
                      {field.type !== 'separator' && (
                        <button
                          className="field-edit-button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onEditField(editingIndex === index ? -1 : index)
                          }}
                          title="Edit field"
                        >
                          <i className="fa-solid fa-edit"></i>
                        </button>
                      )}
                      <button
                        className="field-delete-button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteField(index)
                        }}
                        title="Delete field"
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  </div>
                  {showDropIndicator && isDraggingDown && <div className="field-drop-indicator" />}
                </React.Fragment>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default FormFieldsList
