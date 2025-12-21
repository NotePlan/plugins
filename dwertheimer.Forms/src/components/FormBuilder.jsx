// @flow
//--------------------------------------------------------------------------
// FormBuilder Component
// Visual form builder for creating and editing form field definitions
//--------------------------------------------------------------------------

import React, { useState, useEffect, useMemo, useCallback, type Node } from 'react'
import { useAppContext } from './AppContext.jsx'
import { type TSettingItem, type TSettingItemType } from '@helpers/react/DynamicDialog/DynamicDialog.jsx'
import DynamicDialog from '@helpers/react/DynamicDialog/DynamicDialog.jsx'
import { logDebug, logError } from '@helpers/react/reactDev.js'
import { stripDoubleQuotes } from '@helpers/stringTransforms'
import './FormBuilder.css'

type FormBuilderProps = {
  initialFields?: Array<TSettingItem>,
  receivingTemplateTitle?: string,
  windowTitle?: string,
  formTitle?: string,
  allowEmptySubmit?: boolean,
  hideDependentItems?: boolean,
  width?: ?number,
  height?: ?number,
  isNewForm?: boolean,
  templateTitle?: string,
  onSave: (fields: Array<TSettingItem>, frontmatter: { [key: string]: any }) => void,
  onCancel: () => void,
  onOpenForm?: (templateTitle: string) => void,
}

type FieldTypeOption = {
  value: TSettingItemType,
  label: string,
  description: string,
}

const FIELD_TYPES: Array<FieldTypeOption> = [
  { value: 'input', label: 'Text Input', description: 'Single-line text field' },
  { value: 'input-readonly', label: 'Read-only (display value) field', description: 'Display-only text field' },
  { value: 'textarea', label: 'Expandable Textarea', description: 'Multi-line text field that expands as you type' },
  { value: 'number', label: 'Number', description: 'Numeric input with increment/decrement' },
  { value: 'text', label: 'Text', description: 'Display-only text/instructions' },
  { value: 'switch', label: 'Switch', description: 'Toggle on/off' },
  { value: 'dropdown-select', label: 'Dropdown', description: 'Simple dropdown menu' },
  // combo is not available because of missing NP_Theme in showHTMLV2 (and maybe doesn't work reliably anyway)
  //   { value: 'combo', label: 'Combo', description: 'Advanced dropdown with search' },
  { value: 'calendarpicker', label: 'Date Picker', description: 'Date selection calendar' },
  { value: 'folder-chooser', label: 'Folder Chooser', description: 'Searchable folder selector' },
  { value: 'note-chooser', label: 'Note Chooser', description: 'Searchable note selector' },
  { value: 'heading-chooser', label: 'Heading Chooser', description: 'Select a heading from a note (static or dynamic based on note-chooser)' },
  { value: 'heading', label: 'Heading', description: 'Section heading' },
  { value: 'separator', label: 'Separator', description: 'Horizontal line' },
  { value: 'button', label: 'Button', description: 'Clickable button' },
  { value: 'button-group', label: 'Button Group', description: 'Group of mutually exclusive selectable buttons (like a toggle group or radio buttons)' },
  { value: 'json', label: 'JSON Editor', description: 'JSON data editor' },
  { value: 'hidden', label: 'Hidden Field', description: 'Hidden data field' },
]

