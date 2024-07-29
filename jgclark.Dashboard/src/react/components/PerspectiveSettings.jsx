// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Perspectives settings
// Called by DashboardSettings component.
// Last updated 2024-07-26 for v2.1.0.a2 by @jgclark
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useEffect, useRef, useState, type ElementRef } from 'react'
// import type { perspectiveSettingDefaults, perspectiveSettingDefinitions } from '../../dashboardSettings.js'
import type { TPerspectiveDef } from '../../types'
import ComboBox from '../components/ComboBox.jsx'
import PerspectiveDefinitionSettings from '../components/PerspectiveDefinitionSettings.jsx'
import TextComponent from '../components/TextComponent.jsx'
import { useAppContext } from './AppContext.jsx'
import { clo, logDebug, logError } from '@helpers/react/reactDev.js'
import '../css/PerspectiveSettings.css'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------
type Settings = { [key: string]: string | boolean };

type PerspectiveSettingsProps = {
  values: any
};

//--------------------------------------------------------------------------
// PerspectiveSettings Component Definition
//--------------------------------------------------------------------------

const PerspectiveSettings = ({
  values
}: PerspectiveSettingsProps): React$Node => {
  try {
    const { dashboardSettings, setDashboardSettings } = useAppContext()
    // only continue if we have this Feature Flag turned on
    if (!dashboardSettings.FFlag_Perspectives) return

    // clo(value, 'PerspectiveSettings starting with value:')

    //----------------------------------------------------------------------
    // Context
    //----------------------------------------------------------------------

    const perspectiveDefs: Array<TPerspectiveDef> = values || []
    clo(perspectiveDefs, 'perspectiveDefs')
    const activePerspectiveName = dashboardSettings.activePerspectiveName || ''
    logDebug('PerspectiveSettings', `perspectiveDef names: ${perspectiveDefs.map((pd) => pd.name).sort().join(' / ')}`)
    logDebug('PerspectiveSettings', `activePerspectiveName: '${activePerspectiveName}'`)

    //----------------------------------------------------------------------
    // State
    //----------------------------------------------------------------------
    // const dialogRef = useRef <? ElementRef < 'dialog' >> (null)
    // const dropdownRef = useRef <? { current: null | HTMLInputElement } > (null)
    // const [changesMade, setChangesMade] = useState(false)
    // const [inputValue, setInputValue] = useState(value)
    // const [updatedSettings, setUpdatedSettings] = useState(() => {
    //   const initialSettings: Settings = {}
    //   perspectiveDefs.forEach(def => {
    //     clo(def)
    //     // TODO:
    //     if (def.key) initialSettings[def.key] = def.value || def.checked || ''
    //   })
    //   return initialSettings
    // })

    // if (!updatedSettings) return null // Prevent rendering before items are loaded

    //----------------------------------------------------------------------
    // Handlers
    //----------------------------------------------------------------------

    // const handleEscapeKey = (event: KeyboardEvent) => {
    //   logDebug('PerspectiveSettings', `Event.key: ${event.key}`)
    //   if (event.key === 'Escape') {
    //     toggleDialog()
    //   }
    // }

    // const handleFieldChange = (key: string, value: any) => {
    //   logDebug('PerspectiveSettings', `handleFieldChange() fired`)
    //   setChangesMade(true)
    //   setUpdatedSettings(prevSettings => ({ ...prevSettings, [key]: value }))
    // }

    // const handleInputChange = (e: any) => {
    //   logDebug('PerspectiveSettings', `handleInputChange() fired`)
    //   // TODO: understand what needs to go here
    //   // setInputValue(e.target.value)
    //   // onChange(e)
    // }

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
          label={'Perspective Definitions'}
        />
        <TextComponent
          textType={'description'}
          label={"A 'Perspective' defines a set of item filters to be applied to all sections in the Dashboard view. **This is a just a limited proof of concept for now.**"}
        />
        {/* Note: now moved to main settings */}
        {/* <ComboBox
          compactDisplay={true}
          label={`Active Perspective Name`}
          value={activePerspectiveName}
          options={perspectiveDefs.map((pd) => pd.name).sort()}
          onChange={(newValue) => {
            logDebug('PerspectiveSettings', `activePerspectiveName '${newValue}' selected`)
            // TODO: more
          }}
        /> */}

        <div className="ui-perspective-container">
          {/* Then for each Perspective Definition ... */}
          {perspectiveDefs.map((pd, index) => (
            <PerspectiveDefinitionSettings
              key={index}
              defIndex={index}
              definitionValues={pd}
              activePerspective={pd.name === activePerspectiveName}
            />
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

export default PerspectiveSettings
