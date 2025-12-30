// @flow
//--------------------------------------------------------------------------
// React component to show a dialog using dynamic field definitions.
// Changes are saved when the "Submit" button is clicked, but not before.
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
 */

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------

import React, { useEffect, useRef, useState, type ElementRef } from 'react'
import { renderItem } from './dialogElementRenderer'
import './DynamicDialog.css' // Import the CSS file
import Modal from '@helpers/react/Modal'
import { logWarn, timer, logDebug, logError } from '@helpers/react/reactDev.js'
import { type NoteOption } from './NoteChooser.jsx'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------

export type TSettingItemType =
  | 'switch'
  | 'input'
  | 'combo' // the react-select version (ThemedSelect)
  | 'dropdown-select' // the simple dropdown aka DropdownSelect
  | 'number'
  | 'text'
  | 'separator'
  | 'heading'
  | 'input-readonly'
  | 'json'
  | 'button'
  | 'button-group'
  | 'calendarpicker'
  | 'hidden'
  | 'orderingPanel'
  | 'folder-chooser'
  | 'note-chooser'
  | 'heading-chooser'
  | 'event-chooser' // Calendar event chooser
  | 'form-state-viewer' // Read-only field that displays current form state as JSON
  | 'textarea' // Expandable textarea field
  | 'templatejs-block' // TemplateJS code block that executes JavaScript
  | 'multi-select' // Multi-select checkbox list
  | 'markdown-preview' // Non-editable markdown preview (static text, note by filename/title, or note from another field)

