// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the settings dialog
// Changes are saved when "Save & Close" is clicked, but not before
// Called by Header component.
// Last updated 2024-07-19 for v2.0.3 by @jgclark
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useEffect, useRef, useState, type ElementRef } from 'react'
import type { TSettingItem } from '../../types'
import { renderItem } from '../support/uiElementRenderHelpers'
import '../css/SettingsDialog.css' // Import the CSS file
import { useAppContext } from './AppContext.jsx'
import { logDebug } from '@helpers/react/reactDev.js'
import { clo } from '@helpers/dev.js'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------
type Settings = { [key: string]: string | boolean };

type SettingsDialogProps = {
    items: Array<TSettingItem>,
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

	// clo(items, 'items', 2)
	//----------------------------------------------------------------------
	// Context
	//----------------------------------------------------------------------
	const { dashboardSettings, setDashboardSettings } = useAppContext()

	//----------------------------------------------------------------------
	// State
	//----------------------------------------------------------------------
	const dialogRef = useRef <? ElementRef < 'dialog' >> (null)
  const dropdownRef = useRef <? { current: null | HTMLInputElement } > (null)
  const [changesMade, setChangesMade] = useState(false)
	const [updatedSettings, setUpdatedSettings] = useState(() => {
		const initialSettings: Settings = {}
		items.forEach(item => {
			if (item.key) initialSettings[item.key] = item.value || item.checked || ''
		})
		return initialSettings
	})

	if (!updatedSettings) return null // Prevent rendering before items are loaded

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
		setUpdatedSettings(prevSettings => ({ ...prevSettings, [key]: value }))
	}

	const handleSave = () => {
		if (onSaveChanges) {
			onSaveChanges(updatedSettings)
		}
		// $FlowFixMe[cannot-spread-indexer]
		setDashboardSettings({ ...dashboardSettings, ...updatedSettings, lastChange: 'Dashboard Settings Modal saved' })
		logDebug('Dashboard', `Dashboard Settings Panel updates`, updatedSettings)
		toggleDialog()
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
	return (
		<dialog
			ref={dialogRef}
			className={`settings-dialog ${className || ''}`}
			style={style}
			onClick={e => e.stopPropagation()}
		>
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
					<button className="PCButton save-button-inactive">
						Save & Close
					</button>
				)}
			</div>
			<div className="settings-dialog-content">
				{items.map((item, index) => (
					<div key={`sdc${index}`}>
						{renderItem({
							index,
							item: {
								...item,
								type: item.type,
								value: (typeof item.key === "undefined") ? '' :
									typeof updatedSettings[item.key] === 'boolean'
										? ''
										: updatedSettings[item.key],
								checked: (typeof item.key === "undefined") ? false :
									typeof updatedSettings[item.key] === 'boolean'
										? updatedSettings[item.key]
										: false,
							},
							handleFieldChange,
							labelPosition,
							showSaveButton: false, // Do not show save button
							inputRef: item.type === 'combo' ? dropdownRef : undefined, // Assign ref to the dropdown input
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
