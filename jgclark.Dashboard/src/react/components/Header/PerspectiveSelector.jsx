// @flow
//--------------------------------------------------------------------------
// Dashboard React component to select and manage perspectives
// Refactored to use useReducer to give more visibility into what's happening
// Prevents infinite render loops by avoiding returning null
// Last updated 2024-10-17
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useReducer, useEffect, useCallback } from 'react'
import { PERSPECTIVE_ACTIONS, DASHBOARD_ACTIONS } from '../../reducers/actionTypes'
import { setActivePerspective } from '../../../perspectiveHelpers'
import DropdownSelect from '../../../../../np.Shared/src/react/DynamicDialog/DropdownSelect'
// import ThemedSelect from '../../../../../np.Shared/src/react/DynamicDialog/ThemedSelect'

import {
  cleanDashboardSettings,
  getDisplayListOfPerspectiveNames,
  getPerspectiveNamed,
  getActivePerspectiveDef,
  getActivePerspectiveName,
  type TPerspectiveOptionObject
} from '../../../perspectiveHelpers.js'
import { useAppContext } from '../AppContext.jsx'
import { clo, logDebug, logWarn, logError } from '@helpers/react/reactDev.js'
import { compareObjects, dt } from '@helpers/dev.js'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------
type State = {
  perspectiveNameOptions: Array<TPerspectiveOptionObject>,
  activePerspectiveName: string,
}

type Action =
  | { type: 'SET_PERSPECTIVE_OPTIONS', payload: Array<TPerspectiveOptionObject> }
  | { type: 'SET_ACTIVE_PERSPECTIVE', payload: string }
  | { type: 'SAVE_PERSPECTIVE', payload: null }
  | { type: 'LOG_STATE', payload: string }


const staticOptions = [{ label: "Save Perspective As...", value: "Add New Perspective" }]

/**
 * Formats the name of a perspective or option by appending an asterisk if it is modified.
 *
 * @param {Object} item - The perspective or option object.
 * @param {string} item.name - The name of the perspective or option.
 * @param {boolean} item.isModified - Indicates if the perspective or option is modified.
 * @returns {string} The formatted name.
 */
const formatNameWithModification = (item: { name: string, isModified: boolean, [string]: mixed }): string => {
  return item.isModified ? `${item.name}*` : item.name
}