export type TSettingItem = {
  type: TSettingItemType,
  key?: string, // we can have setting items which are just 'separator' with no key, so this is optional
  value?: string,
  label?: string,
  checked?: boolean,
  options?: Array<string | { label: string, value: string, isDefault?: boolean }>,
  textType?: 'title' | 'description' | 'separator',
  description?: string,
  handleDescriptionItself?: boolean, // if true, then the description is handled by the item itself (e.g. for teamspace-multiselect)
  default?: any,
  refreshAllOnChange?: boolean,
  compactDisplay?: boolean,
  dependsOnKey?: string, // DEPRECATED: use requiresKey instead. Only show/allow this field if the field named in requiresKey is true (prerequisite for visibility/editability)
  requiresKey?: string, // Prerequisite: only show/allow this field if the field named in requiresKey is true/has a value (for visibility/editability)
  step?: number, // only applies to number type -- the increment/decrement amount
  noWrapOptions?: boolean, // truncate, do not wrap the label (for combo)
  focus?: boolean, // for input fields only, set focus to this field when dialog opens
  controlsOtherKeys?: Array<string>, // if this item is changed, also change the items named in this array
  displayDoneCounts?: boolean, // if true, then show the done counts in the dashboard
  vertical?: boolean, // Add vertical property for button-group
  isDefault?: boolean, // Add isDefault property for button items
  fixedWidth?: number, // for dropdowns, set a fixed width
  selectedDate?: Date, // for calendarpicker, the selected date
  numberOfMonths?: number, // for calendarpicker, the number of months to show
  size?: number, // for calendarpicker, the size scale factor (0.5 = 50%, default)
  required?: boolean, // for input fields, require the field to be filled out
  validationType?: 'email' | 'number' | 'date-interval', // for input fields, validate the input
  isEditable?: boolean, // for dropdown-select, allow the user to edit the value
  placeholder?: string, // for dropdown-select, placeholder text when no value is selected
  buttonText?: string, // for calendarpicker and button, text to display on button
  visible?: boolean, // for calendarpicker, whether calendar is shown by default
  // folder-chooser options (matching chooseFolder function parameters)
  includeArchive?: boolean, // for folder-chooser, include the Archive folder in the list
  includeNewFolderOption?: boolean, // for folder-chooser, add a 'New Folder' option that allows creating a new folder
  startFolder?: string, // for folder-chooser, folder to start the list in (e.g. to limit folders to a specific subfolder)
  includeFolderPath?: boolean, // for folder-chooser, show the folder path (or most of it), not just the last folder name
  excludeTeamspaces?: boolean, // for folder-chooser, exclude teamspace folders from the list
  // heading-chooser options
  dependsOnNoteKey?: string, // DEPRECATED: use sourceNoteKey instead. For heading-chooser, the key of a note-chooser field to get headings from dynamically (value dependency)
  sourceNoteKey?: string, // Value dependency: for heading-chooser and markdown-preview, the key of a note-chooser field to get note data from dynamically
  defaultHeading?: string, // for heading-chooser, default heading value if none selected
  optionAddTopAndBottom?: boolean, // for heading-chooser, whether to add "top of note" and "bottom of note" options (default: true)
  includeArchive?: boolean, // for heading-chooser, whether to include headings in Archive section (default: false)
  // note-chooser options
  includeCalendarNotes?: boolean, // for note-chooser, include calendar notes (default: false)
  includePersonalNotes?: boolean, // for note-chooser, include personal/project notes (default: true)
  includeRelativeNotes?: boolean, // for note-chooser, include relative notes like <today>, <thisweek>, etc. (default: false)
  includeTeamspaceNotes?: boolean, // for note-chooser, include teamspace notes (default: true)
  includeNewNoteOption?: boolean, // for note-chooser, add a 'New Note' option that allows creating a new note
  dependsOnFolderKey?: string, // DEPRECATED: use sourceFolderKey instead. For note-chooser, key of a folder-chooser field to filter notes by folder (value dependency)
  sourceFolderKey?: string, // Value dependency: for note-chooser, key of a folder-chooser field to filter notes by folder
  // showValue option for SearchableChooser-based fields
  showValue?: boolean, // for folder-chooser, note-chooser, heading-chooser, dropdown-select-chooser: show the selected value below the input (default: false)
  staticHeadings?: Array<string>, // for heading-chooser, static list of headings (if not depending on a note)
  // textarea options
  minRows?: number, // for textarea, minimum number of rows (default: 3)
  maxRows?: number, // for textarea, maximum number of rows before scrolling (default: 10)
  // templatejs-block options
  executeTiming?: 'before' | 'after', // for templatejs-block, when to execute: before form fields render, or after (default: 'after')
  templateJSContent?: string, // for templatejs-block, JavaScript content stored with the form (not rendered in preview)
  // event-chooser options
  eventDate?: Date, // for event-chooser, date to get events for (defaults to today)
  dependsOnDateKey?: string, // DEPRECATED: use sourceDateKey instead. For event-chooser, key of a date field (calendarpicker or text input) to get the date from dynamically (value dependency)
  sourceDateKey?: string, // Value dependency: for event-chooser, key of a date field (calendarpicker or text input) to get the date from dynamically
  // markdown-preview options
  markdownText?: string, // for markdown-preview, static markdown text to display (if not using note)
  markdownNoteFilename?: string, // for markdown-preview, filename of note to display (alternative to markdownText)
  markdownNoteTitle?: string, // for markdown-preview, title of note to display (alternative to markdownText and markdownNoteFilename)
  selectedCalendars?: Array<string>, // for event-chooser, array of calendar titles to filter events by (ignored if allCalendars=true)
  allCalendars?: boolean, // for event-chooser, if true, include events from all calendars NotePlan can access (bypasses selectedCalendars)
  calendarFilterRegex?: string, // for event-chooser, optional regex pattern to filter calendars after fetching (applied when allCalendars=true)
  eventFilterRegex?: string, // for event-chooser, optional regex pattern to filter events by title after fetching
  includeReminders?: boolean, // for event-chooser, if true, include reminders in the list
  reminderLists?: Array<string>, // for event-chooser, optional array of reminder list titles to filter reminders by
  // multi-select options
  multiSelectItems?: Array<any>, // for multi-select, items for selection
  multiSelectGetLabel?: (item: any) => string, // for multi-select, function to get label
  multiSelectGetValue?: (item: any) => string, // for multi-select, function to get value
  multiSelectGetTitle?: (item: any) => string, // for multi-select, function to get title
  multiSelectFilterFn?: (item: any, searchTerm: string) => boolean, // for multi-select, filter function
  multiSelectEmptyMessage?: string, // for multi-select, empty message
  multiSelectMaxHeight?: string, // for multi-select, max height
}

