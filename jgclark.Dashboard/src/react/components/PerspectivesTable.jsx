// @flow
//------------------------------------------------------------------------------
// PerspectivesTable Component
// Displays a table of settings for multiple perspectives.
// Users can edit settings for each perspective.
// Last updated 2025-01-18 for 2.1.4
//------------------------------------------------------------------------------

// TODO: Something really strange happens if you "Apply" a perspective that has been modified but then click "Cancel".
// The underlying perspective and dashboardSettings are still correct, but for some reason, the PerspectiveSelector
// gets updated to appear that the perspective is not modified.
// If you refresh, all the data is correct. I cannot figure out why/how the PerspectiveSelector is getting updated on a cancel.

import React, { useState } from 'react'
import '../css/PerspectivesTable.css' // Import CSS for styling
import { renderItem } from '@helpers/react/DynamicDialog/dialogElementRenderer.js'
import type { TSettingItem } from '@helpers/react/DynamicDialog/DynamicDialog.jsx'
import DynamicDialog from '@helpers/react/DynamicDialog/DynamicDialog.jsx'
import type { TPerspectiveSettings, TPerspectiveDef } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import { clo, logDebug } from '@helpers/react/reactDev.js'
import { getDiff } from '@helpers/dev'

type PerspectivesTableProps = {
  perspectives: TPerspectiveSettings,
  settingDefs: Array<TSettingItem>,
  onSave: (updatedPerspectives: TPerspectiveSettings) => void,
  onCancel?: () => void,
  labelPosition?: 'left' | 'right',
}

