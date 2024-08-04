// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the definition settings for 1 Perspective settings
// TODO: remove me, I think.
// Note: Was Called by PerspectiveSettings component.
// Last updated 2024-07-26 for v2.1.0.a2 by @jgclark
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useEffect, useRef, useState, type ElementRef } from 'react'
import type { TPerspectiveDef } from '../../types'
import { renderItem } from '../support/uiElementRenderHelpers'
// import InputBox from '../components/InputBox.jsx'
// import TextComponent from '../components/TextComponent.jsx'
import { useAppContext } from './AppContext.jsx'
import { clo, logDebug, logError } from '@helpers/react/reactDev.js'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------
type Settings = { [key: string]: string | boolean };

type PerspectiveDefinitionSettingsProps = {
  // key: number, // Note: can't receive key down in prop ...
  defIndex: number, // ... this is the different name for the same data
  definitionValues: TPerspectiveDef,
  activePerspective: boolean,
};

//--------------------------------------------------------------------------
// PerspectiveDefinitionSettings Component Definition
//--------------------------------------------------------------------------

const PerspectiveDefinitionSettings = ({
  defIndex, definitionValues, activePerspective
}: PerspectiveDefinitionSettingsProps): React$Node => {
  try {
    const { dashboardSettings, setDashboardSettings } = useAppContext()
    // only continue if we have this Feature Flag turned on
    if (!dashboardSettings.FFlag_Perspectives) return

    clo(definitionValues, `PerspectiveDefinitionSettings starting for defIndex ${defIndex}:`)

    //----------------------------------------------------------------------
    // Context
    //----------------------------------------------------------------------

    // const activePerspectiveName = dashboardSettings.activePerspectiveName || ''
    logDebug('PerspectiveDefinitionSettings', `active perspective? ${String(activePerspective)}`)

    //----------------------------------------------------------------------
    // State
    //----------------------------------------------------------------------
    // const dialogRef = useRef <? ElementRef < 'dialog' >> (null)
    // const dropdownRef = useRef <? { current: null | HTMLInputElement } > (null)
    const [changesMade, setChangesMade] = useState(false)
    const [inputValue, setInputValue] = useState(true)

    // HELP: I don't understand how updatedSettings and initialSettings work together in this block.
    const [updatedSettings, setUpdatedSettings] = useState(() => {
      const initialSettings: Settings = {}
      // For each item in the definition, set starting value
      perspectiveSettingDefinitions.forEach(item => {
        const thisKey = item.key ?? ''
        if (thisKey && thisKey in definitionValues) {
          initialSettings[thisKey] = definitionValues[thisKey]
          // logDebug('PerspectiveDefinitionSettings', `- key: '${thisKey}' -> '${String(initialSettings[thisKey])}'`)
        } else {
          logError('PerspectiveDefinitionSettings', `Found key '${thisKey}' not in definitionValues `)
        }
      })
      clo(initialSettings, 'initialSettings')
      return initialSettings
    })

    if (!updatedSettings) return null // Prevent rendering before items are loaded

    //----------------------------------------------------------------------
    // Handlers
    //----------------------------------------------------------------------

    // const handleEscapeKey = (event: KeyboardEvent) => {
    //   logDebug('PerspectiveDefinitionSettings', `Event.key: ${event.key}`)
    //   if (event.key === 'Escape') {
    //     toggleDialog()
    //   }
    // }

    const handleFieldChange = (key: string, value: any) => {
      logDebug('PerspectiveDefinitionSettings', `handleFieldChange() fired`)
      setChangesMade(true)
      setUpdatedSettings(prevSettings => ({ ...prevSettings, [key]: value }))
    }

    const handleInputChange = (value: any) => {
      logDebug('PerspectiveDefinitionSettings', `handleInputChange() fired`)
      // HELP: understand what needs to go here
      setInputValue(value)
      // onChange(e)
    }

    // const handleSaveClick = () => {
    //   logDebug('InputBox', `handleSaveClick: inputValue=${inputValue}`)
    //   if (onSave) {
    //     onSave(inputValue)
    //   }
    // }

    // const handleSave = () => {
    //   if (onSaveChanges) {
    //     onSaveChanges(updatedSettings)
    //   }
    //   // $FlowFixMe[cannot-spread-indexer]
    //   setDashboardSettings({ ...dashboardSettings, ...updatedSettings, lastChange: 'Dashboard Settings Modal saved' })
    //   logDebug('Dashboard', `Dashboard Settings Panel updates`, updatedSettings)
    //   toggleDialog()
    // }

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

    // useEffect(() => {
    //   if (isOpen && dialogRef.current instanceof HTMLDialogElement) {
    //     dialogRef.current.showModal()
    //     document.addEventListener('keydown', handleEscapeKey)
    //   } else if (dialogRef.current instanceof HTMLDialogElement) {
    //     dialogRef.current.close()
    //     document.removeEventListener('keydown', handleEscapeKey)
    //   }
    //   return () => {
    //     document.removeEventListener('keydown', handleEscapeKey)
    //   }
    // }, [isOpen])

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

    //----------------------------------------------------------------------
    // Render
    //----------------------------------------------------------------------

    return (
      <>
        {defIndex > 0 && (<hr className="ui-separator" />)}
        <div className={`perspectiveSettingsBlock ${activePerspective ? 'activePerspective' : ''}`}>
          {perspectiveSettingDefinitions.map((item, index) => (
            // shift all but first item in block a little to right
            <div key={`psd${index}`}>
              {
                renderItem({
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
                  handleInputChange: handleInputChange,
                  labelPosition: 'right', // just for switch?
                  showSaveButton: false, // Do not show save button
                  inputRef: undefined, // TODO:

                })}
              {/* Show descriptions on first definition only */}
              {item.description && defIndex === 0 && (
                <div className="item-description">{item.description}</div>
              )}
            </div>
          ))}
        </div>
      </>
    )
  } catch (error) {
    logError('PerspectiveDefinitionSettings', error.message)
  }
}

export default PerspectiveDefinitionSettings