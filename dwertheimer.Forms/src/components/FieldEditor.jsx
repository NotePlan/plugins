// @flow
//--------------------------------------------------------------------------
// FieldEditor Component - Modal editor for editing individual form fields
//--------------------------------------------------------------------------

import React, { useState, useEffect, useMemo, useRef, type Node } from 'react'
import { OptionsEditor } from './OptionsEditor.jsx'
import { type TSettingItem } from '@helpers/react/DynamicDialog/DynamicDialog.jsx'

type FieldEditorProps = {
  field: TSettingItem,
  allFields: Array<TSettingItem>,
  onSave: (field: TSettingItem) => void,
  onCancel: () => void,
  requestFromPlugin?: (command: string, dataToSend?: any, timeout?: number) => Promise<any>, // Optional function to call plugin commands
}

export function FieldEditor({ field, allFields, onSave, onCancel, requestFromPlugin }: FieldEditorProps): Node {
  const [editedField, setEditedField] = useState<TSettingItem>({ ...field })
  const [calendars, setCalendars] = useState<Array<string>>([])
  const [calendarsLoaded, setCalendarsLoaded] = useState<boolean>(false)
  const [reminderLists, setReminderLists] = useState<Array<string>>([])
  const [reminderListsLoaded, setReminderListsLoaded] = useState<boolean>(false)
  const calendarsLoadingRef = useRef<boolean>(false)
  const reminderListsLoadingRef = useRef<boolean>(false)
  const requestFromPluginRef = useRef<typeof requestFromPlugin>(requestFromPlugin)

  // Track previous field key to detect actual field changes
  const prevFieldKeyRef = useRef<string | void>(field.key)

  // Update ref when requestFromPlugin changes
  useEffect(() => {
    requestFromPluginRef.current = requestFromPlugin
  }, [requestFromPlugin])

  // Update editedField when field prop changes (e.g., when editing a different field)
  useEffect(() => {
    const fieldKeyChanged = prevFieldKeyRef.current !== field.key
    console.log('[FieldEditor DIAG] field useEffect triggered:', {
      prevKey: prevFieldKeyRef.current,
      newKey: field.key,
      keyChanged: fieldKeyChanged,
      type: field.type,
    })
    prevFieldKeyRef.current = field.key

    setEditedField({ ...field })
    // Only reset loaded states when field key actually changes (not just object reference)
    if (fieldKeyChanged && field.type === 'event-chooser') {
      console.log('[FieldEditor DIAG] field useEffect: resetting loaded states')
      setCalendarsLoaded(false)
      setReminderListsLoaded(false)
      calendarsLoadingRef.current = false
      reminderListsLoadingRef.current = false
    }
  }, [field])

  // Load calendars when editing event-chooser field
  useEffect(() => {
    const requestFn = requestFromPluginRef.current
    console.log('[FieldEditor DIAG] calendars useEffect triggered:', {
      type: editedField.type,
      calendarsLoaded,
      isLoading: calendarsLoadingRef.current,
      hasRequestFn: !!requestFn,
    })

    // Only load if we're editing an event-chooser, haven't loaded yet, not currently loading, and have requestFromPlugin
    if (editedField.type !== 'event-chooser' || calendarsLoaded || calendarsLoadingRef.current || !requestFn) {
      console.log('[FieldEditor DIAG] calendars useEffect: skipping load (conditions not met)')
      return
    }

    console.log('[FieldEditor DIAG] calendars useEffect: STARTING load')
    let isMounted = true
    calendarsLoadingRef.current = true

    requestFn('getAvailableCalendars', { writeOnly: false })
      .then((calendarsData) => {
        console.log('[FieldEditor DIAG] calendars useEffect: received data, isMounted=', isMounted, 'data type=', Array.isArray(calendarsData) ? 'array' : typeof calendarsData)
        if (isMounted && Array.isArray(calendarsData)) {
          setCalendars(calendarsData)
          setCalendarsLoaded(true)
          console.log('[FieldEditor DIAG] calendars useEffect: set calendars and loaded flag')
        }
        calendarsLoadingRef.current = false
      })
      .catch((error) => {
        console.error('[FieldEditor DIAG] calendars useEffect: ERROR loading calendars:', error)
        if (isMounted) {
          setCalendarsLoaded(true) // Set to true to prevent infinite retries
        }
        calendarsLoadingRef.current = false
      })

    return () => {
      console.log('[FieldEditor DIAG] calendars useEffect: cleanup called')
      isMounted = false
      calendarsLoadingRef.current = false
    }
  }, [editedField.type, calendarsLoaded])

  // Load reminder lists when editing event-chooser field and reminders are enabled
  useEffect(() => {
    const requestFn = requestFromPluginRef.current
    const includeReminders = ((editedField: any): { includeReminders?: boolean }).includeReminders
    console.log('[FieldEditor DIAG] reminderLists useEffect triggered:', {
      type: editedField.type,
      reminderListsLoaded,
      isLoading: reminderListsLoadingRef.current,
      hasRequestFn: !!requestFn,
      includeReminders,
    })

    if (editedField.type !== 'event-chooser' || reminderListsLoaded || reminderListsLoadingRef.current || !requestFn || !includeReminders) {
      console.log('[FieldEditor DIAG] reminderLists useEffect: skipping load (conditions not met)')
      return
    }

    console.log('[FieldEditor DIAG] reminderLists useEffect: STARTING load')
    let isMounted = true
    reminderListsLoadingRef.current = true

    requestFn('getAvailableReminderLists', {})
      .then((listsData) => {
        console.log(
          '[FieldEditor DIAG] reminderLists useEffect: received data, isMounted=',
          isMounted,
          'data type=',
          Array.isArray(listsData) ? 'array' : typeof listsData,
          'length=',
          Array.isArray(listsData) ? listsData.length : 'N/A',
        )
        if (isMounted) {
          if (Array.isArray(listsData)) {
            setReminderLists(listsData)
            setReminderListsLoaded(true)
            console.log('[FieldEditor DIAG] reminderLists useEffect: set lists and loaded flag, count=', listsData.length)
            if (listsData.length === 0) {
              console.log('[FieldEditor DIAG] reminderLists useEffect: WARNING - received empty array, user may not have any reminder lists configured')
            }
          } else {
            console.error('[FieldEditor DIAG] reminderLists useEffect: received non-array data:', typeof listsData, listsData)
            setReminderLists([])
            setReminderListsLoaded(true)
          }
        }
        reminderListsLoadingRef.current = false
      })
      .catch((error) => {
        console.error('[FieldEditor DIAG] reminderLists useEffect: ERROR loading reminder lists:', error)
        if (isMounted) {
          setReminderLists([])
          setReminderListsLoaded(true) // Set to true to prevent infinite retries
        }
        reminderListsLoadingRef.current = false
      })

    return () => {
      console.log('[FieldEditor DIAG] reminderLists useEffect: cleanup called')
      isMounted = false
      reminderListsLoadingRef.current = false
    }
  }, [editedField.type, reminderListsLoaded, ((editedField: any): { includeReminders?: boolean }).includeReminders])

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

  const needsKey = editedField.type !== 'separator' && editedField.type !== 'heading' && editedField.type !== 'autosave'

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
              <input
                type="text"
                value={editedField.key || ''}
                onChange={(e) => {
                  const newKey = e.target.value
                  updateField({ key: newKey })
                }}
                placeholder="e.g., projectName"
              />
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

          {editedField.type !== 'separator' && editedField.type !== 'heading' && editedField.type !== 'calendarpicker' && editedField.type !== 'autosave' && (
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

          {editedField.type === 'textarea' ? (
            <>
              <div className="field-editor-row">
                <label>Default Value:</label>
                <textarea value={editedField.default || ''} onChange={(e) => updateField({ default: e.target.value })} placeholder="Default value (multi-line)" rows={3} />
              </div>
              <div className="field-editor-row">
                <label>
                  <input type="checkbox" checked={editedField.required || false} onChange={(e) => updateField({ required: e.target.checked })} />
                  Required field
                </label>
              </div>
              <div className="field-editor-row">
                <label>Minimum Rows:</label>
                <input type="number" value={editedField.minRows || 3} onChange={(e) => updateField({ minRows: parseInt(e.target.value, 10) || 3 })} min="1" max="20" />
                <div className="field-editor-help">Starting height of the textarea (default: 3)</div>
              </div>
              <div className="field-editor-row">
                <label>Maximum Rows:</label>
                <input type="number" value={editedField.maxRows || 10} onChange={(e) => updateField({ maxRows: parseInt(e.target.value, 10) || 10 })} min="1" max="50" />
                <div className="field-editor-help">Maximum height before scrolling (default: 10)</div>
              </div>
            </>
          ) : null}

          {editedField.type === 'templatejs-block' ? (
            <>
              <div className="field-editor-row">
                <label>TemplateJS Code:</label>
                <textarea
                  value={((editedField: any): { templateJSContent?: string }).templateJSContent || ''}
                  onChange={(e) => {
                    updateField((({ templateJSContent: e.target.value }: any): Partial<TSettingItem>))
                  }}
                  placeholder="// Enter JavaScript to run for this form"
                  rows={10}
                  style={{ width: '100%', fontFamily: 'Menlo, monospace' }}
                />
                <div className="field-editor-help">
                  Enter without the backticks.Stored as plain text in the form definition. The form executor will wrap it in a <code>templateJS</code> code block at runtime.
                </div>
              </div>
              <div className="field-editor-row">
                <label>When to Execute:</label>
                <select
                  value={((editedField: any): { executeTiming?: 'before' | 'after' }).executeTiming || 'after'}
                  onChange={(e) => updateField((({ executeTiming: (e.target.value: any) || 'after' }: any): Partial<TSettingItem>))}
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  <option value="before">Before form fields render</option>
                  <option value="after">After form fields render</option>
                </select>
                <div className="field-editor-help">Determines when this TemplateJS block runs during processing.</div>
              </div>
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
              <div className="field-editor-row">
                <label>
                  <input
                    type="checkbox"
                    checked={((editedField: any): { shortDescriptionOnLine2?: boolean }).shortDescriptionOnLine2 || false}
                    onChange={(e) => {
                      const updated = { ...editedField }
                      ;(updated: any).shortDescriptionOnLine2 = e.target.checked
                      setEditedField(updated)
                    }}
                  />
                  Short description on second line
                </label>
                <div className="field-editor-help">When enabled, displays the short description (e.g., folder path, space name) on a second line below the label</div>
              </div>
              <div className="field-editor-row">
                <label>Source Space Field (value dependency, optional):</label>
                <select
                  value={
                    ((editedField: any): { sourceSpaceKey?: string, dependsOnSpaceKey?: string }).sourceSpaceKey ||
                    ((editedField: any): { sourceSpaceKey?: string, dependsOnSpaceKey?: string }).dependsOnSpaceKey ||
                    ''
                  }
                  onChange={(e) => {
                    const updated = { ...editedField }
                    ;(updated: any).sourceSpaceKey = e.target.value || undefined
                    // Also set old property for backward compatibility
                    if (e.target.value) {
                      ;(updated: any).dependsOnSpaceKey = e.target.value
                    } else {
                      delete (updated: any).dependsOnSpaceKey
                    }
                    setEditedField(updated)
                  }}
                >
                  <option value="">None (show folders from all spaces)</option>
                  {allFields
                    .filter((f) => f.key && f.type === 'space-chooser' && f.key !== editedField.key)
                    .map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label || f.key} ({f.key})
                      </option>
                    ))}
                </select>
                <div className="field-editor-help">
                  If specified, folders will be filtered by the space selected in the space-chooser field. This is a <strong>value dependency</strong> - the field needs the value
                  from another field to function.
                </div>
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
              <div className="field-editor-row">
                <label>
                  <input
                    type="checkbox"
                    checked={((editedField: any): { shortDescriptionOnLine2?: boolean }).shortDescriptionOnLine2 || false}
                    onChange={(e) => {
                      const updated = { ...editedField }
                      ;(updated: any).shortDescriptionOnLine2 = e.target.checked
                      setEditedField(updated)
                    }}
                  />
                  Short description on second line
                </label>
                <div className="field-editor-help">When enabled, displays the short description (e.g., folder path, space name) on a second line below the label</div>
              </div>
              <div className="field-editor-row">
                <label>
                  <input
                    type="checkbox"
                    checked={((editedField: any): { showTitleOnly?: boolean }).showTitleOnly || false}
                    onChange={(e) => {
                      const updated = { ...editedField }
                      ;(updated: any).showTitleOnly = e.target.checked
                      setEditedField(updated)
                    }}
                  />
                  Show title only (not path/title)
                </label>
                <div className="field-editor-help">
                  When enabled, displays only the note title in the label (not &quot;path / title&quot;). The path will still appear in the short description if enabled.
                </div>
              </div>
            </>
          )}

          {editedField.type === 'space-chooser' && (
            <>
              <div className="field-editor-row">
                <label>
                  <input
                    type="checkbox"
                    checked={((editedField: any): { includeAllOption?: boolean }).includeAllOption || false}
                    onChange={(e) => {
                      const updated = { ...editedField }
                      ;(updated: any).includeAllOption = e.target.checked
                      setEditedField(updated)
                    }}
                  />
                  Include &apos;All Private + Spaces&apos; option
                </label>
                <div className="field-editor-help">
                  When enabled, adds an &quot;All Private + Spaces&quot; option that returns &quot;__all__&quot; when selected. This allows users to select all spaces at once.
                  NOTE: whatever is receiving the value needs to handle the &quot;__all__&quot; value appropriately.
                </div>
              </div>
              <div className="field-editor-row">
                <label>
                  <input
                    type="checkbox"
                    checked={((editedField: any): { shortDescriptionOnLine2?: boolean }).shortDescriptionOnLine2 || false}
                    onChange={(e) => {
                      const updated = { ...editedField }
                      ;(updated: any).shortDescriptionOnLine2 = e.target.checked
                      setEditedField(updated)
                    }}
                  />
                  Short description on second line
                </label>
                <div className="field-editor-help">When enabled, displays the short description (e.g., folder path, space name) on a second line below the label</div>
              </div>
            </>
          )}

          {editedField.type === 'event-chooser' && (
            <>
              <div className="field-editor-row">
                <label>Source Date Field (value dependency, optional):</label>
                <select
                  value={
                    ((editedField: any): { sourceDateKey?: string, dependsOnDateKey?: string }).sourceDateKey ||
                    ((editedField: any): { sourceDateKey?: string, dependsOnDateKey?: string }).dependsOnDateKey ||
                    ''
                  }
                  onChange={(e) => {
                    const updated = { ...editedField }
                    ;(updated: any).sourceDateKey = e.target.value || undefined
                    // Also set old property for backward compatibility
                    if (e.target.value) {
                      ;(updated: any).dependsOnDateKey = e.target.value
                    } else {
                      delete (updated: any).dependsOnDateKey
                    }
                    setEditedField(updated)
                  }}
                >
                  <option value="">None (use today or eventDate below)</option>
                  {allFields
                    .filter((f) => f.key && (f.type === 'calendarpicker' || f.type === 'input') && f.key !== editedField.key)
                    .map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label || f.key} ({f.key}) - {f.type}
                      </option>
                    ))}
                </select>
                <div className="field-editor-help">
                  If specified, events will be loaded for the date from the selected field. The field can be a Date Picker (returns Date) or a text input with a date string
                  (YYYY-MM-DD format). If not specified, events default to today. This is a <strong>value dependency</strong> - the field needs the value from another field to
                  function.
                </div>
              </div>
              <div className="field-editor-row">
                <label>Default Date (optional, if not depending on field):</label>
                <input
                  type="text"
                  value={(() => {
                    const eventDate = ((editedField: any): { eventDate?: Date }).eventDate
                    if (!eventDate) return ''
                    if (eventDate instanceof Date) {
                      return eventDate.toISOString().split('T')[0]
                    }
                    return String(eventDate)
                  })()}
                  onChange={(e) => {
                    const updated = { ...editedField }
                    const dateStr = e.target.value
                    if (dateStr) {
                      const parsed = new Date(dateStr)
                      if (!isNaN(parsed.getTime())) {
                        ;(updated: any).eventDate = parsed
                      } else {
                        ;(updated: any).eventDate = undefined
                      }
                    } else {
                      ;(updated: any).eventDate = undefined
                    }
                    setEditedField(updated)
                  }}
                  placeholder="YYYY-MM-DD (e.g., 2024-01-15)"
                />
                <div className="field-editor-help">Default date to load events for (if not depending on another field). Leave empty to use today. Format: YYYY-MM-DD</div>
              </div>
              <div className="field-editor-row">
                <label>
                  <input
                    type="checkbox"
                    checked={((editedField: any): { allCalendars?: boolean }).allCalendars || false}
                    onChange={(e) => {
                      const updated = { ...editedField }
                      ;(updated: any).allCalendars = e.target.checked
                      // If enabling all calendars, clear selected calendars
                      if (e.target.checked) {
                        ;(updated: any).selectedCalendars = undefined
                      }
                      setEditedField(updated)
                    }}
                  />
                  All NotePlan Enabled Calendars
                </label>
                <div className="field-editor-help">If checked, include events from all calendars NotePlan has access to. This bypasses the calendar list below.</div>
              </div>
              <div className="field-editor-row">
                <label>Calendars (optional):</label>
                {!calendarsLoaded && requestFromPlugin ? (
                  <div>Loading calendars...</div>
                ) : calendars.length === 0 ? (
                  <div>No calendars available</div>
                ) : (
                  <div className="field-editor-multiselect-wrapper">
                    <div
                      style={{
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        padding: '0.5rem',
                        maxHeight: '150px',
                        overflowY: 'auto',
                        backgroundColor: '#fff',
                      }}
                    >
                      {calendars.map((calendar) => {
                        const selectedCalendars = ((editedField: any): { selectedCalendars?: Array<string> }).selectedCalendars || []
                        const isChecked = selectedCalendars.includes(calendar)
                        const allCalendars = ((editedField: any): { allCalendars?: boolean }).allCalendars || false
                        return (
                          <label key={calendar} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem', opacity: allCalendars ? 0.5 : 1 }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={allCalendars}
                              onChange={(e) => {
                                const updated = { ...editedField }
                                const current = ((updated: any): { selectedCalendars?: Array<string> }).selectedCalendars || []
                                if (e.target.checked) {
                                  ;(updated: any).selectedCalendars = [...current, calendar]
                                } else {
                                  ;(updated: any).selectedCalendars = current.filter((c) => c !== calendar)
                                }
                                setEditedField(updated)
                              }}
                              style={{ marginRight: '0.5rem' }}
                            />
                            <span>{calendar}</span>
                          </label>
                        )
                      })}
                    </div>
                    <div className="field-editor-help">
                      Select which calendars to include events from. Leave all unchecked to include events from all calendars.
                      <br />
                      <strong>NOTE: Due to a bug in NotePlan&apos;s API, this list may be incomplete.</strong>
                    </div>
                  </div>
                )}
              </div>
              <div className="field-editor-row">
                <label>Calendar Filter Regex (optional):</label>
                <input
                  type="text"
                  value={((editedField: any): { calendarFilterRegex?: string }).calendarFilterRegex || ''}
                  onChange={(e) => {
                    const updated = { ...editedField }
                    const regexStr = e.target.value.trim()
                    if (regexStr) {
                      ;(updated: any).calendarFilterRegex = regexStr
                    } else {
                      ;(updated: any).calendarFilterRegex = undefined
                    }
                    setEditedField(updated)
                  }}
                  placeholder="e.g., ^Work|^Personal (regex pattern)"
                />
                <div className="field-editor-help">
                  Optional regex pattern to filter calendars after fetching events. Applied when &quot;All NotePlan Enabled Calendars&quot; is enabled. Leave empty to include all
                  calendars.
                </div>
              </div>
              <div className="field-editor-row">
                <label>Event Filter Regex (optional):</label>
                <input
                  type="text"
                  value={((editedField: any): { eventFilterRegex?: string }).eventFilterRegex || ''}
                  onChange={(e) => {
                    const updated = { ...editedField }
                    const regexStr = e.target.value.trim()
                    if (regexStr) {
                      ;(updated: any).eventFilterRegex = regexStr
                    } else {
                      ;(updated: any).eventFilterRegex = undefined
                    }
                    setEditedField(updated)
                  }}
                  placeholder="e.g., Meeting|Standup"
                />
                <div className="field-editor-help">
                  Optional regex pattern to filter events by title after fetching. Applied to all fetched events before display. Leave empty to include all events.
                </div>
              </div>
              <div className="field-editor-row">
                <label>
                  <input
                    type="checkbox"
                    checked={((editedField: any): { includeReminders?: boolean }).includeReminders || false}
                    onChange={(e) => {
                      const updated = { ...editedField }
                      ;(updated: any).includeReminders = e.target.checked
                      if (!e.target.checked) {
                        ;(updated: any).reminderLists = undefined
                      }
                      setEditedField(updated)
                      // Reset reminder lists loaded state to reload when re-enabled
                      if (e.target.checked) {
                        setReminderListsLoaded(false)
                      }
                    }}
                  />
                  Include Reminders
                </label>
                <div className="field-editor-help">Include reminders in the event list</div>
              </div>
              {((editedField: any): { includeReminders?: boolean }).includeReminders && (
                <div className="field-editor-row">
                  <label>Reminder Lists (optional):</label>
                  {!reminderListsLoaded && requestFromPlugin ? (
                    <div>Loading reminder lists...</div>
                  ) : reminderLists.length === 0 ? (
                    <div>No reminder lists available</div>
                  ) : (
                    <div className="field-editor-multiselect-wrapper">
                      <div
                        style={{
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          padding: '0.5rem',
                          maxHeight: '150px',
                          overflowY: 'auto',
                          backgroundColor: '#fff',
                        }}
                      >
                        {reminderLists.map((list) => {
                          const selectedLists = ((editedField: any): { reminderLists?: Array<string> }).reminderLists || []
                          const isChecked = selectedLists.includes(list)
                          return (
                            <label key={list} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const updated = { ...editedField }
                                  const current = ((updated: any): { reminderLists?: Array<string> }).reminderLists || []
                                  if (e.target.checked) {
                                    ;(updated: any).reminderLists = [...current, list]
                                  } else {
                                    ;(updated: any).reminderLists = current.filter((l) => l !== list)
                                  }
                                  setEditedField(updated)
                                }}
                                style={{ marginRight: '0.5rem' }}
                              />
                              <span>{list}</span>
                            </label>
                          )
                        })}
                      </div>
                      <div className="field-editor-help">Select which reminder lists to include. Leave all unchecked to include reminders from all lists.</div>
                    </div>
                  )}
                </div>
              )}
              <div className="field-editor-row">
                <label>
                  <input
                    type="checkbox"
                    checked={((editedField: any): { shortDescriptionOnLine2?: boolean }).shortDescriptionOnLine2 || false}
                    onChange={(e) => {
                      const updated = { ...editedField }
                      ;(updated: any).shortDescriptionOnLine2 = e.target.checked
                      setEditedField(updated)
                    }}
                  />
                  Short description on second line
                </label>
                <div className="field-editor-help">When enabled, displays the short description (e.g., calendar name) on a second line below the label</div>
              </div>
            </>
          )}

          {editedField.type === 'heading-chooser' && (
            <>
              <div className="field-editor-row">
                <label>Source Note Field (value dependency, optional):</label>
                <select
                  value={
                    ((editedField: any): { sourceNoteKey?: string, dependsOnNoteKey?: string }).sourceNoteKey ||
                    ((editedField: any): { sourceNoteKey?: string, dependsOnNoteKey?: string }).dependsOnNoteKey ||
                    ''
                  }
                  onChange={(e) => {
                    const updated = { ...editedField }
                    ;(updated: any).sourceNoteKey = e.target.value || undefined
                    // Also set old property for backward compatibility
                    if (e.target.value) {
                      ;(updated: any).dependsOnNoteKey = e.target.value
                    } else {
                      delete (updated: any).dependsOnNoteKey
                    }
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
                <div className="field-editor-help">
                  If specified, headings will be loaded dynamically from the selected note. Otherwise, use static headings below. This is a <strong>value dependency</strong> - the
                  field needs the value from another field to function.
                </div>
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
              <div className="field-editor-row">
                <label>
                  <input
                    type="checkbox"
                    checked={((editedField: any): { shortDescriptionOnLine2?: boolean }).shortDescriptionOnLine2 || false}
                    onChange={(e) => {
                      const updated = { ...editedField }
                      ;(updated: any).shortDescriptionOnLine2 = e.target.checked
                      setEditedField(updated)
                    }}
                  />
                  Short description on second line
                </label>
                <div className="field-editor-help">When enabled, displays the short description on a second line below the label</div>
              </div>
            </>
          )}

          {editedField.type === 'markdown-preview' && (
            <>
              <div className="field-editor-row">
                <label>Markdown Source Type:</label>
                <select
                  value={(() => {
                    const field = (editedField: any)
                    // Check in priority order - if sourceNoteKey exists (even if empty string), it's 'field'
                    if (field.sourceNoteKey !== undefined || field.dependsOnNoteKey !== undefined) {
                      return 'field'
                    }
                    // If markdownNoteFilename exists (even if empty string), it's 'filename'
                    if (field.markdownNoteFilename !== undefined) {
                      return 'filename'
                    }
                    // If markdownNoteTitle exists (even if empty string), it's 'title'
                    if (field.markdownNoteTitle !== undefined) {
                      return 'title'
                    }
                    // If markdownText exists (even if empty string), it's 'static'
                    if (field.markdownText !== undefined) {
                      return 'static'
                    }
                    // Default to static
                    return 'static'
                  })()}
                  onChange={(e) => {
                    const updated = { ...editedField }
                    const sourceType = e.target.value
                    // Clear all source options
                    delete (updated: any).markdownText
                    delete (updated: any).markdownNoteFilename
                    delete (updated: any).markdownNoteTitle
                    // Set default based on type
                    if (sourceType === 'static') {
                      ;(updated: any).markdownText = ''
                      // Clear field-related properties when switching away from field mode
                      delete (updated: any).sourceNoteKey
                      delete (updated: any).dependsOnNoteKey
                    } else if (sourceType === 'filename') {
                      ;(updated: any).markdownNoteFilename = ''
                      // Clear field-related properties when switching away from field mode
                      delete (updated: any).sourceNoteKey
                      delete (updated: any).dependsOnNoteKey
                    } else if (sourceType === 'title') {
                      ;(updated: any).markdownNoteTitle = ''
                      // Clear field-related properties when switching away from field mode
                      delete (updated: any).sourceNoteKey
                      delete (updated: any).dependsOnNoteKey
                    } else if (sourceType === 'field') {
                      // When switching to field mode, set sourceNoteKey to empty string if it doesn't exist
                      // This ensures the dropdown stays on 'field' option
                      // If it already exists, preserve it (user may have already selected a field)
                      if (!(updated: any).sourceNoteKey && !(updated: any).dependsOnNoteKey) {
                        ;(updated: any).sourceNoteKey = ''
                      }
                    }
                    setEditedField(updated)
                  }}
                >
                  <option value="static">Static Markdown Text</option>
                  <option value="filename">Note by Filename</option>
                  <option value="title">Note by Title</option>
                  <option value="field">Note from Another Field</option>
                </select>
                <div className="field-editor-help">Choose how to get the markdown content to display</div>
              </div>

              {(() => {
                const field = (editedField: any)
                // Determine source type
                let sourceType = 'static'
                // Check in priority order - if sourceNoteKey exists (even if empty string), it's 'field'
                if (field.sourceNoteKey !== undefined || field.dependsOnNoteKey !== undefined) {
                  sourceType = 'field'
                }
                // If markdownNoteFilename exists (even if empty string), it's 'filename'
                else if (field.markdownNoteFilename !== undefined) {
                  sourceType = 'filename'
                }
                // If markdownNoteTitle exists (even if empty string), it's 'title'
                else if (field.markdownNoteTitle !== undefined) {
                  sourceType = 'title'
                }
                // If markdownText exists (even if empty string), it's 'static'
                else if (field.markdownText !== undefined) {
                  sourceType = 'static'
                }

                return (
                  <>
                    {sourceType === 'static' && (
                      <div className="field-editor-row">
                        <label>Markdown Text:</label>
                        <textarea
                          value={((editedField: any): { markdownText?: string }).markdownText || ''}
                          onChange={(e) => {
                            const updated = { ...editedField }
                            ;(updated: any).markdownText = e.target.value
                            setEditedField(updated)
                          }}
                          placeholder="Enter markdown text to display..."
                          rows={10}
                        />
                        <div className="field-editor-help">Enter the markdown text to display (e.g., instructions)</div>
                      </div>
                    )}

                    {sourceType === 'filename' && (
                      <div className="field-editor-row">
                        <label>Note Filename:</label>
                        <input
                          type="text"
                          value={((editedField: any): { markdownNoteFilename?: string }).markdownNoteFilename || ''}
                          onChange={(e) => {
                            const updated = { ...editedField }
                            ;(updated: any).markdownNoteFilename = e.target.value || undefined
                            setEditedField(updated)
                          }}
                          placeholder="e.g., MyNote.md or 20240101.md"
                        />
                        <div className="field-editor-help">Enter the filename (with extension) of the note to display</div>
                      </div>
                    )}

                    {sourceType === 'title' && (
                      <div className="field-editor-row">
                        <label>Note Title:</label>
                        <input
                          type="text"
                          value={((editedField: any): { markdownNoteTitle?: string }).markdownNoteTitle || ''}
                          onChange={(e) => {
                            const updated = { ...editedField }
                            ;(updated: any).markdownNoteTitle = e.target.value || undefined
                            setEditedField(updated)
                          }}
                          placeholder="e.g., My Note"
                        />
                        <div className="field-editor-help">Enter the title of the note to display</div>
                      </div>
                    )}

                    {sourceType === 'field' && (
                      <div className="field-editor-row">
                        <label>Source Note Field (value dependency):</label>
                        <select
                          value={
                            ((editedField: any): { sourceNoteKey?: string, dependsOnNoteKey?: string }).sourceNoteKey ||
                            ((editedField: any): { sourceNoteKey?: string, dependsOnNoteKey?: string }).dependsOnNoteKey ||
                            ''
                          }
                          onChange={(e) => {
                            const updated = { ...editedField }
                            const value = e.target.value
                            // Set sourceNoteKey to the value (even if empty string, to maintain 'field' mode)
                            ;(updated: any).sourceNoteKey = value || ''
                            // Also set old property for backward compatibility
                            if (value) {
                              ;(updated: any).dependsOnNoteKey = value
                            } else {
                              delete (updated: any).dependsOnNoteKey
                            }
                            setEditedField(updated)
                          }}
                        >
                          <option value="">Select a note-chooser field...</option>
                          {allFields
                            .filter((f) => f.key && f.type === 'note-chooser' && f.key !== editedField.key)
                            .map((f) => (
                              <option key={f.key} value={f.key}>
                                {f.label || f.key} ({f.key})
                              </option>
                            ))}
                        </select>
                        <div className="field-editor-help">
                          Select a note-chooser field. The preview will display the note selected in that field. This is a <strong>value dependency</strong> - the field needs the
                          value from another field to function.
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </>
          )}

          {editedField.type === 'autosave' && (
            <>
              <div className="field-editor-row">
                <label>Autosave Interval (seconds):</label>
                <input
                  type="number"
                  min="1"
                  value={((editedField: any): { autosaveInterval?: number }).autosaveInterval || 2}
                  onChange={(e) => {
                    const updated = { ...editedField }
                    const value = parseInt(e.target.value, 10)
                    ;(updated: any).autosaveInterval = isNaN(value) || value < 1 ? 2 : value
                    setEditedField(updated)
                  }}
                  placeholder="2"
                />
                <div className="field-editor-help">
                  How often (in seconds) to automatically save the form state. Default is 2 seconds. The form will only save if the content has changed since the last save.
                </div>
              </div>
              <div className="field-editor-row">
                <label>Autosave Filename Pattern:</label>
                <input
                  type="text"
                  value={((editedField: any): { autosaveFilename?: string }).autosaveFilename || '@Trash/Autosave-<ISO8601>'}
                  onChange={(e) => {
                    const updated = { ...editedField }
                    ;(updated: any).autosaveFilename = e.target.value || undefined
                    setEditedField(updated)
                  }}
                  placeholder="@Trash/Autosave-<ISO8601>"
                />
                <div className="field-editor-help">
                  Filename pattern for autosave files. Available placeholders:
                  <ul style={{ marginTop: '0.5rem', marginBottom: '0.5rem', paddingLeft: '1.5rem' }}>
                    <li>
                      <code>&lt;ISO8601&gt;</code> or <code>&lt;timestamp&gt;</code> - Timestamp in local timezone format: YYYY-MM-DDTHH-MM-SS
                    </li>
                    <li>
                      <code>&lt;formTitle&gt;</code> or <code>&lt;FORM_NAME&gt;</code> - Form title (sanitized for filesystem compatibility)
                    </li>
                  </ul>
                  Default is &quot;@Trash/Autosave-&lt;formTitle&gt;-&lt;ISO8601&gt;&quot; (or &quot;@Trash/Autosave-&lt;ISO8601&gt;&quot; if no form title). The form title will be
                  automatically included if available.
                </div>
              </div>
              <div className="field-editor-row">
                <label>
                  <input type="checkbox" checked={(editedField: any).invisible || false} onChange={(e) => updateField({ invisible: e.target.checked })} />
                  Invisible (hide UI but still perform autosaves)
                </label>
                <div className="field-editor-help">
                  When checked, the autosave field will not display any UI message, but will still automatically save the form state in the background.
                </div>
              </div>
            </>
          )}

          {needsKey && (
            <div className="field-editor-row">
              <label>Requires Field (prerequisite):</label>
              <select
                value={editedField.requiresKey || editedField.dependsOnKey || ''}
                onChange={(e) => {
                  const updated = { ...editedField }
                  updated.requiresKey = e.target.value || undefined
                  // Also set old property for backward compatibility
                  if (e.target.value) {
                    updated.dependsOnKey = e.target.value
                  } else {
                    delete updated.dependsOnKey
                  }
                  setEditedField(updated)
                }}
              >
                <option value="">None (no prerequisite)</option>
                {dependencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="field-editor-help">
                This field will only be visible/enabled when the specified field is true/has a value. This is a <strong>prerequisite</strong> - the field must be set for this field
                to be visible or editable.
              </div>
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

export default FieldEditor
