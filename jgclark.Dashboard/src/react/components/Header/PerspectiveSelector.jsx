// @flow
//--------------------------------------------------------------------------
// Dashboard React component to select and manage perspectives
// Refactored to use useReducer to give more visibility into what's happening
// Prevents infinite render loops by avoiding returning null
// Last updated for 2.1.0.b
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useReducer, useEffect, useCallback } from 'react'
import type { TPerspectiveDef } from '../../../types.js'
import { PERSPECTIVE_ACTIONS } from '../../reducers/actionTypes'
import { endsWithStar, setActivePerspective } from '../../../perspectiveHelpers'
import {
  getDisplayListOfPerspectiveNames,
  getPerspectiveNamed,
  getActivePerspectiveDef,
  getActivePerspectiveName,
  type TPerspectiveOptionObject,
} from '../../../perspectiveHelpers.js'
import { useAppContext } from '../AppContext.jsx'
import DropdownSelect /*, { type Option } */ from '@helpers/react/DynamicDialog/DropdownSelect.jsx'
import { clo, logDebug, logInfo, logWarn, logError } from '@helpers/react/reactDev.js'
import { showDialog, showConfirmationDialog, showMessageYesNoCancel } from '@helpers/react/userInput'
// import { compareObjects, dt } from '@helpers/dev.js'

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

const separatorOption = [{ label: 'Separator', value: '_separator_', type: 'separator' }]

const saveAsOption = [{ label: 'Save Perspective As...', value: 'Add New Perspective' }]

/**
 * Formats the name of a perspective or option by appending an asterisk if it is modified.
 *
 * @param {Object} item - The perspective or option object.
 * @param {string} item.name - The name of the perspective or option.
 * @param {boolean} item.isModified - Indicates if the perspective or option is modified.
 * @returns {string} The formatted name.
 */
const formatNameWithStarIfModified = (item: TPerspectiveDef): string => {
  return item.isModified ? `${item.name}*` : item.name
}

