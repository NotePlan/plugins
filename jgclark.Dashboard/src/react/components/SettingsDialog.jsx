// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the settings dialog
// Changes are saved when "Save & Close" is clicked, but not before
// Called by Header component.
// Last updated 2024-08-26 for v2.1.0.a9 by @jgclark
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useEffect, useRef, useState, type ElementRef } from 'react'
import type { TSettingItem } from '../../types'
import { renderItem } from '../support/uiElementRenderHelpers'
import { adjustSettingsAndSave } from '../../perspectiveHelpers'
import { useAppContext } from './AppContext.jsx'
// import PerspectiveSettings from './PerspectiveSettings.jsx'
import '../css/SettingsDialog.css' // Import the CSS file
import Modal from './Modal'
import { clo, logDebug, logWarn } from '@helpers/react/reactDev.js'

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

	//----------------------------------------------------------------------
	// Context
	//----------------------------------------------------------------------
	const { dashboardSettings, setDashboardSettings, setPerspectiveSettings } = useAppContext()

	// clo(items, 'items', 2)

	//----------------------------------------------------------------------
	// State
	//----------------------------------------------------------------------
	const dialogRef = useRef <? ElementRef < 'dialog' >> (null)
  const dropdownRef = useRef <? { current: null | HTMLInputElement } > (null)
  const [changesMade, setChangesMade] = useState(false)
	const [updatedSettings, setUpdatedSettings] = useState(() => {
		const initialSettings: Settings = {}
		logDebug('SettingsDialog/initial state', `Starting`)
		items.forEach(item => {
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

	if (!updatedSettings) return null // Prevent rendering before items are loaded
	logDebug('SettingsDialog/main', `Starting`)

	// Return whether the controlling setting item is checked or not
	function stateOfControllingSetting(item: TSettingItem): boolean {
		const dependsOn = item.dependsOnKey ?? ''
		if (dependsOn) {
			const thatKey = items.find(f => f.key === dependsOn)
			if (!thatKey) {
				logWarn('', `Cannot find key '${dependsOn}' that key ${item.key ?? ''} is controlled by`)
				return false
			}
			// FIXME: this gets called, but seems to to use the saved, not live state.
			const isThatKeyChecked = thatKey?.checked ?? false
			logDebug('SettingsDialog/stateOfControllingSetting', `dependsOn='${dependsOn} / isThatKeyChecked=${String(isThatKeyChecked)}'`)
			return isThatKeyChecked
		} else {
			// shouldn't get here
			logWarn('SettingsDialog/stateOfControllingSetting', `Key ${item.key ?? ''} does not have .dependsOnKey setting`)
			return false
		}
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
		setUpdatedSettings(prevSettings => ({ ...prevSettings, [key]: value }))

		// change whether to disable or not the other items listed in this controlsOtherKeys (if any)
		const thisItem = items.find((item) => item.key === key)
		logDebug('SettingsDialog/handleFieldChange', `setting '${String(thisItem?.key ?? '?')}' has changed`) // ✅
		logDebug('SettingsDialog/handleFieldChange', `- will impact controlled items [${String(thisItem?.controlsOtherKeys)}] ...`) // ✅
		if (thisItem && thisItem.controlsOtherKeys) {
			const controlledItems = items.filter((item) => thisItem.controlsOtherKeys?.includes(item.key))
			controlledItems.forEach(item => {
				logDebug('SettingsDialog/handleFieldChange', `- triggering change to disabled state for setting ${String(item.key)}`) // ✅
				// TODO: HELP: How to get each controlledItem re-rendered (which should pick up disabled state change)?
			})
		}
	}

	// Handle "Save & Close" action
	const handleSave = () => {
		if (onSaveChanges) {
			onSaveChanges(updatedSettings)
		}

		adjustSettingsAndSave(updatedSettings, dashboardSettings, setDashboardSettings, setPerspectiveSettings, `Dashboard Settings Panel updates`)

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
	logDebug('SettingsDialog/pre-Render', `before render of ${String(items.length)} settings.`)

	return (
		<Modal onClose={() => { toggleDialog() }} >
			<div
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
					{/* Include Perspectives after activePerspectiveName, if turned on */}
					{/* {dashboardSettings.showPerspectives && (
					<PerspectiveSettings handleFieldChange={handleFieldChange}
					/>
				)} */}

					{/* Iterate over all the settings */}
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
								disabled: (item.dependsOnKey) ? !stateOfControllingSetting(item) : false,
								handleFieldChange,
								labelPosition,
								showSaveButton: false, // Do not show save button
								inputRef: item.type === 'combo' ? dropdownRef : undefined, // Assign ref to the dropdown input
								indent: !!item.dependsOnKey,
								className: '', // for future use
							})}
						</div>
					))}
				</div>
			</div>
		</Modal>
	)
}

export default SettingsDialog
