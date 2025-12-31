// @flow
//--------------------------------------------------------------------------
// FormSettings Component - Left column showing form configuration settings
//--------------------------------------------------------------------------

import React, { useState, type Node } from 'react'
import { ProcessingMethodSection } from './ProcessingMethodSection.jsx'
import { PositionInput } from './PositionInput.jsx'
import { InfoIcon } from '@helpers/react/InfoIcon.jsx'
import { type TSettingItem } from '@helpers/react/DynamicDialog/DynamicDialog.jsx'
import { type NoteOption } from '@helpers/react/DynamicDialog/NoteChooser.jsx'

type FormSettingsProps = {
  frontmatter: { [key: string]: any },
  onFrontmatterChange: (key: string, value: any) => void,
  notes: Array<NoteOption>,
  folders: Array<string>,
  requestFromPlugin: (command: string, data?: any) => Promise<any>,
  onLoadNotes: (forceReload?: boolean, forProcessingTemplates?: boolean) => Promise<void>,
  loadingNotes?: boolean,
  onLoadFolders: (forceReload?: boolean) => Promise<void>,
  templateTitle: string,
  templateFilename?: string,
  showTagInserter: boolean,
  setShowTagInserter: (show: boolean) => void,
  tagInserterInputRef: ?HTMLInputElement | ?HTMLTextAreaElement,
  setTagInserterInputRef: (ref: ?HTMLInputElement | ?HTMLTextAreaElement) => void,
  tagInserterFieldKey: string,
  setTagInserterFieldKey: (key: string) => void,
  tagInserterMode: 'field' | 'date' | 'both',
  setTagInserterMode: (mode: 'field' | 'date' | 'both') => void,
  fields: Array<TSettingItem>,
}

