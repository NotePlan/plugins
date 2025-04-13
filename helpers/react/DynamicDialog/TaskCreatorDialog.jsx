// @flow
import React, { useState, useEffect, useRef, useCallback } from 'react'
import InputBox from './InputBox'
import DropdownSelect from './DropdownSelect'
import { Button } from './ButtonComponents'
import Switch from './Switch'
import { logDebug, clo } from '@helpers/react/reactDev'
import './TaskCreatorDialog.css'

type OptionType = {
  label: string,
  value: string,
  [string]: any,
}

/**
 * @typedef {Object} TaskCreatorDialogProps
 * @property {string} title - The title of the dialog
 * @property {Function} onSubmit - Function called when the form is submitted
 * @property {Function} onCancel - Function called when the form is cancelled
 * @property {Function} sendActionToPlugin - Function to send actions to the plugin
 * @property {Object} dynamicData - pluginData.dynamicData
 * @property {string} [className] - Additional CSS class for styling
 * @property {Object} [style] - Custom styles for the dialog
 */
type TaskCreatorDialogProps = {
  title: string,
  onSubmit: (userInputObj: Object) => void,
  onCancel: () => void,
  sendActionToPlugin: (command: string, dataToSend: any) => void, // The main one to use to send actions to the plugin, saves scroll position
  dynamicData?: Object,
  className?: string,
  style?: Object,
}

/**
 * TaskCreatorDialog - A component that displays a modal dialog for creating tasks/checklists
 * @param {TaskCreatorDialogProps} props - Component properties
 * @returns {React$Node} The TaskCreatorDialog component
 */
