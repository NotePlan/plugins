// @flow
//------------------------------------------------------------------------------
// PerspectivesTable Component
// Displays a table of settings for multiple perspectives.
// Users can edit settings for each perspective.
//------------------------------------------------------------------------------

import React, { useState } from 'react'
import '../css/PerspectivesTable.css' // Import CSS for styling
import { renderItem } from '../../../../np.Shared/src/react/DynamicDialog/dialogElementRenderer.js'
import type { TSettingItem } from '../../../../np.Shared/src/react/DynamicDialog/DynamicDialog.jsx'
import DynamicDialog from '../../../../np.Shared/src/react/DynamicDialog/DynamicDialog.jsx'
import { useAppContext } from './AppContext.jsx'
import { clo, logDebug } from '@np/helpers/react/reactDev.js'
import type { TPerspectiveSettings } from '../../types.js'
import { getDiff } from '@np/helpers/dev'

type PerspectivesTableProps = {
  perspectives: TPerspectiveSettings,
  settingDefs: Array<TSettingItem>,
  onSave: (updatedPerspectives: TPerspectiveSettings) => void,
  onCancel?: () => void,
  labelPosition?: 'left' | 'right',
}

const PerspectivesTable = ({ perspectives, settingDefs, onSave, onCancel, labelPosition = 'right' }: PerspectivesTableProps): React.ReactNode => {
  const [updatedPerspectives, setUpdatedPerspectives] = useState(perspectives)
  const [changesMade, setChangesMade] = useState(false) // Manage changesMade state here

  const { sendActionToPlugin, perspectiveSettings } = useAppContext()

  // Handler for field changes
  const handleFieldChange = (perspectiveIndex: number, key: string, value: any) => {
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
      const realDiff = getDiff(perspectiveSettings, updatedPerspectives)
      logDebug('Dashboard', `sending updatedPerspectives to plugin`, { differences: realDiff })
      sendActionToPlugin(
        'perspectiveSettingsChanged',
        { actionType: 'perspectiveSettingsChanged', settings: updatedPerspectives, lastChange: `Bulk change in PerspectivesTable` },
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

  const style = {
    width: '90%',
    height: '90%',
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
    >
      <div className="perspectives-table-container">
        <table className="perspectives-table">
          <thead>
            <tr>
              <th className="sticky-column setting-column">Setting</th>
              {updatedPerspectives.map((perspective, index) => (
                <th key={`header-${index}`} className="perspective-header sticky-column">
                  {perspective.name}
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
                      <td colSpan={updatedPerspectives.length + 1}>{/* <hr className="ui-separator" /> */}</td>
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
                      // @ts-ignore
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