const PerspectivesTable = ({ perspectives, settingDefs, onSave, onCancel, labelPosition = 'right' }: PerspectivesTableProps): React$Node => {
  const { sendActionToPlugin, perspectiveSettings, dashboardSettings } = useAppContext()

  // check if there is an active perspective that is modified & list it also as an unsaved perspective
  const modifiedPerspective = perspectives.find((p) => p.isActive && p.isModified)
  const perspectiveWithModifiedMaybe = JSON.parse(JSON.stringify(perspectives)) // Make a deep copy so changes don't leak back to the original until we save
  if (modifiedPerspective) {
    logDebug('PerspectivesTable', `found active modifiedPerspective:`, { modifiedPerspective })
    perspectiveWithModifiedMaybe.push({
      ...modifiedPerspective,
      nameToShow: `${modifiedPerspective.name} (+ unsaved changes)`,
      showSaveButton: true,
      dashboardSettings: dashboardSettings,
    })
  }

  const [updatedPerspectives, setUpdatedPerspectives] = useState(perspectiveWithModifiedMaybe.sort((a, b) => a.name.localeCompare(b.name)))
  const [changesMade, setChangesMade] = useState(false) // Manage changesMade state here

  // Handler for field changes
  const handleFieldChange = (perspectiveIndex: number, key: string, value: any) => {
    logDebug('PerspectivesTable', `handleFieldChange was called with key: ${key} and value: ${value} for perspectiveIndex:${perspectiveIndex}`)
    setChangesMade(true) // Update changesMade state
    setUpdatedPerspectives((prevPerspectives) => {
      const newPerspectives = [...prevPerspectives]
      newPerspectives[perspectiveIndex] = {
        ...newPerspectives[perspectiveIndex],
        dashboardSettings: {
          ...newPerspectives[perspectiveIndex].dashboardSettings,
          [key]: value,
        },
      }
      return newPerspectives
    })
  }

  const handleSave = () => {
    logDebug('Dashboard', `onPerspectivesTableSave was called with updatedPerspectives:`, { updatedPerspectives })
    if (updatedPerspectives) {
      const updatedPerspectivesWithoutModifiedOne = updatedPerspectives.filter((p) => !p.nameToShow)

      const realDiff = getDiff(perspectiveSettings, updatedPerspectivesWithoutModifiedOne)
      logDebug('Dashboard', `sending updatedPerspectives to plugin`, { differences: realDiff })

      sendActionToPlugin(
        'perspectiveSettingsChanged',
        {
          actionType: 'perspectiveSettingsChanged',
          settings: updatedPerspectivesWithoutModifiedOne,
          lastChange: `Bulk change in PerspectivesTable`,
        },
        'PerspectivesTable save',
        true,
      )
    }
    onSave(updatedPerspectives)
    setChangesMade(false) // Reset changesMade state after saving
    logDebug('PerspectivesTable Saved updated perspectives', { updatedPerspectives })
  }

  const handleCancel = () => {
    onCancel && onCancel()
  }

  type PerspectiveSettingsForTable = Array<{
    ...TPerspectiveDef,
    nameToShow?: string,
    showSaveButton?: boolean,
  }>

  /**
   * Apply the modifications from the perspectiveToSave to the updatedPerspectives array (e.g. as if the "save perspective" button was clicked)
   * Note does not actually save it until the "save & close" button is clicked
   * @param {*} perspectiveToSaveIndex
   */
  const handleApplyModifications = (perspectiveToSaveIndex: number, apply: boolean) => {
    const perspectiveToSave = updatedPerspectives[perspectiveToSaveIndex]
    // remove the perspectiveToSave from the updatedPerspectives array
    setUpdatedPerspectives((prev) => {
      const updatedPerspectivesWithoutModifiedOne = prev.filter((p) => p.nameToShow !== perspectiveToSave.nameToShow)
      logDebug('PerspectivesTable', `handleApplyModifications before applying:`, { updatedPerspectivesWithoutModifiedOne })
      const index = updatedPerspectivesWithoutModifiedOne.findIndex((p) => p.name === perspectiveToSave.name)
      if (index !== -1) {
        updatedPerspectivesWithoutModifiedOne[index].isModified = false
        if (apply) {
          updatedPerspectivesWithoutModifiedOne[index].dashboardSettings = perspectiveToSave.dashboardSettings
        } else {
          // This is where 'Revert' button takes you
          // TODO(dbw): this currently doesn't drop the saved changes in the Edit All... menu.  I think it should.
          // Also couldn't this be a separate function, called handleRevertModifications?
        }
      }
      return updatedPerspectivesWithoutModifiedOne
    })
    setChangesMade(true)
    logDebug('PerspectivesTable', `handleApplyModifications after applying:`, { updatedPerspectives })
  }

  const style = {
    // TEST: Trying without this to figure out where the size constraints actually come from
    width: '95%',
    height: '95%',
    maxWidth: '95%',
    maxHeight: '95%',
  }

  return (
    <DynamicDialog
      title="Edit Perspectives"
      onSave={handleSave}
      onCancel={handleCancel}
      isModal={true}
      hideDependentItems={true}
      hideHeaderButtons={false}
      externalChangesMade={changesMade} // Pass external changesMade state
      setChangesMade={setChangesMade} // Pass setChangesMade function
      style={style}
      submitButtonText="Save & Close"
    >
      <div className="perspectives-table-container">
        <table className="perspectives-table">
          <thead>
            <tr>
              <th className="sticky-column setting-column sticky-header">Setting</th>
              {updatedPerspectives.map((perspective, index) => (
                <th key={`header-${index}`} className="perspective-header sticky-header">
                  {perspective.name === '-' ? '[Default]' : perspective.nameToShow || perspective.name}
                  {perspective.showSaveButton && (
                    <div className="save-button-container">
                      <button
                        className="PCButton apply-button"
                        onClick={() => handleApplyModifications(index, true)}
                        title={`Apply the unsaved modifications to '${perspective.name}'`}
                      >
                        {`< Save`}
                      </button>
                      <button
                        className="PCButton revert-button"
                        onClick={() => handleApplyModifications(index, false)}
                        title={`Revert to original (non-modified) settings for '${perspective.name}'`}
                      >
                        {`Revert`}
                      </button>
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {settingDefs
              .filter((settingDef) => settingDef.key !== 'perspectivesEnabled' && settingDef.label !== 'Perspectives' && settingDef.label !== 'Logging')
              .map((settingDef, settingIndex) => {
                if (settingDef.type === 'separator') {
                  return (
                    <tr key={`separator-${settingIndex}`}>
                      <td colSpan={updatedPerspectives.length + 1} className="ui-separator"></td>
                    </tr>
                  )
                }
                if (settingDef.type === 'heading') {
                  return (
                    <tr key={`heading-${settingIndex}`}>
                      <td colSpan={updatedPerspectives.length + 1} className="settings-heading ui-heading">
                        {settingDef.label}
                      </td>
                    </tr>
                  )
                }
                // For each setting, render a row with that setting in the first column and inputs for each perspective
                return (
                  <tr key={`setting-${settingIndex}`} title={settingDef.description || ''}>
                    <td className="sticky-column setting-label">
                      <div className="setting-label-text">{settingDef.label}</div>
                    </td>
                    {updatedPerspectives.map((perspective, perspectiveIndex) => {
                      const key = settingDef.key
                      if (typeof key !== 'string') {
                        console.error('Invalid key:', key)
                        return null // or handle the error as needed
                      }
                      // $FlowIgnore
                      const value = perspective.dashboardSettings?.[key] ?? settingDef.default
                      const item = {
                        ...settingDef,
                        value: value,
                        checked: value === true,
                        label: ' ',
                        description: ' ',
                      }
                      return (
                        <td key={`cell-${settingIndex}-${perspectiveIndex}`} className="setting-cell">
                          {renderItem({
                            index: settingIndex,
                            item: item,
                            labelPosition: labelPosition,
                            handleFieldChange: (key, val) => handleFieldChange(perspectiveIndex, key, val),
                            handleButtonClick: () => {},
                            disabled: false,
                            showSaveButton: false,
                            className: '',
                          })}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </DynamicDialog>
  )
}

export default PerspectivesTable
