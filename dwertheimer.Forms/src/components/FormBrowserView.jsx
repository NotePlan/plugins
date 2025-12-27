// @flow
//--------------------------------------------------------------------------
// FormBrowserView Component
// Browse and select template forms with a resizable two-column layout
//--------------------------------------------------------------------------

import React, { useState, useEffect, useRef, useMemo, useCallback, type Node } from 'react'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import { AppProvider } from './AppContext.jsx'
import { FormPreview } from './FormPreview.jsx'
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
  const [frontmatter, setFrontmatter] = useState<{ [key: string]: any }>({})
  const [folders, setFolders] = useState<Array<string>>([])
  const [notes, setNotes] = useState<Array<any>>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const formPreviewRef = useRef<?HTMLDivElement>(null)

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
        // The handler now returns { success: true, data: { formFields, frontmatter } }
        if (responseData && typeof responseData === 'object' && Array.isArray(responseData.formFields)) {
          setFormFields(responseData.formFields)
          setFrontmatter(responseData.frontmatter || {})
          logDebug('FormBrowserView', `Loaded ${responseData.formFields.length} form fields for template "${template.label}"`)

          // Load folders and notes if needed (check if form has folder-chooser or note-chooser fields)
          const needsFolders = responseData.formFields.some((field: TSettingItem) => field.type === 'folder-chooser')
          const needsNotes = responseData.formFields.some((field: TSettingItem) => field.type === 'note-chooser')

          if (needsFolders) {
            try {
              const foldersData = await requestFromPlugin('getFolders', {})
              if (Array.isArray(foldersData)) {
                setFolders(foldersData)
              }
            } catch (error) {
              logError('FormBrowserView', `Error loading folders: ${error.message}`)
            }
          }

          if (needsNotes) {
            try {
              const notesData = await requestFromPlugin('getNotes', { includeCalendarNotes: false })
              if (Array.isArray(notesData)) {
                setNotes(notesData)
              }
            } catch (error) {
              logError('FormBrowserView', `Error loading notes: ${error.message}`)
            }
          }
        } else {
          logError('FormBrowserView', `Failed to load form fields: Invalid response data`)
          setFormFields([])
          setFrontmatter({})
        }
      } catch (error) {
        logError('FormBrowserView', `Error loading form fields: ${error.message}`)
        setFormFields([])
        setFrontmatter({})
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
    logDebug('FormBrowserView', `handleTemplateSelect: selecting template "${template.label}"`)
    setSelectedTemplate(template)
    // Don't reset selectedIndex - keep it for arrow navigation continuity
    // setSelectedIndex(-1) // Reset selected index
  }, [])

  // Auto-select template when selectedIndex changes (for arrow navigation)
  useEffect(() => {
    logDebug(
      'FormBrowserView',
      `useEffect selectedIndex: selectedIndex=${selectedIndex}, filteredTemplates.length=${filteredTemplates.length}, current selectedTemplate=${
        selectedTemplate?.label || 'null'
      }`,
    )
    if (selectedIndex >= 0 && selectedIndex < filteredTemplates.length) {
      const template = filteredTemplates[selectedIndex]
      logDebug(
        'FormBrowserView',
        `useEffect selectedIndex: template at index ${selectedIndex} is "${template.label}", current selectedTemplate=${selectedTemplate?.label || 'null'}`,
      )
      if (template) {
        // Always update selectedTemplate when selectedIndex changes (even if same template)
        // This ensures the form loads/reloads when navigating with arrows
        if (template.value !== selectedTemplate?.value) {
          logDebug('FormBrowserView', `useEffect selectedIndex: calling handleTemplateSelect for "${template.label}" (different template)`)
          handleTemplateSelect(template)
        } else {
          logDebug('FormBrowserView', `useEffect selectedIndex: same template already selected, but ensuring form is loaded`)
          // Even if same template, make sure form fields are loaded (in case they weren't before)
          if (selectedTemplate && formFields.length === 0) {
            logDebug('FormBrowserView', `useEffect selectedIndex: formFields empty, triggering loadFormFields`)
            loadFormFields(selectedTemplate)
          }
        }
      }
    } else {
      logDebug('FormBrowserView', `useEffect selectedIndex: selectedIndex out of range (${selectedIndex}) or no templates`)
    }
  }, [selectedIndex, filteredTemplates, selectedTemplate, handleTemplateSelect, formFields.length, loadFormFields])

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      logDebug(
        'FormBrowserView',
        `handleKeyDown: key="${e.key}", selectedIndex=${selectedIndex}, filteredTemplates.length=${filteredTemplates.length}, selectedTemplate=${
          selectedTemplate?.label || 'null'
        }`,
      )

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        logDebug('FormBrowserView', `handleKeyDown ArrowDown: current selectedIndex=${selectedIndex}, max=${filteredTemplates.length - 1}`)
        // If selectedIndex is -1, start at 0, otherwise increment
        const newIndex = selectedIndex < 0 ? 0 : selectedIndex + 1
        if (newIndex < filteredTemplates.length) {
          logDebug('FormBrowserView', `handleKeyDown ArrowDown: setting selectedIndex to ${newIndex}`)
          setSelectedIndex(newIndex)
          // Scroll into view
          setTimeout(() => {
            if (listRef.current) {
              const item = listRef.current.querySelector(`[data-index="${newIndex}"]`)
              if (item) {
                logDebug('FormBrowserView', `handleKeyDown ArrowDown: scrolling item into view`)
                item.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
                // Also focus the item for better keyboard navigation
                // @ts-ignore
                item.focus()
              } else {
                logDebug('FormBrowserView', `handleKeyDown ArrowDown: could not find item with data-index="${newIndex}"`)
              }
            } else {
              logDebug('FormBrowserView', `handleKeyDown ArrowDown: listRef.current is null`)
            }
          }, 0)
        } else {
          logDebug('FormBrowserView', `handleKeyDown ArrowDown: already at last item (${selectedIndex}), not moving`)
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        logDebug('FormBrowserView', `handleKeyDown ArrowUp: current selectedIndex=${selectedIndex}`)
        if (selectedIndex > 0) {
          const newIndex = selectedIndex - 1
          logDebug('FormBrowserView', `handleKeyDown ArrowUp: setting selectedIndex to ${newIndex}`)
          setSelectedIndex(newIndex)
          // Scroll into view
          setTimeout(() => {
            if (listRef.current) {
              const item = listRef.current.querySelector(`[data-index="${newIndex}"]`)
              if (item) {
                logDebug('FormBrowserView', `handleKeyDown ArrowUp: scrolling item into view`)
                item.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
                // Also focus the item for better keyboard navigation
                // @ts-ignore
                item.focus()
              } else {
                logDebug('FormBrowserView', `handleKeyDown ArrowUp: could not find item with data-index="${newIndex}"`)
              }
            } else {
              logDebug('FormBrowserView', `handleKeyDown ArrowUp: listRef.current is null`)
            }
          }, 0)
        } else {
          logDebug('FormBrowserView', `handleKeyDown ArrowUp: already at first item (${selectedIndex}), not moving`)
        }
      } else if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < filteredTemplates.length) {
        e.preventDefault()
        logDebug('FormBrowserView', `handleKeyDown Enter: selecting template at index ${selectedIndex}`)
        handleTemplateSelect(filteredTemplates[selectedIndex])
      } else if (e.key === 'Tab' && selectedIndex >= 0 && selectedIndex < filteredTemplates.length && selectedTemplate) {
        // TAB from focused list item should focus first form field
        e.preventDefault()
        logDebug('FormBrowserView', `handleKeyDown Tab: attempting to focus first form field, formPreviewRef.current=${formPreviewRef.current ? 'exists' : 'null'}`)
        // Focus the first input field in the form preview
        if (formPreviewRef.current) {
          const firstInput = formPreviewRef.current.querySelector('input:not([type="hidden"]), textarea, select, button:not(.cancel-button):not(.save-button)')
          if (firstInput instanceof HTMLElement) {
            logDebug('FormBrowserView', `handleKeyDown Tab: found first input, focusing it`)
            firstInput.focus()
          } else {
            logDebug('FormBrowserView', `handleKeyDown Tab: no input field found in form preview`)
          }
        } else {
          logDebug('FormBrowserView', `handleKeyDown Tab: formPreviewRef.current is null`)
        }
      } else {
        logDebug('FormBrowserView', `handleKeyDown: unhandled key="${e.key}"`)
      }
    },
    [selectedIndex, filteredTemplates, selectedTemplate, handleTemplateSelect],
  )

  // Handle filter input keydown
  const handleFilterKeyDown = useCallback(
    (e: SyntheticKeyboardEvent<HTMLInputElement>) => {
      logDebug('FormBrowserView', `handleFilterKeyDown: key="${e.key}", filteredTemplates.length=${filteredTemplates.length}`)

      if (e.key === 'ArrowDown' && filteredTemplates.length > 0) {
        e.preventDefault()
        logDebug('FormBrowserView', `handleFilterKeyDown ArrowDown: setting selectedIndex to 0 and focusing first item`)
        setSelectedIndex(0)
        // Focus the list with setTimeout to ensure DOM is updated
        setTimeout(() => {
          if (listRef.current) {
            const firstItem = listRef.current.querySelector('[data-index="0"]')
            if (firstItem) {
              logDebug('FormBrowserView', `handleFilterKeyDown ArrowDown: found first item, focusing it`)
              // @ts-ignore
              firstItem.focus()
            } else {
              logDebug('FormBrowserView', `handleFilterKeyDown ArrowDown: could not find first item`)
            }
          } else {
            logDebug('FormBrowserView', `handleFilterKeyDown ArrowDown: listRef.current is null`)
          }
        }, 0)
      } else if (e.key === 'Tab' && !e.shiftKey && filteredTemplates.length > 0) {
        // TAB from filter should focus first list item
        e.preventDefault()
        logDebug('FormBrowserView', `handleFilterKeyDown Tab: focusing first list item`)
        setSelectedIndex(0)
        setTimeout(() => {
          if (listRef.current) {
            const firstItem = listRef.current.querySelector('[data-index="0"]')
            if (firstItem) {
              logDebug('FormBrowserView', `handleFilterKeyDown Tab: found first item, focusing it`)
              // @ts-ignore
              firstItem.focus()
            } else {
              logDebug('FormBrowserView', `handleFilterKeyDown Tab: could not find first item`)
            }
          } else {
            logDebug('FormBrowserView', `handleFilterKeyDown Tab: listRef.current is null`)
          }
        }, 0)
      } else {
        logDebug('FormBrowserView', `handleFilterKeyDown: passing to handleKeyDown, key="${e.key}"`)
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
                          logDebug('FormBrowserView', `list-item onKeyDown: key="${e.key}", index=${index}, template="${template.label}", shiftKey=${e.shiftKey}`)
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            logDebug('FormBrowserView', `list-item Enter: selecting template "${template.label}"`)
                            handleTemplateSelect(template)
                          } else if (e.key === 'Tab' && !e.shiftKey && selectedTemplate) {
                            // TAB from list item should focus first form field
                            e.preventDefault()
                            logDebug('FormBrowserView', `list-item Tab: attempting to focus first form field, formPreviewRef.current=${formPreviewRef.current ? 'exists' : 'null'}`)
                            // Use setTimeout to ensure the form is rendered
                            setTimeout(() => {
                              const previewRef = formPreviewRef.current
                              if (previewRef) {
                                // Try to find first focusable input (skip hidden, readonly, disabled)
                                const firstInput = previewRef.querySelector(
                                  'input:not([type="hidden"]):not([readonly]):not([disabled]), textarea:not([readonly]):not([disabled]), select:not([disabled]), button:not(.cancel-button):not(.save-button):not([disabled])',
                                )
                                if (firstInput instanceof HTMLElement) {
                                  logDebug('FormBrowserView', `list-item Tab: found first input (${firstInput.tagName}), focusing it`)
                                  firstInput.focus()
                                } else {
                                  logDebug('FormBrowserView', `list-item Tab: no focusable input found, trying broader search`)
                                  // Try a broader search (include readonly/disabled)
                                  const anyInput = previewRef.querySelector('input:not([type="hidden"]), textarea, select, button:not(.cancel-button):not(.save-button)')
                                  if (anyInput instanceof HTMLElement) {
                                    logDebug('FormBrowserView', `list-item Tab: found input with broader search (${anyInput.tagName}), focusing it`)
                                    anyInput.focus()
                                  } else {
                                    logDebug('FormBrowserView', `list-item Tab: no input field found at all in form preview`)
                                  }
                                }
                              } else {
                                logDebug('FormBrowserView', `list-item Tab: formPreviewRef.current is null`)
                              }
                            }, 100)
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
                {selectedTemplate && formFields.length > 0 ? (
                  <div className="form-browser-form-wrapper" ref={formPreviewRef}>
                    <div className="form-browser-preview-wrapper">
                      <FormPreview
                        frontmatter={frontmatter}
                        fields={formFields}
                        folders={folders}
                        notes={notes}
                        requestFromPlugin={requestFromPlugin}
                        onSave={handleSave}
                        onCancel={handleCancel}
                        hideHeaderButtons={false}
                        allowEmptySubmit={frontmatter.allowEmptySubmit || false}
                        hidePreviewHeader={true}
                        hideWindowTitlebar={true}
                      />
                    </div>
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
