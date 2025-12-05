// @flow
//--------------------------------------------------------------------------
// Dashboard React component for multi-select of team/private spaces
// Core of this specified by @jgclark and written by Cursor, 2025-12-04
// Last updated 2025-12-05 for v2.4.0 by @jgclark
//--------------------------------------------------------------------------
import React from 'react'
import { useAppContext } from './AppContext.jsx'
import { PRIVATE_FA_ICON,TEAMSPACE_FA_ICON } from '@helpers/teamspace'
import { logDebug, logError } from '@helpers/react/reactDev'
import '../css/MultiSelectSpaces.css'

//-----------------------------------------------------------

type Props = {
  value: Array<string>, // array of selected teamspace IDs (including 'private')
  onChange: (Array<string>) => void,
  disabled?: boolean,
  label: string,
  description?: string,
}

//-----------------------------------------------------------

/**
 * Multi-select component for selecting teamspaces to include
 */
function MultiSelectSpaces({ value, onChange, disabled = false, label, description }: Props): React$Node {
  const { pluginData } = useAppContext()
  // const teamspaces: Array<string> = ['private'] // for Testing only
  const teamspaces: Array<TTeamspace> = pluginData?.notePlanSettings?.currentTeamspaces ?? []

  if (teamspaces.length === 0) {
    logError('MultiSelectSpaces', 'No teamspaces available')
    return null
  }

  // Ensure value is an array
  const selectedValues = Array.isArray(value) ? value : (value ? [value] : ['private'])

  // Handle checkbox change
  const handleCheckboxChange = (teamspaceId: string) => {
    if (disabled) return

    const newSelected = [...selectedValues]
    const index = newSelected.indexOf(teamspaceId)

    if (index > -1) {
      // Unchecking - but ensure at least one remains selected
      if (newSelected.length > 1) {
        newSelected.splice(index, 1)
        onChange(newSelected)
      }
      // If only one selected, don't allow unchecking (enforced by disabled state)
    } else {
      // Checking - add to selection
      newSelected.push(teamspaceId)
      onChange(newSelected)
    }
  }

  // Check if a checkbox should be disabled (only disable if it's the last selected item)
  const isCheckboxDisabled = (teamspaceId: string): boolean => {
    return disabled || (selectedValues.length === 1 && selectedValues.includes(teamspaceId))
  }

  // Build options: Private space first, then teamspaces
  const options = [
    { id: 'private', title: 'Private space' },
    ...teamspaces.map((ts) => ({ id: ts.id, title: ts.title })),
  ]

  // ----------------------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------------------

  return (
    <div className={`ui-item`}>
      {label && (
        <label className="input-box-label">{label}</label>
      )}
      {/* If only one teamspace available, show message instead */}
      {(teamspaces.length === 1 && teamspaces[0] === 'private')
        ? (
          <div className="item-description italicText">
            You are not a member of any Spaces.
          </div>)
        : (
          <>
            {description && <div className="item-description pad-bottom">{description}</div>}
            <div className="multi-select-panel">
              <div className="multi-select-options">
                {options.map((option) => {
                  const isChecked = selectedValues.includes(option.id)
                  const isDisabled = isCheckboxDisabled(option.id)
                  const isPrivate = option.id === 'private'

                  return (
                    <label key={option.id}>
                      <input
                        type="checkbox"
                        className="apple-switch switch-input"
                        checked={isChecked}
                        disabled={isDisabled}
                        onChange={() => handleCheckboxChange(option.id)}
                      />
                      <span>
                        {!isPrivate
                          ? <i className={`${TEAMSPACE_FA_ICON} teamspace-color pad-right`}></i>
                          : <i className={`${PRIVATE_FA_ICON} teamspace-color pad-right`}></i>}
                        {option.title}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          </>
        )
      }
    </div>
  )
}

export default MultiSelectSpaces
