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
import React, { useReducer, useEffect } from 'react'
import ThemedSelect from '../../../../../np.Shared/src/react/DynamicDialog/ThemedSelect.jsx'
import {
  cleanDashboardSettings,
  getDisplayListOfPerspectiveNames,
  getPerspectiveNamed,
  type TPerspectiveOptionObject
} from '../../../perspectiveHelpers.js'
import { useAppContext } from '../AppContext.jsx'
import { clo, logDebug, logWarn, logError } from '@helpers/react/reactDev.js'
import { compareObjects } from '@helpers/dev.js'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------
type State = {
  perspectiveNameOptions: Array<string | TPerspectiveOptionObject>,
  activePerspectiveName: string,
  isLoading: boolean,
}

type Action =
  | { type: 'SET_PERSPECTIVE_OPTIONS', payload: Array<string | TPerspectiveOptionObject> }
  | { type: 'SET_ACTIVE_PERSPECTIVE', payload: string }
  | { type: 'SAVE_PERSPECTIVE', payload: null }
  | { type: 'SET_LOADING', payload: boolean }
  | { type: 'LOG_STATE', payload: string }


const staticOptions = ["Add New Perspective", "Save Perspective"]

//--------------------------------------------------------------------------
// PerspectiveSelector Component Definition
//--------------------------------------------------------------------------
const PerspectiveSelector = (): React$Node => {
  //----------------------------------------------------------------------
  // Context
  //----------------------------------------------------------------------
  const { dashboardSettings, dispatchDashboardSettings, setPerspectiveSettings } = useAppContext()
  const { perspectiveSettings } = useAppContext()

  //--------------------------------------------------------------------------
  // Reducer Function with Comprehensive Logging
  //--------------------------------------------------------------------------
  const reducer = (state: State, action: Action): State => {
    switch (action.type) {
      case 'SET_PERSPECTIVE_OPTIONS':
        logDebug('PerspectiveSelector Reducer', `Action: SET_PERSPECTIVE_OPTIONS, Payload: ${JSON.stringify(action.payload)}`)
        return {
          ...state,
          perspectiveNameOptions: [...staticOptions, ...action.payload],
          isLoading: false,
        }

      case 'SET_ACTIVE_PERSPECTIVE':
        logDebug('PerspectiveSelector Reducer', `Action: SET_ACTIVE_PERSPECTIVE, Payload: ${action.payload}`)
        return {
          ...state,
          activePerspectiveName: action.payload,
        }

      case 'SET_LOADING':
        logDebug('PerspectiveSelector Reducer', `Action: SET_LOADING, Payload: ${action.payload}`)
        return {
          ...state,
          isLoading: action.payload,
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
    activePerspectiveName: dashboardSettings.activePerspectiveName || '',
    isLoading: true,
  }

  const [state, dispatchPerspectiveSelector] = useReducer(reducer, initialState)
  const { perspectiveNameOptions, activePerspectiveName, isLoading } = state

  logDebug(
    'PerspectiveSelector',
    `Initial State: perspectiveNameOptions=, activePerspectiveName=${activePerspectiveName}, isLoading=${isLoading}`
  )

  //----------------------------------------------------------------------
  // Effect to Update Perspective Options When perspectiveSettings Change
  //----------------------------------------------------------------------
  useEffect(() => {
    logDebug('PerspectiveSelector/useEffect', `Detected change in perspectiveSettings. activePerspectiveName="${dashboardSettings.activePerspectiveName}" dashboardSettings.lastChange="${dashboardSettings.lastChange}"`)

    if (!perspectiveSettings) {
      logWarn('PerspectiveSelector/useEffect', 'perspectiveSettings is falsy. Exiting effect.')
      dispatchPerspectiveSelector({ type: 'LOG_STATE', payload: 'perspectiveSettings is falsy' })
      dispatchPerspectiveSelector({ type: 'SET_LOADING', payload: false })
      return
    }

    // Indicate loading state
    dispatchPerspectiveSelector({ type: 'SET_LOADING', payload: true })

    // Get list of perspective names
    const options: Array<string | TPerspectiveOptionObject> = getDisplayListOfPerspectiveNames(perspectiveSettings, true, true)
    logDebug('PerspectiveSelector/useEffect', `Retrieved perspective options: activePerspectiveName: ${dashboardSettings.activePerspectiveName}`)

    if (!options || options.length === 0) {
      logWarn('PerspectiveSelector/useEffect', 'Options derived from perspectiveSettings are empty or falsy.')
      dispatchPerspectiveSelector({ type: 'LOG_STATE', payload: 'Options derived from perspectiveSettings are empty or falsy.' })
      dispatchPerspectiveSelector({ type: 'SET_PERSPECTIVE_OPTIONS', payload: [] })
      dispatchPerspectiveSelector({ type: 'SET_LOADING', payload: false })
      return
    }

    const diff = compareObjects(perspectiveNameOptions, [...staticOptions, ...options])

    if (diff) {
      logDebug('PerspectiveSelector/useEffect', `perspectiveNameOptions changed. Updating options. diff=${JSON.stringify(diff)} isLoading=${String(isLoading)}`)
      clo(perspectiveNameOptions, `PerspectiveSelector/useEffect perspectiveNameOptions`)
      clo(options, `PerspectiveSelector/useEffect options`)
      dispatchPerspectiveSelector({ type: 'SET_PERSPECTIVE_OPTIONS', payload: options })
    }

    dispatchPerspectiveSelector({ type: 'SET_LOADING', payload: false })
  }, [perspectiveSettings])

  //----------------------------------------------------------------------
  // Effect to Update Active Perspective Name When It Changes Externally
  //----------------------------------------------------------------------

  useEffect(() => {
    if (activePerspectiveName !== dashboardSettings.activePerspectiveName) {
      logDebug('PerspectiveSelector/useEffect', `dashboardSettings.activePerspectiveName changed to: "${dashboardSettings.activePerspectiveName}"`)
      dispatchPerspectiveSelector({ type: 'SET_ACTIVE_PERSPECTIVE', payload: dashboardSettings.activePerspectiveName })
    }
  }, [dashboardSettings.activePerspectiveName])

  //----------------------------------------------------------------------
  // Effect to Log State Changes (Optional, for Debugging)
  //----------------------------------------------------------------------
  useEffect(() => {
    logDebug(
      'PerspectiveSelector/useEffect',
      `State updated: activePerspectiveName=${activePerspectiveName}}, isLoading=${isLoading}`
    )
  }, [perspectiveNameOptions, activePerspectiveName, isLoading])

  //----------------------------------------------------------------------
  // Effect to Update Active Perspective Name When It Changes Externally
  //----------------------------------------------------------------------
  useEffect(() => {
    logDebug('PerspectiveSelector/useEffect', `Detected change in dashboardSettings.activePerspectiveName: "${dashboardSettings.activePerspectiveName}"`)

    if (activePerspectiveName !== dashboardSettings.activePerspectiveName) {
      logDebug(
        'PerspectiveSelector/useEffect',
        `Updating activePerspectiveName from "${activePerspectiveName}" to "${dashboardSettings.activePerspectiveName}".`
      )
      dispatchPerspectiveSelector({ type: 'SET_ACTIVE_PERSPECTIVE', payload: dashboardSettings.activePerspectiveName })
    }
  }, [dashboardSettings.activePerspectiveName, activePerspectiveName])

  //----------------------------------------------------------------------
  // Handler for Perspective Change with Comprehensive Logging
  //----------------------------------------------------------------------
  const handlePerspectiveChange = //useCallback(
    (newValue: string) => {
      logDebug(
        'PerspectiveSelector/handlePerspectiveChange',
        `User selected newValue: "${newValue}". Current activePerspectiveName: "${activePerspectiveName}".`
      )

      if (activePerspectiveName === newValue) {
        logDebug(
          'PerspectiveSelector/handlePerspectiveChange',
          `newValue "${newValue}" is the same as activePerspectiveName. No action taken.`
        )
        return
      }

      if (newValue === "Add New Perspective") {
        logDebug(
          'PerspectiveSelector/handlePerspectiveChange',
          `newValue "${newValue}" NEEDS IMPLEMENTING.`
        )
        return
      }

      if (newValue === "Save Perspective") {
        const perspName = state.activePerspectiveName
        const thisPersp = getPerspectiveNamed(perspName, perspectiveSettings)
        if (thisPersp && thisPersp.isModified) {
          dispatchPerspectiveSelector({ type: 'SET_ACTIVE_PERSPECTIVE', payload: perspName })
          setPerspectiveSettings(perspectiveSettings.map(p => p.name === perspName ? { ...p, isModified: false } : p))
          dispatchDashboardSettings({ type: 'UPDATE_DASHBOARD_SETTING', payload: { key: "activePerspectiveName", value: perspName }, reason: `Perspective selector clicked save while active persp was: ${state.activePerspectiveName}` })
          logDebug('PerspectiveSelector/handlePerspectiveChange', `${thisPersp.name} saved!`)

        } else {
          logDebug('PerspectiveSelector/handlePerspectiveChange', `${thisPersp.name} was not modified. Not saving.`)
        }
        return
      }

      // Get the new perspective definition
      const newPerspectiveDef = getPerspectiveNamed(newValue, perspectiveSettings)
      if (!newPerspectiveDef || newPerspectiveDef.dashboardSettings === undefined) {
        logWarn(
          'PerspectiveSelector/handlePerspectiveChange',
          `Cannot find perspective definition for "${newValue}". Action aborted.`
        )
        dispatchPerspectiveSelector({ type: 'LOG_STATE', payload: `Cannot find perspective definition for "${newValue}".` })
        return
      }

      logDebug(
        'PerspectiveSelector/handlePerspectiveChange',
        `Selected Perspective "${newValue}" has excludedFolders: [${String(
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
      dispatchPerspectiveSelector({ type: 'SET_ACTIVE_PERSPECTIVE', payload: newValue })

      // Update dashboard settings atomically
      const updatedSettings = {
        ...perspectiveDashboardSettings,
        activePerspectiveName: newValue,
        lastChange: `perspective changed to ${newValue} ${new Date().toLocaleTimeString()}`,
      }
      dispatchDashboardSettings({
        type: 'UPDATE_DASHBOARD_SETTINGS',
        payload: updatedSettings,
        reason: `perspective changed to ${newValue} ${new Date().toLocaleTimeString()}; loading ${Object.keys(updatedSettings).length} settings`,
      })

      //FIXME: explicitly send dashsettings and persp settings to new receiver after change

      // Handle modified perspectives
      if (newPerspectiveDef.isModified) {
        logWarn(
          'PerspectiveSelector/handlePerspectiveChange',
          `Perspective "${newValue}" is modified. Consider prompting to save changes.`
        )
        // TODO: Implement prompt to save changes if necessary
      }

      logDebug(
        'PerspectiveSelector/handlePerspectiveChange',
        `Perspective changed to "${newValue}". Awaiting React to re-render components based on new settings.`
      )
    }
  // ,
  // [activePerspectiveName, perspectiveSettings, setDashboardSettings]
  // )

  //----------------------------------------------------------------------
  // Render Logic with Comprehensive Logging
  //----------------------------------------------------------------------
  if (isLoading) {
    logDebug('PerspectiveSelector', 'Component is loading perspective options.')
    return (
      <div>
        <label>Persp</label>
        <select disabled>
          <option>Loading...</option>
        </select>
      </div>
    )
  }

  if (!perspectiveNameOptions.length) {
    logWarn('PerspectiveSelector', 'perspectiveNameOptions is empty. Rendering disabled ComboBox.')
    return (
      <div>
        <label>Persp</label>
        <select disabled>
          <option>No Perspectives Available</option>
        </select>
      </div>
    )
  }

  logDebug(
    'PerspectiveSelector',
    `Rendering ComboBox with value="${activePerspectiveName}".`
  )

  const customStyles = {
    container: {
      width: '100px', // Half the default width of 400px
      height: '30px', // Three-quarters the default height of 60px
    },
  }

  return (
    <ThemedSelect
      style={customStyles}
      options={perspectiveNameOptions ? perspectiveNameOptions.map((option) => (typeof option === 'string' ? { label: option, value: option } : option)) : []} // Normalize options to ensure they are in { label, value } format
      value={activePerspectiveName}
      onChange={(selectedOption) => {
        const value = selectedOption ? selectedOption.value : null // Get the value from the selected option
        value && handlePerspectiveChange(value)
      }}
      compactDisplay={true}
      label={'Persp'}
      noWrapOptions={false}
    />
  )
}

export default PerspectiveSelector
