// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the settings dialog
// Changes are saved when "Save & Close" is clicked, but not before
// Called by Header component.
// Last updated 2025-07-04 for v2.3.0.b4 by @jgclark
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useEffect, useRef, useState, type ElementRef } from 'react'
import { defaultSectionDisplayOrder } from '../../constants.js'
import type { TSettingItem, TDashboardSettings, TSectionCode } from '../../types.js'
// import { PERSPECTIVE_ACTIONS, DASHBOARD_ACTIONS } from '../reducers/actionTypes'
import { renderItem } from '../support/uiElementRenderHelpers'
import { setPerspectivesIfJSONChanged } from '../../perspectiveHelpers'
import { useAppContext } from './AppContext.jsx'
// import PerspectiveSettings from './PerspectiveSettings.jsx'
import '../css/SettingsDialog.css' // Import the CSS file
import Modal from './Modal'
import SectionOrderPanel from './SectionOrderPanel.jsx'
import { clo, logDebug, logWarn } from '@helpers/react/reactDev.js'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------
type Settings = { [key: string]: string | boolean }

type SettingsDialogProps = {
  items: Array<TSettingItem>,
  onSaveChanges?: (updatedSettings: { [key: string]: any }) => void,
  className?: string,
  labelPosition?: 'left' | 'right',
  style?: Object, // Add style prop
}

//--------------------------------------------------------------------------
// SettingsDialog Component Definition
//--------------------------------------------------------------------------