export function FormSettings({
  frontmatter,
  onFrontmatterChange,
  notes,
  folders,
  requestFromPlugin,
  onLoadNotes,
  loadingNotes = false,
  onLoadFolders,
  templateTitle,
  templateFilename = '',
  showTagInserter,
  setShowTagInserter,
  tagInserterInputRef,
  setTagInserterInputRef,
  tagInserterFieldKey,
  setTagInserterFieldKey,
  tagInserterMode,
  setTagInserterMode,
  fields,
}: FormSettingsProps): Node {
  const [showFormWindowOptions, setShowFormWindowOptions] = useState<boolean>(false)

  return (
    <div className="form-builder-sidebar">
      <div className="sidebar-section">
        <div className="form-section-header">
          <h3>Form Settings</h3>
        </div>
        <div className="frontmatter-editor">
          <div className="frontmatter-field frontmatter-field-window-title">
            <label className="frontmatter-field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Window Title:
              <InfoIcon text="The title that appears in the window bar when the form is opened. This is what users will see in the window title bar." />
            </label>
            <input
              className="frontmatter-field-input frontmatter-field-input-window-title"
              type="text"
              value={frontmatter.windowTitle || ''}
              onChange={(e) => onFrontmatterChange('windowTitle', e.target.value)}
              placeholder="Form Window"
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
            />
          </div>
          <div className="frontmatter-field frontmatter-field-form-title">
            <label className="frontmatter-field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Form Heading:
              <InfoIcon text="The main heading that appears at the top of the form. This is the primary title users will see when they open the form." />
            </label>
            <input
              className="frontmatter-field-input frontmatter-field-input-form-title"
              type="text"
              value={frontmatter.formTitle || ''}
              onChange={(e) => onFrontmatterChange('formTitle', e.target.value)}
              placeholder="Form Heading"
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
            />
          </div>
          {/* Form Window Options - Collapsible Section */}
          <div className="frontmatter-field frontmatter-field-form-window-options">
            <label
              className="frontmatter-field-label frontmatter-field-label-collapsible"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                userSelect: 'none',
                marginBottom: showFormWindowOptions ? '0.5rem' : '0',
              }}
              onClick={() => setShowFormWindowOptions(!showFormWindowOptions)}
            >
              <span
                className="frontmatter-field-collapse-icon"
                style={{
                  display: 'inline-block',
                  transition: 'transform 0.2s',
                  transform: showFormWindowOptions ? 'rotate(90deg)' : 'rotate(0deg)',
                  fontSize: '0.75rem',
                  color: '#666',
                }}
              >
                ▶
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: '500' }}>
                Form Window Options
                <InfoIcon text="Options for controlling the form window behavior and appearance." />
              </span>
            </label>
            {showFormWindowOptions && (
              <div className="frontmatter-field-form-window-options-content" style={{ marginTop: '0.75rem', paddingLeft: '1.25rem', borderLeft: '2px solid #e0e0e0' }}>
                <div className="frontmatter-field frontmatter-field-allow-empty-submit" style={{ marginBottom: '0.75rem' }}>
                  <label className="frontmatter-field-label frontmatter-field-label-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      className="frontmatter-field-checkbox frontmatter-field-checkbox-allow-empty-submit"
                      type="checkbox"
                      checked={frontmatter.allowEmptySubmit || false}
                      onChange={(e) => onFrontmatterChange('allowEmptySubmit', e.target.checked)}
                    />
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      Allow Empty Submit
                      <InfoIcon text="If checked, users can submit the form even if no fields are filled in. If unchecked, at least one field must have a value before the form can be submitted." />
                    </span>
                  </label>
                </div>
                <div className="frontmatter-field frontmatter-field-hide-dependent-items" style={{ marginBottom: '0.75rem' }}>
                  <label className="frontmatter-field-label frontmatter-field-label-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      className="frontmatter-field-checkbox frontmatter-field-checkbox-hide-dependent-items"
                      type="checkbox"
                      checked={frontmatter.hideDependentItems || false}
                      onChange={(e) => onFrontmatterChange('hideDependentItems', e.target.checked)}
                    />
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      Hide Dependent Items
                      <InfoIcon text="If checked, fields in your form that depend on other fields (using 'dependsOnKey') will be hidden until their dependency is satisfied. This creates a cleaner form interface by only showing relevant fields." />
                    </span>
                  </label>
                </div>
                <div className="frontmatter-field frontmatter-field-window-size-position">
                  <label className="frontmatter-field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.5rem' }}>
                    Window Size & Position:
                    <InfoIcon text="The size and position of the popup window. You can use pixels (e.g., 750) or percentages (e.g., 50%). Minimum size is 200x200 pixels. Leave empty to use defaults or center the window." />
                  </label>
                  <div className="frontmatter-field-window-size-position-controls" style={{ marginTop: '0.5rem' }}>
                    <div className="frontmatter-field-window-size-position-row" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div className="frontmatter-field-window-size-position-field frontmatter-field-window-width" style={{ flex: '1 1 0', minWidth: '80px' }}>
                        <label className="frontmatter-field-window-size-position-label" style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>
                          Width:
                        </label>
                        <input
                          className="frontmatter-field-input frontmatter-field-input-window-width"
                          type="text"
                          value={frontmatter.width || ''}
                          onChange={(e) => onFrontmatterChange('width', e.target.value || undefined)}
                          onBlur={(e) => {
                            const value = e.target.value.trim()
                            if (value) {
                              const numValue = parseInt(value, 10)
                              if (isNaN(numValue) && !value.endsWith('%')) {
                                alert('Window width must be a number (e.g., 750) or a percentage (e.g., 50%).')
                                onFrontmatterChange('width', undefined)
                              } else if (!value.endsWith('%') && numValue < 200) {
                                alert('Window width must be at least 200 pixels. Please enter a value of 200 or greater, or use a percentage.')
                                onFrontmatterChange('width', undefined)
                              }
                            }
                          }}
                          placeholder="750 or 50%"
                          style={{ width: '100%', padding: '0.4rem', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div className="frontmatter-field-window-size-position-field frontmatter-field-window-height" style={{ flex: '1 1 0', minWidth: '80px' }}>
                        <label className="frontmatter-field-window-size-position-label" style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>
                          Height:
                        </label>
                        <input
                          className="frontmatter-field-input frontmatter-field-input-window-height"
                          type="text"
                          value={frontmatter.height || ''}
                          onChange={(e) => onFrontmatterChange('height', e.target.value || undefined)}
                          onBlur={(e) => {
                            const value = e.target.value.trim()
                            if (value) {
                              const numValue = parseInt(value, 10)
                              if (isNaN(numValue) && !value.endsWith('%')) {
                                alert('Window height must be a number (e.g., 750) or a percentage (e.g., 50%).')
                                onFrontmatterChange('height', undefined)
                              } else if (!value.endsWith('%') && numValue < 200) {
                                alert('Window height must be at least 200 pixels. Please enter a value of 200 or greater, or use a percentage.')
                                onFrontmatterChange('height', undefined)
                              }
                            }
                          }}
                          placeholder="750 or 50%"
                          style={{ width: '100%', padding: '0.4rem', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div className="frontmatter-field-window-size-position-field frontmatter-field-window-x" style={{ flex: '1 1 0', minWidth: '80px' }}>
                        <label className="frontmatter-field-window-size-position-label" style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>
                          X:
                        </label>
                        <div className="frontmatter-field-input-wrapper frontmatter-field-input-wrapper-window-x">
                          <PositionInput type="x" value={frontmatter.x} onChange={(value) => onFrontmatterChange('x', value)} placeholder="center, left, right, or 25%" />
                        </div>
                      </div>
                      <div className="frontmatter-field-window-size-position-field frontmatter-field-window-y" style={{ flex: '1 1 0', minWidth: '80px' }}>
                        <label className="frontmatter-field-window-size-position-label" style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>
                          Y:
                        </label>
                        <div className="frontmatter-field-input-wrapper frontmatter-field-input-wrapper-window-y">
                          <PositionInput type="y" value={frontmatter.y} onChange={(value) => onFrontmatterChange('y', value)} placeholder="center, top, bottom, or 25%" />
                        </div>
                      </div>
                    </div>
                    <div className="frontmatter-field-window-size-position-help-text" style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem', fontStyle: 'italic' }}>
                      Use pixels (e.g., 750) or percentages (e.g., 50%). Minimum Width x Height is 200 x 200 pixels. For position, use predefined choices (center, left, right, top,
                      bottom) or enter a number/percentage. Leave empty to use defaults.
                    </div>
                  </div>
                </div>
                <div className="frontmatter-field frontmatter-field-custom-css" style={{ marginTop: '1rem' }}>
                  <label className="frontmatter-field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.5rem' }}>
                    Custom CSS:
                    <InfoIcon text="Custom CSS styles for this form. Stored in a template:ignore codeblock and injected into the form window when opened. Use this to override specific styles for this form only." />
                  </label>
                  <textarea
                    className="frontmatter-field-textarea frontmatter-field-textarea-custom-css"
                    value={frontmatter.customCSS || ''}
                    onChange={(e) => onFrontmatterChange('customCSS', e.target.value)}
                    placeholder="/* Enter custom CSS for this form */&#10;.dynamic-dialog {&#10;  /* Your styles here */&#10;}"
                    rows={8}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                      fontSize: '0.85rem',
                      lineHeight: '1.4',
                      resize: 'vertical',
                      marginTop: '0.25rem',
                    }}
                  />
                  <div className="frontmatter-field-help-text" style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem', fontStyle: 'italic' }}>
                    Custom CSS will be saved in a <code>template:ignore customCSS</code> codeblock and injected into the form window when opened.
                  </div>
                </div>
              </div>
            )}
          </div>
          <ProcessingMethodSection
            processingMethod={frontmatter.processingMethod || 'write-existing'}
            frontmatter={frontmatter}
            notes={notes}
            folders={folders}
            requestFromPlugin={requestFromPlugin}
            onFrontmatterChange={onFrontmatterChange}
            onLoadNotes={onLoadNotes}
            onLoadFolders={onLoadFolders}
            loadingNotes={loadingNotes}
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
        </div>
      </div>
    </div>
  )
}

export default FormSettings
