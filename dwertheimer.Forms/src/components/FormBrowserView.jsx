// @flow
//--------------------------------------------------------------------------
// FormBrowserView Component
// Browse and select template forms with a resizable two-column layout
//--------------------------------------------------------------------------

import React, { useState, useEffect, useRef, useMemo, useCallback, type Node } from 'react'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import DynamicDialog from '@helpers/react/DynamicDialog'
import { SpaceChooser as SpaceChooserComponent } from '@helpers/react/DynamicDialog/SpaceChooser'
import { type TSettingItem } from '@helpers/react/DynamicDialog/DynamicDialog.jsx'
import { logDebug, logError } from '@helpers/react/reactDev.js'
import './FormBrowserView.css'

type FormTemplate = {
  label: string,
  value: string,
  filename: string,
}

type FormBrowserViewProps = {
  data: any,
  dispatch: Function,
  reactSettings: any,
  setReactSettings: Function,
  onSubmitOrCancelCallFunctionNamed: string,
}

/**
 * FormBrowserView Component
 * Displays a list of template forms in a resizable two-column layout
 * @param {FormBrowserViewProps} props
 * @returns {React$Node}
 */
export function FormBrowserView({ data, dispatch, reactSettings, setReactSettings, onSubmitOrCancelCallFunctionNamed }: FormBrowserViewProps): Node {
  const { pluginData } = data
  const requestFromPlugin = pluginData?.requestFromPlugin || (() => Promise.resolve({ success: false }))

  // State
  const [selectedSpace, setSelectedSpace] = useState<string>('') // Empty string = Private (default)
  const [filterText, setFilterText] = useState<string>('')
  const [templates, setTemplates] = useState<Array<FormTemplate>>([])
  const [selectedTemplate, setSelectedTemplate] = useState<?FormTemplate>(null)
  const [formFields, setFormFields] = useState<Array<TSettingItem>>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)

  // Refs
  const filterInputRef = useRef<?HTMLInputElement>(null)
  const listRef = useRef<?HTMLDivElement>(null)

  /**
   * Load template forms from the plugin
   */
  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true)
      const response = await requestFromPlugin('getFormTemplates', {
        space: selectedSpace,
      })
      if (response && response.success && Array.isArray(response.data)) {
        setTemplates(response.data)
        logDebug('FormBrowserView', `Loaded ${response.data.length} templates`)
      } else {
        logError('FormBrowserView', `Failed to load templates: ${response?.message || 'Unknown error'}`)
        setTemplates([])
      }
    } catch (error) {
      logError('FormBrowserView', `Error loading templates: ${error.message}`)
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [requestFromPlugin, selectedSpace])

  /**
   * Load form fields for the selected template
   */
  const loadFormFields = useCallback(
    async (template: FormTemplate) => {
      try {
        setLoading(true)
        const response = await requestFromPlugin('getFormFields', {
          templateFilename: template.filename,
        })
        if (response && response.success && Array.isArray(response.data)) {
          setFormFields(response.data)
          logDebug('FormBrowserView', `Loaded ${response.data.length} form fields for template "${template.label}"`)
        } else {
          logError('FormBrowserView', `Failed to load form fields: ${response?.message || 'Unknown error'}`)
          setFormFields([])
        }
      } catch (error) {
        logError('FormBrowserView', `Error loading form fields: ${error.message}`)
        setFormFields([])
      } finally {
        setLoading(false)
      }
    },
    [requestFromPlugin],
  )

  // Load templates when space changes
  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  // Load form fields when template is selected
  useEffect(() => {
    if (selectedTemplate) {
      loadFormFields(selectedTemplate)
    } else {
      setFormFields([])
    }
  }, [selectedTemplate, loadFormFields])

  // Focus filter input on mount
  useEffect(() => {
    if (filterInputRef.current) {
      filterInputRef.current.focus()
    }
  }, [])

  // Filter templates based on filter text (case-insensitive)
  const filteredTemplates = useMemo(() => {
    if (!filterText.trim()) {
      return templates
    }
    const searchTerm = filterText.toLowerCase()
    return templates.filter((template) => template.label.toLowerCase().includes(searchTerm))
  }, [templates, filterText])

  // Handle template selection
  const handleTemplateSelect = useCallback((template: FormTemplate) => {
    setSelectedTemplate(template)
    setSelectedIndex(-1) // Reset selected index
  }, [])

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (selectedIndex < filteredTemplates.length - 1) {
          const newIndex = selectedIndex + 1
          setSelectedIndex(newIndex)
          // Scroll into view
          if (listRef.current) {
            const item = listRef.current.querySelector(`[data-index="${newIndex}"]`)
            if (item) {
              item.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
            }
          }
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (selectedIndex > 0) {
          const newIndex = selectedIndex - 1
          setSelectedIndex(newIndex)
          // Scroll into view
          if (listRef.current) {
            const item = listRef.current.querySelector(`[data-index="${newIndex}"]`)
            if (item) {
              item.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
            }
          }
        }
      } else if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < filteredTemplates.length) {
        e.preventDefault()
        handleTemplateSelect(filteredTemplates[selectedIndex])
      }
    },
    [selectedIndex, filteredTemplates, handleTemplateSelect],
  )

  // Handle filter input keydown
  const handleFilterKeyDown = useCallback(
    (e: SyntheticKeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown' && filteredTemplates.length > 0) {
        e.preventDefault()
        setSelectedIndex(0)
        // Focus the list
        if (listRef.current) {
          const firstItem = listRef.current.querySelector('[data-index="0"]')
          if (firstItem) {
            // @ts-ignore
            firstItem.focus()
          }
        }
      } else {
        handleKeyDown(e.nativeEvent)
      }
    },
    [filteredTemplates.length, handleKeyDown],
  )

  // Handle form cancel
  const handleCancel = useCallback(() => {
    setSelectedTemplate(null)
    setFormFields([])
  }, [])

  // Handle form submit
  const handleSave = useCallback(
    (formValues: Object, windowId?: string) => {
      logDebug('FormBrowserView', 'Form submitted:', formValues)
      // Send to plugin for processing
      if (requestFromPlugin) {
        requestFromPlugin('submitForm', {
          templateFilename: selectedTemplate?.filename,
          formValues,
          windowId,
        }).catch((error) => {
          logError('FormBrowserView', `Error submitting form: ${error.message}`)
        })
      }
      // Reset after submit
      handleCancel()
    },
    [selectedTemplate, requestFromPlugin, handleCancel],
  )

  // Handle new form button
  const handleNewForm = useCallback(() => {
    if (requestFromPlugin) {
      requestFromPlugin('openFormBuilder', {}).catch((error) => {
        logError('FormBrowserView', `Error opening form builder: ${error.message}`)
      })
    }
  }, [requestFromPlugin])

  // Handle reload button
  const handleReload = useCallback(() => {
    loadTemplates()
  }, [loadTemplates])

  return (
    <div className="form-browser-container">
      {/* Header */}
      <div className="form-browser-header">
        <div className="form-browser-header-controls">
          <div className="form-browser-space-chooser">
            <SpaceChooserComponent
              label=""
              value={selectedSpace}
              onChange={(spaceId: string) => {
                setSelectedSpace(spaceId)
                setSelectedTemplate(null) // Clear selection when space changes
                setFilterText('') // Clear filter when space changes
              }}
              placeholder="Select space (Private or Teamspace)"
              compactDisplay={true}
              requestFromPlugin={requestFromPlugin}
              showValue={false}
            />
          </div>
          <div className="form-browser-filter">
            <input
              ref={filterInputRef}
              type="text"
              className="form-browser-filter-input"
              placeholder="Filter forms..."
              value={filterText}
              onChange={(e) => {
                setFilterText(e.target.value)
                setSelectedIndex(-1) // Reset selection when filter changes
              }}
              onKeyDown={handleFilterKeyDown}
            />
          </div>
          <button className="form-browser-button form-browser-button-new" onClick={handleNewForm}>
            + New Form
          </button>
          <button className="form-browser-button form-browser-button-reload" onClick={handleReload} title="Reload forms list">
            ↻
          </button>
        </div>
      </div>

      {/* Content with resizable columns */}
      <div className="form-browser-content">
        <PanelGroup direction="horizontal" className="form-browser-panels">
          {/* Left Panel: Template List */}
          <Panel defaultSize={40} minSize={20} order={1}>
            <div className="form-browser-list-container">
              <div className="form-browser-list-header">
                <h3>Template Forms ({filteredTemplates.length})</h3>
              </div>
              <div ref={listRef} className="form-browser-list" onKeyDown={handleKeyDown} tabIndex={0}>
                {loading && templates.length === 0 ? (
                  <div className="form-browser-list-loading">Loading...</div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="form-browser-list-empty">{filterText ? 'No forms match your filter' : 'No forms found'}</div>
                ) : (
                  filteredTemplates.map((template, index) => (
                    <div
                      key={template.value}
                      data-index={index}
                      className={`form-browser-list-item ${selectedIndex === index ? 'selected' : ''} ${selectedTemplate?.value === template.value ? 'active' : ''}`}
                      onClick={() => handleTemplateSelect(template)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleTemplateSelect(template)
                        }
                      }}
                      tabIndex={0}
                    >
                      {template.label}
                    </div>
                  ))
                )}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="form-browser-resize-handle" />

          {/* Right Panel: Form Preview */}
          <Panel defaultSize={60} minSize={30} order={2}>
            <div className="form-browser-form-container">
              {selectedTemplate ? (
                <div className="form-browser-form-wrapper">
                  <DynamicDialog
                    items={formFields}
                    onSave={handleSave}
                    onCancel={handleCancel}
                    title={selectedTemplate.label}
                    isModal={false}
                    hideHeaderButtons={false}
                    allowEmptySubmit={false}
                    requestFromPlugin={requestFromPlugin}
                  />
                </div>
              ) : (
                <div className="form-browser-form-empty">
                  <p>Select a form from the list to preview and fill it out</p>
                </div>
              )}
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  )
}

export default FormBrowserView
