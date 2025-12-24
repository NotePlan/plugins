// @flow
//--------------------------------------------------------------------------
// FormBuilder Component
// Visual form builder for creating and editing form field definitions
//--------------------------------------------------------------------------

import React, { useState, useEffect, useMemo, useCallback, type Node } from 'react'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import { useAppContext } from './AppContext.jsx'
import { FieldEditor } from './FieldEditor.jsx'
import { FieldTypeSelector } from './FieldTypeSelector.jsx'
import { FormSettings } from './FormSettings.jsx'
import { FormFieldsList } from './FormFieldsList.jsx'
import { FormPreview } from './FormPreview.jsx'
import { stripDoubleQuotes } from '@helpers/stringTransforms'
import { logDebug, logError } from '@helpers/react/reactDev.js'
import { type NoteOption } from '@helpers/react/DynamicDialog/NoteChooser.jsx'
import { type TSettingItem, type TSettingItemType } from '@helpers/react/DynamicDialog/DynamicDialog.jsx'
import './FormBuilder.css'

type FormBuilderProps = {
  initialFields?: Array<TSettingItem>,
  receivingTemplateTitle?: string,
  windowTitle?: string,
  formTitle?: string,
  allowEmptySubmit?: boolean,
  hideDependentItems?: boolean,
  width?: ?number | ?string,
  height?: ?number | ?string,
  x?: ?number | ?string,
  y?: ?number | ?string,
  templateBody?: string, // Load from codeblock
  templateRunnerArgs?: { [key: string]: any }, // TemplateRunner processing variables (loaded from codeblock)
  isNewForm?: boolean,
  templateTitle?: string,
  templateFilename?: string,
  onSave: (fields: Array<TSettingItem>, frontmatter: { [key: string]: any }) => Promise<{ success: boolean, message?: string }>,
  onCancel: () => void,
  onOpenForm?: (templateTitle: string) => void,
}

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
  x,
  y,
  templateBody = '', // Load from codeblock
  templateRunnerArgs = {}, // TemplateRunner processing variables (loaded from codeblock)
  isNewForm = false,
  templateTitle = '',
  templateFilename = '',
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
  const [notes, setNotes] = useState<Array<NoteOption>>([])
  const [foldersLoaded, setFoldersLoaded] = useState<boolean>(false)
  const [notesLoaded, setNotesLoaded] = useState<boolean>(false)
  const [loadingFolders, setLoadingFolders] = useState<boolean>(false)
  const [loadingNotes, setLoadingNotes] = useState<boolean>(false)
  const [showTagInserter, setShowTagInserter] = useState<boolean>(false)
  const [tagInserterInputRef, setTagInserterInputRef] = useState<?HTMLInputElement | ?HTMLTextAreaElement>(null)
  const [tagInserterFieldKey, setTagInserterFieldKey] = useState<string>('')
  const [tagInserterMode, setTagInserterMode] = useState<'field' | 'date' | 'both'>('both')
  const [showWindowSettings, setShowWindowSettings] = useState<boolean>(false)
  const [frontmatter, setFrontmatter] = useState<{ [key: string]: any }>(() => {
    // Strip quotes from initial values to prevent saving quoted values
    const cleanedReceivingTemplateTitle = stripDoubleQuotes(receivingTemplateTitle || '') || ''
    // For backward compatibility: if receivingTemplateTitle exists, automatically use form-processor
    const defaultProcessingMethod = cleanedReceivingTemplateTitle ? 'form-processor' : 'write-existing'

    // Base frontmatter with form configuration
    const baseFrontmatter = {
      processingMethod: defaultProcessingMethod,
      receivingTemplateTitle: cleanedReceivingTemplateTitle,
      windowTitle: stripDoubleQuotes(windowTitle || '') || '',
      formTitle: stripDoubleQuotes(formTitle || '') || '',
      allowEmptySubmit: allowEmptySubmit || false,
      hideDependentItems: hideDependentItems || false,
      width: width,
      height: height,
      x: x, // Preserve string values like "center", "left", "right" or numeric/percentage values
      y: y, // Preserve string values like "center", "top", "bottom" or numeric/percentage values
      // Option A: Write to existing file (defaults)
      getNoteTitled: '',
      location: 'append',
      writeUnderHeading: '',
      replaceNoteContents: false,
      createMissingHeading: true,
      // Option B: Create new note (defaults)
      newNoteTitle: '',
      newNoteFolder: '',
      // Option C: Form processor
      formProcessorTitle: cleanedReceivingTemplateTitle, // Set to receivingTemplateTitle for backward compatibility
      // Template body (loaded from codeblock)
      templateBody: templateBody || '',
    }

    // Merge TemplateRunner args from codeblock (these override defaults)
    // These contain template tags and should not be in frontmatter
    const mergedFrontmatter: { [key: string]: any } = { ...baseFrontmatter }
    Object.keys(templateRunnerArgs).forEach((key: string) => {
      if (templateRunnerArgs[key] !== undefined) {
        mergedFrontmatter[key] = templateRunnerArgs[key]
      }
    })
    return mergedFrontmatter
  })

  // Get requestFromPlugin from context
  const { requestFromPlugin } = useAppContext()

  // Check if form has folder-chooser or note-chooser fields
  const needsFolders = useMemo(() => fields.some((field) => field.type === 'folder-chooser'), [fields])
  const needsNotes = useMemo(() => fields.some((field) => field.type === 'note-chooser'), [fields])

  // Load folders on demand when needed (for form fields OR processing method sections)
  const loadFolders = useCallback(
    async (forceReload: boolean = false) => {
      if ((foldersLoaded && !forceReload) || loadingFolders) return

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
    },
    [foldersLoaded, loadingFolders, requestFromPlugin],
  )

  // Load notes on demand when needed (for form fields OR processing method sections)
  const loadNotes = useCallback(
    async (forceReload: boolean = false, forProcessingTemplates: boolean = false) => {
      if ((notesLoaded && !forceReload) || loadingNotes) return

      try {
        setLoadingNotes(true)
        logDebug('FormBuilder', `Loading notes on demand... (forProcessingTemplates=${String(forProcessingTemplates)})`)
        // Note: requestFromPlugin resolves with just the data when success=true, or rejects with error when success=false
        // For processing templates, we only need project notes (not calendar notes) - this is much faster
        // For form fields, we might need all note types
        const notesData = await requestFromPlugin('getNotes', {
          includePersonalNotes: true,
          includeCalendarNotes: !forProcessingTemplates, // Skip calendar notes for processing templates (performance optimization)
          includeRelativeNotes: !forProcessingTemplates, // Skip relative notes for processing templates
          includeTeamspaceNotes: true,
        })
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
    },
    [notesLoaded, loadingNotes, requestFromPlugin],
  )

  // Load folders/notes automatically when fields change and they're needed, OR when processing method sections are shown
  useEffect(() => {
    const needsFoldersForFields = fields.some((field) => field.type === 'folder-chooser')
    const needsFoldersForProcessing = frontmatter.processingMethod === 'create-new'
    if (needsFoldersForFields || needsFoldersForProcessing) {
      // Always load if needed, even if already loaded (in case processing method changed)
      const shouldLoad = !foldersLoaded || (needsFoldersForProcessing && folders.length === 0)
      if (shouldLoad && !loadingFolders) {
        logDebug(
          'FormBuilder',
          `Triggering loadFolders: needsFoldersForFields=${String(needsFoldersForFields)}, needsFoldersForProcessing=${String(needsFoldersForProcessing)}, folders.length=${
            folders.length
          }`,
        )
        loadFolders(needsFoldersForProcessing && folders.length === 0) // Force reload if processing section needs it and we have no data
      }
    }
  }, [needsFolders, foldersLoaded, loadingFolders, loadFolders, frontmatter.processingMethod, fields, folders.length])

  // Load notes for form fields on mount (if needed)
  // For processing templates, load notes lazily when dropdown opens (better UX)
  useEffect(() => {
    const needsNotesForFields = fields.some((field) => field.type === 'note-chooser')
    if (needsNotesForFields && !notesLoaded && !loadingNotes) {
      logDebug('FormBuilder', `Triggering loadNotes for form fields: needsNotesForFields=${String(needsNotesForFields)}`)
      loadNotes(false, false) // Load all note types for form fields
    }
    // Note: We no longer auto-load notes for processing templates - they load lazily when dropdown opens
  }, [needsNotes, notesLoaded, loadingNotes, loadNotes, fields])

  // Sync frontmatter when props change (e.g., when receivingTemplateTitle is set after template creation)
  useEffect(() => {
    if (receivingTemplateTitle && receivingTemplateTitle !== frontmatter.receivingTemplateTitle) {
      const cleanedReceivingTemplateTitle = stripDoubleQuotes(receivingTemplateTitle || '') || ''
      setFrontmatter((prev) => ({
        ...prev,
        receivingTemplateTitle: cleanedReceivingTemplateTitle,
        // For backward compatibility: if receivingTemplateTitle is set, automatically switch to form-processor
        processingMethod: cleanedReceivingTemplateTitle ? 'form-processor' : prev.processingMethod || 'write-existing',
        formProcessorTitle: cleanedReceivingTemplateTitle || prev.formProcessorTitle || '',
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

  const [saveMessage, setSaveMessage] = useState<?string>(null)
  const [isSaving, setIsSaving] = useState<boolean>(false)

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage(null)
    try {
      const result = await onSave(fields, frontmatter)
      if (result.success) {
        setHasUnsavedChanges(false)
        setIsSaved(true)
        setSaveMessage(result.message || 'Form saved successfully')
        // Clear success message after 3 seconds
        setTimeout(() => setSaveMessage(null), 3000)
      } else {
        setSaveMessage(result.message || 'Failed to save form')
        // Clear error message after 5 seconds
        setTimeout(() => setSaveMessage(null), 5000)
      }
    } catch (error) {
      logError('FormBuilder', `handleSave error: ${error.message}`)
      setSaveMessage(error.message || 'Failed to save form')
      // Clear error message after 5 seconds
      setTimeout(() => setSaveMessage(null), 5000)
    } finally {
      setIsSaving(false)
    }
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
      compactDisplay: type !== 'separator' && type !== 'heading' && type !== 'calendarpicker' ? true : undefined, // Default to compact display for most fields
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
          {saveMessage && (
            <span className={`save-message ${saveMessage.includes('successfully') ? 'save-message-success' : 'save-message-error'}`} title={saveMessage}>
              {saveMessage.includes('successfully') ? '✅' : '❌'} {saveMessage}
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
          <button
            className={`PCButton save-button ${hasUnsavedChanges ? 'save-button-active' : 'save-button-disabled'}`}
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Form'}
          </button>
        </div>
      </div>
      <div className="form-builder-content resizable">
        <PanelGroup direction="horizontal" className="form-builder-panels">
          <Panel defaultSize={25} minSize={15} order={1}>
            <FormSettings
              frontmatter={frontmatter}
              onFrontmatterChange={handleFrontmatterChange}
              notes={notes}
              folders={folders}
              requestFromPlugin={requestFromPlugin}
              onLoadNotes={async (forProcessingTemplates?: boolean) => {
                // Load notes - for processing templates, only project notes (faster)
                // For write-existing method, need all note types (including calendar/relative notes)
                await loadNotes(false, forProcessingTemplates === true) // Only skip calendar notes if explicitly for processing templates
              }}
              loadingNotes={loadingNotes}
              onLoadFolders={loadFolders}
              templateTitle={templateTitle}
              templateFilename={templateFilename}
              showTagInserter={showTagInserter}
              setShowTagInserter={setShowTagInserter}
              tagInserterInputRef={tagInserterInputRef}
              setTagInserterInputRef={setTagInserterInputRef}
              tagInserterFieldKey={tagInserterFieldKey}
              setTagInserterFieldKey={setTagInserterFieldKey}
              tagInserterMode={tagInserterMode}
              setTagInserterMode={setTagInserterMode}
              fields={fields}
            />
          </Panel>
          <PanelResizeHandle className="form-builder-resize-handle" />
          <Panel defaultSize={40} minSize={20} order={2}>
            <FormFieldsList
              fields={fields}
              editingIndex={editingIndex}
              draggedIndex={draggedIndex}
              dragOverIndex={dragOverIndex}
              onAddField={() => setShowAddField(true)}
              onEditField={(index) => setEditingIndex(index)}
              onDeleteField={handleDeleteField}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            />
          </Panel>
          <PanelResizeHandle className="form-builder-resize-handle" />
          <Panel defaultSize={35} minSize={20} order={3}>
            <FormPreview frontmatter={frontmatter} fields={fields} folders={folders} notes={notes} requestFromPlugin={requestFromPlugin} />
          </Panel>
        </PanelGroup>
      </div>

      <FieldTypeSelector isOpen={showAddField} onSelect={handleAddField} onClose={() => setShowAddField(false)} />

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

export default FormBuilder
