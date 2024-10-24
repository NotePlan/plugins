// @flow
//--------------------------------------------------------------------------
// React component to show a dialog using dynamic field definitions
// Changes are saved when "Submit" is clicked, but not before
// Imported by Root.jsx and displayed when the context variable reactSettings.dynamicDialog.visible is true
//--------------------------------------------------------------------------
/**
 * TODO:
 * - get ThemedSelect to pass value if label/value has been set
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
  noWrapOptions?: boolean, // truncate, do not wrap the label (for combo)
  focus?: boolean, // for input fields only, set focus to this field when dialog opens
  controlsOtherKeys?: Array<string>, // if this item is changed, also change the items named in this array
  displayDoneCounts?: boolean, // if true, then show the done counts in the dashboard
}

export type TDynamicDialogProps = {
  // required props
  items: Array<TSettingItem>,
  // optional props
  onSave?: (updatedSettings: { [key: string]: any }) => void,
  onCancel?: () => void,
  className?: string,
  labelPosition?: 'left' | 'right',
  allowEmptySubmit?: boolean,
  isOpen?: boolean,
  title?: string,
  style?: Object, // Add style prop
  isModal?: boolean, // default is true, but can be overridden to run full screen
  hideDependentItems?: boolean,
  submitOnEnter?: boolean,
  children?: React$Node, // children nodes (primarily for banner message)
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
  isOpen = true,
  style, // Destructure style prop
  isModal = true, // by default, it is a modal dialog, but can run full screen
  onSave, // caller needs to process the updated settings
  onCancel, // caller should always close the dialog by setting reactSettings.dynamicDialog.visible to false
  hideDependentItems,
  submitOnEnter = true,
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
  const updatedSettingsRef = useRef(updatedSettings)

  useEffect(() => {
    updatedSettingsRef.current = updatedSettings
  }, [updatedSettings])

  if (!updatedSettings) return null // Prevent rendering before items are loaded

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------

  const handleEscapeKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onCancel && onCancel()
    }
  }

  const handleEnterKey = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && submitOnEnter) {
      event.preventDefault() // Prevent default action if needed
      handleSave() // see the note below about why we use the ref inside of handleSave
    }
  }

  const handleFieldChange = (key: string, value: any) => {
    setChangesMade(true)
    setUpdatedSettings((prevSettings) => {
      const newSettings = { ...prevSettings, [key]: value }
      updatedSettingsRef.current = newSettings
      return newSettings
    })
  }

  const handleSave = () => {
    if (onSave) {
      onSave(updatedSettingsRef.current) // we have to use the ref, because the state may be stale if the enter key event listener caused this to be called
    }
    logDebug('Dashboard', `DynamicDialog saved updates`, updatedSettingsRef.current)
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

  // Submit on Enter (unless submitOnEnter is set to false)
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEnterKey)
      document.addEventListener('keydown', handleEscapeKey)
    }

    return () => {
      document.removeEventListener('keydown', handleEnterKey)
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [isOpen, submitOnEnter])

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
                value: typeof item.key === 'undefined' ? '' : updatedSettings[item.key] ?? '',
                checked: typeof item.key === 'undefined' ? false : updatedSettings[item.key] === true,
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
        onCancel && onCancel()
      }}
    >
      {dialogContents}
    </Modal>
  ) : (
    dialogContents
  )
}

export default DynamicDialog