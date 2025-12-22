// @flow
//--------------------------------------------------------------------------
// ProcessingMethodSection Component
// Handles the form processing method selection and related configuration
//--------------------------------------------------------------------------

import React from 'react'
import { NoteChooser, type NoteOption } from '@helpers/react/DynamicDialog/NoteChooser.jsx'
import { HeadingChooser } from '@helpers/react/DynamicDialog/HeadingChooser.jsx'
import { FolderChooser } from '@helpers/react/DynamicDialog/FolderChooser.jsx'
import { ExpandableTextarea } from '@helpers/react/DynamicDialog/ExpandableTextarea.jsx'
import { TemplateTagInserter } from './TemplateTagInserter.jsx'

export type ProcessingMethodSectionProps = {
  processingMethod: string,
  frontmatter: { [key: string]: any },
  notes: Array<NoteOption>,
  folders: Array<string>,
  requestFromPlugin: (command: string, dataToSend?: any, timeout?: number) => Promise<any>,
  onFrontmatterChange: (key: string, value: any) => void,
  onLoadNotes: () => Promise<void>,
  onLoadFolders: (forceReload?: boolean) => Promise<void>,
  templateTitle: string,
  showTagInserter: boolean,
  setShowTagInserter: (show: boolean) => void,
  tagInserterInputRef: ?HTMLInputElement | ?HTMLTextAreaElement,
  setTagInserterInputRef: (ref: ?HTMLInputElement | ?HTMLTextAreaElement) => void,
  fields: Array<any>, // TSettingItem array
}

/**
 * ProcessingMethodSection Component
 * Renders the processing method selection and related configuration fields
 */
