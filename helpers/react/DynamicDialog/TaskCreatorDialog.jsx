// @flow
/*
 * TODO:
 * - folder comes up all the time, but should only come up if this is a new note creation
 */

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
  const [selectedNote, setSelectedNote] = useState<OptionType | null>(dynamicData?.defaultNote || null)
  const [selectedFolder, setSelectedFolder] = useState<OptionType | null>(null)
  const [selectedHeading, setSelectedHeading] = useState<OptionType | null>(dynamicData?.defaultHeading || null)
  const [isLoading, setIsLoading] = useState(false)
  const [isNewNoteTitle, setIsNewNoteTitle] = useState(false)
  const [isHeadingSelectVisible, setIsHeadingSelectVisible] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)
  const [folderError, setFolderError] = useState<string | null>(null)
  const [headingError, setHeadingError] = useState<string | null>(null)
  const [localNotes, setNotes] = useState<Array<OptionType>>(dynamicData?.getNotesResults || [{ label: 'TEMP PLACEHOLDER', value: '_TEMP PLACEHOLDER_' }])
  const [localFolders, setFolders] = useState<Array<OptionType>>(dynamicData?.getFoldersResults || [{ label: 'TEMP FOLDER', value: '_TEMP FOLDER_' }])
  const [localHeadings, setLocalHeadings] = useState<Array<OptionType>>(dynamicData?.getHeadingsResults || [{ label: 'TEMP HEADING', value: 'TEMP HEADING' }])

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
      clo(dynamicData.getNotesResults.slice(0, 5), 'Notes data received (first 5):')
      setNotes(dynamicData.getNotesResults)
      setIsLoading(false)
    }
  }, [dynamicData])

  // Watch for headings data from the plugin
  useEffect(() => {
    if (dynamicData?.getHeadingsResults) {
      logDebug('TaskCreatorDialog', 'Headings received from plugin')
      clo(dynamicData.getHeadingsResults)
      setLocalHeadings(dynamicData.getHeadingsResults)
      setIsHeadingSelectVisible(true)
    }
  }, [dynamicData])

  // Watch for folders data from the plugin
  useEffect(() => {
    if (dynamicData?.getFoldersResults) {
      logDebug('TaskCreatorDialog', 'Folders received from plugin')
      clo(dynamicData.getFoldersResults)
      const formattedFolders = dynamicData.getFoldersResults.map((folder) => {
        // Ensure we're using the string value for label and value
        const folderValue = typeof folder === 'string' ? folder : folder.value || folder.label || ''
        return {
          tooltip: folderValue,
          label: folderValue,
          value: folderValue,
        }
      })
      setFolders(formattedFolders)
    }
  }, [dynamicData])

  // Handle note selection
  const handleNoteSelect = (option: OptionType | null) => {
    if (option && typeof option.label === 'string' && typeof option.value === 'string') {
      const selectedOption: OptionType = { label: option.label, value: option.value }
      setSelectedNote(selectedOption)
      setSelectedFolder(null) // Reset folder selection
      setSelectedHeading(null) // Reset heading selection

      if (selectedOption.value !== '_TEMP PLACEHOLDER_') {
        // Check if the selected note is a custom value (not in our predefined list)
        const isCustomNote = !localNotes.some((note) => note.value === selectedOption.value)
        setIsNewNoteTitle(isCustomNote)
        if (isCustomNote) {
          setFolders([]) // Clear folders list
          setLocalHeadings([]) // Clear headings list
          logDebug('TaskCreatorDialog', `Fetching folders for custom note: ${selectedOption.value}`)
          sendActionToPlugin('getFolders', {})
          setIsHeadingSelectVisible(false)
        } else {
          // For predefined notes, fetch headings directly
          setFolders([])
          setLocalHeadings([])
          setIsNewNoteTitle(false)
          setIsHeadingSelectVisible(true)
          logDebug('TaskCreatorDialog', `Fetching headings for predefined note: ${selectedOption.value}`)
          sendActionToPlugin('getHeadings', { filename: selectedOption.value })
        }
      } else {
        setFolders([])
        setLocalHeadings([{ label: 'TEMP HEADING', value: 'TEMP HEADING' }]) // Reset to placeholder
      }
    } else {
      setSelectedNote(null)
      setSelectedFolder(null)
      setSelectedHeading(null)
      setFolders([])
      setIsNewNoteTitle(false)
      setLocalHeadings([{ label: 'TEMP HEADING', value: 'TEMP HEADING' }])
      setIsHeadingSelectVisible(false)
    }
  }

  // Handle folder selection
  const handleFolderSelect = (option: OptionType | null) => {
    if (option && typeof option.label === 'string' && typeof option.value === 'string') {
      const selectedOption: OptionType = { label: option.label, value: option.value }
      setSelectedFolder(selectedOption)
      if (isNewNoteTitle) {
        setLocalHeadings([
          {
            label: '⏫ (top of note)',
            value: '⏫ (top of note)',
          },
        ])
        setIsHeadingSelectVisible(true)
      }
    } else {
      setSelectedFolder(null)
    }
  }

  // Handle heading selection
  const handleHeadingSelect = (option: OptionType | null) => {
    if (option && typeof option.label === 'string' && typeof option.value === 'string') {
      const selectedOption: OptionType = { label: option.label, value: option.value }
      setSelectedHeading(selectedOption)
    } else {
      setSelectedHeading(null)
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
      folder: selectedFolder?.value,
      isNewNote: selectedNote && !localNotes.some((note) => note.value === selectedNote.value),
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

  return (
    // $FlowFixMe[incompatible-type] - Flow doesn't recognize dialog element well
    <dialog ref={dialogRef} className={`task-creator-dialog-modal ${className}`} onClick={handleBackdropClick}>
      <div className="task-creator-dialog" style={style}>
        <div className="task-creator-dialog-header">
          <h2>Add New Task/Checklist</h2>
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
            options={localNotes}
            value={selectedNote || { label: '', value: '' }}
            onChange={handleNoteSelect}
            allowFiltering={true}
            allowCustomValues={true}
            showClearButton={true}
            defaultValue={dynamicData?.defaultNote}
            onValidationError={(error) => {
              // Show error message under the dropdown
              setNoteError(error)
            }}
            disabled={isLoading || localNotes.length === 0}
            compactDisplay={true}
            className="full-width-select"
            tabIndex={2}
          />

          {isNewNoteTitle && (
            <DropdownSelect
              label="Folder"
              options={localFolders}
              value={selectedFolder || { label: '', value: '' }}
              onChange={handleFolderSelect}
              allowFiltering={true}
              allowCustomValues={true}
              showClearButton={true}
              onValidationError={(error) => {
                setFolderError(error)
              }}
              disabled={!selectedNote || localFolders.length === 0}
              compactDisplay={true}
              className="full-width-select"
              tabIndex={3}
            />
          )}

          {isHeadingSelectVisible && (
            <DropdownSelect
              label="Under Heading"
              options={localHeadings}
              value={selectedHeading || { label: '', value: '' }}
              onChange={handleHeadingSelect}
              allowFiltering={true}
              allowCustomValues={true}
              showClearButton={true}
              defaultValue={dynamicData?.defaultHeading}
              onValidationError={(error) => {
                setHeadingError(error)
              }}
              disabled={!selectedNote || localHeadings.length === 0}
              compactDisplay={true}
              className="full-width-select"
              tabIndex={4}
            />
          )}
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
