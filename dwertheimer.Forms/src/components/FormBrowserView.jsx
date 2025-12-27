// @flow
//--------------------------------------------------------------------------
// FormBrowserView Component
// Browse and select template forms with a resizable two-column layout
//--------------------------------------------------------------------------

import React, { useState, useEffect, useRef, useMemo, useCallback, type Node } from 'react'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import { AppProvider } from './AppContext.jsx'
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
export function FormBrowserView({
  data,
  dispatch,
  reactSettings,
  setReactSettings,
  onSubmitOrCancelCallFunctionNamed: _onSubmitOrCancelCallFunctionNamed,
}: FormBrowserViewProps): Node {
  const { pluginData } = data

  // Map to store pending requests for request/response pattern
  // Key: correlationId, Value: { resolve, reject, timeoutId }
  const pendingRequestsRef = useRef<Map<string, { resolve: (data: any) => void, reject: (error: Error) => void, timeoutId: any }>>(new Map())

  // Store windowId in a ref so requestFromPlugin doesn't need to depend on pluginData
  const windowIdRef = useRef<?string>(pluginData?.windowId || 'form-browser-window')

  // Update windowId ref when pluginData changes
  useEffect(() => {
    windowIdRef.current = pluginData?.windowId || 'form-browser-window'
  }, [pluginData?.windowId])

  // Listen for RESPONSE messages from Root and resolve pending requests
  useEffect(() => {
    const handleResponse = (event: MessageEvent) => {
      const { data: eventData } = event
      // $FlowFixMe[incompatible-type] - eventData can be various types
      if (eventData && typeof eventData === 'object' && eventData.type === 'RESPONSE' && eventData.payload) {
        // $FlowFixMe[prop-missing] - payload structure is validated above
        const payload = eventData.payload
        // $FlowFixMe[prop-missing] - payload structure is validated above
        if (payload && typeof payload === 'object') {
          const correlationId = (payload: any).correlationId
          const success = (payload: any).success
          logDebug('FormBrowserView', `handleResponse: Received RESPONSE with correlationId="${String(correlationId || '')}", success=${String(success || false)}`)
          if (correlationId && typeof correlationId === 'string') {
            const { data: responseData, error } = (payload: any)
            const pending = pendingRequestsRef.current.get(correlationId)
            if (pending) {
              pendingRequestsRef.current.delete(correlationId)
              clearTimeout(pending.timeoutId)
              logDebug('FormBrowserView', `handleResponse: Resolving request for correlationId="${correlationId}", success=${String(success || false)}`)
              if (success) {
                pending.resolve(responseData)
              } else {
                pending.reject(new Error(error || 'Request failed'))
              }
            } else {
              logDebug('FormBrowserView', `handleResponse: No pending request found for correlationId="${correlationId}"`)
            }
          }
        }
      }
    }

    window.addEventListener('message', handleResponse)
    return () => {
      window.removeEventListener('message', handleResponse)
      // Clean up any pending requests on unmount
      pendingRequestsRef.current.forEach((pending) => {
        clearTimeout(pending.timeoutId)
      })
      pendingRequestsRef.current.clear()
    }
  }, [])

  /**
   * Request data from the plugin using request/response pattern
   *
   * RESPONSE PATTERN:
   * - Handler returns: { success: boolean, data?: any, message?: string }
   * - Router sends RESPONSE: { correlationId, success, data, error }
   * - handleResponse extracts payload.data and resolves promise with just the data
   * - So this function resolves with result.data (the actual data array/object, not the wrapper)
   *
   * Returns a Promise that resolves with the response data or rejects with an error
   * Memoized with useCallback to prevent recreation on every render
   * @param {string} command - The command/request type (e.g., 'getFormTemplates', 'getFormFields')
   * @param {any} dataToSend - Request parameters
   * @param {number} timeout - Timeout in milliseconds (default: 10000)
   * @returns {Promise<any>} - Resolves with the data from handler (result.data), not the full response object
   */
  const requestFromPlugin = useCallback(
    (command: string, dataToSend: any = {}, timeout: number = 10000): Promise<any> => {
      if (!command) throw new Error('requestFromPlugin: command must be called with a string')

      const correlationId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          if (pendingRequestsRef.current.has(correlationId)) {
            pendingRequestsRef.current.delete(correlationId)
            reject(new Error(`Request timeout after ${timeout}ms: ${command}`))
          }
        }, timeout)

        pendingRequestsRef.current.set(correlationId, { resolve, reject, timeoutId })

        // Send request with correlation ID and request type marker
        const requestData = {
          ...dataToSend,
          __correlationId: correlationId,
          __requestType: 'REQUEST',
          __windowId: windowIdRef.current,
        }

        logDebug('FormBrowserView', `requestFromPlugin: Sending request "${command}" with correlationId="${correlationId}", windowId="${String(windowIdRef.current || '')}"`)
        dispatch('SEND_TO_PLUGIN', [command, requestData], `FormBrowserView: requestFromPlugin: ${String(command)}`)
      })
    },
    [dispatch],
  ) // Only depend on dispatch, which should be stable from useReducer

  const sendActionToPlugin = (command: string, dataToSend: any) => {
    logDebug('FormBrowserView', `sendActionToPlugin: command="${command}"`)
    dispatch('SEND_TO_PLUGIN', [command, dataToSend], `FormBrowserView: ${command}`)
  }

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
      const responseData = await requestFromPlugin('getFormTemplates', {
        space: selectedSpace,
      })
      // requestFromPlugin resolves with the data from the response (result.data from handler)
      // The handler returns { success: true, data: formTemplates }
      // So responseData should be the formTemplates array
      if (Array.isArray(responseData)) {
        setTemplates(responseData)
        logDebug('FormBrowserView', `Loaded ${responseData.length} templates`)
      } else {
        logError('FormBrowserView', `Failed to load templates: Expected array but got ${typeof responseData}`)
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
        const responseData = await requestFromPlugin('getFormFields', {
          templateFilename: template.filename,
        })
        // requestFromPlugin resolves with the data from the response (result.data from handler)
        // The handler returns { success: true, data: formFields }
        // So responseData should be the formFields array
        if (Array.isArray(responseData)) {
          setFormFields(responseData)
          logDebug('FormBrowserView', `Loaded ${responseData.length} form fields for template "${template.label}"`)
        } else {
          logError('FormBrowserView', `Failed to load form fields: Expected array but got ${typeof responseData}`)
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
      requestFromPlugin('createNewForm', {}).catch((error) => {
        logError('FormBrowserView', `Error creating new form: ${error.message}`)
      })
    }
  }, [requestFromPlugin])

  // Handle reload button
  const handleReload = useCallback(() => {
    loadTemplates()
  }, [loadTemplates])

  // Handle edit form button
  const handleEditForm = useCallback(
    (template: FormTemplate, e: any) => {
      e.stopPropagation() // Prevent triggering template selection
      if (requestFromPlugin) {
        // Open FormBuilder with the template title
        // The receivingTemplateTitle will be read from the note's frontmatter by openFormBuilder
        requestFromPlugin('openFormBuilder', {
          templateTitle: template.label,
        }).catch((error) => {
          logError('FormBrowserView', `Error opening form builder: ${error.message}`)
        })
      }
    },
    [requestFromPlugin],
  )

  return (
    <AppProvider
      sendActionToPlugin={sendActionToPlugin}
      sendToPlugin={sendActionToPlugin}
      requestFromPlugin={requestFromPlugin}
      dispatch={dispatch}
      pluginData={pluginData}
      updatePluginData={(newData) => {
        const newFullData = { ...data, pluginData: newData }
        dispatch('UPDATE_DATA', newFullData)
      }}
      reactSettings={reactSettings}
      setReactSettings={setReactSettings}
    >
      <div className="form-browser-container">
        {/* Header */}
        <div className="form-browser-header">
          <h1 className="form-browser-title">Form Browser</h1>
        </div>

        {/* Content with resizable columns */}
        <div className="form-browser-content">
          <PanelGroup direction="horizontal" className="form-browser-panels">
            {/* Left Panel: Template List */}
            <Panel defaultSize={25} minSize={20} order={1} className="form-browser-left-panel">
              <div className="form-browser-list-container">
                {/* Controls in left column */}
                <div className="form-browser-left-controls">
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
                  <div className="form-browser-filter-row">
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
                  </div>
                </div>
                <div className="form-browser-list-header">
                  <h3>Template Forms ({filteredTemplates.length})</h3>
                  <button className="form-browser-button form-browser-button-reload" onClick={handleReload} title="Reload forms list">
                    ↻
                  </button>
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
                        <span className="form-browser-list-item-label">{template.label}</span>
                        <div className="form-browser-list-item-actions" onClick={(e) => e.stopPropagation()}>
                          <button className="form-browser-list-item-button form-browser-list-item-button-edit" onClick={(e) => handleEditForm(template, e)} title="Edit form">
                            ✏️
                          </button>
                        </div>
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
                      isOpen={true}
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
    </AppProvider>
  )
}

export default FormBrowserView
