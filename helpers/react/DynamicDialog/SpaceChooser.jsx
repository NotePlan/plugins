// @flow
//--------------------------------------------------------------------------
// SpaceChooser Component
// Allows users to select a Space (Teamspace or Private) by typing to filter choices
//--------------------------------------------------------------------------

import React, { useState, useEffect, useMemo } from 'react'
import SearchableChooser, { type ChooserConfig } from './SearchableChooser'
import { logDebug, logError } from '@helpers/react/reactDev.js'
import { TEAMSPACE_FA_ICON } from '@helpers/teamspace.js'
import { TEAMSPACE_ICON_COLOR } from '@helpers/NPnote.js'
import { truncateText } from '@helpers/react/reactUtils.js'
import './SpaceChooser.css'

export type SpaceOption = {
  id: string, // Empty string for Private, teamspace ID for teamspaces
  title: string, // "Private" or teamspace title
  isPrivate: boolean,
}

export type SpaceChooserProps = {
  label?: string,
  value?: string, // The space ID (empty string for Private)
  onChange: (spaceId: string) => void, // Callback with space ID (empty string for Private)
  disabled?: boolean,
  compactDisplay?: boolean,
  placeholder?: string,
  requestFromPlugin?: (command: string, dataToSend?: any, timeout?: number) => Promise<any>,
  showValue?: boolean, // If true, display the selected value below the input
}

/**
 * SpaceChooser Component
 * A searchable dropdown for selecting a Space (Private or Teamspace)
 * @param {SpaceChooserProps} props
 * @returns {React$Node}
 */
export function SpaceChooser({
  label,
  value = '',
  onChange,
  disabled = false,
  compactDisplay = false,
  placeholder = 'Type to search spaces...',
  requestFromPlugin,
  showValue = false,
}: SpaceChooserProps): React$Node {
  const [spaces, setSpaces] = useState<Array<SpaceOption>>([])
  const [spacesLoaded, setSpacesLoaded] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  // Load spaces (teamspaces) from plugin
  const loadSpaces = async () => {
    if (spacesLoaded || !requestFromPlugin) return

    const loadStartTime = performance.now()
    try {
      setIsLoading(true)
      logDebug('SpaceChooser', `[DIAG] loadSpaces START`)
      // Note: requestFromPlugin resolves with just the data when success=true, or rejects with error when success=false
      const teamspacesData = await requestFromPlugin('getTeamspaces', {})
      const loadElapsed = performance.now() - loadStartTime
      logDebug('SpaceChooser', `[DIAG] loadSpaces COMPLETE: elapsed=${loadElapsed.toFixed(2)}ms`)

      // Always include Private as the first option
      const privateOption: SpaceOption = {
        id: '',
        title: 'Private',
        isPrivate: true,
      }

      if (Array.isArray(teamspacesData)) {
        // Convert teamspaces to SpaceOption format
        const teamspaceOptions: Array<SpaceOption> = teamspacesData.map((ts: { id: string, title: string }) => ({
          id: ts.id,
          title: ts.title || '(unknown)',
          isPrivate: false,
        }))

        // Combine Private + Teamspaces
        setSpaces([privateOption, ...teamspaceOptions])
        setSpacesLoaded(true)
        logDebug('SpaceChooser', `Loaded ${teamspaceOptions.length} teamspaces + Private`)
        if (teamspaceOptions.length > 0) {
          logDebug(
            'SpaceChooser',
            `Teamspaces:`,
            teamspaceOptions.map((ts) => ({ id: ts.id, title: ts.title })),
          )
        }
      } else {
        logError('SpaceChooser', `[DIAG] loadSpaces: Invalid response format, got:`, typeof teamspacesData, teamspacesData)
        // Still set Private option even on error
        setSpaces([privateOption])
        setSpacesLoaded(true)
      }
    } catch (error) {
      const loadElapsed = performance.now() - loadStartTime
      logError('SpaceChooser', `[DIAG] loadSpaces ERROR: elapsed=${loadElapsed.toFixed(2)}ms, error="${error.message}"`)
      // Still set Private option even on error
      const privateOption: SpaceOption = {
        id: '',
        title: 'Private',
        isPrivate: true,
      }
      setSpaces([privateOption])
      setSpacesLoaded(true)
    } finally {
      setIsLoading(false)
    }
  }

  // Load spaces on mount
  useEffect(() => {
    if (!spacesLoaded && requestFromPlugin) {
      // Use requestAnimationFrame to yield before making the request
      requestAnimationFrame(() => {
        loadSpaces()
      })
    }
  }, [spacesLoaded, requestFromPlugin])

  // Configure the SearchableChooser
  const config: ChooserConfig = {
    items: spaces,
    filterFn: (space: SpaceOption, searchTerm: string) => {
      const term = searchTerm.toLowerCase()
      return space.title.toLowerCase().includes(term)
    },
    getDisplayValue: (space: SpaceOption) => {
      return space.title
    },
    getOptionText: (space: SpaceOption) => {
      return space.title
    },
    getOptionTitle: (space: SpaceOption) => {
      return space.isPrivate ? 'Private notes (default)' : `Teamspace: ${space.title}`
    },
    truncateDisplay: truncateText,
    onSelect: (space: SpaceOption) => {
      logDebug('SpaceChooser', `Selected space: ${space.title} (id: ${space.id || 'Private'})`)
      onChange(space.id)
    },
    emptyMessageNoItems: 'No spaces available',
    emptyMessageNoMatch: 'No spaces match',
    classNamePrefix: 'space-chooser',
    iconClass: 'fa-cube', // Icon for the input field (will be prefixed with fa-solid by SearchableChooser)
    fieldType: 'space-chooser',
    debugLogging: true,
    maxResults: 25,
    inputMaxLength: 100,
    dropdownMaxLength: 80,
    getOptionIcon: (space: SpaceOption) => {
      // TEAMSPACE_FA_ICON is 'fa-regular fa-cube', we need just 'cube' for fa-solid
      return space.isPrivate ? 'user' : 'cube'
    },
    getOptionColor: (space: SpaceOption) => {
      return space.isPrivate ? undefined : TEAMSPACE_ICON_COLOR
    },
    getOptionShortDescription: (space: SpaceOption) => {
      return space.isPrivate ? 'Your private notes' : 'Teamspace'
    },
  }

  // Find the current space to get its display title
  const currentSpace = spaces.find((s) => s.id === value) || (value === '' ? spaces.find((s) => s.isPrivate) : null)
  const displayValue = currentSpace ? currentSpace.title : value || 'Private'

  return (
    <SearchableChooser
      label={label}
      value={displayValue}
      disabled={disabled}
      compactDisplay={compactDisplay}
      placeholder={placeholder}
      showValue={showValue}
      config={config}
      isLoading={isLoading}
    />
  )
}

export default SpaceChooser