//--------------------------------------------------------------------------
// PerspectiveSelector Component Definition
//--------------------------------------------------------------------------
const PerspectiveSelector = (): React$Node => {
  //----------------------------------------------------------------------
  // Context
  //----------------------------------------------------------------------
  const { dashboardSettings, perspectiveSettings, dispatchDashboardSettings, dispatchPerspectiveSettings, sendActionToPlugin } = useAppContext()

  //--------------------------------------------------------------------------
  // Reducer Function with Comprehensive Logging
  //--------------------------------------------------------------------------
  const reducer = (state: State, action: Action): State => {
    switch (action.type) {
      case 'SET_PERSPECTIVE_OPTIONS': {
        logDebug('PerspectiveSelector Reducer', `Action: SET_PERSPECTIVE_OPTIONS, Payload: ${JSON.stringify(action.payload)}${!action.payload ? ' (empty)' : ''}`)
        // Determine if "Save Perspective" should be included
        const thisPersp = getActivePerspectiveDef(perspectiveSettings)
        const dynamicOptions = thisPersp?.isModified
          ? [{ label: "Save Perspective", value: "Save Perspective" }]
          : []
        return {
          ...state,
          perspectiveNameOptions: [...staticOptions, ...dynamicOptions, ...action.payload],
        }
      }
      case 'SET_ACTIVE_PERSPECTIVE':
        logDebug('PerspectiveSelector Reducer', `Action: SET_ACTIVE_PERSPECTIVE, Payload: ${action.payload}`)
        return {
          ...state,
          activePerspectiveName: action.payload,
        }

      case 'LOG_STATE':
        logDebug('PerspectiveSelector Reducer', `Action: LOG_STATE, Message: ${action.payload}`)
        return state

      default:
        logWarn('PerspectiveSelector Reducer', `Unhandled action type: ${action.type}`)
        return state
    }
  }

  //----------------------------------------------------------------------
  // Reducer Initialization
  //----------------------------------------------------------------------
  const initialState: State = {
    perspectiveNameOptions: [],
    activePerspectiveName: getActivePerspectiveName(perspectiveSettings) || '-',
  }

  const [state, dispatchPerspectiveSelector] = useReducer(reducer, initialState)
  const { perspectiveNameOptions, activePerspectiveName } = state

  //----------------------------------------------------------------------
  // Effect to Update Perspective Options When perspectiveSettings Change
  //----------------------------------------------------------------------
  useEffect(() => {
    logDebug('PerspectiveSelector/useEffect(perspectiveSettings)', `Detected change in perspectiveSettings. dashboardSettings.lastChange="${dashboardSettings.lastChange}"`)
    clo(perspectiveSettings, `PerspectiveSelector/useEffect(perspectiveSettings) HHH perspectiveSettings onj`)

    if (!perspectiveSettings) {
      logWarn('PerspectiveSelector/useEffect(perspectiveSettings)', 'perspectiveSettings is falsy. Exiting effect.')
      dispatchPerspectiveSelector({ type: 'LOG_STATE', payload: 'perspectiveSettings is falsy' })
      return
    }

    // Get list of perspective names
    const options: Array<TPerspectiveOptionObject> = getDisplayListOfPerspectiveNames(perspectiveSettings, true)
    logDebug('PerspectiveSelector/useEffect(perspectiveSettings)', `Retrieved perspective options ${getActivePerspectiveDef(perspectiveSettings)?.dashboardSettings?.excludedFolders||'no active perspective'}`)

    if (!options || options.length === 0) {
      logWarn('PerspectiveSelector/useEffect(perspectiveSettings)', 'Options derived from perspectiveSettings are empty or falsy.')
      dispatchPerspectiveSelector({ type: 'LOG_STATE', payload: 'Options derived from perspectiveSettings are empty or falsy.' })
      dispatchPerspectiveSelector({ type: 'SET_PERSPECTIVE_OPTIONS', payload: [] })
      return
    }

    const diff = compareObjects(perspectiveNameOptions, [...staticOptions, ...options])

    if (diff) {
      logDebug('PerspectiveSelector/useEffect(perspectiveSettings)', `perspectiveNameOptions changed. Updating dropdown options. diff=${JSON.stringify(diff)}`)
      dispatchPerspectiveSelector({ type: 'SET_PERSPECTIVE_OPTIONS', payload: options })
      const thisPersp = getActivePerspectiveDef(perspectiveSettings)
      logDebug(`PerspectiveSelector/useEffect(perspectiveSettings) HHH thisPersp=${JSON.stringify(thisPersp)}`)
      dispatchPerspectiveSelector({ type: 'SET_ACTIVE_PERSPECTIVE', payload: thisPersp?.name || '-' })
    } else {
      const thisPersp = getActivePerspectiveDef(perspectiveSettings)
      logDebug('PerspectiveSelector/useEffect(perspectiveSettings)', `perspectiveNameOptions unchanged. Not updating dropdown options.HHH thisPersp=${JSON.stringify(thisPersp)}`)
    }

  }, [perspectiveSettings])

  //----------------------------------------------------------------------
  // Effect to Update Active Perspective Name When It Changes Externally
  //----------------------------------------------------------------------

  // dbw commented out after moving .activePerspectiveName to perspectiveSettings.isActive -- DELETE SOON AFTER (2024-11-02)
  // useEffect(() => {
  //   if (activePerspectiveName !== getActivePerspectiveName(perspectiveSettings)) {
  //     logDebug('PerspectiveSelector/useEffect(perspectiveSettings)', `dashboardSettings.activePerspectiveName changed to: "${dashboardSettings.activePerspectiveName}"`)
  //     dispatchPerspectiveSelector({ type: 'SET_ACTIVE_PERSPECTIVE', payload: dashboardSettings.activePerspectiveName })
  //   }
  // }, [dashboardSettings.activePerspectiveName])

  //----------------------------------------------------------------------
  // Effect to Log State Changes (Optional, for Debugging)
  //----------------------------------------------------------------------
  useEffect(() => {
    logDebug(
      'PerspectiveSelector/useEffect(perspectiveSettings)',
      `FYI: State updated: activePerspectiveName="${activePerspectiveName}"}`
    )
  }, [perspectiveNameOptions, activePerspectiveName])

    // dbw commented out after moving .activePerspectiveName to perspectiveSettings.isActive -- DELETE SOON AFTER (2024-11-02)
    // TODO: May need to deal with the perspective change externally
  //----------------------------------------------------------------------
  // Effect to Update Active Perspective Name When It Changes Externally
  //----------------------------------------------------------------------
  // useEffect(() => {
  //   logDebug('PerspectiveSelector/useEffect(dashboardSettings.activePerspectiveName)', `activePerspectiveName="${activePerspectiveName}" dashboardSettings.activePerspectiveName="${dashboardSettings.activePerspectiveName}"`)
  //   const thisPersp = getPerspectiveNamed(dashboardSettings.activePerspectiveName, perspectiveSettings)
  //   if (!thisPersp) {
  //     logWarn('PerspectiveSelector/useEffect(dashboardSettings.activePerspectiveName)', `Cannot find perspective definition for "${dashboardSettings.activePerspectiveName}".`)
  //     return
  //   }
  //   const nameToDisplay = dashboardSettings.activePerspectiveName
  //   if (activePerspectiveName !== dashboardSettings.activePerspectiveName) {
  //     logDebug(
  //       'PerspectiveSelector/useEffect(perspectiveSettings)',
  //       `Updating activePerspectiveName from "${activePerspectiveName}" to "${nameToDisplay}".`
  //     )
  //       dispatchPerspectiveSelector({ type: 'SET_ACTIVE_PERSPECTIVE', payload: nameToDisplay })

  //   } else {
  //     if (thisPersp) {
  //       if (activePerspectiveName !== nameToDisplay) {
  //         dispatchPerspectiveSelector({ type: 'SET_ACTIVE_PERSPECTIVE', payload: nameToDisplay })
  //       }
  //     }
  //   }
  // }, [dashboardSettings.activePerspectiveName, activePerspectiveName])

  //----------------------------------------------------------------------
  // Handler for Perspective Change with Comprehensive Logging
  //----------------------------------------------------------------------
  const handlePerspectiveChange = useCallback((selectedOption: { label: string, value: string, [string]: mixed }) => {
      logDebug(
        'PerspectiveSelector/handlePerspectiveChange',
        `User selected newValue: "${selectedOption.value}". Current activePerspectiveName: "${activePerspectiveName}".`
      )

      if (activePerspectiveName === selectedOption.value) {
        logDebug(
          'PerspectiveSelector/handlePerspectiveChange',
          `newValue "${selectedOption.value}" is the same as activePerspectiveName. No action taken.`
        )
        return
      }

      if (selectedOption.value === "Add New Perspective") {
        logDebug(
          'PerspectiveSelector/handlePerspectiveChange',
          `newValue "${selectedOption.value}".`
        )
        sendActionToPlugin('addNewPerspective', { actionType: 'addNewPerspective', logMessage: 'Add New Perspective selected from dropdown' }, 'Add New Perspective selected from dropdown')
        return
      }

      if (selectedOption.value === "Save Perspective") {
        const perspName = state.activePerspectiveName
        const thisPersp = getPerspectiveNamed(perspName, perspectiveSettings)
        if (thisPersp && thisPersp.isModified && thisPersp.name !== '-') {
          logDebug('PerspectiveSelector/handlePerspectiveChange', `Saving perspective: ${thisPersp.name}`)
          // Save the currently modified settings into the proper perspective (but only the fields in the "clean" set)
          const settingsToSave = {...thisPersp, dashboardSettings: {...thisPersp.dashboardSettings, ...cleanDashboardSettings(dashboardSettings)}, isModified: false}
          const resetModified = perspectiveSettings.map(p=> p.name === perspName ? settingsToSave : ({ ...p, isModified: false }))
          sendActionToPlugin('perspectiveSettingsChanged', { actionType: 'perspectiveSettingsChanged', settings: resetModified, logMessage: `${thisPersp.name} saved!` }, `${thisPersp.name} saved!`)
          dispatchPerspectiveSettings(
            {
              type: PERSPECTIVE_ACTIONS.SET_PERSPECTIVE_SETTINGS,
              payload: resetModified,
              reason: `Save perspective selected while active perspective was: ${state.activePerspectiveName}`
            })
          logDebug('PerspectiveSelector/handlePerspectiveChange', `${thisPersp.name} saved!`)
        } else {
          logDebug('PerspectiveSelector/handlePerspectiveChange', `${thisPersp?.name||''} was not modified. Not saving.`)
        }
        return
      }

      // Reset all to non-modified
      const resetModified = perspectiveSettings.map(p => ({ ...p, isModified: false }))
      dispatchPerspectiveSelector({ type: 'SET_PERSPECTIVE_OPTIONS', payload: getDisplayListOfPerspectiveNames(resetModified, true),  })

      // Get the new perspective definition
      const newPerspectiveDef = getPerspectiveNamed(selectedOption.value, perspectiveSettings)
      if (!newPerspectiveDef || newPerspectiveDef.dashboardSettings === undefined) {
        logWarn(
          'PerspectiveSelector/handlePerspectiveChange',
          `Cannot find perspective definition for "${selectedOption.value}". Action aborted.`
        )
        dispatchPerspectiveSelector({ type: 'LOG_STATE', payload: `Cannot find perspective definition for "${selectedOption.value}".` })
        return
      }

      logDebug(
        'PerspectiveSelector/handlePerspectiveChange',
        `Selected Perspective "${selectedOption.value}" has excludedFolders: [${String(
          newPerspectiveDef.dashboardSettings.excludedFolders
        )}].`
      )

      // Clean and prepare new dashboard settings
      const perspectiveDashboardSettings = cleanDashboardSettings(newPerspectiveDef.dashboardSettings)
      logDebug(
        'PerspectiveSelector/handlePerspectiveChange',
        `Cleaned dashboard settings: ${JSON.stringify(perspectiveDashboardSettings)}.`
      )

      // Dispatch action to set active perspective
      dispatchPerspectiveSelector({ type: 'SET_ACTIVE_PERSPECTIVE', payload: selectedOption.value })

      // Update dashboard settings with the changed perspective

      const updatedSettings = {
        ...perspectiveDashboardSettings,
      }
      logDebug('PerspectiveSelector/handlePerspectiveChange', `calling UPDATE_DASHBOARD_SETTINGS with: ${JSON.stringify(updatedSettings)}`)

      dispatchDashboardSettings({
        type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS,
        payload: updatedSettings,
        reason: `perspective changed to ${selectedOption.value} ${dt()}; loaded ${Object.keys(updatedSettings).length} settings`,
      })

      dispatchPerspectiveSettings({
        type: PERSPECTIVE_ACTIONS.SET_ACTIVE_PERSPECTIVE,
        payload: selectedOption.value,
        reason: `perspective changed to ${selectedOption.value} ${dt()}; loaded ${Object.keys(updatedSettings).length} settings`,
      })

      // We can't use the perspectiveSettings here because our handle to it will be stale, so we need to update the settings before we send them  
      const updatedPerspSettings = setActivePerspective(selectedOption.value, perspectiveSettings)
      sendActionToPlugin('perspectiveSettingsChanged', { actionType: 'perspectiveSettingsChanged', settings: updatedPerspSettings, logMessage: `${thisPersp?.name||''} saved!` }, `${thisPersp.name} saved!`)

      logDebug(
        'PerspectiveSelector/handlePerspectiveChange',
        `Perspective changed to "${selectedOption.value}". Awaiting React to re-render components based on new settings for: "${updatedSettings.activePerspectiveName}"`
      )
    }, [perspectiveSettings,state,activePerspectiveName,dashboardSettings])

  //----------------------------------------------------------------------
  // Render Logic with Comprehensive Logging
  //----------------------------------------------------------------------

  if (!perspectiveNameOptions.length) {
    logDebug('PerspectiveSelector', 'perspectiveNameOptions is empty. Rendering disabled ComboBox.')
    return (
      <div>
        <label htmlFor="perspective-select">Persp</label>
        <select id="perspective-select" disabled>
          <option>No Perspectives Available</option>
        </select>
      </div>
    )
  }

  const customStyles = {
    container: {
      minWidth: '45px',
      width: '51px', // Half the default width of 400px
      height: '21px', // Three-quarters the default height of 60px
    },
  }

  const normalizedOptions: Array<TPerspectiveOptionObject> = perspectiveNameOptions ? perspectiveNameOptions.map((option) => (typeof option === 'string' ? { label: option, value: option } : option)) : []
  const thisPersp = getPerspectiveNamed(activePerspectiveName, perspectiveSettings)
  if (!thisPersp) {
    logDebug('PerspectiveSelector', `Cannot find perspective definition for: "${activePerspectiveName}". Was it just created externally?".`)
  }
  const nameToDisplay = thisPersp ? formatNameWithModification(thisPersp) : '-'
  const selectedValue = {label:nameToDisplay, value:activePerspectiveName || '-'}
  // logDebug('PerspectiveSelector', `selectedValue: ${JSON.stringify(selectedValue)} value(activePerspectiveName)=${activePerspectiveName}`)
  return (
    <DropdownSelect
      style={customStyles}
      options={normalizedOptions}
      // value={normalizedOptions.find(o=>o.value === activePerspectiveName)?.label||''} // show the star if it's modified
      value={selectedValue||{label:'-', value:'-'}} // show the star if it's modified
      onChange={handlePerspectiveChange}
      compactDisplay={true}
      label={'Persp'}
      noWrapOptions={false}
    />
  )
}

export default PerspectiveSelector
