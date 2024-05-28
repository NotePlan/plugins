// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the settings dialog
// Changes are saved when "Save & Close" is clicked, but not before
// Called by Header component.
// Last updated 2024-05-26 for v2.0.0 by @dwertheimer
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useEffect, useRef, useState, type ElementRef } from 'react'
import type { TDropdownItem } from '../../types'
import { renderItem } from '../support/uiElementRenderHelpers'
import '../css/SettingsDialog.css' // Import the CSS file
import { useAppContext } from './AppContext.jsx'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------
type Settings = { [key: string]: string | boolean };

type SettingsDialogProps = {
    items: Array<TDropdownItem>,
    onSaveChanges?: (updatedSettings: { [key: string]: any }) => void,
    className?: string,
    labelPosition?: 'left' | 'right',
    isOpen: boolean,
    toggleDialog: () => void,
    style?: Object, // Add style prop
};

//--------------------------------------------------------------------------
// SettingsDialog Component Definition
//--------------------------------------------------------------------------

const SettingsDialog = ({
    items,
    onSaveChanges = () => { }, // optional in case Header wants to do something else
    className,
    labelPosition = 'right',
    isOpen,
    toggleDialog,
    style, // Destructure style prop
}: SettingsDialogProps): React$Node => {
    //----------------------------------------------------------------------
    // Context
    //----------------------------------------------------------------------
    const { sendActionToPlugin } = useAppContext()

    //----------------------------------------------------------------------
    // State
    //----------------------------------------------------------------------
    const dialogRef = useRef <? ElementRef < 'dialog' >> (null)
  const [changesMade, setChangesMade] = useState(false)
    const [updatedSettings, setUpdatedSettings] = useState(() => {
        const initialSettings: Settings = {}
        items.forEach(item => {
            initialSettings[item.key] = item.value || item.checked || ''
        })
        return initialSettings
    })

    if (!updatedSettings) return null // Prevent rendering before items are loaded

    //----------------------------------------------------------------------
    // Handlers
    //----------------------------------------------------------------------

    const handleEscapeKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            toggleDialog()
        }
    }

    const handleFieldChange = (key: string, value: any) => {
        setChangesMade(true)
        setUpdatedSettings(prevSettings => ({ ...prevSettings, [key]: value }))
    }

    const handleSave = () => {
        if (onSaveChanges) {
            onSaveChanges(updatedSettings)
        }
        sendActionToPlugin('sharedSettingsChanged', { actionType: 'sharedSettingsChanged', settings: updatedSettings }, 'Dashboard Settings Panel updates', true)
        toggleDialog()
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

    //----------------------------------------------------------------------
    // Render
    //----------------------------------------------------------------------
    return (
        <dialog
            ref={dialogRef}
            className={`settings-dialog ${className || ''}`}
            style={style}
            onClick={e => e.stopPropagation()}
        >
            <div className="settings-dialog-buttons">
                <button className="PCButton cancel-button" onClick={toggleDialog}>
                    Cancel
                </button>
                <span className="settings-dialog-header">Dashboard Settings</span>
                {changesMade && (
                    <button className="PCButton save-button" onClick={handleSave}>
                        Save & Close
                    </button>
                )}
            </div>
            <div className="settings-dialog-content">
                {items.map(item => (
                    <div key={item.key}>
                        {renderItem({
                            item: {
                                ...item,
                                value:
                                    typeof updatedSettings[item.key] === 'boolean'
                                        ? ''
                                        : updatedSettings[item.key],
                                checked:
                                    typeof updatedSettings[item.key] === 'boolean'
                                        ? updatedSettings[item.key]
                                        : false,
                            },
                            handleFieldChange,
                            labelPosition,
                            showSaveButton: false, // Do not show save button
                        })}
                        {item.description && (
                            <div className="item-description">{item.description}</div>
                        )}
                    </div>
                ))}
            </div>
        </dialog>
    )
}

export default SettingsDialog