//--------------------------------------------------------------------------
// FormBuilder Component
//--------------------------------------------------------------------------
export function FormBuilder({
  initialFields = [],
  receivingTemplateTitle = '',
  windowTitle = '',
  formTitle = '',
  allowEmptySubmit = false,
  hideDependentItems = false,
  width,
  height,
  isNewForm = false,
  templateTitle = '',
  onSave,
  onCancel,
  onOpenForm,
}: FormBuilderProps): Node {
  const [fields, setFields] = useState<Array<TSettingItem>>(initialFields)
  const [editingIndex, setEditingIndex] = useState<?number>(null)
  const [draggedIndex, setDraggedIndex] = useState<?number>(null)
  const [dragOverIndex, setDragOverIndex] = useState<?number>(null)
  const [showAddField, setShowAddField] = useState<boolean>(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false)
  const [isSaved, setIsSaved] = useState<boolean>(!isNewForm)
  const [folders, setFolders] = useState<Array<string>>([])
  const [notes, setNotes] = useState<Array<{ title: string, filename: string }>>([])
  const [foldersLoaded, setFoldersLoaded] = useState<boolean>(false)
  const [notesLoaded, setNotesLoaded] = useState<boolean>(false)
  const [loadingFolders, setLoadingFolders] = useState<boolean>(false)
  const [loadingNotes, setLoadingNotes] = useState<boolean>(false)
  const [frontmatter, setFrontmatter] = useState<{ [key: string]: any }>(() => {
    // Strip quotes from initial values to prevent saving quoted values
    return {
      receivingTemplateTitle: stripDoubleQuotes(receivingTemplateTitle || '') || '',
      windowTitle: stripDoubleQuotes(windowTitle || '') || '',
      formTitle: stripDoubleQuotes(formTitle || '') || '',
      allowEmptySubmit: allowEmptySubmit || false,
      hideDependentItems: hideDependentItems || false,
      width: width,
      height: height,
    }
  })

  // Get requestFromPlugin from context
  const { requestFromPlugin } = useAppContext()

  // Check if form has folder-chooser or note-chooser fields
  const needsFolders = useMemo(() => fields.some((field) => field.type === 'folder-chooser'), [fields])
  const needsNotes = useMemo(() => fields.some((field) => field.type === 'note-chooser'), [fields])

  // Load folders on demand when needed
  const loadFolders = useCallback(async () => {
    if (foldersLoaded || loadingFolders || !needsFolders) return

    try {
      setLoadingFolders(true)
      logDebug('FormBuilder', 'Loading folders on demand...')
      // Note: requestFromPlugin resolves with just the data when success=true, or rejects with error when success=false
      const foldersData = await requestFromPlugin('getFolders', { excludeTrash: true })
      if (Array.isArray(foldersData)) {
        setFolders(foldersData)
        setFoldersLoaded(true)
        logDebug('FormBuilder', `Loaded ${foldersData.length} folders`)
      } else {
        logError('FormBuilder', `Failed to load folders: Invalid response format`)
        setFoldersLoaded(true) // Set to true to prevent infinite retries
      }
    } catch (error) {
      logError('FormBuilder', `Error loading folders: ${error.message}`)
      setFoldersLoaded(true) // Set to true to prevent infinite retries
    } finally {
      setLoadingFolders(false)
    }
  }, [foldersLoaded, loadingFolders, needsFolders])

  // Load notes on demand when needed
  const loadNotes = useCallback(async () => {
    if (notesLoaded || loadingNotes || !needsNotes) return

    try {
      setLoadingNotes(true)
      logDebug('FormBuilder', 'Loading notes on demand...')
      // Note: requestFromPlugin resolves with just the data when success=true, or rejects with error when success=false
      const notesData = await requestFromPlugin('getNotes', {})
      if (Array.isArray(notesData)) {
        setNotes(notesData)
        setNotesLoaded(true)
        logDebug('FormBuilder', `Loaded ${notesData.length} notes`)
      } else {
        logError('FormBuilder', `Failed to load notes: Invalid response format`)
        setNotesLoaded(true) // Set to true to prevent infinite retries
      }
    } catch (error) {
      logError('FormBuilder', `Error loading notes: ${error.message}`)
      setNotesLoaded(true) // Set to true to prevent infinite retries
    } finally {
      setLoadingNotes(false)
    }
  }, [notesLoaded, loadingNotes, needsNotes])

  // Load folders/notes automatically when fields change and they're needed
  useEffect(() => {
    if (needsFolders && !foldersLoaded && !loadingFolders) {
      loadFolders()
    }
  }, [needsFolders, foldersLoaded, loadingFolders, loadFolders])

  useEffect(() => {
    if (needsNotes && !notesLoaded && !loadingNotes) {
      loadNotes()
    }
  }, [needsNotes, notesLoaded, loadingNotes, loadNotes])

  // Sync frontmatter when props change (e.g., when receivingTemplateTitle is set after template creation)
  useEffect(() => {
    if (receivingTemplateTitle && receivingTemplateTitle !== frontmatter.receivingTemplateTitle) {
      setFrontmatter((prev) => ({
        ...prev,
        receivingTemplateTitle: stripDoubleQuotes(receivingTemplateTitle || '') || '',
      }))
    }
  }, [receivingTemplateTitle, frontmatter.receivingTemplateTitle])

  // Initialize frontmatter with stripped quotes to prevent saving quoted values
  useEffect(() => {
    setFrontmatter((prev) => {
      const updated = { ...prev }
      // Strip quotes from string values in frontmatter
      let hasChanges = false
      Object.keys(updated).forEach((key) => {
        if (typeof updated[key] === 'string') {
          const stripped = stripDoubleQuotes(updated[key])
          if (stripped !== updated[key]) {
            updated[key] = stripped
            hasChanges = true
          }
        }
      })
      return hasChanges ? updated : prev
    })
  }, []) // Only run once on mount

  //----------------------------------------------------------------------
  // Drag and Drop Handlers
  //----------------------------------------------------------------------
  const handleDragStart = (e: any, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', '')
  }

  const handleDragOver = (e: any, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: any, dropIndex: number) => {
    e.preventDefault()
    if (draggedIndex == null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    const newFields = [...fields]
    const draggedItem = newFields[draggedIndex]
    if (draggedItem && typeof draggedIndex === 'number') {
      newFields.splice(draggedIndex, 1)
      const insertIndex = dropIndex
      newFields.splice(insertIndex, 0, draggedItem)
    }

    handleReorderFields(newFields)
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  //----------------------------------------------------------------------
  // Field Management
  //----------------------------------------------------------------------

  const handleUpdateField = (index: number, updatedField: TSettingItem) => {
    const newFields = [...fields]
    newFields[index] = updatedField
    setFields(newFields)
    setEditingIndex(null)
    setHasUnsavedChanges(true)
  }

  const handleSave = () => {
    onSave(fields, frontmatter)
    setHasUnsavedChanges(false)
    setIsSaved(true)
  }

  const handleFrontmatterChange = (key: string, value: any) => {
    // Strip quotes from string values before saving
    const cleanedValue = typeof value === 'string' ? stripDoubleQuotes(value) : value
    setFrontmatter((prev) => ({ ...prev, [key]: cleanedValue }))
    setHasUnsavedChanges(true)
  }

  const handleAddField = (type: TSettingItemType) => {
    const baseField: TSettingItem = {
      type,
      key: type === 'separator' || type === 'heading' ? undefined : `field${fields.length + 1}`,
      label: type === 'separator' ? undefined : `${type} field`,
    }
    let newField: TSettingItem = baseField
    if (type === 'switch') {
      newField = { ...baseField, default: false }
    } else if (type === 'number') {
      newField = { ...baseField, default: 0, step: 1 }
    } else if (type === 'dropdown-select' || type === 'combo' || type === 'button-group') {
      newField = { ...baseField, options: ['Option 1', 'Option 2'] }
    }
    const newFields = [...fields, newField]
    setFields(newFields)
    setEditingIndex(newFields.length - 1)
    setShowAddField(false)
    setHasUnsavedChanges(true)
  }

  const handleDeleteField = (index: number) => {
    const newFields = fields.filter((_, i) => i !== index)
    setFields(newFields)
    if (editingIndex != null && editingIndex === index) {
      setEditingIndex(null)
    } else if (editingIndex != null && typeof editingIndex === 'number' && editingIndex > index) {
      setEditingIndex(editingIndex - 1)
    }
    setHasUnsavedChanges(true)
  }

  const handleReorderFields = (newFields: Array<TSettingItem>) => {
    setFields(newFields)
    setHasUnsavedChanges(true)
  }

  const handleOpenForm = () => {
    if (!onOpenForm || !templateTitle) {
      return
    }

    // Warn if there are unsaved changes
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('You have unsaved changes. The form will open with the last saved version. Do you want to continue?')
      if (!confirmed) {
        return
      }
    }

    onOpenForm(templateTitle)
  }

  const canOpenForm = isSaved && !isNewForm && templateTitle && onOpenForm

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------
  return (
    <div className="form-builder-container">
      <div className="form-builder-header">
        <div className="form-builder-title-section">
          <h2 className="form-builder-title">Form Builder (beta)</h2>
          {hasUnsavedChanges && (
            <span className="unsaved-changes-message" title="You have unsaved changes. Click 'Save Form' to save your changes.">
              ⚠️ Unsaved changes
            </span>
          )}
        </div>
        <div className="form-builder-actions">
          {canOpenForm && (
            <button
              className="PCButton open-form-button"
              onClick={handleOpenForm}
              title={hasUnsavedChanges ? 'Open form (you have unsaved changes - you will be warned)' : 'Open this form in a new window'}
            >
              Open Form
            </button>
          )}
          <button className="PCButton cancel-button" onClick={onCancel}>
            Cancel
          </button>
          <button className={`PCButton save-button ${hasUnsavedChanges ? 'save-button-active' : 'save-button-disabled'}`} onClick={handleSave} disabled={!hasUnsavedChanges}>
            Save Form
          </button>
        </div>
      </div>
      <div className="form-builder-content">
        <div className="form-builder-sidebar">
          <div className="sidebar-section">
            <div className="form-section-header">
              <h3>Form Settings</h3>
            </div>
            <div className="frontmatter-editor">
              <div className="frontmatter-field">
                <label>Window Title:</label>
                <input
                  type="text"
                  value={frontmatter.windowTitle || ''}
                  onChange={(e) => handleFrontmatterChange('windowTitle', e.target.value)}
                  placeholder="Form Window"
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                />
              </div>
              <div className="frontmatter-field">
                <label>Form Heading:</label>
                <input
                  type="text"
                  value={frontmatter.formTitle || ''}
                  onChange={(e) => handleFrontmatterChange('formTitle', e.target.value)}
                  placeholder="Form Heading"
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                />
              </div>
              <div className="frontmatter-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={frontmatter.allowEmptySubmit || false} onChange={(e) => handleFrontmatterChange('allowEmptySubmit', e.target.checked)} />
                  Allow Empty Submit
                </label>
              </div>
              <div className="frontmatter-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={frontmatter.hideDependentItems || false} onChange={(e) => handleFrontmatterChange('hideDependentItems', e.target.checked)} />
                  Hide Dependent Items
                </label>
              </div>
              <div className="frontmatter-field">
                <label>Window Width:</label>
                <input
                  type="number"
                  value={frontmatter.width || ''}
                  onChange={(e) => handleFrontmatterChange('width', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  placeholder="e.g., 750"
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                />
              </div>
              <div className="frontmatter-field">
                <label>Window Height:</label>
                <input
                  type="number"
                  value={frontmatter.height || ''}
                  onChange={(e) => handleFrontmatterChange('height', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  placeholder="e.g., 750"
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                />
                <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', fontStyle: 'italic' }}>
                  Note: You will need to open the form to see the window size settings take effect.
                </div>
              </div>
              <div className="frontmatter-field">
                <label>Receiving Template:</label>
                {frontmatter.receivingTemplateTitle ? (
                  <div
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      marginTop: '0.25rem',
                      backgroundColor: '#f5f5f5',
                      border: '1px solid #e0e0e0',
                      borderRadius: '4px',
                      color: '#333',
                    }}
                  >
                    {frontmatter.receivingTemplateTitle}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={frontmatter.receivingTemplateTitle || ''}
                    onChange={(e) => handleFrontmatterChange('receivingTemplateTitle', e.target.value)}
                    placeholder="Processing Template Title"
                    style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                  />
                )}
                {frontmatter.receivingTemplateTitle && (
                  <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', fontStyle: 'italic' }}>This template is used to process form submissions</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="form-builder-main">
          <div className="form-builder-editor">
            <div className="form-section-header">
              <h3>Form Fields</h3>
              <button className="add-field-button-small" onClick={() => setShowAddField(true)}>
                + Add Field
              </button>
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

                  return (
                    <React.Fragment key={`field-${index}`}>
                      {showDropIndicator && !isDraggingDown && <div className="field-drop-indicator" />}
                      <div
                        className={`form-field-item ${isDragging ? 'dragging' : ''} ${editingIndex === index ? 'editing' : ''}`}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                      >
                        <div className="field-handle">
                          <i className="fa-solid fa-grip-vertical"></i>
                        </div>
                        <div
                          className="field-content"
                          onClick={() => {
                            // Don't open editor for separator - it has no editable properties
                            if (field.type !== 'separator') {
                              setEditingIndex(index)
                            }
                          }}
                          style={{ cursor: field.type === 'separator' ? 'default' : 'pointer' }}
                        >
                          <div className="field-header">
                            <span className="field-type-badge">{field.type}</span>
                            <span className="field-label-preview">{field.label || field.key || ''}</span>
                          </div>
                          {field.description && <div className="field-description-preview">{field.description}</div>}
                          {field.key && (
                            <div className="field-key-preview">
                              <code>key: {field.key}</code>
                            </div>
                          )}
                        </div>
                        <div className="field-actions">
                          {field.type !== 'separator' && (
                            <button className="field-edit-button" onClick={() => setEditingIndex(editingIndex === index ? null : index)} title="Edit field">
                              <i className="fa-solid fa-edit"></i>
                            </button>
                          )}
                          <button className="field-delete-button" onClick={() => handleDeleteField(index)} title="Delete field">
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
          <div className="form-builder-preview">
            <div className="form-section-header">
              <h3>Preview</h3>
            </div>
            <div className="form-preview-container">
              <div className="form-preview-window">
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
                    notes={notes}
                    requestFromPlugin={requestFromPlugin}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAddField && (
        <div className="field-type-selector-overlay" onClick={() => setShowAddField(false)}>
          <div className="field-type-selector-modal" onClick={(e) => e.stopPropagation()}>
            <div className="field-type-selector-header">
              <h3>Select Field Type</h3>
              <button className="field-type-selector-close" onClick={() => setShowAddField(false)}>
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <div className="field-type-selector-content">
              <div className="field-type-list">
                {FIELD_TYPES.map((fieldType) => (
                  <div key={fieldType.value} className="field-type-option" onClick={() => handleAddField(fieldType.value)}>
                    <div className="field-type-label">{fieldType.label}</div>
                    <div className="field-type-description">{fieldType.description}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="field-type-selector-footer">
              <button className="PCButton cancel-button" onClick={() => setShowAddField(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {editingIndex != null && typeof editingIndex === 'number' && editingIndex < fields.length && (
        <FieldEditor
          field={fields[editingIndex]}
          allFields={fields}
          onSave={(updatedField) => {
            if (typeof editingIndex === 'number') {
              handleUpdateField(editingIndex, updatedField)
            }
          }}
          onCancel={() => setEditingIndex(null)}
        />
      )}
    </div>
  )
}

//--------------------------------------------------------------------------
// OptionsEditor Component - Reusable editor for dropdown/button-group options
//--------------------------------------------------------------------------
type OptionItem = {
  label: string,
  value: string,
  isDefault: boolean,
}

type OptionsEditorProps = {
  options: Array<any>, // Can be Array<string | OptionItem>, but Flow has trouble with union arrays
  fieldType: 'dropdown-select' | 'combo' | 'button-group',
  onChange: (options: Array<any>) => void, // Can be Array<string | OptionItem>
}

function OptionsEditor({ options, fieldType, onChange }: OptionsEditorProps): Node {
  // Normalize options to always work with OptionItem format internally
  const normalizeOption = (opt: string | OptionItem): OptionItem => {
    if (typeof opt === 'string') {
      return { label: opt, value: opt, isDefault: false }
    }
    return { label: opt.label || opt.value || '', value: opt.value || '', isDefault: opt.isDefault || false }
  }

  const [optionItems, setOptionItems] = useState<Array<OptionItem>>(() => {
    return options ? options.map(normalizeOption) : []
  })

  const handleAddOption = () => {
    const newOption: OptionItem = { label: 'New Option', value: 'newOption', isDefault: false }
    const updated = [...optionItems, newOption]
    setOptionItems(updated)
    convertAndNotify(updated)
  }

  const handleUpdateOption = (index: number, updates: Partial<OptionItem>) => {
    const updated = [...optionItems]
    const currentItem = updated[index]
    const newItem = { ...currentItem, ...updates }
    // Ensure value is also updated if label changes and they were the same
    if (updates.label && currentItem.label === currentItem.value && !updates.value) {
      newItem.value = updates.label
    }
    updated[index] = newItem
    setOptionItems(updated)
    // Convert back to the appropriate format for the field type
    convertAndNotify(updated)
  }

  const handleDeleteOption = (index: number) => {
    const updated = optionItems.filter((_, i) => i !== index)
    setOptionItems(updated)
    convertAndNotify(updated)
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const updated = [...optionItems]
    const temp = updated[index - 1]
    updated[index - 1] = updated[index]
    updated[index] = temp
    setOptionItems(updated)
    convertAndNotify(updated)
  }

  const handleMoveDown = (index: number) => {
    if (index === optionItems.length - 1) return
    const updated = [...optionItems]
    const temp = updated[index]
    updated[index] = updated[index + 1]
    updated[index + 1] = temp
    setOptionItems(updated)
    convertAndNotify(updated)
  }

  const handleToggleDefault = (index: number) => {
    const updated = optionItems.map((opt, i) => ({
      label: opt.label,
      value: opt.value,
      isDefault: i === index ? !opt.isDefault : false, // Only one default at a time
    }))
    setOptionItems(updated)
    convertAndNotify(updated)
  }

  const convertAndNotify = (items: Array<OptionItem>) => {
    if (fieldType === 'button-group') {
      // For button-group, always return objects with isDefault (but convert to the format expected)
      const converted: Array<OptionItem> = items.map((item) => ({
        label: item.label,
        value: item.value,
        isDefault: item.isDefault,
      }))
      onChange(converted)
    } else {
      // For dropdown-select/combo, return strings if label === value, otherwise objects
      const converted: Array<string | { label: string, value: string }> = items.map((item) => {
        if (item.label === item.value) {
          return item.label
        }
        return { label: item.label, value: item.value }
      })
      onChange(converted)
    }
  }

  useEffect(() => {
    // Update internal state when options prop changes externally
    const normalized = options ? options.map(normalizeOption) : []
    setOptionItems(normalized)
  }, [options])

  return (
    <div className="options-editor">
      <div className="options-editor-header">
        <label>Options:</label>
        <button type="button" className="PCButton add-option-button" onClick={handleAddOption}>
          + Add Option
        </button>
      </div>
      <div className="options-list">
        {optionItems.length === 0 ? (
          <div className="options-empty-state">No options yet. Click &quot;Add Option&quot; to get started.</div>
        ) : (
          optionItems.map((option, index) => (
            <div key={`option-${index}`} className="option-item">
              <div className="option-item-controls">
                <button type="button" className="option-move-button" onClick={() => handleMoveUp(index)} disabled={index === 0} title="Move up">
                  ↑
                </button>
                <button type="button" className="option-move-button" onClick={() => handleMoveDown(index)} disabled={index === optionItems.length - 1} title="Move down">
                  ↓
                </button>
              </div>
              <div className="option-item-fields">
                <div className="option-field">
                  <label>Label:</label>
                  <input type="text" value={option.label} onChange={(e) => handleUpdateOption(index, { label: e.target.value })} placeholder="Display label" />
                </div>
                <div className="option-field">
                  <label>Value:</label>
                  <input type="text" value={option.value} onChange={(e) => handleUpdateOption(index, { value: e.target.value })} placeholder="Value (for template)" />
                </div>
                {fieldType === 'button-group' && (
                  <div className="option-field option-checkbox-field">
                    <label>
                      <input type="checkbox" checked={option.isDefault || false} onChange={() => handleToggleDefault(index)} />
                      Default
                    </label>
                  </div>
                )}
              </div>
              <button type="button" className="option-delete-button" onClick={() => handleDeleteOption(index)} title="Delete option">
                ×
              </button>
            </div>
          ))
        )}
      </div>
      <div className="options-editor-help">
        {fieldType === 'button-group'
          ? 'Label is what users see, Value is used in templates. Only one option can be marked as default.'
          : 'Label is what users see, Value is used in templates. Leave Value empty to use Label as Value.'}
      </div>
    </div>
  )
}

//--------------------------------------------------------------------------
// FieldEditor Component
//--------------------------------------------------------------------------
type FieldEditorProps = {
  field: TSettingItem,
  allFields: Array<TSettingItem>,
  onSave: (field: TSettingItem) => void,
  onCancel: () => void,
}

function FieldEditor({ field, allFields, onSave, onCancel }: FieldEditorProps): Node {
  const [editedField, setEditedField] = useState<TSettingItem>({ ...field })

  // Update editedField when field prop changes (e.g., when editing a different field)
  useEffect(() => {
    setEditedField({ ...field })
  }, [field])

  // Compute dependency options fresh each render based on current allFields
  const dependencyOptions = useMemo(() => {
    return allFields
      .filter((f) => f.key && f.key !== editedField.key && (f.type === 'switch' || f.type === 'input' || f.type === 'number'))
      .map((f) => {
        const key = f.key || ''
        const label = f.label || key
        return {
          value: key,
          label: `${label} (${key})`,
        }
      })
  }, [allFields, editedField.key])

  const updateField = (updates: Partial<TSettingItem>) => {
    setEditedField({ ...editedField, ...updates })
  }

  const handleSave = () => {
    onSave(editedField)
  }

  const needsKey = editedField.type !== 'separator' && editedField.type !== 'heading'

  // Construct header title with label, key, and type
  const headerTitle = needsKey && editedField.key ? `Editing ${editedField.type}: ${editedField.label || ''} (${editedField.key})` : `Editing: ${editedField.type}`

  return (
    <div className="field-editor-overlay" onClick={onCancel}>
      <div className="field-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="field-editor-header">
          <h3>{headerTitle}</h3>
          <button className="field-editor-close" onClick={onCancel}>
            <i className="fa-solid fa-times"></i>
          </button>
        </div>
        <div className="field-editor-content">
          {needsKey && (
            <div className="field-editor-row">
              <label>Key (variable name):</label>
              <input type="text" value={editedField.key || ''} onChange={(e) => updateField({ key: e.target.value })} placeholder="e.g., projectName" />
              <div className="field-editor-help">This becomes the variable name in your template (so it&apos;s best to give it a descriptive name)</div>
            </div>
          )}

          {(editedField.type === 'heading' || editedField.type !== 'separator') && (
            <div className="field-editor-row">
              <label>Label:</label>
              <input type="text" value={editedField.label || ''} onChange={(e) => updateField({ label: e.target.value })} placeholder="Field label" />
              <div className="field-editor-help">The label is displayed above the field (or to the left of the field if compact display is enabled)</div>
            </div>
          )}

          {editedField.type !== 'separator' && editedField.type !== 'heading' && editedField.type !== 'calendarpicker' && (
            <div className="field-editor-row">
              <label>
                <input type="checkbox" checked={editedField.compactDisplay || false} onChange={(e) => updateField({ compactDisplay: e.target.checked })} />
                Compact Display (label and field side-by-side)
              </label>
            </div>
          )}

          {editedField.type !== 'separator' && (
            <div className="field-editor-row">
              <label>Description (help text):</label>
              <textarea
                value={editedField.description || ''}
                onChange={(e) => updateField({ description: e.target.value })}
                placeholder="Help text shown below the field"
                rows={2}
              />
              <div className="field-editor-help">(like this)</div>
            </div>
          )}

          {editedField.type === 'input' || editedField.type === 'input-readonly' || editedField.type === 'text' ? (
            <>
              <div className="field-editor-row">
                <label>Default Value:</label>
                <input type="text" value={editedField.default || ''} onChange={(e) => updateField({ default: e.target.value })} placeholder="Default value" />
              </div>
              {editedField.type === 'input' && (
                <>
                  <div className="field-editor-row">
                    <label>
                      <input type="checkbox" checked={editedField.required || false} onChange={(e) => updateField({ required: e.target.checked })} />
                      Required field
                    </label>
                  </div>
                  <div className="field-editor-row">
                    <label>Validation Type:</label>
                    <select value={editedField.validationType || ''} onChange={(e) => updateField({ validationType: e.target.value || undefined })}>
                      <option value="">None</option>
                      <option value="email">Email</option>
                      <option value="number">Number</option>
                      <option value="date-interval">Date Interval</option>
                    </select>
                  </div>
                </>
              )}
            </>
          ) : null}

          {editedField.type === 'number' ? (
            <>
              <div className="field-editor-row">
                <label>Default Value:</label>
                <input type="number" value={editedField.default || 0} onChange={(e) => updateField({ default: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="field-editor-row">
                <label>Step (increment amount):</label>
                <input type="number" value={editedField.step || 1} onChange={(e) => updateField({ step: parseInt(e.target.value) || 1 })} />
              </div>
            </>
          ) : null}

          {editedField.type === 'switch' ? (
            <div className="field-editor-row">
              <label>
                <input type="checkbox" checked={editedField.default || false} onChange={(e) => updateField({ default: e.target.checked })} />
                Default value (checked)
              </label>
            </div>
          ) : null}

          {(editedField.type === 'dropdown-select' || editedField.type === 'combo' || editedField.type === 'button-group') && (
            <div className="field-editor-row">
              <OptionsEditor options={editedField.options || []} fieldType={editedField.type} onChange={(newOptions) => updateField({ options: newOptions })} />
              {(editedField.type === 'dropdown-select' || editedField.type === 'combo') && (
                <>
                  <div className="field-editor-row" style={{ marginTop: '1rem' }}>
                    <label>Placeholder:</label>
                    <input
                      type="text"
                      value={((editedField: any): { placeholder?: string }).placeholder || ''}
                      onChange={(e) => {
                        const updated = { ...editedField }
                        ;(updated: any).placeholder = e.target.value || undefined
                        setEditedField(updated)
                      }}
                      placeholder="e.g., Select a color"
                    />
                    <div className="field-editor-help">Text shown when no option is selected (won&apos;t be submitted)</div>
                  </div>
                  {editedField.type === 'dropdown-select' &&
                    (() => {
                      // Build dropdown options from the field's options
                      const defaultOptions = []
                      if (editedField.options && editedField.options.length > 0) {
                        editedField.options.forEach((opt: any) => {
                          if (typeof opt === 'string') {
                            defaultOptions.push({ label: opt, value: opt })
                          } else if (opt && typeof opt === 'object' && opt.label && opt.value) {
                            defaultOptions.push({ label: opt.label, value: opt.value })
                          }
                        })
                      }
                      return (
                        <div className="field-editor-row" style={{ marginTop: '1rem' }}>
                          <label>Default Value:</label>
                          <select value={editedField.default || ''} onChange={(e) => updateField({ default: e.target.value || undefined })}>
                            <option value="">None (no default)</option>
                            {defaultOptions.map((opt, idx) => (
                              <option key={`default-opt-${idx}`} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          <div className="field-editor-help">Select which option should be pre-selected</div>
                        </div>
                      )
                    })()}
                </>
              )}
            </div>
          )}

          {editedField.type === 'calendarpicker' && (
            <>
              <div className="field-editor-row">
                <label>Button Text:</label>
                <input
                  type="text"
                  value={((editedField: any): { buttonText?: string }).buttonText || 'Select Date'}
                  onChange={(e) => {
                    const updated = { ...editedField }
                    ;(updated: any).buttonText = e.target.value
                    setEditedField(updated)
                  }}
                  placeholder="Button text"
                />
                <div className="field-editor-help">Text to show on the button which pops up the calendar picker</div>
              </div>
              <div className="field-editor-row">
                <label>
                  <input
                    type="checkbox"
                    checked={((editedField: any): { visible?: boolean }).visible ?? false}
                    onChange={(e) => {
                      const updated = { ...editedField }
                      ;(updated: any).visible = e.target.checked
                      setEditedField(updated)
                    }}
                  />
                  Show calendar by default (visible without clicking button)
                </label>
              </div>
              {editedField.type !== 'separator' && editedField.type !== 'heading' && (
                <div className="field-editor-row">
                  <label>
                    <input type="checkbox" checked={editedField.compactDisplay || false} onChange={(e) => updateField({ compactDisplay: e.target.checked })} />
                    Compact Display (label and field side-by-side)
                  </label>
                </div>
              )}
            </>
          )}

          {editedField.type === 'folder-chooser' && (
            <>
              <div className="field-editor-row">
                <label>
                  <input
                    type="checkbox"
                    checked={((editedField: any): { includeArchive?: boolean }).includeArchive || false}
                    onChange={(e) => {
                      const updated = { ...editedField }
                      ;(updated: any).includeArchive = e.target.checked
                      setEditedField(updated)
                    }}
                  />
                  Include Archive folder
                </label>
                <div className="field-editor-help">Include the Archive folder in the list of available folders</div>
              </div>
              <div className="field-editor-row">
                <label>
                  <input
                    type="checkbox"
                    checked={((editedField: any): { includeNewFolderOption?: boolean }).includeNewFolderOption || false}
                    onChange={(e) => {
                      const updated = { ...editedField }
                      ;(updated: any).includeNewFolderOption = e.target.checked
                      setEditedField(updated)
                    }}
                  />
                  Allow creating new folders
                </label>
                <div className="field-editor-help">
                  Add a &quot;New Folder&quot; option that allows users to create a new folder and select it. On macOS, users can also Option-click on a parent folder to create a
                  new subfolder.
                </div>
              </div>
              <div className="field-editor-row">
                <label>Start Folder (limit to subfolder):</label>
                <input
                  type="text"
                  value={((editedField: any): { startFolder?: string }).startFolder || ''}
                  onChange={(e) => {
                    const updated = { ...editedField }
                    ;(updated: any).startFolder = e.target.value || undefined
                    setEditedField(updated)
                  }}
                  placeholder="e.g., /Projects"
                />
                <div className="field-editor-help">Folder to start the list in (e.g., to limit folders to a specific subfolder). Leave empty to show all folders.</div>
              </div>
              <div className="field-editor-row">
                <label>
                  <input
                    type="checkbox"
                    checked={((editedField: any): { includeFolderPath?: boolean }).includeFolderPath ?? true}
                    onChange={(e) => {
                      const updated = { ...editedField }
                      ;(updated: any).includeFolderPath = e.target.checked
                      setEditedField(updated)
                    }}
                  />
                  Show full folder path
                </label>
                <div className="field-editor-help">Show the folder path (or most of it), not just the last folder name, to give more context</div>
              </div>
              <div className="field-editor-row">
                <label>
                  <input
                    type="checkbox"
                    checked={((editedField: any): { excludeTeamspaces?: boolean }).excludeTeamspaces || false}
                    onChange={(e) => {
                      const updated = { ...editedField }
                      ;(updated: any).excludeTeamspaces = e.target.checked
                      setEditedField(updated)
                    }}
                  />
                  Exclude Teamspaces
                </label>
                <div className="field-editor-help">Exclude teamspace folders from the list of folders</div>
              </div>
            </>
          )}

          {editedField.type === 'note-chooser' && (
            <>
              <div className="field-editor-row">
                <label>
                  <input
                    type="checkbox"
                    checked={((editedField: any): { includePersonalNotes?: boolean }).includePersonalNotes !== false}
                    onChange={(e) => {
                      const updated = { ...editedField }
                      ;(updated: any).includePersonalNotes = e.target.checked
                      setEditedField(updated)
                    }}
                  />
                  Include Personal Notes (default: on)
                </label>
                <div className="field-editor-help">Include personal/project notes in the list</div>
              </div>
              <div className="field-editor-row">
                <label>
                  <input
                    type="checkbox"
                    checked={((editedField: any): { includeCalendarNotes?: boolean }).includeCalendarNotes || false}
                    onChange={(e) => {
                      const updated = { ...editedField }
                      ;(updated: any).includeCalendarNotes = e.target.checked
                      setEditedField(updated)
                    }}
                  />
                  Include Calendar Notes
                </label>
                <div className="field-editor-help">Include calendar notes (daily, weekly, monthly, etc.) in the list</div>
              </div>
              <div className="field-editor-row">
                <label>
                  <input
                    type="checkbox"
                    checked={((editedField: any): { includeRelativeNotes?: boolean }).includeRelativeNotes || false}
                    onChange={(e) => {
                      const updated = { ...editedField }
                      ;(updated: any).includeRelativeNotes = e.target.checked
                      setEditedField(updated)
                    }}
                  />
                  Include Relative Notes
                </label>
                <div className="field-editor-help">
                  Include relative notes like &lt;today&gt;, &lt;thisweek&gt;, &lt;nextweek&gt;, &lt;current&gt;, &lt;choose&gt;. These are compatible with TemplateRunner.
                </div>
              </div>
              <div className="field-editor-row">
                <label>
                  <input
                    type="checkbox"
                    checked={((editedField: any): { includeTeamspaceNotes?: boolean }).includeTeamspaceNotes !== false}
                    onChange={(e) => {
                      const updated = { ...editedField }
                      ;(updated: any).includeTeamspaceNotes = e.target.checked
                      setEditedField(updated)
                    }}
                  />
                  Include Teamspace Notes (default: on)
                </label>
                <div className="field-editor-help">Include teamspace notes in the list</div>
              </div>
            </>
          )}

          {editedField.type === 'heading-chooser' && (
            <>
              <div className="field-editor-row">
                <label>Depends On Note Field (optional):</label>
                <select
                  value={((editedField: any): { dependsOnNoteKey?: string }).dependsOnNoteKey || ''}
                  onChange={(e) => {
                    const updated = { ...editedField }
                    ;(updated: any).dependsOnNoteKey = e.target.value || undefined
                    setEditedField(updated)
                  }}
                >
                  <option value="">None (use static headings)</option>
                  {allFields
                    .filter((f) => f.key && f.type === 'note-chooser' && f.key !== editedField.key)
                    .map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label || f.key} ({f.key})
                      </option>
                    ))}
                </select>
                <div className="field-editor-help">If specified, headings will be loaded dynamically from the selected note. Otherwise, use static headings below.</div>
              </div>
              <div className="field-editor-row">
                <label>Static Headings (if not depending on note):</label>
                <textarea
                  value={((editedField: any): { staticHeadings?: Array<string> }).staticHeadings?.join('\n') || ''}
                  onChange={(e) => {
                    const updated = { ...editedField }
                    ;(updated: any).staticHeadings = e.target.value
                      .split('\n')
                      .map((h) => h.trim())
                      .filter((h) => h.length > 0)
                    setEditedField(updated)
                  }}
                  placeholder="Enter one heading per line&#10;Tasks&#10;Projects&#10;Archive"
                  rows={5}
                />
                <div className="field-editor-help">Enter headings one per line. Only used if &quot;Depends On Note Field&quot; is not set.</div>
              </div>
              <div className="field-editor-row">
                <label>Default Heading:</label>
                <input
                  type="text"
                  value={((editedField: any): { defaultHeading?: string }).defaultHeading || ''}
                  onChange={(e) => {
                    const updated = { ...editedField }
                    ;(updated: any).defaultHeading = e.target.value || undefined
                    setEditedField(updated)
                  }}
                  placeholder="e.g., Tasks"
                />
                <div className="field-editor-help">Default heading to use if none is selected</div>
              </div>
              <div className="field-editor-row">
                <label>
                  <input
                    type="checkbox"
                    checked={((editedField: any): { optionAddTopAndBottom?: boolean }).optionAddTopAndBottom ?? true}
                    onChange={(e) => {
                      const updated = { ...editedField }
                      ;(updated: any).optionAddTopAndBottom = e.target.checked
                      setEditedField(updated)
                    }}
                  />
                  Include &quot;Top of note&quot; and &quot;Bottom of note&quot; options
                </label>
              </div>
              <div className="field-editor-row">
                <label>
                  <input
                    type="checkbox"
                    checked={((editedField: any): { includeArchive?: boolean }).includeArchive ?? false}
                    onChange={(e) => {
                      const updated = { ...editedField }
                      ;(updated: any).includeArchive = e.target.checked
                      setEditedField(updated)
                    }}
                  />
                  Include headings in Archive section
                </label>
              </div>
            </>
          )}

          {needsKey && (
            <div className="field-editor-row">
              <label>Depends On (conditional field):</label>
              <select value={editedField.dependsOnKey || ''} onChange={(e) => updateField({ dependsOnKey: e.target.value || undefined })}>
                <option value="">None (no dependency)</option>
                {dependencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="field-editor-help">This field will only be enabled when the specified field is true/has a value</div>
            </div>
          )}
        </div>
        <div className="field-editor-footer">
          <button className="PCButton cancel-button" onClick={onCancel}>
            Cancel
          </button>
          <button className="PCButton save-button" onClick={handleSave}>
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

export default FormBuilder