export function ProcessingMethodSection({
  processingMethod,
  frontmatter,
  notes,
  folders,
  requestFromPlugin,
  onFrontmatterChange,
  onLoadNotes,
  onLoadFolders,
  templateTitle,
  showTagInserter,
  setShowTagInserter,
  tagInserterInputRef,
  setTagInserterInputRef,
  fields,
}: ProcessingMethodSectionProps): React$Node {
  return (
    <>
      {/* Show in Editor checkbox */}
      <div className="frontmatter-field">
        <label>
          <input
            type="checkbox"
            checked={frontmatter.shouldOpenInEditor !== false}
            onChange={(e) => onFrontmatterChange('shouldOpenInEditor', e.target.checked)}
          />
          Show in Editor on Submit
        </label>
        <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', fontStyle: 'italic' }}>
          If checked, the note will be opened in the editor after form submission
        </div>
      </div>
      
      <div className="frontmatter-field">
        <label>Form Processing Method:</label>
        <select
          value={processingMethod || 'write-existing'}
          onChange={(e) => onFrontmatterChange('processingMethod', e.target.value)}
          style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
        >
          <option value="write-existing">Write to Existing Note</option>
          <option value="create-new">Create New Note on Each Submission</option>
          <option value="form-processor">Use Form Processor Template</option>
        </select>
        <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', fontStyle: 'italic' }}>
          {processingMethod === 'write-existing' && 'Write form data directly to an existing note using TemplateRunner'}
          {processingMethod === 'create-new' && 'Create a new note with form data using TemplateRunner'}
          {processingMethod === 'form-processor' && 'Use a separate processing template to handle form submissions'}
        </div>
      </div>

      {/* Option A: Write to Existing File */}
      {processingMethod === 'write-existing' && (
        <>
          <div className="frontmatter-field" style={{ marginTop: '1rem' }}>
            <label>Template Body:</label>
            <div style={{ position: 'relative' }}>
              <ExpandableTextarea
                ref={(ref) => {
                  if (ref) {
                    setTagInserterInputRef(ref)
                  }
                }}
                value={frontmatter.templateBody || ''}
                onChange={(e) => onFrontmatterChange('templateBody', e.target.value)}
                onFocus={(e) => {
                  const target = e.target
                  if (target instanceof HTMLTextAreaElement) {
                    setTagInserterInputRef(target)
                  }
                }}
                placeholder="Enter template body with tags like <%- fieldKey %> or <%- date.format(&quot;YYYY-MM-DD&quot;) %>"
                minRows={5}
                maxRows={15}
                compactDisplay={false}
                style={{ width: '100%', paddingRight: '8rem' }}
              />
              <div
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  top: '0.5rem',
                  display: 'flex',
                  gap: '0.25rem',
                }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowTagInserter(true)
                  }}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#f0f0f0',
                    border: '1px solid #ccc',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                  title="Insert field variable"
                >
                  + Field
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowTagInserter(true)
                  }}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#f0f0f0',
                    border: '1px solid #ccc',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                  title="Insert date format"
                >
                  + Date
                </button>
              </div>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', fontStyle: 'italic' }}>
              Use template tags like &lt;%- fieldKey %&gt; for form fields, or &lt;%- date.format(&quot;YYYY-MM-DD&quot;) %&gt; for dates
            </div>
          </div>
          <div className="frontmatter-field" style={{ marginTop: '1rem' }}>
            <label>Target Note:</label>
            <NoteChooser
              label=""
              value={frontmatter.getNoteTitled || ''}
              notes={notes}
              onChange={(noteTitle: string, _noteFilename: string) => {
                onFrontmatterChange('getNoteTitled', noteTitle)
              }}
              placeholder="Select note or type <today>, <current>, <thisweek>, etc."
              includePersonalNotes={true}
              includeCalendarNotes={true}
              includeRelativeNotes={true}
              includeTeamspaceNotes={true}
              compactDisplay={true}
              requestFromPlugin={requestFromPlugin}
              onNotesChanged={() => {
                onLoadNotes()
              }}
            />
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', fontStyle: 'italic' }}>
              Select a note or use special values: &lt;today&gt;, &lt;current&gt;, &lt;thisweek&gt;, &lt;nextweek&gt;, &lt;choose&gt;
            </div>
          </div>
          <div className="frontmatter-field">
            <label>Write Location:</label>
            <select
              value={frontmatter.location || 'append'}
              onChange={(e) => {
                const newLocation = e.target.value
                onFrontmatterChange('location', newLocation)
                // If replacing, set replaceNoteContents
                if (newLocation === 'replace') {
                  onFrontmatterChange('replaceNoteContents', true)
                } else {
                  onFrontmatterChange('replaceNoteContents', false)
                }
              }}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
            >
              <option value="append">Append to note</option>
              <option value="prepend">Prepend to note</option>
              <option value="prepend-under-heading">Prepend under Heading</option>
              <option value="append-under-heading">Append under Heading</option>
              <option value="replace">Replace entire note contents</option>
              <option value="cursor">Insert at cursor (Editor mode)</option>
              <option value="insert">Insert (default behavior)</option>
            </select>
          </div>
          {(frontmatter.location === 'prepend-under-heading' ||
            frontmatter.location === 'append-under-heading' ||
            (frontmatter.location === 'append' && frontmatter.writeUnderHeading) ||
            (frontmatter.location === 'prepend' && frontmatter.writeUnderHeading)) && (
            <>
              <div className="frontmatter-field">
                <label>Write Under Heading:</label>
                <HeadingChooser
                  key={`heading-chooser-${frontmatter.getNoteTitled || ''}-${frontmatter.getNoteFilename || ''}-${notes.length}`}
                  label=""
                  value={frontmatter.writeUnderHeading || ''}
                  noteFilename={
                    frontmatter.getNoteTitled
                      ? frontmatter.getNoteFilename ||
                        notes.find((n: NoteOption) => n.title === frontmatter.getNoteTitled)?.filename ||
                        null
                      : null
                  }
                  requestFromPlugin={requestFromPlugin}
                  onChange={(heading: string) => {
                    onFrontmatterChange('writeUnderHeading', heading)
                  }}
                  placeholder="Select heading or type to enter manually"
                  optionAddTopAndBottom={true}
                  includeArchive={false}
                  compactDisplay={true}
                />
                <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', fontStyle: 'italic' }}>
                  {frontmatter.getNoteTitled
                    ? "Select a heading from the note above, or type a heading name and press Enter to enter it manually. The heading will be created if it doesn't exist."
                    : 'Type a heading name and press Enter to enter it manually. If a note is selected above, you can also choose from its headings.'}
                </div>
              </div>
              <div className="frontmatter-field">
                <label>
                  <input
                    type="checkbox"
                    checked={frontmatter.createMissingHeading !== false}
                    onChange={(e) => onFrontmatterChange('createMissingHeading', e.target.checked)}
                  />
                  Create heading if it doesn&apos;t exist
                </label>
              </div>
            </>
          )}
        </>
      )}

      {/* Option B: Create New Note */}
      {processingMethod === 'create-new' && (
        <>
          <div className="frontmatter-field" style={{ marginTop: '1rem' }}>
            <label>New Note Title:</label>
            <div style={{ position: 'relative' }}>
              <input
                ref={(ref) => {
                  if (ref && !tagInserterInputRef) {
                    setTagInserterInputRef(ref)
                  }
                }}
                type="text"
                value={frontmatter.newNoteTitle || ''}
                onChange={(e) => onFrontmatterChange('newNoteTitle', e.target.value)}
                onFocus={() => {
                  // Store the input ref when focused
                  const activeElement = document.activeElement
                  if (activeElement instanceof HTMLInputElement) {
                    setTagInserterInputRef(activeElement)
                  }
                }}
                placeholder="e.g., <%- noteTitle %> or Project: <%- projectName %>"
                style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem', paddingRight: '8rem' }}
              />
              <div
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  gap: '0.25rem',
                }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowTagInserter(true)
                  }}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#f0f0f0',
                    border: '1px solid #ccc',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                  title="Insert field variable or date format"
                >
                  + Field
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowTagInserter(true)
                  }}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#f0f0f0',
                    border: '1px solid #ccc',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                  title="Insert date format"
                >
                  + Date
                </button>
              </div>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', fontStyle: 'italic' }}>
              Use template tags like &lt;%- fieldKey %&gt; for form fields, or &lt;%- date.format(&quot;YYYY-MM-DD&quot;) %&gt; for dates
            </div>
          </div>
          <div className="frontmatter-field">
            <label>Folder:</label>
            <FolderChooser
              label=""
              value={frontmatter.newNoteFolder || ''}
              folders={folders}
              onChange={(folder: string) => {
                onFrontmatterChange('newNoteFolder', folder)
              }}
              placeholder="Select folder (optional)"
              includeNewFolderOption={true}
              compactDisplay={true}
              requestFromPlugin={requestFromPlugin}
              onFoldersChanged={() => {
                onLoadFolders(true) // Force reload after creating folder
              }}
            />
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', fontStyle: 'italic' }}>
              Leave empty for root folder, or use &lt;select&gt; to prompt each time
            </div>
          </div>
        </>
      )}

      {/* Option C: Form Processor */}
      {processingMethod === 'form-processor' && (
        <>
          <div className="frontmatter-field" style={{ marginTop: '1rem' }}>
            <label>Processing Template:</label>
            <NoteChooser
              label=""
              value={frontmatter.receivingTemplateTitle || frontmatter.formProcessorTitle || ''}
              notes={notes}
              onChange={(noteTitle: string, _noteFilename: string) => {
                onFrontmatterChange('receivingTemplateTitle', noteTitle)
              }}
              placeholder="Select processing template"
              includePersonalNotes={true}
              includeCalendarNotes={false}
              includeRelativeNotes={false}
              includeTeamspaceNotes={true}
              startFolder="@Templates/Forms"
              filterByType="forms-processor"
              allowBackwardsCompatible={true}
              compactDisplay={true}
              requestFromPlugin={requestFromPlugin}
              onNotesChanged={() => {
                onLoadNotes()
              }}
            />
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', fontStyle: 'italic' }}>
              Select an existing processing template, or create a new one below
            </div>
          </div>
          <div className="frontmatter-field">
            <button
              type="button"
              onClick={async () => {
                // This will be handled by the plugin - we'll need to add a request handler
                const result = await requestFromPlugin('createProcessingTemplate', {
                  formTemplateTitle: templateTitle,
                })
                if (result && typeof result === 'string') {
                  onFrontmatterChange('receivingTemplateTitle', result)
                }
              }}
              className="PCButton"
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              Create New Processing Template
            </button>
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', fontStyle: 'italic' }}>Creates a new processing template and links it to this form</div>
          </div>
        </>
      )}
      
      {/* Debug JSON Viewer */}
      <div className="frontmatter-field" style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color, #ddd)' }}>
        <label style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Debug: Frontmatter Values (JSON)</label>
        <div
          style={{
            backgroundColor: 'var(--bg-alt-color, #f5f5f5)',
            border: '1px solid var(--border-color, #ddd)',
            borderRadius: '4px',
            padding: '0.75rem',
            fontFamily: 'Menlo, monospace',
            fontSize: '0.8em',
            maxHeight: '300px',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {JSON.stringify(
            {
              processingMethod: frontmatter.processingMethod,
              shouldOpenInEditor: frontmatter.shouldOpenInEditor,
              getNoteTitled: frontmatter.getNoteTitled,
              getNoteFilename: frontmatter.getNoteFilename,
              location: frontmatter.location,
              writeUnderHeading: frontmatter.writeUnderHeading,
              replaceNoteContents: frontmatter.replaceNoteContents,
              createMissingHeading: frontmatter.createMissingHeading,
              newNoteTitle: frontmatter.newNoteTitle,
              newNoteFolder: frontmatter.newNoteFolder,
              templateBody: frontmatter.templateBody,
              receivingTemplateTitle: frontmatter.receivingTemplateTitle,
            },
            null,
            2,
          )}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', fontStyle: 'italic' }}>
          Current frontmatter values for debugging. This shows what will be saved.
        </div>
      </div>
      
      {/* Template Tag Inserter Modal */}
      {showTagInserter && (
        <TemplateTagInserter
          isOpen={showTagInserter}
          onClose={() => setShowTagInserter(false)}
          onInsert={(tag: string) => {
            // Insert tag at cursor position
            if (tagInserterInputRef) {
              if (tagInserterInputRef instanceof HTMLInputElement) {
                const input = tagInserterInputRef
                const start = input.selectionStart || 0
                const end = input.selectionEnd || 0
                const currentValue = input.value || ''
                const newValue = currentValue.substring(0, start) + tag + currentValue.substring(end)
                // Determine which field to update based on the input's context
                if (input.placeholder && input.placeholder.includes('New Note Title')) {
                  onFrontmatterChange('newNoteTitle', newValue)
                }
                // Set cursor position after inserted text
                setTimeout(() => {
                  input.focus()
                  const newCursorPos = start + tag.length
                  input.setSelectionRange(newCursorPos, newCursorPos)
                }, 0)
              } else if (tagInserterInputRef instanceof HTMLTextAreaElement) {
                const textarea = tagInserterInputRef
                const start = textarea.selectionStart || 0
                const end = textarea.selectionEnd || 0
                const currentValue = textarea.value || ''
                const newValue = currentValue.substring(0, start) + tag + currentValue.substring(end)
                // Determine which field to update based on the textarea's context
                if (textarea.placeholder && textarea.placeholder.includes('template body')) {
                  onFrontmatterChange('templateBody', newValue)
                }
                // Set cursor position after inserted text
                setTimeout(() => {
                  textarea.focus()
                  const newCursorPos = start + tag.length
                  textarea.setSelectionRange(newCursorPos, newCursorPos)
                }, 0)
              }
            }
          }}
          fieldKeys={fields.filter((f) => f.key && f.type !== 'separator' && f.type !== 'heading').map((f) => f.key || '')}
          showDateFormats={true}
        />
      )}
    </>
  )
}

export default ProcessingMethodSection

