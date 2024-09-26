// @flow
//--------------------------------------------------------------------------
// React component to show a dialog using dynamic field definitions
// Changes are saved when "Submit" is clicked, but not before
// Imported by Root.jsx and displayed when the context variable reactSettings.dynamicDialog.visible is true
//--------------------------------------------------------------------------
/**
 * TODO:
 * - Separator is not visible
 * - Dropdown always visible is not working
 * - Make dialog draggable?
 * - Send processing template name to plugin in pluginData
 * - Processing command should be np.Templating,templateRunner
 * - Template-side processing, use: overrideSettingsWithTypedArgs (somehow needs to identify that this is a JSON self-runner, __isJSON__ = true or something)
 *
 */
//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useEffect, useRef, useState, type ElementRef } from 'react'
import { renderItem } from './dialogElementRenderer'
import './DynamicDialog.css' // Import the CSS file
import Modal from '@helpers/react/Modal'
import { logDebug } from '@helpers/react/reactDev.js'
import { clo } from '@helpers/dev.js'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------
export type TSettingItemType = 'switch' | 'input' | 'combo' | 'dropdown' | 'number' | 'text' | 'separator' | 'heading' | 'header'

export type TSettingItem = {
  type: TSettingItemType,
  key?: string, // we can have setting items which are just 'separator' with no key, so this is optional
  value?: string,
  label?: string,
  checked?: boolean,
  options?: Array<string>,
  textType?: 'title' | 'description' | 'separator',
  description?: string,
  default?: any,
  refreshAllOnChange?: boolean,
  compactDisplay?: boolean,
}

type SettingsDialogProps = {
  title: string,
  items: Array<TSettingItem>,
  className?: string,
  labelPosition?: 'left' | 'right',
  allowEmptySubmit?: boolean,
  isOpen: boolean,
  style?: Object, // Add style prop
  isModal?: boolean, // default is true, but can be overridden to run full screen
  onSave?: (updatedSettings: { [key: string]: any }) => void,
  onCancel: () => void,
  children: React$Node, // children nodes (primarily for banner message)
}

//--------------------------------------------------------------------------
// SettingsDialog Component Definition
//--------------------------------------------------------------------------

const DynamicDialog = ({
  children,
  title,
  items: passedItems,
  className,
  labelPosition = 'right',
  allowEmptySubmit = false,
  isOpen,
  style, // Destructure style prop
  isModal = true, // by default, it is a modal dialog, but can run full screen
  onSave, // caller needs to process the updated settings
  onCancel, // caller should always close the dialog by setting reactSettings.dynamicDialog.visible to false
}: SettingsDialogProps): React$Node => {
  if (!isOpen) return null
  const items = passedItems || [
    {
      key: 'errorMessage',
      label: 'No items were sent to the dialog to be rendered',
      type: 'text',
      textType: 'description',
    },
  ]

  //----------------------------------------------------------------------
  // Context
  //----------------------------------------------------------------------

  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------
  const dialogRef = useRef<?ElementRef<'dialog'>>(null)
  const dropdownRef = useRef<?{ current: null | HTMLInputElement }>(null)
  const [changesMade, setChangesMade] = useState(allowEmptySubmit)
  const [updatedSettings, setUpdatedSettings] = useState(() => {
    const initialItemValues = {}
    items.forEach((item) => {
      // $FlowFixMe[prop-missing]
      if (item.key) initialItemValues[item.key] = item.value || item.checked || ''
    })
    return initialItemValues
  })

  if (!updatedSettings) return null // Prevent rendering before items are loaded

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------

  const handleEscapeKey = (event: KeyboardEvent) => {
    logDebug('SettingsDialog', `Event.key: ${event.key}`)
    if (event.key === 'Escape') {
      onCancel()
    }
  }

  const handleFieldChange = (key: string, value: any) => {
    setChangesMade(true)
    setUpdatedSettings((prevSettings) => ({ ...prevSettings, [key]: value }))
  }

  const handleSave = () => {
    if (onSave) {
      onSave(updatedSettings)
    }
    // $FlowFixMe[cannot-spread-indexer]
    logDebug('Dashboard', `Dashboard Settings Panel updates`, updatedSettings)
  }

  const handleDropdownOpen = () => {
    setTimeout(() => {
      if (dropdownRef.current instanceof HTMLInputElement) {
        dropdownRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }
    }, 100) // Delay to account for rendering/animation
  }

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

  useEffect(() => {
    const dropdown = dropdownRef.current
    if (dropdown instanceof HTMLInputElement) {
      dropdown.addEventListener('click', handleDropdownOpen)
    }
    return () => {
      if (dropdown instanceof HTMLInputElement) {
        dropdown.removeEventListener('click', handleDropdownOpen)
      }
    }
  }, [])

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------
  const dialogContents = (
    <div ref={dialogRef} className={`dynamic-dialog ${className || ''}`} style={style} onClick={(e) => e.stopPropagation()}>
      <div className="dynamic-dialog-header">
        <button className="PCButton cancel-button" onClick={onCancel}>
          Cancel
        </button>
        <span className="dynamic-dialog-title">{title || ''}</span>
        {changesMade ? (
          <button className="PCButton save-button" onClick={handleSave}>
            Submit
          </button>
        ) : (
          <button className="PCButton save-button-inactive">Submit</button>
        )}
      </div>
      <div className="dynamic-dialog-content">
        {children}
        {items.map((item, index) => (
          <div key={`ddc-${index}`}>
            {renderItem({
              index,
              item: {
                ...item,
                type: item.type,
                value: typeof item.key === 'undefined' ? '' : typeof updatedSettings[item.key] === 'boolean' ? '' : updatedSettings[item.key],
                checked: typeof item.key === 'undefined' ? false : typeof updatedSettings[item.key] === 'boolean' ? updatedSettings[item.key] : false,
              },
              handleFieldChange,
              labelPosition,
              showSaveButton: false, // Do not show save button
              // $FlowIgnore
              inputRef: item.type === 'combo' || item.type === 'dropdown' ? dropdownRef : undefined, // Assign ref to the dropdown input
              className: '', // for future use
            })}
            {item.description && <div className="item-description">{item.description}</div>}
          </div>
        ))}
      </div>
    </div>
  )
  return isModal ? (
    <Modal
      onClose={() => {
        onCancel()
      }}
    >
      {dialogContents}
    </Modal>
  ) : (
    dialogContents
  )
}

export default DynamicDialog
