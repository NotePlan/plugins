// @flow
//--------------------------------------------------------------------------
// React component to show a dialog using dynamic field definitions
// Changes are saved when "Submit" is clicked, but not before
// Imported by Root.jsx and displayed when the context variable reactSettings.dynamicDialog.visible is true
//--------------------------------------------------------------------------
/**
 * TODO:
 * - get ThemedSelect to pass onSelect to settings
 * - add "disabled" to all elements
 * - Dropdown always visible is not working
 * - Make dialog draggable?
 * - Send processing template name to plugin in pluginData
 * - Processing command should be np.Templating,templateRunner
 * - Template-side processing, use: overrideSettingsWithTypedArgs (somehow needs to identify that this is a JSON self-runner, __isJSON__ = true or something)
 * - implement dependsOnKey (disabled greyed out and indented)
 * - CSS: Separator padding top/bottom balance
 *
 */
//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useEffect, useRef, useState, type ElementRef } from 'react'
import { renderItem } from './dialogElementRenderer'
import './DynamicDialog.css' // Import the CSS file
import Modal from '@helpers/react/Modal'
import { clo, logWarn, timer, logDebug, logError } from '@helpers/react/reactDev.js'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------
export type TSettingItemType = 
  | 'switch'
  | 'input'
  | 'combo' // the react-select version (ThemedSelect)
  | 'dropdown' // the simple dropdown aka DropdownSelect
  | 'number'
  | 'text'
  | 'separator'
  | 'heading'
  | 'input-readonly'
  | 'json'

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
  dependsOnKey?: string, // only show/allow this field if the field named in dependsOnKey is true
  step?: number, // only applies to number type -- the increment/decrement amount
}

export type TDynamicDialogProps = {
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
  hideDependentItems?: boolean,
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
  hideDependentItems,
}: TDynamicDialogProps): React$Node => {
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
  // HELPER FUNCTIONS
  //----------------------------------------------------------------------

  function getInitialItemStateObject(items: Array<TSettingItem>): { [key: string]: any } {
    const initialItemValues = {}
    items.forEach((item) => {
      // $FlowFixMe[prop-missing]
      if (item.key) initialItemValues[item.key] = item.value ?? item.checked ?? item.default ?? ''
      if (item.dependsOnKey) {
        // logDebug('SettingsDialog/initial state', `- ${item.key || ''} depends on ${item.dependsOnKey} to be true, whose initial state=${String(initialItemValues[item.dependsOnKey])}`) // ✅
      }
    })
    return initialItemValues
  }

  // Return whether the controlling setting item is checked or not
  function stateOfControllingSetting(item: TSettingItem): boolean {
    const dependsOn = item.dependsOnKey ?? ''
    if (dependsOn) {
      const isThatKeyChecked = updatedSettings[dependsOn]
      if (!updatedSettings.hasOwnProperty(dependsOn)) {
        logError('', `Cannot find key '${dependsOn}' that key ${item.key ?? ''} is controlled by`)
        return false
      }
      logDebug('SettingsDialog/stateOfControllingSetting', `dependsOn='${dependsOn} / isThatKeyChecked=${String(isThatKeyChecked)}`)
      return isThatKeyChecked
    } else {
      // shouldn't get here
      logWarn('SettingsDialog/stateOfControllingSetting', `Key ${item.key ?? ''} does not have .dependsOnKey setting`)
      return false
    }
  }

  function shouldRenderItem(item: TSettingItem): boolean {
    if (!item) return false
    if (!item.dependsOnKey) return true
    const yesRender = !item.dependsOnKey || !hideDependentItems || item.dependsOnKey && stateOfControllingSetting(item)
    // logDebug('SettingsDialog/shouldRenderItem?', `${yesRender} -- item=${item?.key} dependsOnKey=${item.dependsOnKey} hideDependentItems=${hideDependentItems} stateOfControllingSetting=${item.dependsOnKey && stateOfControllingSetting(item) || ''}`)
    return yesRender
  }

  //----------------------------------------------------------------------
  // Context
  //----------------------------------------------------------------------

  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------
  const dialogRef = useRef<?ElementRef<'dialog'>>(null)
  const dropdownRef = useRef<?{ current: null | HTMLInputElement }>(null)
  const [changesMade, setChangesMade] = useState(allowEmptySubmit)
  const [updatedSettings, setUpdatedSettings] = useState(getInitialItemStateObject(items))

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
    clo({ ...updatedSettings, [key]: value }, `DynamicDialog/handleFieldChange ${key}=${value} updatedSettings=`)
  }

  const handleSave = () => {
    if (onSave) {
      onSave(updatedSettings)
      clo(updatedSettings, `DynamicDialog/handleSave updatedSettings=`)
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
  // clo(items, `DynamicDialog items=`)
  if (!updatedSettings) return null
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
            {(!item.key || shouldRenderItem(item)) && renderItem({
              index,
              item: {
                ...item,
                type: item.type,
                value: typeof item.key === 'undefined' ? '' : typeof updatedSettings[item.key] === 'boolean' ? '' : updatedSettings[item.key],
                checked: typeof item.key === 'undefined' ? false : typeof updatedSettings[item.key] === 'boolean' ? updatedSettings[item.key] : false,
              },
              disabled: (item.dependsOnKey) ? !stateOfControllingSetting(item) : false,
              indent: Boolean(item.dependsOnKey),
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