const TaskCreatorDialog = ({ title, onSubmit, onCancel, sendActionToPlugin, dynamicData, className = '', style = {} }: TaskCreatorDialogProps): React$Node => {
  // Create a ref for the dialog
  const dialogRef = useRef<?HTMLDialogElement>(null)
  const taskInputRef = useRef<?HTMLInputElement>(null)

  // State for all form inputs
  const [taskText, setTaskText] = useState('')
  const [isChecklist, setIsChecklist] = useState(false)
  const [selectedNote, setSelectedNote] = useState<OptionType | null>(null)
  const [selectedHeading, setSelectedHeading] = useState<OptionType | null>(null)
  const [notes, setNotes] = useState<Array<OptionType>>([{ label: 'TEMP PLACEHOLDER', value: '_TEMP PLACEHOLDER_' }])
  const [defaultNote, setDefaultNote] = useState<OptionType | null>(null)
  const [headings, setHeadings] = useState<Array<OptionType>>([{ label: 'TEMP HEADING', value: 'TEMP HEADING' }])
  const [defaultHeading, setDefaultHeading] = useState<OptionType | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)
  const [headingError, setHeadingError] = useState<string | null>(null)

  // Open the modal dialog when component mounts
  useEffect(() => {
    const dialogElement = dialogRef.current
    if (dialogElement) {
      dialogElement.showModal()

      // Handle dialog close event (when user clicks escape)
      const handleClose = () => {
        onCancel()
      }

      dialogElement.addEventListener('close', handleClose)

      return () => {
        if (dialogElement) {
          dialogElement.removeEventListener('close', handleClose)
        }
      }
    }
  }, [onCancel])

  // Add Enter key listener to the entire dialog
  useEffect(() => {
    const handleDialogKeyDown = (e: KeyboardEvent) => {
      // If Enter is pressed and there's valid text, submit the form
      if (e.key === 'Enter' && !e.shiftKey && taskText.trim()) {
        // Don't handle Enter if we're in a select or textarea element
        const activeElementTag = document.activeElement?.tagName?.toLowerCase()
        if (activeElementTag === 'select' || activeElementTag === 'textarea') {
          return
        }

        // Don't submit when in a select dropdown
        if (document.activeElement?.closest('.dropdown-select-container-compact')) {
          return
        }

        e.preventDefault()
        handleSubmit()
      }
    }

    // Add event listener to the dialog element
    const dialogElement = dialogRef.current
    if (dialogElement) {
      dialogElement.addEventListener('keydown', handleDialogKeyDown)
    }

    return () => {
      if (dialogElement) {
        dialogElement.removeEventListener('keydown', handleDialogKeyDown)
      }
    }
  }, [taskText])

  // Handle click on the backdrop (outside the dialog content)
  const handleBackdropClick = (e: MouseEvent) => {
    // $FlowFixMe[incompatible-call] - Event target type casting needed for Flow
    if (e.target === dialogRef.current) {
      onCancel()
    }
  }

  // Fetch notes on component mount - only once
  useEffect(() => {
    logDebug('TaskCreatorDialog', 'Fetching notes')
    sendActionToPlugin('getNotes', { actionType: 'getNotes' })
    // Using empty dependency array to ensure this only runs once on mount
  }, []) // Removed sendActionToPlugin from dependencies

  // Watch for notes data from the plugin
  useEffect(() => {
    if (dynamicData?.getNotesResults) {
      logDebug('TaskCreatorDialog', 'Notes received from plugin')
      clo(dynamicData.getNotesResults, 'Notes data received:')
      setNotes(dynamicData.getNotesResults)
      setIsLoading(false)
    }
  }, [dynamicData])

  // Watch for headings data from the plugin
  useEffect(() => {
    if (dynamicData?.getHeadingsResults) {
      logDebug('TaskCreatorDialog', 'Headings received from plugin')
      clo(dynamicData.getHeadingsResults)
      setHeadings(dynamicData.getHeadingsResults)
    }
  }, [dynamicData])

  // Handle note selection
  const handleNoteSelect = (option: OptionType | null) => {
    setSelectedNote(option)
    setSelectedHeading(null) // Reset heading selection

    if (option && option.value !== '_TEMP PLACEHOLDER_') {
      setHeadings([]) // Clear headings list
      logDebug('TaskCreatorDialog', `Fetching headings for note: ${option.value}`)
      sendActionToPlugin('getHeadings', { actionType: 'getHeadings', filename: option.value })
    } else {
      setHeadings([{ label: 'TEMP HEADING', value: 'TEMP HEADING' }]) // Reset to placeholder
    }
  }

  // Handle form submission
  const handleSubmit = () => {
    if (!taskText.trim()) return // Don't submit if no task text

    const userInputObj = {
      content: taskText,
      type: isChecklist ? 'checklist' : 'open',
      filename: selectedNote?.value,
      heading: selectedHeading?.value,
    }

    logDebug('TaskCreatorDialog', 'Submitting form with data:', userInputObj)
    onSubmit(userInputObj)
  }

  // Handle key press event for the task text input
  const handleTaskInputKeyDown = (e: any) => {
    if (e.key === 'Enter' && !e.shiftKey && taskText.trim()) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Determine if heading should be visible
  const isHeadingVisible = selectedNote !== null

  return (
    // $FlowFixMe[incompatible-type] - Flow doesn't recognize dialog element well
    <dialog ref={dialogRef} className={`task-creator-dialog-modal ${className}`} onClick={handleBackdropClick}>
      <div className="task-creator-dialog" style={style}>
        <div className="task-creator-dialog-header">
          <h2>{title}</h2>
        </div>

        <div className="task-creator-dialog-content">
          <Switch
            id="task-type-switch"
            label={['Task', 'Checklist']}
            checked={isChecklist}
            onChange={(e) => setIsChecklist(e.target.checked)}
            labelPosition="both"
            description={isChecklist ? 'Create an open checkbox item' : 'Create a task'}
          />

          <InputBox
            label="Task Text"
            value={taskText}
            onChange={(e) => setTaskText(e.target.value)}
            onKeyDown={handleTaskInputKeyDown}
            compactDisplay={true}
            focus={true}
            required={true}
            showSaveButton={false}
            className="full-width-input"
            inputRef={taskInputRef}
            tabIndex={1}
          />

          <DropdownSelect
            label="Note"
            options={notes}
            value={selectedNote || { label: '', value: '' }}
            onChange={handleNoteSelect}
            allowFiltering={true}
            allowCustomValues={true}
            showClearButton={true}
            defaultValue={defaultNote}
            onValidationError={(error) => {
              // Show error message under the dropdown
              setNoteError(error)
            }}
            disabled={isLoading || notes.length === 0}
            compactDisplay={true}
            className="full-width-select"
            tabIndex={2}
          />

          <div className={`heading-select-container ${isHeadingVisible ? 'visible' : ''}`}>
            <DropdownSelect
              label="Heading"
              options={headings}
              value={selectedHeading || { label: '', value: '' }}
              onChange={(option: OptionType | null) => setSelectedHeading(option)}
              allowFiltering={true}
              allowCustomValues={true}
              showClearButton={true}
              defaultValue={defaultHeading}
              onValidationError={(error) => {
                // Show error message under the dropdown
                setHeadingError(error)
              }}
              disabled={!selectedNote || headings.length === 0}
              compactDisplay={true}
              className="full-width-select"
              tabIndex={3}
            />
          </div>
        </div>

        <div className="task-creator-dialog-footer">
          <Button label="Cancel" value="cancel" onClick={onCancel} className="task-creator-dialog-button PCButton" />
          <Button label="Create" value="submit" onClick={handleSubmit} className="task-creator-dialog-button PCButton default-button" disabled={!taskText.trim()} />
        </div>
      </div>
    </dialog>
  )
}

export default TaskCreatorDialog
