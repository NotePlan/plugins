// @flow
//--------------------------------------------------------------------------
// SpaceChooser Component
// Allows users to select a Space (Teamspace or Private) by typing to filter choices
//--------------------------------------------------------------------------

import React, { useState, useEffect, useRef } from 'react'
import SearchableChooser, { type ChooserConfig } from './SearchableChooser'
import { logDebug, logError } from '@helpers/react/reactDev.js'
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
  value?: string, // The space ID (empty string for Private, "__all__" for All)
  onChange: (spaceId: string) => void, // Callback with space ID (empty string for Private, "__all__" for All)
  disabled?: boolean,
  compactDisplay?: boolean,
  placeholder?: string,
  width?: string, // Custom width for the chooser input (e.g., '80vw', '79%', '300px'). Overrides default width even in compact mode.
  requestFromPlugin?: (command: string, dataToSend?: any, timeout?: number) => Promise<any>,
  showValue?: boolean, // If true, display the selected value below the input
  includeAllOption?: boolean, // If true, include "All Private + Spaces" option that returns "__all__"
  shortDescriptionOnLine2?: boolean, // If true, render short description on second line (default: false)
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
  width,
  requestFromPlugin,
  showValue = false,
  includeAllOption = false,
  shortDescriptionOnLine2 = false,
}: SpaceChooserProps): React$Node {
  const [spaces, setSpaces] = useState<Array<SpaceOption>>([])
  const [spacesLoaded, setSpacesLoaded] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const requestFromPluginRef = useRef<?(command: string, dataToSend?: any, timeout?: number) => Promise<any>>(requestFromPlugin)
  const isLoadingRef = useRef<boolean>(false) // Track loading state to prevent concurrent loads
  const includeAllOptionRef = useRef<boolean>(includeAllOption)

  // Update refs when props change
  useEffect(() => {
    requestFromPluginRef.current = requestFromPlugin
  }, [requestFromPlugin])

  useEffect(() => {
    // If includeAllOption changes and spaces are already loaded, we need to reload
    if (includeAllOptionRef.current !== includeAllOption && spacesLoaded) {
      includeAllOptionRef.current = includeAllOption
      setSpacesLoaded(false) // Force reload to update the options list
    } else {
      includeAllOptionRef.current = includeAllOption
    }
  }, [includeAllOption, spacesLoaded])

  // Load spaces (teamspaces) from plugin
  const loadSpaces = async () => {
    const requestFn = requestFromPluginRef.current
    if (spacesLoaded || !requestFn || isLoadingRef.current) {
      logDebug('SpaceChooser', `[DIAG] loadSpaces: skipping (spacesLoaded=${String(spacesLoaded)}, hasRequestFn=${String(!!requestFn)}, isLoading=${String(isLoadingRef.current)})`)
      return
    }

    const loadStartTime = performance.now()
    const isMounted = true // Track if component is still mounted (currently always true, but kept for future cleanup pattern)
    try {
      isLoadingRef.current = true
      setIsLoading(true)
      logDebug('SpaceChooser', `[DIAG] loadSpaces START`)
      // Note: requestFromPlugin resolves with just the data when success=true, or rejects with error when success=false
      const teamspacesData = await requestFn('getTeamspaces', {})
      const loadElapsed = performance.now() - loadStartTime
      logDebug('SpaceChooser', `[DIAG] loadSpaces COMPLETE: elapsed=${loadElapsed.toFixed(2)}ms`)

      // Always include Private as an option
      const privateOption: SpaceOption = {
        id: '',
        title: 'Private',
        isPrivate: true,
      }

      // Optionally include "All Private + Spaces" option
      const allOption: SpaceOption = {
        id: '__all__',
        title: 'All Private + Spaces',
        isPrivate: false, // Not technically private, but we'll handle it specially in display functions
      }

      if (isMounted) {
        if (Array.isArray(teamspacesData)) {
          // Convert teamspaces to SpaceOption format
          const teamspaceOptions: Array<SpaceOption> = teamspacesData.map((ts: { id: string, title: string }) => ({
            id: ts.id,
            title: ts.title || '(unknown)',
            isPrivate: false,
          }))

          // Combine options: All (if enabled) + Private + Teamspaces
          const allOptions = includeAllOptionRef.current ? [allOption, privateOption, ...teamspaceOptions] : [privateOption, ...teamspaceOptions]
          setSpaces(allOptions)
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
          // Still set Private option even on error (and All if enabled)
          const allOptions = includeAllOptionRef.current ? [allOption, privateOption] : [privateOption]
          setSpaces(allOptions)
          setSpacesLoaded(true)
        }
      }
    } catch (error) {
      const loadElapsed = performance.now() - loadStartTime
      logError('SpaceChooser', `[DIAG] loadSpaces ERROR: elapsed=${loadElapsed.toFixed(2)}ms, error="${error.message}"`)
      // Still set Private option even on error (and All if enabled)
      if (isMounted) {
        const privateOption: SpaceOption = {
          id: '',
          title: 'Private',
          isPrivate: true,
        }
        const allOption: SpaceOption = {
          id: '__all__',
          title: 'All Private + Spaces',
          isPrivate: false,
        }
        const allOptions = includeAllOptionRef.current ? [allOption, privateOption] : [privateOption]
        setSpaces(allOptions)
        setSpacesLoaded(true) // Set to true to prevent infinite retries on error
      }
    } finally {
      if (isMounted) {
        setIsLoading(false)
        isLoadingRef.current = false
      }
    }
  }

  // Load spaces on mount
  // Delay the request to yield to TOC rendering and other critical UI elements
  // This prevents blocking the initial render with data loading
  useEffect(() => {
    if (!spacesLoaded && !isLoadingRef.current && requestFromPluginRef.current) {
      // Use setTimeout to delay the request, allowing TOC and other UI to render first
      const timeoutId = setTimeout(() => {
        loadSpaces()
      }, 200) // 200ms delay to yield to TOC rendering

      return () => {
        // Cleanup: clear timeout and mark as not loading if component unmounts
        clearTimeout(timeoutId)
        isLoadingRef.current = false
      }
    }

    return () => {
      // Cleanup: mark as not loading if component unmounts
      isLoadingRef.current = false
    }
    // Only depend on spacesLoaded, not requestFromPlugin to avoid infinite loops
    // includeAllOption changes are handled by the separate useEffect above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spacesLoaded])

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
      if (space.id === '__all__') {
        return 'All Private notes and all Teamspaces'
      }
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
      if (space.id === '__all__') {
        return 'layer-group' // Icon representing "all" or multiple layers
      }
      return space.isPrivate ? 'user' : 'cube'
    },
    getOptionColor: (space: SpaceOption) => {
      if (space.id === '__all__') {
        return undefined // Use default color for "All" option
      }
      return space.isPrivate ? undefined : TEAMSPACE_ICON_COLOR
    },
    getOptionShortDescription: (space: SpaceOption) => {
      if (space.id === '__all__') {
        return 'All Private notes and Teamspaces'
      }
      return space.isPrivate ? 'Your private notes' : 'Teamspace'
    },
    shortDescriptionOnLine2,
  }

  // Find the current space to get its display title
  const currentSpace = spaces.find((s) => s.id === value) || (value === '' ? spaces.find((s) => s.isPrivate) : null)
  const displayValue = currentSpace ? currentSpace.title : value === '__all__' ? 'All Private + Spaces' : value || 'Private'

  return (
    <SearchableChooser
      label={label}
      value={displayValue}
      disabled={disabled}
      compactDisplay={compactDisplay}
      placeholder={placeholder}
      showValue={showValue}
      width={width}
      config={config}
      isLoading={isLoading}
    />
  )
}

export default SpaceChooser