export type TDynamicDialogProps = {
  // optional props
  items?: Array<TSettingItem>, // generally required, but can be empty (e.g. for PerspectivesTable)
  onSave?: (updatedSettings: { [key: string]: any }, windowId?: string) => void, // Updated to accept optional windowId
  onCancel?: () => void,
  handleButtonClick?: (key: string, value: any) => void | boolean, // Add handleButtonClick prop (return false to prevent closing)
  className?: string,
  labelPosition?: 'left' | 'right',
  allowEmptySubmit?: boolean,
  submitButtonText?: string, // Add submitButtonText property
  isOpen?: boolean,
  title?: string,
  style?: Object, // Add style prop
  isModal?: boolean, // default is true, but can be overridden to run full screen
  hideDependentItems?: boolean,
  submitOnEnter?: boolean,
  children?: React$Node, // children nodes (primarily for banner message)
  hideHeaderButtons?: boolean, // hide the header buttons (cancel and submit) if you want to add your own buttons
  externalChangesMade?: boolean, // New prop to accept external changesMade state
  setChangesMade?: (changesMade: boolean) => void, // New prop to allow external components to update changesMade
  folders?: Array<string>, // For folder-chooser field types
  notes?: Array<NoteOption>, // For note-chooser field types
  requestFromPlugin?: (command: string, dataToSend?: any, timeout?: number) => Promise<any>, // Optional function to call plugin commands (for native folder chooser)
  onFoldersChanged?: () => void, // Callback to reload folders after creating a new folder
  onNotesChanged?: () => void, // Callback to reload notes after creating a new note
  windowId?: string, // Optional window ID to pass when submitting (for backward compatibility, will use fallback if not provided)
  keepOpenOnSubmit?: boolean, // If true, don't close the window after submit (e.g., for Form Browser context)
}

//--------------------------------------------------------------------------
// SettingsDialog Component Definition
//--------------------------------------------------------------------------

