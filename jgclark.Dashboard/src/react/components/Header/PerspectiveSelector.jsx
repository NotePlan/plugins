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
import ComboBox from '../ComboBox.jsx'
import {
  cleanDashboardSettings,
  endsWithStar,
  getDisplayListOfPerspectiveNames,
  getPerspectiveNamed,
} from '../../../perspectiveHelpers.js'
import { useAppContext } from '../AppContext.jsx'
import { clo, logDebug, logWarn, logError } from '@helpers/react/reactDev.js'

//--------------------------------------------------------------------------
 // Type Definitions
//--------------------------------------------------------------------------
type State = {
  perspectiveNameOptions: Array<string>,
  activePerspectiveName: string,
  isValid: boolean,
  isLoading: boolean,
}

type Action =
  | { type: 'SET_PERSPECTIVE_OPTIONS', payload: Array<string> }
  | { type: 'SET_ACTIVE_PERSPECTIVE', payload: string }
  | { type: 'VALIDATE_ACTIVE_PERSPECTIVE' }
  | { type: 'SET_LOADING', payload: boolean }
  | { type: 'LOG_STATE', payload: string }

//--------------------------------------------------------------------------
 // Reducer Function with Comprehensive Logging
//--------------------------------------------------------------------------
const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_PERSPECTIVE_OPTIONS':
      logDebug('PerspectiveSelector Reducer', `Action: SET_PERSPECTIVE_OPTIONS, Payload: ${JSON.stringify(action.payload)}`)
      return {
        ...state,
        perspectiveNameOptions: action.payload,
        isLoading: false,
      }

    case 'SET_ACTIVE_PERSPECTIVE':
      logDebug('PerspectiveSelector Reducer', `Action: SET_ACTIVE_PERSPECTIVE, Payload: ${action.payload}`)
      return {
        ...state,
        activePerspectiveName: action.payload,
      }

    case 'VALIDATE_ACTIVE_PERSPECTIVE': {
      const isValid = state.perspectiveNameOptions.includes(state.activePerspectiveName)
      logDebug('PerspectiveSelector Reducer', `Action: VALIDATE_ACTIVE_PERSPECTIVE, isValid: ${String(isValid)}`)
      return {
        ...state,
        isValid,
        activePerspectiveName: isValid ? state.activePerspectiveName : '-',
      }
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
  // Reducer Initialization
  //----------------------------------------------------------------------
  const initialState: State = {
    perspectiveNameOptions: [],
    activePerspectiveName: dashboardSettings.activePerspectiveName || '',
    isValid: true,
    isLoading: true,
  }

  const [state, dispatch] = useReducer(reducer, initialState)
  const { perspectiveNameOptions, activePerspectiveName, isValid, isLoading } = state

  logDebug(
    'PerspectiveSelector',
    `Initial State: perspectiveNameOptions=, activePerspectiveName=${activePerspectiveName}, isValid=${String(isValid)}, isLoading=${isLoading}`
  )

  //----------------------------------------------------------------------
  // Effect to Update Perspective Options When perspectiveSettings Change
  //----------------------------------------------------------------------
  useEffect(() => {
    logDebug('PerspectiveSelector/useEffect', `Detected change in perspectiveSettings. activePerspectiveName="${dashboardSettings.activePerspectiveName}" dashboardSettings.lastChange="${dashboardSettings.lastChange}"`)

    if (!perspectiveSettings) {
      logWarn('PerspectiveSelector/useEffect', 'perspectiveSettings is falsy. Exiting effect.')
      dispatch({ type: 'LOG_STATE', payload: 'perspectiveSettings is falsy' })
      dispatch({ type: 'SET_LOADING', payload: false })
      return
    }

    // Indicate loading state
    dispatch({ type: 'SET_LOADING', payload: true })

    // Get list of perspective names
    const options = getDisplayListOfPerspectiveNames(perspectiveSettings, true)
    logDebug('PerspectiveSelector/useEffect', `Retrieved perspective options: activePerspectiveName${dashboardSettings.activePerspectiveName}`)

    if (!options || options.length === 0) {
      logWarn('PerspectiveSelector/useEffect', 'Options derived from perspectiveSettings are empty or falsy.')
      dispatch({ type: 'LOG_STATE', payload: 'Options derived from perspectiveSettings are empty or falsy.' })
      dispatch({ type: 'SET_PERSPECTIVE_OPTIONS', payload: [] })
      dispatch({ type: 'SET_LOADING', payload: false })
      return
    }

    dispatch({ type: 'SET_PERSPECTIVE_OPTIONS', payload: options })
    dispatch({ type: 'SET_LOADING', payload: false })
  }, [perspectiveSettings])

  //----------------------------------------------------------------------
  // Effect to Validate Active Perspective When Options or Active Name Change
  //----------------------------------------------------------------------
  useEffect(() => {
    logDebug('PerspectiveSelector/useEffect', `perspectiveNameOptions or dashboardSettings.activePerspectiveName changed:${dashboardSettings.activePerspectiveName}`)

    const apn = dashboardSettings.activePerspectiveName
    const updatedOptions = [...perspectiveNameOptions]

    if (apn && endsWithStar(apn) && !updatedOptions.includes(apn)) {
      const nameWithoutStar = apn.slice(0, -1)
      const index = updatedOptions.indexOf(nameWithoutStar)
      if (index !== -1) {
        updatedOptions.splice(index + 1, 0, apn)
        // FIXME: this doesn't seem to be doing anything becauuse it doesn't update the list in the state
        logDebug(
          'PerspectiveSelector/useEffect',
          `Added activePerspectiveName with star "${apn}" after "${nameWithoutStar}" in options.`
        )
      } else {
        logWarn(
          'PerspectiveSelector/useEffect',
          `Name without star "${nameWithoutStar}" not found in options. Cannot insert "${apn}".`
        )
      }
    } else {
      logDebug('PerspectiveSelector/useEffect', `No star found in activePerspectiveName "${apn}".`)
    }

    dispatch({ type: 'VALIDATE_ACTIVE_PERSPECTIVE' }) //dbw commenting this out because not sure if it's even necessary
  }, [perspectiveNameOptions, dashboardSettings.activePerspectiveName])

  //----------------------------------------------------------------------
  // Effect to Log State Changes (Optional, for Debugging)
  //----------------------------------------------------------------------
  useEffect(() => {
    logDebug(
      'PerspectiveSelector/useEffect',
      `State updated: activePerspectiveName=${activePerspectiveName}, isValid=${String(isValid)}, isLoading=${isLoading}`
    )
  }, [perspectiveNameOptions, activePerspectiveName, isValid, isLoading])

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
      dispatch({ type: 'SET_ACTIVE_PERSPECTIVE', payload: dashboardSettings.activePerspectiveName })
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

      // Get the new perspective definition
      const newPerspectiveDef = getPerspectiveNamed(newValue, perspectiveSettings)
      if (!newPerspectiveDef || newPerspectiveDef.dashboardSettings === undefined) {
        logWarn(
          'PerspectiveSelector/handlePerspectiveChange',
          `Cannot find perspective definition for "${newValue}". Action aborted.`
        )
        dispatch({ type: 'LOG_STATE', payload: `Cannot find perspective definition for "${newValue}".` })
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
      dispatch({ type: 'SET_ACTIVE_PERSPECTIVE', payload: newValue })

      // Update dashboard settings atomically
      setDashboardSettings((prev) => {
        const updatedSettings = {
          ...prev,
          ...perspectiveDashboardSettings,
          activePerspectiveName: newValue,
          lastChange: `perspective changed to ${newValue} ${new Date().toLocaleTimeString()}`,
        }
        logDebug(
          'PerspectiveSelector/setDashboardSettings',
          `Updating dashboardSettings with activePerspectiveName: ${updatedSettings.activePerspectiveName}.`
        )
        return updatedSettings
      })

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
    `Rendering ComboBox with value="${activePerspectiveName}"}".`
  )

  return (
    <ComboBox
      label="Persp"
      value={activePerspectiveName}
      onChange={handlePerspectiveChange}
      options={perspectiveNameOptions}
      compactDisplay={true}
    />
  )
}

export default PerspectiveSelector
