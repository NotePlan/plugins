// @flow
//--------------------------------------------------------------------------
// ProcessingMethodSection Component
// Handles the form processing method selection and related configuration
//--------------------------------------------------------------------------

import React, { useState, useEffect } from 'react'
import { TemplateTagInserter } from './TemplateTagInserter.jsx'
import { TemplateTagEditor } from './TemplateTagEditor.jsx'
import { useAppContext } from './AppContext.jsx'
import { NoteChooser, type NoteOption } from '@helpers/react/DynamicDialog/NoteChooser.jsx'
import { HeadingChooser } from '@helpers/react/DynamicDialog/HeadingChooser.jsx'
import { FolderChooser } from '@helpers/react/DynamicDialog/FolderChooser.jsx'
import { SpaceChooser } from '@helpers/react/DynamicDialog/SpaceChooser.jsx'
import { InfoIcon } from '@helpers/react/InfoIcon.jsx'
import { logDebug } from '@helpers/react/reactDev'

export type ProcessingMethodSectionProps = {
  processingMethod: string,
  frontmatter: { [key: string]: any },
  notes: Array<NoteOption>,
  folders: Array<string>,
  requestFromPlugin: (command: string, dataToSend?: any, timeout?: number) => Promise<any>,
  onFrontmatterChange: (key: string, value: any) => void,
  onLoadNotes: (forProcessingTemplates?: boolean, forceReload?: boolean, spaceOverride?: ?string) => Promise<void>,
  loadingNotes?: boolean, // Loading state for notes
  onLoadFolders: (forceReload?: boolean, spaceOverride?: ?string) => Promise<void>,
  templateTitle: string,
  templateFilename?: string,
  showTagInserter: boolean,
  setShowTagInserter: (show: boolean) => void,
  tagInserterMode: 'field' | 'date' | 'both',
  setTagInserterMode: (mode: 'field' | 'date' | 'both') => void,
  tagInserterInputRef: ?HTMLInputElement | ?HTMLTextAreaElement,
  setTagInserterInputRef: (ref: ?HTMLInputElement | ?HTMLTextAreaElement) => void,
  tagInserterFieldKey: string, // Track which field is being edited ('newNoteTitle' or 'templateBody')
  setTagInserterFieldKey: (key: string) => void,
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
  loadingNotes = false,
  onLoadFolders,
  templateTitle,
  templateFilename = '',
  showTagInserter,
  setShowTagInserter,
  tagInserterMode,
  setTagInserterMode,
  tagInserterInputRef,
  setTagInserterInputRef,
  tagInserterFieldKey,
  setTagInserterFieldKey,
  fields,
}: ProcessingMethodSectionProps): React$Node {
  // Get pluginData from context for buffer buster logging
  const { pluginData } = useAppContext()

  const [tagInserterAnchorElement, setTagInserterAnchorElement] = useState<?HTMLElement>(null)
  // Track the selected processing template filename so we can open it
  const [selectedProcessingTemplateFilename, setSelectedProcessingTemplateFilename] = useState<string>('')

  // Initialize selectedProcessingTemplateFilename from notes when receivingTemplateTitle is set
  // Also update when notes load (for timing issue fix)
  React.useEffect(() => {
    const currentTitle = frontmatter.receivingTemplateTitle || frontmatter.formProcessorTitle || ''
    if (currentTitle && notes.length > 0) {
      const matchingNote = notes.find((note: NoteOption) => {
        // Match by title (preferred) or filename
        return note.title === currentTitle || note.filename === currentTitle
      })
      if (matchingNote && matchingNote.filename) {
        setSelectedProcessingTemplateFilename(matchingNote.filename)
      } else {
        // If no match found but we have a title, clear the filename to prevent stale state
        setSelectedProcessingTemplateFilename('')
      }
    } else {
      setSelectedProcessingTemplateFilename('')
    }
  }, [frontmatter.receivingTemplateTitle, frontmatter.formProcessorTitle, notes])

  // Helper function to handle tag inserter button clicks
  const handleTagInserterButtonClick = (e: any, mode: 'field' | 'date', fieldKey: string) => {
    e.preventDefault()
    e.stopPropagation()

    // Store the button element for positioning
    const buttonElement = e.currentTarget instanceof HTMLElement ? e.currentTarget : null

    // Ensure ref is set before opening modal
    const activeElement = document.activeElement
    if (activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLInputElement) {
      setTagInserterInputRef(activeElement)
      setTagInserterFieldKey(fieldKey)
    } else {
      // Find the associated textarea/input (the one this button is next to)
      const container = e.currentTarget.closest('.frontmatter-field')
      const textarea = container?.querySelector('textarea')
      const input = container?.querySelector('input[type="text"]')
      if (textarea instanceof HTMLTextAreaElement) {
        setTagInserterInputRef(textarea)
        setTagInserterFieldKey(fieldKey)
      } else if (input instanceof HTMLInputElement) {
        setTagInserterInputRef(input)
        setTagInserterFieldKey(fieldKey)
      }
    }
    setTagInserterMode(mode)
    setTagInserterAnchorElement(buttonElement)
    setShowTagInserter(true)
  }

  return (
    <>
      <div className="frontmatter-field">
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          Form Processing Method:
          <InfoIcon text="Choose how form submissions should be processed: Write directly to an existing note, create a new note each time, or use a separate processing template for more complex logic." />
        </label>
        <select
          value={processingMethod || 'create-new'}
          onChange={(e) => onFrontmatterChange('processingMethod', e.target.value)}
          style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
        >
          <option value="create-new">Create New Note on Each Submission</option>
          <option value="write-existing">Write to Existing Note</option>
          <option value="form-processor">Use Form Processor Template</option>
          <option value="run-js-only">Run JS Only (no note creation)</option>
        </select>
        <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', fontStyle: 'italic' }}>
          {processingMethod === 'write-existing' && 'Write form data directly to an existing note using TemplateRunner'}
          {processingMethod === 'create-new' && 'Create a new note with form data using TemplateRunner'}
          {processingMethod === 'form-processor' && 'Use a separate processing template to handle form submissions'}
          {processingMethod === 'run-js-only' && 'Run JavaScript template code only - no note creation or validation'}
        </div>
      </div>

      {/* Show in Editor checkbox - label changes based on processing method */}
      {/* Hide for run-js-only since there's no note to open */}
      {processingMethod !== 'run-js-only' && (
        <div className="frontmatter-field">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={frontmatter.shouldOpenInEditor !== false} onChange={(e) => onFrontmatterChange('shouldOpenInEditor', e.target.checked)} />
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {(processingMethod === 'write-existing' || !processingMethod) && 'Open target note in Editor on Submit'}
              {processingMethod === 'create-new' && 'Open new note in Editor on Submit'}
              {processingMethod === 'form-processor' && 'Open processed note in Editor on Submit'}
              <InfoIcon text="If checked, the target note will automatically open in the NotePlan editor after the form is submitted, allowing you to immediately see the results." />
            </span>
          </label>
        </div>
      )}

      {/* Option A: Write to Existing File */}
      {processingMethod === 'write-existing' && (
        <>
          <div className="frontmatter-field" style={{ marginTop: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Space:
              <InfoIcon text="Select the Space (Private or Teamspace) where the target note should be located. Notes will be filtered to only show notes from the selected space." />
            </label>
            <SpaceChooser
              label=""
              value={frontmatter.space || ''}
              onChange={(spaceId: string) => {
                onFrontmatterChange('space', spaceId)
                // Clear note selection when space changes to avoid confusion
                onFrontmatterChange('getNoteTitled', '')
                // Reload notes and folders to reflect the new space filter (force reload to ensure fresh data)
                // Pass spaceId directly to avoid reading stale frontmatter.space value
                onLoadNotes(false, true, spaceId).catch((error) => {
                  console.error('Error reloading notes after space change:', error)
                })
                onLoadFolders(true, spaceId).catch((error) => {
                  console.error('Error reloading folders after space change:', error)
                })
              }}
              placeholder="Select space (Private or Teamspace)"
              compactDisplay={true}
              requestFromPlugin={requestFromPlugin}
              showValue={false}
            />
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', fontStyle: 'italic' }}>
              {frontmatter.space ? 'Only notes from the selected space will be shown' : 'Private notes (default) - only private notes will be shown'}
            </div>
          </div>
          <div className="frontmatter-field" style={{ marginTop: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Target Note:
              <InfoIcon text="The note where form data will be written. You can select an existing note, or use special values like <today>, <current>, <thisweek>, <nextweek>, or <choose> to prompt the user each time." />
            </label>
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
              spaceFilter={frontmatter.space || ''}
              compactDisplay={true}
              requestFromPlugin={requestFromPlugin}
              onNotesChanged={() => {
                onLoadNotes(false) // Load all note types for write-existing method
              }}
              onOpen={() => {
                // Lazy load notes when dropdown opens
                // For write-existing, need all note types (including calendar/relative notes like <today>)
                if (notes.length === 0) {
                  onLoadNotes(false).catch((error) => {
                    console.error('Error loading notes:', error)
                  })
                }
              }}
              isLoading={notes.length === 0 && loadingNotes}
            />
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', fontStyle: 'italic' }}>
              Select a note or use special values: &lt;today&gt;, &lt;current&gt;, &lt;thisweek&gt;, &lt;nextweek&gt;, &lt;choose&gt;
            </div>
          </div>
          <div className="frontmatter-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Write Location:
              <InfoIcon text="Where in the target note the content should be written: Append to the end, prepend to the beginning, write under a specific heading, or replace the entire note contents." />
            </label>
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
              <option value="append">Write at end of note</option>
              <option value="prepend">Write at beginning of note</option>
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
                    frontmatter.getNoteTitled ? frontmatter.getNoteFilename || notes.find((n: NoteOption) => n.title === frontmatter.getNoteTitled)?.filename || null : null
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
                  <input type="checkbox" checked={frontmatter.createMissingHeading !== false} onChange={(e) => onFrontmatterChange('createMissingHeading', e.target.checked)} />
                  Create heading if it doesn&apos;t exist
                </label>
              </div>
            </>
          )}
          <div className="frontmatter-field" style={{ marginTop: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Content to Insert:
              <InfoIcon text="The template content that will be written to the target note. Click +Field or +Date buttons to insert tags. Or use template tags like <%- fieldKey %> to insert form field values, or <%- date.format('YYYY-MM-DD') %> for dates. " />
            </label>
            <TemplateTagEditor
              value={frontmatter.templateBody || ''}
              onChange={(value) => onFrontmatterChange('templateBody', value)}
              onFocus={(e) => {
                const target = e.target
                if (target instanceof HTMLTextAreaElement) {
                  setTagInserterInputRef(target)
                  setTagInserterFieldKey('templateBody')
                }
              }}
              placeholder=""
              minRows={5}
              maxRows={15}
              fields={fields.filter((f) => f.key && f.type !== 'separator' && f.type !== 'heading')}
              actionButtons={
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleTagInserterButtonClick(e, 'field', 'templateBody')
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#f0f0f0',
                      border: '1px solid #ccc',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      position: 'relative',
                      zIndex: 100,
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
                      handleTagInserterButtonClick(e, 'date', 'templateBody')
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#f0f0f0',
                      border: '1px solid #ccc',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      position: 'relative',
                      zIndex: 100,
                    }}
                    title="Insert date format"
                  >
                    + Date
                  </button>
                </>
              }
            />
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', fontStyle: 'italic' }}>
              Use template tags like &lt;%- fieldKey %&gt; for form fields, or &lt;%- date.format(&quot;YYYY-MM-DD&quot;) %&gt; for dates
            </div>
          </div>
        </>
      )}

      {/* Option B: Create New Note */}
      {processingMethod === 'create-new' && (
        <>
          <div className="frontmatter-field" style={{ marginTop: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Space:
              <InfoIcon text="Select the Space (Private or Teamspace) where the new note should be created." />
            </label>
            <SpaceChooser
              label=""
              value={frontmatter.space || ''}
              onChange={(spaceId: string) => {
                onFrontmatterChange('space', spaceId)
                // Reload notes and folders to reflect the new space filter (force reload)
                onLoadNotes(false, true, spaceId).catch((error) => {
                  console.error('Error reloading notes after space change:', error)
                })
                onLoadFolders(true, spaceId).catch((error) => {
                  console.error('Error reloading folders after space change:', error)
                })
              }}
              placeholder="Select space (Private or Teamspace)"
              compactDisplay={true}
              requestFromPlugin={requestFromPlugin}
              showValue={false}
            />
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', fontStyle: 'italic' }}>
              {frontmatter.space ? 'New note will be created in the selected space' : 'Private notes (default) - new note will be created in Private space'}
            </div>
          </div>
          <div className="frontmatter-field" style={{ marginTop: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              New Note Title:
              <InfoIcon text="The title for the new note that will be created. You can use template tags like <%- fieldKey %> to dynamically generate the title based on form field values. The field expands to show long template tags." />
            </label>
            <TemplateTagEditor
              value={frontmatter.newNoteTitle || ''}
              onChange={(value) => {
                // Strip newlines only (allow trailing spaces - trim on save)
                const cleanedValue = value.replace(/\n/g, ' ')
                onFrontmatterChange('newNoteTitle', cleanedValue)
              }}
              onFocus={(e) => {
                const target = e.target
                if (target instanceof HTMLTextAreaElement) {
                  setTagInserterInputRef(target)
                  setTagInserterFieldKey('newNoteTitle')
                }
              }}
              placeholder="e.g., <%- noteTitle %> or Project: <%- projectName %>"
              minRows={2}
              maxRows={5}
              fields={fields.filter((f) => f.key && f.type !== 'separator' && f.type !== 'heading')}
              actionButtons={
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleTagInserterButtonClick(e, 'field', 'newNoteTitle')
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#f0f0f0',
                      border: '1px solid #ccc',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      position: 'relative',
                      zIndex: 100,
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
                      handleTagInserterButtonClick(e, 'date', 'newNoteTitle')
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#f0f0f0',
                      border: '1px solid #ccc',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      position: 'relative',
                      zIndex: 100,
                    }}
                    title="Insert date format"
                  >
                    + Date
                  </button>
                </>
              }
            />
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', fontStyle: 'italic' }}>
              Use template tags like &lt;%- fieldKey %&gt; for form fields, or &lt;%- date.format(&quot;YYYY-MM-DD&quot;) %&gt; for dates
            </div>
          </div>
          <div className="frontmatter-field" style={{ marginTop: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Content to Insert:
              <InfoIcon text="The template content that will be used to create the new note. Click +Field or +Date buttons to insert tags. Or use template tags like <%- fieldKey %> to insert form field values, or <%- date.format('YYYY-MM-DD') %> for dates." />
            </label>
            <TemplateTagEditor
              value={frontmatter.templateBody || ''}
              onChange={(value) => onFrontmatterChange('templateBody', value)}
              onFocus={(e) => {
                const target = e.target
                if (target instanceof HTMLTextAreaElement) {
                  setTagInserterInputRef(target)
                  setTagInserterFieldKey('templateBody')
                }
              }}
              placeholder=""
              minRows={5}
              maxRows={15}
              fields={fields.filter((f) => f.key && f.type !== 'separator' && f.type !== 'heading')}
              actionButtons={
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleTagInserterButtonClick(e, 'field', 'templateBody')
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#f0f0f0',
                      border: '1px solid #ccc',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      position: 'relative',
                      zIndex: 100,
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
                      handleTagInserterButtonClick(e, 'date', 'templateBody')
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#f0f0f0',
                      border: '1px solid #ccc',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      position: 'relative',
                      zIndex: 100,
                    }}
                    title="Insert date format"
                  >
                    + Date
                  </button>
                </>
              }
            />
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', fontStyle: 'italic' }}>
              Enter the template content that will be used to create the new note. Use tags like &lt;%- fieldKey %&gt; for form fields, or &lt;%-
              date.format(&quot;YYYY-MM-DD&quot;) %&gt; for dates.
            </div>
          </div>
          <div className="frontmatter-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Folder:
              <InfoIcon text="The folder where the new note will be created. Leave empty to create the note in the root folder, or select a specific folder. You can also create a new folder by using Option-click on a folder." />
            </label>
            <FolderChooser
              label=""
              value={frontmatter.newNoteFolder || ''}
              folders={folders}
              onChange={(folder: string) => {
                onFrontmatterChange('newNoteFolder', folder)
              }}
              placeholder="Select folder (optional)"
              includeNewFolderOption={true}
              spaceFilter={frontmatter.space || ''}
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

      {/* Option D: Run JS Only */}
      {processingMethod === 'run-js-only' && (
        <>
          <div
            className="frontmatter-field"
            style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--bg-alt-color, #f5f5f5)', borderRadius: '4px', border: '1px solid var(--divider-color, #ddd)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.5rem' }}>
              <strong>JavaScript Template Code:</strong>
              <InfoIcon text="For 'run-js-only' method, include a TemplateJS block field in your form fields. The JavaScript code in that field will be executed when the form is submitted. No note creation or validation is performed." />
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--fg-main-color, #333)', lineHeight: '1.5' }}>
              <p style={{ margin: '0 0 0.5rem 0' }}>
                To use this method, add a <strong>TemplateJS Block</strong> field to your form fields list. The JavaScript code in that field will be executed when the form is
                submitted.
              </p>
              <p style={{ margin: '0', fontStyle: 'italic', color: 'var(--fg-placeholder-color, rgba(76, 79, 105, 0.7))' }}>
                Form values are available as variables in the TemplateJS code. No note creation or validation is performed - the code runs directly.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Option C: Form Processor */}
      {processingMethod === 'form-processor' && (
        <>
          <div className="frontmatter-field" style={{ marginTop: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Space:
              <InfoIcon text="Select the Space (Private or Teamspace) where the processing template should be located. Templates will be filtered to only show templates from the selected space." />
            </label>
            <SpaceChooser
              label=""
              value={frontmatter.space || ''}
              onChange={(spaceId: string) => {
                onFrontmatterChange('space', spaceId)
                // Clear template selection when space changes to avoid confusion
                onFrontmatterChange('receivingTemplateTitle', '')
                setSelectedProcessingTemplateFilename('')
                // Reload notes and folders to reflect the new space filter (force reload to ensure fresh data)
                // Pass spaceId directly to avoid reading stale frontmatter.space value
                onLoadNotes(true, true, spaceId).catch((error) => {
                  console.error('Error reloading notes after space change:', error)
                })
                onLoadFolders(true, spaceId).catch((error) => {
                  console.error('Error reloading folders after space change:', error)
                })
              }}
              placeholder="Select space (Private or Teamspace)"
              compactDisplay={true}
              requestFromPlugin={requestFromPlugin}
              showValue={false}
            />
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', fontStyle: 'italic' }}>
              {frontmatter.space ? 'Only templates from the selected space will be shown' : 'Private notes (default) - only private templates will be shown'}
            </div>
          </div>
          <div className="frontmatter-field" style={{ marginTop: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Processing Template:
              <InfoIcon text="A separate template note that will process the form submission. This template should be in the @Forms directory and have type 'forms-processor'. The template receives the form data as JSON and can perform complex processing logic." />
            </label>
            <div
              className={`processing-template-chooser-container ${
                frontmatter.receivingTemplateTitle || frontmatter.formProcessorTitle ? 'note-chooser-with-open-button' : 'note-chooser-no-open-button'
              }`}
            >
              <div className="processing-template-chooser-wrapper">
                <NoteChooser
                  label=""
                  value={frontmatter.receivingTemplateTitle || frontmatter.formProcessorTitle || ''}
                  notes={notes}
                  onChange={(noteTitle: string, noteFilename: string) => {
                    // Ensure we're setting the note title (not filename) to receivingTemplateTitle
                    const trimmedTitle = noteTitle ? noteTitle.trim() : ''
                    logDebug(
                      pluginData,
                      `ProcessingMethodSection: NoteChooser onChange called: noteTitle="${noteTitle}", noteFilename="${noteFilename}", trimmedTitle="${trimmedTitle}"`,
                    )
                    setSelectedProcessingTemplateFilename(noteFilename || '')
                    if (trimmedTitle) {
                      logDebug(pluginData, `ProcessingMethodSection: Setting receivingTemplateTitle to: "${trimmedTitle}"`)
                      onFrontmatterChange('receivingTemplateTitle', trimmedTitle)
                      // Also clear formProcessorTitle if it exists and is different (for backward compatibility cleanup)
                      if (frontmatter.formProcessorTitle && frontmatter.formProcessorTitle !== trimmedTitle) {
                        onFrontmatterChange('formProcessorTitle', '')
                      }
                    } else {
                      // If empty, clear both
                      logDebug(pluginData, 'ProcessingMethodSection: Clearing receivingTemplateTitle')
                      onFrontmatterChange('receivingTemplateTitle', '')
                      if (frontmatter.formProcessorTitle) {
                        onFrontmatterChange('formProcessorTitle', '')
                      }
                    }
                  }}
                  placeholder="Select processing template"
                  includePersonalNotes={true}
                  includeCalendarNotes={false}
                  includeRelativeNotes={false}
                  includeTeamspaceNotes={true}
                  spaceFilter={frontmatter.space || ''}
                  filterByType={['forms-processor', 'template-runner']}
                  includeTemplatesAndForms={true}
                  allowBackwardsCompatible={true}
                  requestFromPlugin={requestFromPlugin}
                  onNotesChanged={() => {
                    onLoadNotes(true) // Load only project notes for processing templates (faster)
                  }}
                  onOpen={() => {
                    // Lazy load notes when dropdown opens - always reload to ensure fresh data
                    // For processing templates, only need project notes (faster)
                    onLoadNotes(true, true).catch((error) => {
                      console.error('Error loading notes:', error)
                    })
                  }}
                  isLoading={notes.length === 0 && loadingNotes}
                  showCalendarChooserIcon={false}
                  shortDescriptionOnLine2={true}
                />
              </div>
              {(selectedProcessingTemplateFilename || frontmatter.receivingTemplateTitle || frontmatter.formProcessorTitle) && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      // If we have a filename, use it; otherwise try to find it from the title
                      let filenameToOpen = selectedProcessingTemplateFilename
                      const currentTitle = frontmatter.receivingTemplateTitle || frontmatter.formProcessorTitle || ''

                      logDebug(
                        pluginData,
                        `ProcessingMethodSection: Open button clicked: selectedProcessingTemplateFilename="${selectedProcessingTemplateFilename}", currentTitle="${currentTitle}", notes.length=${notes.length}`,
                      )

                      // If no filename, try to find it from notes
                      if (!filenameToOpen && currentTitle) {
                        // If notes aren't loaded yet, load them directly via requestFromPlugin
                        // This ensures we have the notes data immediately in this async function
                        let notesToSearch = notes
                        if (notes.length === 0) {
                          logDebug(pluginData, `ProcessingMethodSection: Notes not loaded, loading notes for processing templates via requestFromPlugin...`)
                          try {
                            const notesData = await requestFromPlugin('getNotes', {
                              includePersonalNotes: true,
                              includeCalendarNotes: false, // Skip calendar notes for processing templates (performance)
                              includeRelativeNotes: false, // Skip relative notes for processing templates
                              includeTeamspaceNotes: true,
                              space: frontmatter.space || '', // Filter by selected space
                              filterByType: ['forms-processor', 'template-runner'],
                              includeTemplatesAndForms: true,
                            })
                            if (Array.isArray(notesData)) {
                              notesToSearch = notesData
                              logDebug(pluginData, `ProcessingMethodSection: Loaded ${notesData.length} notes via requestFromPlugin`)
                            }
                          } catch (error) {
                            logDebug(pluginData, `ProcessingMethodSection: Error loading notes: ${error.message}`)
                          }
                        }

                        // Try to find the note in the notes array
                        if (notesToSearch.length > 0) {
                          const matchingNote = notesToSearch.find((note: NoteOption) => note.title === currentTitle)
                          if (matchingNote && matchingNote.filename) {
                            filenameToOpen = matchingNote.filename
                            logDebug(pluginData, `ProcessingMethodSection: Found matching note: filename="${matchingNote.filename}"`)
                          } else {
                            logDebug(pluginData, `ProcessingMethodSection: No matching note found in ${notesToSearch.length} notes for title="${currentTitle}"`)
                          }
                        }
                      }

                      if (filenameToOpen) {
                        logDebug(pluginData, `ProcessingMethodSection: Opening note with filename="${filenameToOpen}"`)
                        await requestFromPlugin('openNote', {
                          filename: filenameToOpen,
                        })
                      } else if (currentTitle) {
                        // Fallback: try to open by title directly
                        logDebug(pluginData, `ProcessingMethodSection: No filename found, trying to open by title: "${currentTitle}"`)
                        try {
                          await requestFromPlugin('openNote', {
                            title: currentTitle,
                          })
                        } catch (titleError) {
                          const errorMsg = `Could not find or open processing template "${currentTitle}". Please select the template again.`
                          logDebug(pluginData, `ProcessingMethodSection: ${errorMsg}`)
                          console.error(errorMsg)
                        }
                      } else {
                        const errorMsg = `Could not find filename for processing template. Please select the template again.`
                        logDebug(pluginData, `ProcessingMethodSection: ${errorMsg}`)
                        console.error(errorMsg)
                      }
                    } catch (error) {
                      logDebug(pluginData, `ProcessingMethodSection: Error opening note: ${error.message}`)
                      console.error('openNote: Error opening note:', error)
                    }
                  }}
                  className="PCButton processing-template-open-button"
                  style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  title={`Open "${frontmatter.receivingTemplateTitle || frontmatter.formProcessorTitle || ''}" in NotePlan`}
                >
                  Open
                </button>
              )}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', fontStyle: 'italic' }}>Select an existing processing template, or create a new one below</div>
          </div>
          <div className="frontmatter-field">
            <button
              type="button"
              onClick={async () => {
                try {
                  // This will be handled by the plugin - we'll need to add a request handler
                  const result = await requestFromPlugin('createProcessingTemplate', {
                    formTemplateTitle: templateTitle,
                    formTemplateFilename: templateFilename,
                  })
                  console.log(`createProcessingTemplate: Received result: ${JSON.stringify(result)}, type: ${typeof result}, JSON: ${JSON.stringify(result)}`)
                  let processingTitle = null
                  let processingFilename = null

                  if (result && typeof result === 'string') {
                    // Backward compatibility: if result is just a string
                    processingTitle = result
                  } else if (result && typeof result === 'object') {
                    // New format: result.data contains { processingTitle, processingFilename }
                    if (result.data && typeof result.data === 'object' && result.data.processingTitle) {
                      processingTitle = result.data.processingTitle
                      processingFilename = result.data.processingFilename || null
                    } else if (result.data && typeof result.data === 'string') {
                      // Handle case where response might be wrapped in an object with just a string
                      processingTitle = result.data
                    } else if (result.processingTitle) {
                      // Handle case where response includes both title and filename at top level
                      processingTitle = result.processingTitle
                      processingFilename = result.processingFilename || null
                    }
                  }

                  if (processingTitle) {
                    console.log(`createProcessingTemplate: Updating receivingTemplateTitle to: ${processingTitle}, filename: ${processingFilename || 'null'}`)
                    onFrontmatterChange('receivingTemplateTitle', processingTitle)
                    if (processingFilename) {
                      setSelectedProcessingTemplateFilename(processingFilename)
                    }
                    // Reload notes so the new processing template appears in the dropdown
                    await onLoadNotes(true) // Load only project notes for processing templates
                  } else {
                    console.warn(`createProcessingTemplate: Unexpected result format: ${JSON.stringify(result)}, typeof: ${typeof result}, JSON: ${JSON.stringify(result)}`)
                  }
                } catch (error) {
                  const errorMessage = error?.message || error?.toString() || String(error) || 'Unknown error'
                  const errorStack = error?.stack || 'No stack trace'
                  console.error('createProcessingTemplate: Error creating processing template:', {
                    error,
                    message: errorMessage,
                    stack: errorStack,
                    type: typeof error,
                    stringified: JSON.stringify(error),
                  })
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
      <div className="frontmatter-field" style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--divider-color, #CDCFD0)' }}>
        <label style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Debug: Frontmatter Values (JSON)</label>
        <div
          style={{
            backgroundColor: 'var(--bg-alt-color, #f5f5f5)',
            border: '1px solid var(--divider-color, #CDCFD0)',
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
          onClose={() => {
            setShowTagInserter(false)
            setTagInserterAnchorElement(null)
          }}
          anchorElement={tagInserterAnchorElement}
          onInsert={(tag: string) => {
            // Insert tag at cursor position
            if (tagInserterInputRef && tagInserterFieldKey) {
              const start = tagInserterInputRef.selectionStart || 0
              const end = tagInserterInputRef.selectionEnd || 0
              const currentValue = tagInserterInputRef.value || ''
              const newValue = currentValue.substring(0, start) + tag + currentValue.substring(end)

              // Update the field based on the tracked field key
              onFrontmatterChange(tagInserterFieldKey, newValue)

              // Set cursor position after inserted text
              setTimeout(() => {
                tagInserterInputRef.focus()
                const newCursorPos = start + tag.length
                tagInserterInputRef.setSelectionRange(newCursorPos, newCursorPos)
              }, 0)
            }
          }}
          fields={fields
            .filter((f) => f.key && f.type !== 'separator' && f.type !== 'heading' && f.type !== 'templatejs-block')
            .map((f) => ({ key: f.key || '', label: f.label, type: f.type }))}
          showDateFormats={true}
          mode={tagInserterMode}
        />
      )}
    </>
  )
}

export default ProcessingMethodSection
