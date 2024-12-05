// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the settings dialog
// Changes are saved when "Save & Close" is clicked, but not before
// Called by Header component.
// Last updated 2024-09-21 for v2.1.0.a12 by @jgclark
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useEffect, useRef, useState, type ElementRef } from 'react'
import type { TSettingItem, TDashboardSettings } from '../../types'
import { PERSPECTIVE_ACTIONS, DASHBOARD_ACTIONS } from '../reducers/actionTypes'
import { renderItem } from '../support/uiElementRenderHelpers'
import { setPerspectivesIfJSONChanged, getActivePerspectiveName } from '../../perspectiveHelpers'
import { useAppContext } from './AppContext.jsx'
// import PerspectiveSettings from './PerspectiveSettings.jsx'
import '../css/SettingsDialog.css' // Import the CSS file
import Modal from './Modal'
import { clo, logDebug, logWarn } from '@np/helpers/react/reactDev.js'
import { dt } from '@np/helpers/dev.js'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------
type Settings = { [key: string]: string | boolean }

type SettingsDialogProps = {
  items: Array<TSettingItem>,
  onSaveChanges?: (updatedSettings: { [key: string]: any }) => void,
  className?: string,
  labelPosition?: 'left' | 'right',
  isOpen: boolean,
  toggleDialog: () => void,
  style?: Object, // Add style prop
}

//--------------------------------------------------------------------------
// SettingsDialog Component Definition
//--------------------------------------------------------------------------

const SettingsDialog = ({
  items, // won't chaange unless its parent changes it
  onSaveChanges = () => {}, // optional in case Header wants to do something else
  className,
  labelPosition = 'right',
  isOpen,
  toggleDialog,
  style, // Destructure style prop
}: SettingsDialogProps): React.ReactNode => {
  //----------------------------------------------------------------------
  // Context
  //----------------------------------------------------------------------
  const { dashboardSettings, dispatchDashboardSettings, dispatchPerspectiveSettings, pluginData, perspectiveSettings, sendActionToPlugin } = useAppContext()

  const pluginDisplayVersion = `v${pluginData?.version || ''}`

  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------
  const dialogRef = useRef<?ElementRef<'dialog'>>(null)
  const dropdownRef = useRef<?{ current: null | HTMLInputElement }>(null)
  const [changesMade, setChangesMade] = useState(false)
  const [updatedSettings, setUpdatedSettings] = useState(() => {
    const initialSettings: Settings = {}
    logDebug('SettingsDialog/initial state', `Starting`)
    items.forEach((item) => {
      if (item.key) {
        const thisKey = item.key
        initialSettings[thisKey] = item.value || item.checked || ''
        if (item.controlsOtherKeys) logDebug('SettingsDialog/initial state', `- ${thisKey} controls [${String(item.controlsOtherKeys)}]`) // ✅

        if (item.dependsOnKey) {
          logDebug('SettingsDialog/initial state', `- ${thisKey} depends on ${item.dependsOnKey}, whose initialSettings=${String(initialSettings[item.dependsOnKey])}`) // ✅
        }
      }
    })
    return initialSettings
  })

  // Add a new state to track the controlling settings' states
  const [controllingSettingsState, setControllingSettingsState] = useState({})

  if (!updatedSettings) return null // Prevent rendering before items are loaded
  logDebug('SettingsDialog/main', `Starting`)

  // Return whether the controlling setting item is checked or not
  function stateOfControllingSetting(item: TSettingItem): boolean {
    return controllingSettingsState[item.dependsOnKey ?? ''] ?? false
  }

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------

  const handleEscapeKey = (event: KeyboardEvent) => {
    logDebug('SettingsDialog', `Event.key: ${event.key}`)
    if (event.key === 'Escape') {
      toggleDialog()
    }
  }

  const handleFieldChange = (key: string, value: any) => {
    setChangesMade(true)
    setUpdatedSettings((prevSettings) => ({ ...prevSettings, [key]: value }))

    // change whether to disable or not the other items listed in this controlsOtherKeys (if any)
    const thisItem = items.find((item) => item.key === key)
    logDebug('SettingsDialog/handleFieldChange', `setting '${String(thisItem?.key ?? '?')}' has changed`) // ✅
    logDebug('SettingsDialog/handleFieldChange', `- will impact controlled items [${String(thisItem?.controlsOtherKeys)}] ...`) // ✅
    if (thisItem && thisItem.controlsOtherKeys) {
      const controlledItems = items.filter((item) => thisItem.controlsOtherKeys?.includes(item.key))
      controlledItems.forEach((item) => {
        logDebug('SettingsDialog/handleFieldChange', `- triggering change to disabled state for setting ${String(item.key)}`) // ✅
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
      if (updatedSettings?.perspectiveSettings) {
        newSettings = setPerspectivesIfJSONChanged(newSettings, dashboardSettings, sendActionToPlugin, `Dashboard Settings updated`)
      }
      onSaveChanges(newSettings)
    }
    toggleDialog()
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

  useEffect(() => {
    if (isOpen && dialogRef.current instanceof HTMLDialogElement) {
      dialogRef.current.showModal()
      document.addEventListener('keydown', handleEscapeKey)
    } else if (dialogRef.current instanceof HTMLDialogElement) {
      dialogRef.current.close()
      document.removeEventListener('keydown', handleEscapeKey)
    }
    return () => {
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [isOpen])

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
  logDebug('SettingsDialog/pre-Render', `before render of ${String(items.length)} settings.`)

  return (
    <Modal
      onClose={() => {
        toggleDialog()
      }}
    >
      <div ref={dialogRef} className={`settings-dialog ${className || ''}`} style={style} onClick={(e) => e.stopPropagation()}>
        <div className="settings-dialog-header">
          <button className="PCButton cancel-button" onClick={toggleDialog}>
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
          {items.map((item, index) => (
            <div key={`sdc${index}`}>
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
                inputRef: item.type === 'combo' ? dropdownRef : undefined, // Assign ref to the dropdown input
                indent: !!item.dependsOnKey,
                className: '', // for future use
                showDescAsTooltips: false,
              })}
              {/* {item.description && (
							<div className="item-description">{item.description}</div>
						)} */}
            </div>
          ))}
          <div className="item-description">{pluginDisplayVersion}</div>
        </div>
      </div>
    </Modal>
  )
}

export default SettingsDialog