//--------------------------------------------------------------------------
// PerspectiveSelector Component Definition
//--------------------------------------------------------------------------
const PerspectiveSelector = (): React$Node => {
  //----------------------------------------------------------------------
  // Context
  //----------------------------------------------------------------------
  const { dashboardSettings, perspectiveSettings, /*dispatchDashboardSettings,*/ dispatchPerspectiveSettings, sendActionToPlugin, pluginData, setReactSettings } = useAppContext()

  //--------------------------------------------------------------------------
  // Reducer Function with Comprehensive Logging
  //--------------------------------------------------------------------------
  const reducer = (state: State, action: Action): State => {
    switch (action.type) {
      case 'SET_PERSPECTIVE_OPTIONS': {
        // Access activePerspectiveName from the current state
        // const { activePerspectiveName } = state

        // Determine if "Save Perspective" should be included
        const thisPersp = getActivePerspectiveDef(perspectiveSettings)
        const notIsDash = thisPersp && thisPersp.name && thisPersp.name !== '-'
        const saveModifiedOption = notIsDash && thisPersp?.isModified ? [{ label: 'Save Perspective', value: 'Save Perspective' }] : []
        const renamePerspective = notIsDash ? [{ label: 'Rename Perspective…', value: 'Rename Perspective' }] : []
        const copySettings = notIsDash ? [{ label: 'Copy Settings to…', value: 'Copy Perspective' }] : []
        const deletePersp = notIsDash ? [{ label: 'Delete Perspective…', value: 'Delete Perspective' }] : []
        const editAllPerspectives = [{ label: 'Edit All Perspectives…', value: 'Edit All Perspectives' }]
        // logDebug each of the variables above
        logDebug('PerspectiveSelector/SET_PERSPECTIVE_OPTIONS activePerspective=', { thisPersp })
        logDebug('PerspectiveSelector/SET_PERSPECTIVE_OPTIONS', `notIsDash=${String(notIsDash)} action.payload=`, { payload: action.payload })
        logDebug(
          'PerspectiveSelector/SET_PERSPECTIVE_OPTIONS',
          `saveModifiedOption=${JSON.stringify(saveModifiedOption)} renamePerspective=${JSON.stringify(renamePerspective)} copySettings=${JSON.stringify(
            copySettings,
          )} deletePersp=${JSON.stringify(deletePersp)} editAllPerspectives=${JSON.stringify(editAllPerspectives)}`,
        )
        const perspectiveNameOptions = [
          ...action.payload,
          ...separatorOption,
          ...saveModifiedOption,
          ...saveAsOption,
          ...renamePerspective,
          ...copySettings,
          ...deletePersp,
          ...editAllPerspectives,
        ]
        logDebug('PerspectiveSelector/SET_PERSPECTIVE_OPTIONS', `perspectiveNameOptions=`, perspectiveNameOptions)
        return {
          ...state,
          perspectiveNameOptions: perspectiveNameOptions,
        }
      }
      case 'SET_ACTIVE_PERSPECTIVE':
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
    if (!perspectiveSettings) {
      logWarn('PerspectiveSelector/useEffect(perspectiveSettings)', 'perspectiveSettings is falsy. Exiting effect.')
      dispatchPerspectiveSelector({ type: 'LOG_STATE', payload: 'perspectiveSettings is falsy' })
      return
    }

    // Get list of perspective names
    const options: Array<TPerspectiveOptionObject> = getDisplayListOfPerspectiveNames(perspectiveSettings, true)

    if (!options || options.length === 0) {
      logWarn('PerspectiveSelector/useEffect(perspectiveSettings)', 'Options derived from perspectiveSettings are empty or falsy.')
      dispatchPerspectiveSelector({ type: 'LOG_STATE', payload: 'Options derived from perspectiveSettings are empty or falsy.' })
      dispatchPerspectiveSelector({ type: 'SET_PERSPECTIVE_OPTIONS', payload: [] })
      return
    }

    // Update perspective options first
    dispatchPerspectiveSelector({ type: 'SET_PERSPECTIVE_OPTIONS', payload: options })

    // Then derive the active perspective name
    const newActivePerspectiveName = getActivePerspectiveName(perspectiveSettings)
    if (newActivePerspectiveName !== activePerspectiveName) {
      dispatchPerspectiveSelector({ type: 'SET_ACTIVE_PERSPECTIVE', payload: newActivePerspectiveName })
    }
  }, [perspectiveSettings, pluginData.perspectiveSettings])

  //----------------------------------------------------------------------
  // Effect to Update Active Perspective Name When It Changes Externally
  //----------------------------------------------------------------------

  // Ensure activePerspectiveName is updated when perspectiveSettings change
  useEffect(() => {
    const thisPersp = getActivePerspectiveDef(perspectiveSettings)
    if (thisPersp && thisPersp.name !== activePerspectiveName) {
      dispatchPerspectiveSelector({ type: 'SET_ACTIVE_PERSPECTIVE', payload: thisPersp.name })
    }
  }, [perspectiveSettings, activePerspectiveName])

  //----------------------------------------------------------------------
  // Effect to Log State Changes (Optional, for Debugging)
  //----------------------------------------------------------------------
  useEffect(() => {
    const thisPersp = getActivePerspectiveDef(perspectiveSettings)
    if (thisPersp) {
      // logWarn('PerspectiveSelector/useEffect(perspectiveSettings)', `FYI: State updated: activePerspectiveName="${formatNameWithStarIfModified(thisPersp)}"`)
    }
  }, [perspectiveNameOptions, activePerspectiveName])

  //----------------------------------------------------------------------
  // Handler for Perspective Change with Comprehensive Logging
  //----------------------------------------------------------------------

  const thisPersp = getPerspectiveNamed(activePerspectiveName, perspectiveSettings)
  const nameToDisplay = thisPersp ? formatNameWithStarIfModified(thisPersp) : '-'

  /**
   * Handles a perspective change event. If the selected option's value
   * is the same as the currently active perspective, then no further
   * action is taken. Otherwise, it proceeds with the relevant
   * perspective/option logic (delete, save, rename, copy, etc.).
   *
   * @param {TPerspectiveOptionObject} selectedOption - The newly selected perspective or action.
   * @returns {Promise<void>} A promise that resolves when the event handling is complete.
   */
  const handlePerspectiveChange = useCallback(
    async (selectedOption: TPerspectiveOptionObject) => {
      logDebug('PerspectiveSelector/handlePerspectiveChange', `User selected newValue: "${selectedOption.value}". Current activePerspectiveName: "${activePerspectiveName}".`)

      // Add this at the start of the handler to store the current perspective
      const currentPerspective = {
        label: nameToDisplay,
        value: thisPersp ? activePerspectiveName : '-',
      }

      if (selectedOption.value === 'separator') {
        logDebug('PerspectiveSelector/handlePerspectiveChange', `clicked on separator option. No action taken.`)
        // Force rerender with current perspective
        handlePerspectiveReset(currentPerspective)
        return
      }

      if (selectedOption.value === 'Add New Perspective') {
        logDebug('PerspectiveSelector/handlePerspectiveChange', `addNewPersp user selected "${selectedOption.value}".`)
        const formFields = [{ type: 'input', label: 'Name:', key: 'newName', focus: true }]
        const userInputObj = await showDialog({ items: formFields, title: `Save as New Perspective`, submitOnEnter: true })
        if (userInputObj) {
          sendActionToPlugin(
            'addNewPerspective',
            { actionType: 'addNewPerspective', perspectiveName: userInputObj ? userInputObj.newName : '', logMessage: 'Add New Perspective selected from dropdown' },
            'Add New Perspective selected from dropdown',
          )
        } else {
          logDebug('PerspectiveSelector/handlePerspectiveChange', `No new name provided. Not adding new perspective.`)
          handlePerspectiveReset(currentPerspective)
        }
        return
      }

      if (selectedOption.value === 'Delete Perspective') {
        logDebug('PerspectiveSelector/handlePerspectiveChange', `deletePerspective "${selectedOption.value}".`)
        try {
          const confirmation = await showConfirmationDialog({
            message: `Are you sure you want to delete the perspective "${activePerspectiveName}"?`,
            onCancel: () => {
              logDebug('PerspectiveSelector/handlePerspectiveChange', 'Delete Perspective cancelled via escape')
              handlePerspectiveReset(currentPerspective)
            },
            options: ['Yes', 'No'],
          })
          logDebug('PerspectiveSelector/handlePerspectiveChange', `confirmation="${String(confirmation)}" typeof(confirmation)=${typeof confirmation}`)

          if (confirmation && confirmation !== 'No') {
            sendActionToPlugin(
              'deletePerspective',
              { actionType: 'deletePerspective', perspectiveName: activePerspectiveName, logMessage: `Delete Perspective (${activePerspectiveName}) selected from dropdown` },
              `Delete Perspective (${activePerspectiveName}) selected from dropdown`,
            )
          } else {
            logDebug('PerspectiveSelector/handlePerspectiveChange', `Delete Perspective cancelled`)
            handlePerspectiveReset(currentPerspective)
          }
        } catch (error) {
          logError('PerspectiveSelector/handlePerspectiveChange', `Error in delete perspective dialog: ${error}`)
          handlePerspectiveReset(currentPerspective)
        }
        return
      }

      if (selectedOption.value === 'Save Perspective') {
        logDebug('PerspectiveSelector/handlePerspectiveChange', `savePerspective "${selectedOption.value}".`)
        // const perspName = state.activePerspectiveName
        const thisPersp = getActivePerspectiveDef(perspectiveSettings)
        if (thisPersp && thisPersp.isModified && thisPersp.name !== '-') {
          sendActionToPlugin(
            'savePerspective',
            { actionType: 'savePerspective', perspectiveName: thisPersp.name, logMessage: `Save Perspective (${thisPersp.name}) selected from dropdown` },
            `Save Perspective (${thisPersp.name}) selected from dropdown`,
          )
          logDebug('PerspectiveSelector/handlePerspectiveChange', `${thisPersp.name} saved!`)
        } else {
          logDebug('PerspectiveSelector/handlePerspectiveChange', `${thisPersp?.name || ''} was not modified. Not saving.`)
          handlePerspectiveReset(currentPerspective)
        }
        return
      }

      if (selectedOption.value === 'Rename Perspective') {
        logDebug('PerspectiveSelector/handlePerspectiveChange', `renamePerspective "${selectedOption.value}".`)
        const formFields = [{ type: 'input', label: 'New Name:', key: 'newName', focus: true }]
        const userInputObj = await showDialog({ items: formFields, title: `Rename Perspective "${state.activePerspectiveName}"`, submitOnEnter: true })
        if (userInputObj) {
          userInputObj.oldName = state.activePerspectiveName
          logDebug('PerspectiveSelector/handlePerspectiveChange renamePerspective', { userInputObj })
          // set the activePerspectiveName optimistically  so the UI updates immediately, but the perspectiveSettings will be updated later in pluginData
          dispatchPerspectiveSettings({
            type: PERSPECTIVE_ACTIONS.SET_PERSPECTIVE_SETTINGS,
            payload: perspectiveSettings.map((persp) => ({ ...persp, name: persp.name === state.activePerspectiveName ? userInputObj.newName : persp.name })),
          })
          dispatchPerspectiveSelector({ type: 'SET_ACTIVE_PERSPECTIVE', payload: userInputObj.newName })
          sendActionToPlugin(
            'renamePerspective',
            { actionType: 'renamePerspective', userInputObj, logMessage: `Rename Perspective (${selectedOption.value}) selected from dropdown` },
            `Rename Perspective (${selectedOption.value}) selected from dropdown`,
          )
        } else {
          logDebug('PerspectiveSelector/handlePerspectiveChange', `No new name provided. Not renaming perspective.`)
          handlePerspectiveReset(currentPerspective)
        }
        return
      }

      if (selectedOption.value === 'Copy Perspective') {
        logDebug('PerspectiveSelector/handlePerspectiveChange', `copySettings "${selectedOption.value}".`)
        const formFields = [
          {
            type: 'dropdown-select',
            label: 'Copy to:',
            key: 'newName',
            focus: true,
            compactDisplay: true,
            options: getDisplayListOfPerspectiveNames(perspectiveSettings, true).filter((option) => option.value !== state.activePerspectiveName),
          },
          {
            type: 'text',
            label: `This will replace the settings for the selected perspective with the settings from "${state.activePerspectiveName}"`,
          },
        ]
        const userInputObj = await showDialog({ items: formFields, title: `Copy Settings from   "${state.activePerspectiveName}"`, submitOnEnter: true })
        if (userInputObj) {
          userInputObj.fromName = state.activePerspectiveName
          sendActionToPlugin(
            'copyPerspective',
            { actionType: 'copyPerspective', userInputObj, logMessage: `Copy Settings from (${state.activePerspectiveName}) selected from dropdown` },
            `Copy Settings from (${state.activePerspectiveName}) selected from dropdown`,
          )
        } else {
          logDebug('PerspectiveSelector/handlePerspectiveChange', `No new name provided. Not copying settings.`)
          handlePerspectiveReset(currentPerspective)
        }
        return
      }

      if (selectedOption.value === 'Edit All Perspectives') {
        logDebug('PerspectiveSelector/handlePerspectiveChange', `editAllPerspectives "${selectedOption.value}".`)
        setReactSettings((prevReactSettings) => ({ ...prevReactSettings, perspectivesTableVisible: true }))
        return
      }

      // Otherwise, it's a normal perspective change so we process it
      // but not if the option changed only because the plugin sent it to us (no user action)
      const apn = getActivePerspectiveName(perspectiveSettings)
      logDebug('PerspectiveSelector/handlePerspectiveChange', `selectedOption.label: "${selectedOption.label}" apn: "${apn}"`)
      const currentPerspIsModified = perspectiveSettings.find((persp) => persp.name === apn)?.isModified || false
      if (currentPerspIsModified) {
        logDebug('PerspectiveSelector/handlePerspectiveChange', `Current perspective "${apn}" has unsaved changes. Showing confirmation dialog.`)
        const confirmation = await showMessageYesNoCancel(
          `Your current perspective "${activePerspectiveName}" has unsaved changes. Would you like to save these changes before switching to "${selectedOption.label}"?`,
          ['Cancel', 'Switch', 'Save+Switch'],
          'Confirm Perspective Switch',
        )
        if (!confirmation) {
          logDebug('PerspectiveSelector/handlePerspectiveChange', `Delete Perspective cancelled`)
          handlePerspectiveReset(currentPerspective)
          return
        } else if (confirmation === 'Save+Switch') {
          logDebug(
            'PerspectiveSelector/handlePerspectiveChange',
            `Save+Switch selected. Saving perspective "${activePerspectiveName}" before switching to "${selectedOption.label}".`,
          )
          const thisPersp = getActivePerspectiveDef(perspectiveSettings)
          if (thisPersp && thisPersp.name !== '-') {
            sendActionToPlugin(
              'savePerspective',
              { actionType: 'savePerspective', perspectiveName: thisPersp.name, logMessage: `Saving Perspective (${thisPersp.name}) before switching.` },
              `Save Perspective (${thisPersp.name}) selected from dropdown`,
            )
          }
        } else if (confirmation === 'Switch') {
          logDebug('PerspectiveSelector/handlePerspectiveChange', `Switch selected`)
        }
      }
      // The perspectives ground truth is set by the plugin and will be returned in pluginData
      // but for now, we will do an optimistic update so the UI is updated immediately
      logDebug(`PerspectiveSelector/handlePerspectiveChange optimistic update to activePerspectiveName: "${selectedOption.value}"`)
      const newPerspectiveSettings = setActivePerspective(selectedOption.value, perspectiveSettings)
      dispatchPerspectiveSettings({ type: PERSPECTIVE_ACTIONS.SET_PERSPECTIVE_SETTINGS, payload: newPerspectiveSettings })
      dispatchPerspectiveSelector({ type: 'SET_ACTIVE_PERSPECTIVE', payload: selectedOption.value })
      logDebug('PerspectiveSelector/handlePerspectiveChange', `Switching to perspective "${selectedOption.value}" sendActionToPlugin: "switchToPerspective"`)
      sendActionToPlugin(
        'switchToPerspective',
        { perspectiveName: selectedOption.value, actionType: 'switchToPerspective', logMessage: `Perspective changed to ${selectedOption.value}` },
        `Perspective changed to ${selectedOption.value}`,
      )
    },
    [perspectiveSettings, state, activePerspectiveName, dashboardSettings, nameToDisplay, thisPersp],
  )

  /**
   * Resets the DropdownSelect to the current perspective without triggering a full perspective change.
   *
   * @param {TPerspectiveOptionObject} currentPerspective - The current perspective to reset to.
   */
  const handlePerspectiveReset = useCallback((currentPerspective: TPerspectiveOptionObject) => {
    logDebug('PerspectiveSelector/handlePerspectiveReset', `Resetting to: ${JSON.stringify(currentPerspective)}`)
    // Directly update the DropdownSelect to reflect the current perspective
    dispatchPerspectiveSelector({ type: 'SET_ACTIVE_PERSPECTIVE', payload: currentPerspective.value })
  }, [])

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
      minWidth: '6rem',
    },
    separator: {
      borderTop: '0.5px solid lightgray',
      margin: '5px 0',
    },
    input: {
      fontFamily: 'unset',
    },
    label: {
      fontWeight: 500,
    },
  }

  const selectedValue = { label: nameToDisplay, value: thisPersp ? activePerspectiveName : '-' }
  logDebug('PerspectiveSelector', `selectedValue: ${JSON.stringify(selectedValue)} value(activePerspectiveName)=${activePerspectiveName}`)
  logDebug('Calling DropdownSelect with PerspectiveSelector/perspectiveNameOptions', { perspectiveNameOptions })

  return (
    <DropdownSelect
      styles={customStyles}
      options={perspectiveNameOptions.map((option) => (option.value === 'separator' ? { ...option, label: '', component: <div style={customStyles.separator}></div> } : option))}
      controlledValue={selectedValue}
      onChange={handlePerspectiveChange}
      compactDisplay={true}
      label={'Persp'}
      noWrapOptions={false}
      className={'perspective-selector'}
    />
  )
}

export default PerspectiveSelector
