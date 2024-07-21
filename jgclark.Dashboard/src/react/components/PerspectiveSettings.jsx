// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Perspectives settings
// Called by DashboardSettings component.
// Last updated 2024-07-21 for v2.1.0.a1 by @jgclark
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useEffect, useRef, useState, type ElementRef } from 'react'
// import type { TSettingItem, TPerspectiveDef } from '../../types'
import { renderItem } from '../support/uiElementRenderHelpers'
import InputBox from '../components/InputBox.jsx'
import { useAppContext } from './AppContext.jsx'
import { clo, logDebug, logError } from '@helpers/react/reactDev.js'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------
type Settings = { [key: string]: string | boolean };

type PerspectiveSettingsProps = {
  heading: string,
  label: string,
};

//--------------------------------------------------------------------------
// PerspectiveSettings Component Definition
//--------------------------------------------------------------------------

const PerspectiveSettings = ({
  heading,
  label,
}: PerspectiveSettingsProps): React$Node => {
  try {
    logDebug('PerspectiveSettings', `Starting`) // FIXME: nothing shown

    //----------------------------------------------------------------------
    // Context
    //----------------------------------------------------------------------
    const { dashboardSettings, setDashboardSettings } = useAppContext()

    // only continue if we have this Feature Flag turned on FIXME: has no effect
    if (!dashboardSettings.FFlag_Perspectives) return

    const perspectiveDefs = dashboardSettings.perspectiveDefs
    clo(perspectiveDefs, 'perspectiveDefs') // FIXME: nothing shown
    const activePerspectiveName = dashboardSettings.activePerspectiveName
    logDebug('PerspectiveSettings', `active perspective: ${activePerspectiveName}`) // FIXME: nothing shown

    //----------------------------------------------------------------------
    // State
    //----------------------------------------------------------------------
    // const dialogRef = useRef <? ElementRef < 'dialog' >> (null)
    // const dropdownRef = useRef <? { current: null | HTMLInputElement } > (null)
    const [changesMade, setChangesMade] = useState(false)
    // const [inputValue, setInputValue] = useState(value)
    const [updatedSettings, setUpdatedSettings] = useState(() => {
      const initialSettings: Settings = {}
      perspectiveDefs.forEach(item => {
        clo(item)
        // TODO:
        if (item.key) initialSettings[item.key] = item.value || item.checked || ''
      })
      return initialSettings
    })


    if (!updatedSettings) return null // Prevent rendering before items are loaded

    //----------------------------------------------------------------------
    // Handlers
    //----------------------------------------------------------------------

    // const handleEscapeKey = (event: KeyboardEvent) => {
    //   logDebug('PerspectiveSettings', `Event.key: ${event.key}`)
    //   if (event.key === 'Escape') {
    //     toggleDialog()
    //   }
    // }

    const handleFieldChange = (key: string, value: any) => {
      logDebug('PerspectiveSettings', `handleFieldChange() fired`)
      setChangesMade(true)
      setUpdatedSettings(prevSettings => ({ ...prevSettings, [key]: value }))
    }

    const handleInputChange = (e: any) => {
      logDebug('PerspectiveSettings', `handleInputChange() fired`)
      // TODO: understand what needs to go here
      // setInputValue(e.target.value)
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
    // TODO(later): show activePerspectiveName differently

    return (
      <>
        {/* Add Heading and Description at start of Perspective section */}
        {renderItem({
          type: "heading",
          label: heading
        })}
        {renderItem({
          type: "text",
          label: label
        })}

        <div className="ui-perspective-container">
          {/* Then for each Perspective Definition ... */}
          {perspectiveDefs.map((persp, index) => (
            <div key={`persp${index}`}>

              {/* For now just show Name and Included Folders */}
              <div>Perspective {`${index + 1}`}:</div>
              <InputBox
                inputType="text"
                label="Name"
                value={`${(typeof persp.key === "undefined") ? '' :
                  updatedSettings[persp.key]}`}
                onSave={(newValue) => {
                  //   persp.key && handleFieldChange(persp.key, newValue)
                  //   persp.key && handleSaveInput(persp.key, newValue)
                }}
                onChange={(e) => {
                  persp.key && handleFieldChange(persp.key, (e.currentTarget: HTMLInputElement).value)
              persp.key && handleInputChange(persp.key, e)
                }}
              />
              <InputBox
                inputType="text"
                label="Included folders"
                value={`${(typeof persp.key === "undefined") ? '' :
                  typeof updatedSettings[persp.key] === 'boolean'
                    ? ''
                    : updatedSettings[persp.key]}`}
                onSave={(newValue) => {
                  //   persp.key && handleFieldChange(persp.key, newValue)
                  //   persp.key && handleSaveInput(persp.key, newValue)
                }}
                onChange={(e) => {
                  persp.key && handleFieldChange(persp.key, (e.currentTarget: HTMLInputElement).value)
              persp.key && handleInputChange(persp.key, e)
                }}
              />
            </div>
          ))}

          {/* Finally add a Separator */}
          {renderItem({
            type: "separator",
            label: ""
          })}

        </div>
      </>
    )
  } catch (error) {
    logError('PerspectiveSettings', error.message)
  }
}

// FIXME: there's a flow error here which I don't understand ("Duplicate export for default")
export default PerspectiveSettings
