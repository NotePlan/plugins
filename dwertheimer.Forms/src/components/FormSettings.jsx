// @flow
//--------------------------------------------------------------------------
// FormSettings Component - Left column showing form configuration settings
//--------------------------------------------------------------------------

import React, { useState, type Node } from 'react'
import { ProcessingMethodSection } from './ProcessingMethodSection.jsx'
import { InfoIcon } from '@helpers/react/InfoIcon.jsx'
import { type TSettingItem } from '@helpers/react/DynamicDialog/DynamicDialog.jsx'
import { type NoteOption } from '@helpers/react/DynamicDialog/NoteChooser.jsx'
import { PositionInput } from './PositionInput.jsx'

type FormSettingsProps = {
  frontmatter: { [key: string]: any },
  onFrontmatterChange: (key: string, value: any) => void,
  notes: Array<NoteOption>,
  folders: Array<string>,
  requestFromPlugin: (command: string, data?: any) => Promise<any>,
  onLoadNotes: (forceReload?: boolean) => Promise<void>,
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
  const [showWindowSettings, setShowWindowSettings] = useState<boolean>(false)

  return (
    <div className="form-builder-sidebar">
      <div className="sidebar-section">
        <div className="form-section-header">
          <h3>Form Settings</h3>
        </div>
        <div className="frontmatter-editor">
          <div className="frontmatter-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Window Title:
              <InfoIcon text="The title that appears in the window bar when the form is opened. This is what users will see in the window title bar." />
            </label>
            <input
              type="text"
              value={frontmatter.windowTitle || ''}
              onChange={(e) => onFrontmatterChange('windowTitle', e.target.value)}
              placeholder="Form Window"
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
            />
          </div>
          <div className="frontmatter-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Form Heading:
              <InfoIcon text="The main heading that appears at the top of the form. This is the primary title users will see when they open the form." />
            </label>
            <input
              type="text"
              value={frontmatter.formTitle || ''}
              onChange={(e) => onFrontmatterChange('formTitle', e.target.value)}
              placeholder="Form Heading"
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
            />
          </div>
          <div className="frontmatter-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={frontmatter.allowEmptySubmit || false} onChange={(e) => onFrontmatterChange('allowEmptySubmit', e.target.checked)} />
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                Allow Empty Submit
                <InfoIcon text="If checked, users can submit the form even if no fields are filled in. If unchecked, at least one field must have a value before the form can be submitted." />
              </span>
            </label>
          </div>
          <div className="frontmatter-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={frontmatter.hideDependentItems || false} onChange={(e) => onFrontmatterChange('hideDependentItems', e.target.checked)} />
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                Hide Dependent Items
                <InfoIcon text="If checked, fields in your form that depend on other fields (using 'dependsOnKey') will be hidden until their dependency is satisfied. This creates a cleaner form interface by only showing relevant fields." />
              </span>
            </label>
          </div>
          <div className="frontmatter-field">
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                userSelect: 'none',
              }}
              onClick={() => setShowWindowSettings(!showWindowSettings)}
            >
              <span
                style={{
                  display: 'inline-block',
                  transition: 'transform 0.2s',
                  transform: showWindowSettings ? 'rotate(90deg)' : 'rotate(0deg)',
                  fontSize: '0.75rem',
                  color: '#666',
                }}
              >
                ▶
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                Window Size & Position:
                <InfoIcon text="The size and position of the popup window. You can use pixels (e.g., 750) or percentages (e.g., 50%). Minimum size is 200x200 pixels. Leave empty to use defaults or center the window." />
              </span>
            </label>
            {showWindowSettings && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <div style={{ flex: '0 0 100px' }}>
                    <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>Width:</label>
                    <input
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
                  <div style={{ flex: '0 0 100px' }}>
                    <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>Height:</label>
                    <input
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
                  <div style={{ flex: '0 0 100px' }}>
                    <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>X:</label>
                    <PositionInput type="x" value={frontmatter.x} onChange={(value) => onFrontmatterChange('x', value)} placeholder="center, left, right, or 25%" />
                  </div>
                  <div style={{ flex: '0 0 100px' }}>
                    <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>Y:</label>
                    <PositionInput type="y" value={frontmatter.y} onChange={(value) => onFrontmatterChange('y', value)} placeholder="center, top, bottom, or 25%" />
                  </div>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem', fontStyle: 'italic' }}>
                  Use pixels (e.g., 750) or percentages (e.g., 50%). Minimum Width x Height is 200 x 200 pixels. For position, use predefined choices (center, left, right, top,
                  bottom) or enter a number/percentage. Leave empty to use defaults.
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