const SettingsDialog = ({
  items, // won't change unless its parent changes it
  onSaveChanges = () => {}, // optional in case Header wants to do something else
  className,
  labelPosition = 'right',
  style, // Destructure style prop
}: SettingsDialogProps): React$Node => {
  //----------------------------------------------------------------------
  // Context
  //----------------------------------------------------------------------
  const { dashboardSettings, pluginData, sendActionToPlugin, reactSettings, setReactSettings } = useAppContext()
  const { sections } = pluginData

  const pluginDisplayVersion = `v${pluginData?.version || ''}`

  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------
  const dialogRef = useRef<?ElementRef<'dialog'>>(null)
  const dropdownRef = useRef<?{ current: null | HTMLInputElement }>(null)
  const [changesMade, setChangesMade] = useState(false)
  const [updatedSettings, setUpdatedSettings] = useState(() => {
    const initialSettings: Settings = {}
    // logDebug('SettingsDialog/initial state', `Starting`)
    items.forEach((item) => {
      if (item.key) {
        const thisKey = item.key
        initialSettings[thisKey] = item.value || item.checked || ''
        // if (item.controlsOtherKeys) logDebug('SettingsDialog/initial state', `- ${thisKey} controls [${String(item.controlsOtherKeys)}]`) // ✅

        if (item.dependsOnKey) {
          // logDebug('SettingsDialog/initial state', `- ${thisKey} depends on ${item.dependsOnKey}, whose initialSettings=${String(initialSettings[item.dependsOnKey])}`) // ✅
        }
      }
    })
    return initialSettings
  })

  // Add a new state to track the controlling settings' states
  const [controllingSettingsState, setControllingSettingsState] = useState({})
  
  // Track section order changes separately (will be merged into updatedSettings on save)
  const [sectionOrderChange, setSectionOrderChange] = useState<?Array<TSectionCode>>(null)

  if (!updatedSettings) return null // Prevent rendering before items are loaded
  logDebug('SettingsDialog/main', `Starting`)

  // Return whether the controlling setting item is checked or not
  function stateOfControllingSetting(item: TSettingItem): boolean {
    // $FlowIgnore[invalid-computed-prop]
    return controllingSettingsState[item.dependsOnKey ?? ''] ?? false
  }

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------

  const handleEscapeKey = (event: KeyboardEvent) => {
    // logDebug('SettingsDialog', `Event.key: ${event.key}`)
    if (event.key === 'Escape') {
      setReactSettings((prev) => ({
        ...prev,
        settingsDialog: {
          ...prev?.settingsDialog,
          isOpen: false,
        },
      }))
    }
  }

  const handleFieldChange = (key: string, value: any) => {
    setChangesMade(true)
    setUpdatedSettings((prevSettings) => ({ ...prevSettings, [key]: value }))

    // change whether to disable or not the other items listed in this controlsOtherKeys (if any)
    const thisItem = items.find((item) => item.key === key)
    // logDebug('SettingsDialog/handleFieldChange', `setting '${String(thisItem?.key ?? '?')}' has changed`) // ✅
    // logDebug('SettingsDialog/handleFieldChange', `- will impact controlled items [${String(thisItem?.controlsOtherKeys)}] ...`) // ✅
    if (thisItem && thisItem.controlsOtherKeys) {
      const controlledItems = items.filter((item) => thisItem.controlsOtherKeys?.includes(item.key))
      controlledItems.forEach((item) => {
        // logDebug('SettingsDialog/handleFieldChange', `- triggering change to disabled state for setting ${String(item.key)}`) // ✅
        // TODO: HELP: How to get each controlledItem re-rendered (which should pick up disabled state change)?
      })
    }
  }

  // Handle "Save & Close" action
  const handleSave = () => {
    if (onSaveChanges) {
      // Because the settings dialog has the JSON editor for perspectives, which are not technically dashboard settings,
      // we need to make sure it gets updated
      let newSettings: TDashboardSettings = { ...updatedSettings }
      
      // Include section order change if it exists
      if (sectionOrderChange) {
        newSettings.customSectionDisplayOrder = sectionOrderChange
      }
      
      if (updatedSettings?.perspectiveSettings) {
        newSettings = setPerspectivesIfJSONChanged(newSettings, dashboardSettings, sendActionToPlugin, `Dashboard Settings updated`)
      }
      onSaveChanges(newSettings)
    }
    
    // Reset section order change tracking
    setSectionOrderChange(null)
    
    setReactSettings((prev) => ({
      ...prev,
      settingsDialog: {
        ...prev?.settingsDialog,
        isOpen: false,
      },
    }))
  }

  // const handleDropdownOpen = () => {
  //   setTimeout(() => {
  //     if (dropdownRef.current instanceof HTMLInputElement) {
  //       dropdownRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
  //     }
  //   }, 100) // Delay to account for rendering/animation
  // }

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------

  // Effect to handle scrolling to target when dialog opens
  useEffect(() => {
    if (reactSettings?.settingsDialog?.scrollTarget) {
      // Wait for dialog to be fully rendered
      setTimeout(() => {
        const targetElement = reactSettings?.settingsDialog?.scrollTarget ? document.querySelector(`[data-settings-key="${reactSettings?.settingsDialog.scrollTarget}"]`) : null
        if (targetElement) {
          logDebug('SettingsDialog/useEffect', `Scrolling to element [${reactSettings?.settingsDialog.scrollTarget}]`)
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
        } else {
          logDebug('SettingsDialog/useEffect', `No target element found for scrollTarget=${reactSettings?.settingsDialog.scrollTarget}`)
          return
        }
        // Clear the scroll target after scrolling
        setReactSettings((prev) => ({
          ...prev,
          settingsDialog: {
            ...prev?.settingsDialog,
            scrollTarget: null,
          },
        }))
      }, 100)
    }
  }, [reactSettings?.settingsDialog?.scrollTarget])

  // useEffect(() => {
  //   const dropdown = dropdownRef.current
  //   if (dropdown instanceof HTMLInputElement) {
  //     dropdown.addEventListener('click', handleDropdownOpen)
  //   }
  //   return () => {
  //     if (dropdown instanceof HTMLInputElement) {
  //       dropdown.removeEventListener('click', handleDropdownOpen)
  //     }
  //   }
  // }, [])

  // Add a useEffect to update the controlling settings' states
  useEffect(() => {
    const newControllingSettingsState = {}
    items.forEach((item) => {
      if (item.dependsOnKey) {
        const thatKey = items.find((f) => f.key === item.dependsOnKey)
        if (thatKey) {
          newControllingSettingsState[item.dependsOnKey] = updatedSettings[thatKey.key] ?? false
        }
      }
    })
    setControllingSettingsState(newControllingSettingsState)
  }, [items, updatedSettings])

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------
  // logDebug('SettingsDialog/pre-Render', `before render of ${String(items.length)} settings.`)

  return (
    <Modal
      onClose={() => {
        // Discard section order changes when closing via modal backdrop
        setSectionOrderChange(null)
        setReactSettings((prev) => ({
          ...prev,
          settingsDialog: {
            ...prev?.settingsDialog,
            isOpen: false,
          },
        }))
      }}
    >
      <div ref={dialogRef} className={`settings-dialog ${className || ''}`} style={style} onClick={(e) => e.stopPropagation()}>
        <div className="settings-dialog-header">
          <button
            className="PCButton cancel-button"
            onClick={() => {
              // Discard section order changes on cancel
              setSectionOrderChange(null)
              setReactSettings((prev) => ({
                ...prev,
                settingsDialog: {
                  ...prev?.settingsDialog,
                  isOpen: false,
                },
              }))
            }}
          >
            Cancel
          </button>
          <span className="settings-dialog-title">Dashboard Settings</span>
          {changesMade ? (
            <button className="PCButton save-button" onClick={handleSave}>
              Save & Close
            </button>
          ) : (
            <button className="PCButton save-button-inactive">Save & Close</button>
          )}
        </div>
        <div className="settings-dialog-content">
          {/* Iterate over all the settings */}
          {items.map((item, index) => {

            // Handle sectionOrderPanel type specially
            if (item.type === 'sectionOrderPanel') {
              return (
                <details key={`sdc${index}`} data-settings-key={item.key} className="ui-item">
                  <summary className="section-order-panel-summary">
                    <span className="switch-label">{item.label || 'Reorder Sections'}</span>
                    {item.description && <div className="item-description">{item.description}</div>}
                  </summary>
                  <SectionOrderPanel
                    sections={sections}
                    dashboardSettings={dashboardSettings}
                    defaultOrder={defaultSectionDisplayOrder}
                    onSave={(newOrder) => {
                      // Track the section order change (will be saved when "Save & Close" is clicked)
                      setSectionOrderChange(newOrder)
                      setChangesMade(true)
                    }}
                  />
                </details>
              )
            }

            return (
              <div key={`sdc${index}`} data-settings-key={item.key}>
                {renderItem({
                  index,
                  item: {
                    ...item,
                    type: item.type,
                    value: typeof item.key === 'undefined' ? '' : typeof updatedSettings[item.key] === 'boolean' ? '' : updatedSettings[item.key],
                    checked: typeof item.key === 'undefined' ? false : typeof updatedSettings[item.key] === 'boolean' ? updatedSettings[item.key] : false,
                  },
                  disabled: item.dependsOnKey ? !stateOfControllingSetting(item) : false,
                  handleFieldChange,
                  labelPosition,
                  showSaveButton: false, // Do not show save button
                  // $FlowFixMe[incompatible-exact] reason for suppression
                  // $FlowFixMe[incompatible-call] reason for suppression
                  inputRef: item.type === 'dropdown-select' ? dropdownRef : undefined, // Assign ref to the dropdown input
                  indent: !!item.dependsOnKey,
                  className: '', // for future use
                  showDescAsTooltips: false,
                })}
                {/* {item.description && (
							<div className="item-description">{item.description}</div>
						)} */}
              </div>
            )
          })}
          <div className="item-description">{pluginDisplayVersion}</div>
        </div>
      </div>
    </Modal>
  )
}

export default SettingsDialog