const DynamicDialog = ({
  windowId,
  children,
  title,
  items: passedItems,
  className = '',
  labelPosition = 'right',
  allowEmptySubmit = false,
  submitButtonText = 'Submit',
  isOpen = true,
  style = {}, // Destructure style prop
  isModal = true, // by default, it is a modal dialog, but can run full screen
  onSave, // caller needs to process the updated settings
  onCancel,
  handleButtonClick = (key, value) => {}, // Destructure handleButtonClick prop
  hideDependentItems = false,
  submitOnEnter = true,
  hideHeaderButtons = false,
  externalChangesMade,
  setChangesMade: externalSetChangesMade,
  folders = [],
  notes = [],
  requestFromPlugin,
  onFoldersChanged,
  onNotesChanged,
  keepOpenOnSubmit = false, // Default to false (close on submit for backward compatibility)
}: TDynamicDialogProps): React$Node => {
  if (!isOpen) return null
  const items = passedItems || []

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
    // Support both old (dependsOnKey) and new (requiresKey) property names for backward compatibility
    const dependsOn = item.requiresKey ?? item.dependsOnKey ?? ''
    if (dependsOn) {
      const isThatKeyChecked = updatedSettings[dependsOn]
      if (!updatedSettings.hasOwnProperty(dependsOn)) {
        logError('', `Cannot find key '${dependsOn}' that key ${item.key ?? ''} is controlled by`)
        return false
      }
      return isThatKeyChecked
    } else {
      // shouldn't get here
      logWarn('SettingsDialog/stateOfControllingSetting', `Key ${item.key ?? ''} does not have .requiresKey or .dependsOnKey setting`)
      return false
    }
  }

  function shouldRenderItem(item: TSettingItem): boolean {
    if (!item) return false
    // Support both old (dependsOnKey) and new (requiresKey) property names for backward compatibility
    const requiresKey = item.requiresKey ?? item.dependsOnKey
    if (!requiresKey) return true
    const yesRender = !requiresKey || !hideDependentItems || (requiresKey && stateOfControllingSetting(item))
    return yesRender
  }

  //----------------------------------------------------------------------
  // Context
  //----------------------------------------------------------------------

  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------
  const dialogRef = useRef<?ElementRef<'dialog'>>(null)
  const dropdownRef = useRef<?HTMLInputElement>(null)
  const [changesMade, setChangesMadeInternal] = useState(false)
  const [updatedSettings, setUpdatedSettings] = useState(getInitialItemStateObject(items))
  const updatedSettingsRef = useRef(updatedSettings)

  useEffect(() => {
    updatedSettingsRef.current = updatedSettings
  }, [updatedSettings])

  if (!updatedSettings) return null // Prevent rendering before items are loaded

  // Use internal changesMade state only if externalChangesMade is not provided
  const changesMadeToUse = allowEmptySubmit || (typeof externalChangesMade === 'boolean' ? externalChangesMade : changesMade)
  const setChangesMade = externalSetChangesMade || setChangesMadeInternal

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------

  const handleEscapeKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onCancel && onCancel()
    }
  }

  // Field types that should consume Enter key (prevent form submission)
  // These are fields where Enter has a specific meaning (e.g., selecting an option, creating new lines)
  const ENTER_CONSUMING_FIELD_TYPES: Array<string> = ['folder-chooser', 'note-chooser', 'space-chooser', 'dropdown-select', 'combo', 'textarea']

  const handleEnterKey = (event: KeyboardEvent) => {
    // CMD+ENTER (or CTRL+ENTER on Windows/Linux) should always submit, bypassing ENTER_CONSUMING_FIELD_TYPES
    const isCmdEnter = (event.metaKey || event.ctrlKey) && event.key === 'Enter'

    if (event.key === 'Enter' && submitOnEnter) {
      // If CMD+ENTER, always submit regardless of field type
      if (isCmdEnter) {
        event.preventDefault()
        event.stopPropagation() // Prevent event from bubbling up
        event.stopImmediatePropagation() // Prevent other handlers from firing
        handleSave()
        return
      }

      // For regular Enter, check if the focused element is within a field that consumes Enter key
      const activeElement = document.activeElement
      if (activeElement instanceof HTMLElement) {
        // Look for the closest parent with data-field-type attribute
        const fieldContainer = activeElement.closest('[data-field-type]')
        if (fieldContainer instanceof HTMLElement) {
          const fieldType = fieldContainer.getAttribute('data-field-type')
          if (fieldType && ENTER_CONSUMING_FIELD_TYPES.includes(fieldType)) {
            // This field type consumes Enter, don't submit the form
            return
          }
        }
      }

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
      // Pass keepOpenOnSubmit flag in windowId as a special marker, or pass it separately
      // For now, we'll pass it as part of a special windowId format, or the caller can check the prop
      // Actually, the caller (onSave) can access keepOpenOnSubmit via closure, so we don't need to pass it
      onSave(updatedSettingsRef.current, windowId) // Pass windowId if available, otherwise use fallback pattern in plugin
    }
    logDebug('Dashboard', `DynamicDialog saved updates`, { updatedSettings: updatedSettingsRef.current, windowId, keepOpenOnSubmit })
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
    if (isOpen) {
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
  // ONLY attach an ESC listener if isModal = false
  // (When isModal = true, our custom Modal handles ESC.)
  //----------------------------------------------------------------------
  useEffect(() => {
    if (!isModal) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          // let's call onCancel to close
          logDebug('DynamicDialog', 'ESC pressed in non-modal scenario. onCancel called.')
          onCancel && onCancel()
        }
      }

      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [isModal, onCancel])

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------
  if (!updatedSettings) return null
  if (items?.length > 0 && items[items.length - 1].type === 'dropdown-select') {
    logDebug(
      'DynamicDialog',
      "NOTE: The last item in the DynamicDialog is a dropdown-select. Unless you have addressed this already in a specific CSS rule, it may cause problems with the dialog clipping the contents. You may want to move it up in the dialog or add a CSS rule to the dynamic-dialog-content class to set overflow: visible. (but then it won't scroll vertically--that's the trade-off)",
    )
  }

  const dialogStyle = {
    // minWidth: '50%', // defaults which can be overridden by the style prop
    ...style,
  }
  const dialogContents = (
    <dialog ref={dialogRef} open={isOpen} className={`dynamic-dialog ${className || ''}`} style={dialogStyle} onClick={(e) => e.stopPropagation()}>
      <div className={`dynamic-dialog-header ${hideHeaderButtons ? 'title-only' : 'title-with-buttons'}`}>
        {!hideHeaderButtons && (
          <button className="PCButton cancel-button" onClick={onCancel}>
            Cancel
          </button>
        )}
        <span className="dynamic-dialog-title">{title || ''}</span>
        {!hideHeaderButtons && changesMadeToUse ? (
          <button className="PCButton save-button" onClick={handleSave}>
            {submitButtonText}
          </button>
        ) : (
          !hideHeaderButtons && <button className="PCButton save-button-inactive">{submitButtonText}</button>
        )}
      </div>
      <div className="dynamic-dialog-content thin-scrollbar" style={dialogStyle?.content}>
        {children}
        {items.map((item, index) => {
          const renderItemProps: any = {
            index,
            item: {
              ...item,
              type: item.type,
              value: typeof item.key === 'undefined' ? '' : updatedSettings[item.key] ?? '',
              checked: typeof item.key === 'undefined' ? false : updatedSettings[item.key] === true,
            },
            disabled: (item.dependsOnKey || item.requiresKey) ? !stateOfControllingSetting(item) : false,
            indent: Boolean(item.dependsOnKey || item.requiresKey),
            handleFieldChange,
            handleButtonClick, // Pass handleButtonClick
            labelPosition,
            showSaveButton: false, // Do not show save button
            className: '', // for future use
            folders, // Pass folders for folder-chooser
            notes, // Pass notes for note-chooser
            requestFromPlugin, // Pass requestFromPlugin for native folder chooser
            updatedSettings, // Pass updatedSettings for heading-chooser to watch note-chooser field, and for form-state-viewer
            onFoldersChanged, // Pass onFoldersChanged to reload folders after creating a new folder
            onNotesChanged, // Pass onNotesChanged to reload notes after creating a new note
          }
          if (item.type === 'combo' || item.type === 'dropdown-select') {
            renderItemProps.inputRef = dropdownRef
          }
          return (
            <div key={`ddc-${index}`} data-compact-display={item.compactDisplay ? 'true' : 'false'}>
              {(!item.key || shouldRenderItem(item)) && renderItem(renderItemProps)}
              {/* Don't render description for heading type since renderItem already renders it */}
              {item.description && item.type !== 'heading' && <div className="item-description">{item.description}</div>}
            </div>
          )
        })}
      </div>
    </dialog>
  )
  // Debug logging (disabled for cleaner console output)
  // console.log(`DynamicDialog dialogcontents`, dialogContents)
  return isModal ? (
    <Modal
      onClose={() => {
        logDebug('DynamicDialog', 'Modal onClose called.')
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
