// @flow
//--------------------------------------------------------------------------
// Dashboard React component to select and manage perspectives
// Called by DashboardSettings component.
// Last updated 2024-08-12 for v2.1.0.a7 by @dbw
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useEffect, useState } from 'react'
import ComboBox from '../ComboBox.jsx'
import {
  getListOfPerspectiveNames,
  getPerspectiveNamed,
cleanSettings} from '../../../perspectiveHelpers.js'
import { useAppContext } from '../AppContext.jsx'
import { clo, logDebug, logWarn } from '@helpers/react/reactDev.js'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------


//--------------------------------------------------------------------------
// PerspectiveSelector Component Definition
//--------------------------------------------------------------------------
const PerspectiveSelector = (): React$Node => {
  //----------------------------------------------------------------------
  // Context
  //----------------------------------------------------------------------
  const { dashboardSettings, setDashboardSettings } = useAppContext()
  const { perspectiveSettings } = useAppContext()

  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------
  // We need to store the state of the ComboBox options and the active perspective name in local state so that we can
  // redraw the component if the options are changed outside of the component (e.g. in the settings dialog).
  // Set the initial state of the ComboBox options and the active perspective name to empty and we will update them in the
  // useEffect hook below.
  const [perspectiveNameOptions, setPerspectiveNameOptions] = useState<Array<string>>([])
  const [activePerspectiveName, setActivePerspectiveName] = useState<string>('')

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------
  // Watching any change in perspectiveSettings
  useEffect(() => {
    logDebug('PerspectiveSelector', `useEffect called because perspectiveSettings changed to ${perspectiveSettings.length} perspectives`)
    if (!perspectiveSettings) return
    // We set the initial options for the ComboBox to the list of perspective names from the dashboard settings here
    // We also watch for changes to perspectiveSettings (e.g. when a new perspective is added) so we can re-render 
    // the ComboBox with the updated list of perspective names.
    logDebug('PerspectiveSelector', `(${perspectiveSettings.length} perspectives) useEffect called because perspectiveSettings changed`, perspectiveSettings)
    const options = getListOfPerspectiveNames(perspectiveSettings, true)
    clo(options, 'PerspectiveSelector/useEffect(perspectiveSettings): new options')
    setPerspectiveNameOptions(options)
  }, [perspectiveSettings]) // dependencies: run any time this changes

  // sets the selection in the combobox to "-" if can't find an active perspective
  useEffect(() => {
    // This is needed because it sets the selection in the combobox to "-" if can't find an active perspective
    if (!perspectiveSettings) {
      logDebug('PerspectiveSelector', `(${perspectiveSettings.length} perspectives) useEffect called because perspectiveSettings is falsy`)
      return
    }
    logDebug('PerspectiveSelector', `(${perspectiveSettings.length} perspectives) useEffect called because activePerspectiveName changed`)
    const options = getListOfPerspectiveNames(perspectiveSettings, true)
  // So we should first make sure the activePerspectiveName exists in the list of options before setting the combo box current value.
    const perspectiveNameIfItExists = dashboardSettings.activePerspectiveName ? options.find((option) => option === dashboardSettings.activePerspectiveName) : '-'
    logDebug('PerspectiveSelector/useEffect(activePerspectiveName)', `useEffect: activePerspectiveName: ${dashboardSettings.activePerspectiveName}, perspectiveExists: ${perspectiveNameIfItExists ?? 'no'}`)
    if (activePerspectiveName !== perspectiveNameIfItExists) {
      logDebug('PerspectiveSelector/useEffect(activePerspectiveName)', `useEffect: setting activePerspectiveName to ${perspectiveNameIfItExists ?? '-'}`)
      setActivePerspectiveName(perspectiveNameIfItExists ?? '-')
    }
  }, [activePerspectiveName]) // dependencies: run any time this changes

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------

  /**
   * Handler for when the perspective name is changed in the ComboBox.
   * @param {string} newValue - The new perspective name selected.
   */
  const handlePerspectiveChange = (newValue: string) => {
    if (activePerspectiveName === newValue) {
      logDebug('PerspectiveSelector/handlePerspectiveChange', `called with newValue: ${newValue}; but that was no change, so returning`)
      return
    } else {
      logDebug('PerspectiveSelector/handlePerspectiveChange', `called with newValue: ${newValue}`)
      setActivePerspectiveName(newValue) // this only changes the local state of the ComboBox
    }

    if (newValue === "-") {
      //FIXME: @jgclark: what should happen in this case to the dashboardSettings (when a user thinks they're turning it "off")?
      setDashboardSettings((prev) => ({ ...prev, activePerspectiveName: newValue }))
      logDebug('PerspectiveSelector/handlePerspectiveChange', `newValue is '-' so returning`)
      return
    }

    // Get the new settings to apply
    const newPerspectiveDef = getPerspectiveNamed(newValue, perspectiveSettings)
    if (!newPerspectiveDef || newPerspectiveDef.dashboardSettings === undefined) {
      logDebug('PerspectiveSelector/handlePerspectiveChange', `⚠️ Cannot get newPerspectiveDef`)
      return
    }
    // clo(newPerspectiveDef, 'PerspectiveSelector/handlePerspectiveChange: newPerspectiveDef')
    logDebug('PerspectiveSelector/handlePerspectiveChange', `newPerspectiveDef("${newValue}") has excludedFolders: [${String(newPerspectiveDef.dashboardSettings.excludedFolders)}]`)
    // FIXME: ^^^^ isn't updated

    setActivePerspectiveName(newValue) // this only changes the local state of the ComboBox
    //FIXME: dbw this becomes recursive i think
    // sendActionToPlugin('perspectiveSettingsChanged', { actionType: 'perspectiveSettingsChanged', settings: perspectiveSettings, logMessage: `Perspectives array changed (${perspectiveSettings.length} items)` }, 'Dashboard perspectiveSettings updated', true)

    // TEST: override dashboardSettings with what is in the Perspective & set the new activePerspectiveName
    const perspectiveDashboardSettings = cleanSettings(newPerspectiveDef.dashboardSettings)
    setDashboardSettings((prev) => ({ ...prev, ...perspectiveDashboardSettings, activePerspectiveName: newValue, lastChange:`perspective changed to ${newValue}` }))

    // Cannot immediately rely on the updated dashboardSettings, because it happens asynchronously.
    // logDebug('PerspectiveSelector/handlePerspectiveChange', `- after updating dS, activePerspectiveName: ${String(dashboardSettings.activePerspectiveName)} / excludedFolders: [${String(dashboardSettings.excludedFolders)}]`)

    // TODO: set the isActive indicator on all perspectives -- if I actually keep this setting in play.
    // setPerspectiveSettings((prev) => ({ ...prev, ...etc. }))

    // beware race conditions, as we cannot await.
    logDebug('PerspectiveSelector/handlePerspectiveChange', `Hopefully the window will now magically React and refresh itself ...`)
  }

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------
  if (!perspectiveNameOptions.length) {
    logWarn('PerspectiveSelector', `perspectiveNameOptions is empty, so returning null.`)
    return null
  }

  return (
    <ComboBox
      label={'Persp'}
      value={activePerspectiveName}
      onChange={handlePerspectiveChange}
      options={perspectiveNameOptions}
      compactDisplay={true}
    />
  )
}

export default PerspectiveSelector
