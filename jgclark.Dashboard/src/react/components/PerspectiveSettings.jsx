// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Perspectives settings
// Called by DashboardSettings component.
// Last updated 2024-07-23 for v2.1.0.a1 by @jgclark
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useEffect, useRef, useState, type ElementRef } from 'react'
// import type { TSettingItem, TPerspectiveDef } from '../../types'
import InputBox from '../components/InputBox.jsx'
import TextComponent from '../components/TextComponent.jsx'
import { useAppContext } from './AppContext.jsx'
import { clo, logDebug, logError } from '@helpers/react/reactDev.js'
import '../css/PerspectiveSettings.css'

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
    logDebug('PerspectiveSettings', `Starting`) // HELP: nothing shown

    //----------------------------------------------------------------------
    // Context
    //----------------------------------------------------------------------
    const { dashboardSettings, setDashboardSettings } = useAppContext()

    // only continue if we have this Feature Flag turned on HELP: has no effect
    if (!dashboardSettings.FFlag_Perspectives) return

    const perspectiveDefs = dashboardSettings?.perspectives || []
    clo(perspectiveDefs, 'perspectiveDefs') // HELP: nothing shown
    const activePerspectiveName = dashboardSettings.activePerspectiveName || ''
    logDebug('PerspectiveSettings', `active perspective: ${activePerspectiveName}`) // HELP: nothing shown

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
        {/* <div className="ui-heading">{heading}</div> */}
        <TextComponent
          textType={'header'}
          label={heading}
        />
        <TextComponent
          textType={'description'}
          label={"A 'Perspective' defines a set of item filters to be applied to all sections in the Dashboard view. This is a just a limited proof of concept for now."}
        />

        <div className="ui-perspective-container">
          {/* Then for each Perspective Definition ... */}
          {perspectiveDefs.map((persp, index) => (
            <div key={`persp${index}`}>
              {/* ... start with the name input box */}
              <InputBox
                inputType="text"
                label={`Perspective Name (${index + 1})`}
                // HELP: (@jgclark) There is no "key" field in perspectives as defined in dashboardSettings, there's a "name"
                // so persp.key is going to be undefined
                // also note that `updatedSettings[persp.key]` is not going to work because perspectives is an array of objects
                // and persp.name (or persp.key if you create one) is a string
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
              {/* For now just show Included Folders */}
              <div className="perspectiveSettingsBlock">
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
            </div>
          ))}
        </div>

        {/* Finally add a Separator */}
        <TextComponent
          textType={'separator'}
          label=''
        />
      </>
    )
  } catch (error) {
    logError('PerspectiveSettings', error.message)
  }
}

// HELP: there's a flow error here which I don't understand ("Duplicate export for default")
export default PerspectiveSettings
