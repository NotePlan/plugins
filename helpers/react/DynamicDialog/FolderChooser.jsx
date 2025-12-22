// @flow
//--------------------------------------------------------------------------
// FolderChooser Component
// Allows users to select a folder by typing to filter choices
// Supports all chooseFolder options: includeArchive, includeNewFolderOption, startFolder, includeFolderPath, excludeTeamspaces
//--------------------------------------------------------------------------

import React, { useState, useMemo } from 'react'
import SearchableChooser, { type ChooserConfig } from './SearchableChooser'
import { truncatePath } from '@helpers/react/reactUtils.js'
import { logDebug, logError } from '@helpers/react/reactDev.js'
import { getFolderDecorationFromPath } from '@helpers/userInput.js'
import { parseTeamspaceFilename } from '@helpers/teamspace.js'
import { RE_UUID } from '@helpers/regex.js'
import './FolderChooser.css'

export type FolderChooserProps = {
  label?: string,
  value?: string,
  folders: Array<string>, // Array of folder paths (base list, will be filtered)
  onChange: (folder: string) => void,
  disabled?: boolean,
  compactDisplay?: boolean,
  placeholder?: string,
  // Advanced options
  includeArchive?: boolean,
  includeNewFolderOption?: boolean,
  startFolder?: string,
  includeFolderPath?: boolean,
  excludeTeamspaces?: boolean,
  requestFromPlugin?: (command: string, dataToSend?: any, timeout?: number) => Promise<any>,
  showValue?: boolean, // If true, display the selected value below the input
  onFoldersChanged?: () => void, // Callback to request folder list reload after creating a folder
}

/**
 * FolderChooser Component
 * A searchable dropdown for selecting folders with support for creating new folders
 * @param {FolderChooserProps} props
 * @returns {React$Node}
 */
export function FolderChooser({
  label,
  value = '',
  folders = [],
  onChange,
  disabled = false,
  compactDisplay = false,
  placeholder = 'Type to search folders...',
  includeArchive = false,
  includeNewFolderOption = false,
  startFolder,
  includeFolderPath = true,
  excludeTeamspaces = false,
  requestFromPlugin,
  showValue = false,
  onFoldersChanged,
}: FolderChooserProps): React$Node {
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [parentFolder, setParentFolder] = useState('')
  const [createInParent, setCreateInParent] = useState(false)
  const [teamspaces, setTeamspaces] = useState<Array<{ id: string, title: string }>>([])
  const [teamspacesLoaded, setTeamspacesLoaded] = useState<boolean>(false)
  const [closeDropdown, setCloseDropdown] = useState<boolean>(false)

  // Load teamspaces if needed for decoration
  const loadTeamspaces = async () => {
    if (teamspacesLoaded || !requestFromPlugin) return

    const loadStartTime = performance.now()
    try {
      logDebug('FolderChooser', `[DIAG] loadTeamspaces START: folders.length=${folders.length}`)
      // Note: requestFromPlugin resolves with just the data when success=true, or rejects with error when success=false
      const teamspacesData = await requestFromPlugin('getTeamspaces', {})
      const loadElapsed = performance.now() - loadStartTime
      logDebug('FolderChooser', `[DIAG] loadTeamspaces COMPLETE: elapsed=${loadElapsed.toFixed(2)}ms`)

      if (Array.isArray(teamspacesData)) {
        setTeamspaces(teamspacesData)
        setTeamspacesLoaded(true)
        logDebug('FolderChooser', `Loaded ${teamspacesData.length} teamspaces`)
        if (teamspacesData.length > 0) {
          logDebug(
            'FolderChooser',
            `Teamspaces:`,
            teamspacesData.map((ts) => ({ id: ts.id, title: ts.title })),
          )
        }
      } else {
        logError('FolderChooser', `[DIAG] loadTeamspaces: Invalid response format, got:`, typeof teamspacesData, teamspacesData)
        setTeamspacesLoaded(true) // Set to true to prevent infinite retries
      }
    } catch (error) {
      const loadElapsed = performance.now() - loadStartTime
      logError('FolderChooser', `[DIAG] loadTeamspaces ERROR: elapsed=${loadElapsed.toFixed(2)}ms, error="${error.message}"`)
      setTeamspacesLoaded(true) // Set to true to prevent infinite retries on error
    }
  }

  // Load teamspaces on mount if we have folders that might be teamspaces
  React.useEffect(() => {
    const effectStartTime = performance.now()
    logDebug(
      'FolderChooser',
      `[DIAG] useEffect START: folders.length=${folders.length}, teamspacesLoaded=${String(teamspacesLoaded)}, requestFromPlugin=${String(!!requestFromPlugin)}`,
    )

    if (folders.length > 0 && !teamspacesLoaded && requestFromPlugin) {
      // Use requestAnimationFrame to yield before making the request
      requestAnimationFrame(() => {
        const effectElapsed = performance.now() - effectStartTime
        logDebug('FolderChooser', `[DIAG] useEffect AFTER RAF: elapsed=${effectElapsed.toFixed(2)}ms, calling loadTeamspaces`)
        loadTeamspaces()
      })
    } else {
      const effectElapsed = performance.now() - effectStartTime
      logDebug('FolderChooser', `[DIAG] useEffect SKIP: elapsed=${effectElapsed.toFixed(2)}ms, condition not met`)
    }
  }, [folders.length, teamspacesLoaded, requestFromPlugin])

  // Filter folders based on options
  const filteredFolders = useMemo(() => {
    let filtered = [...folders]

    // Filter by startFolder if specified
    // Note: teamspace folders (starting with %%NotePlanCloud%%) are not filtered by startFolder
    if (startFolder) {
      filtered = filtered.filter((folder) => {
        // Always include teamspace folders (they have their own structure)
        if (folder.startsWith('%%NotePlanCloud%%')) {
          return true
        }
        // For regular folders, check if they match startFolder
        return folder === startFolder || folder.startsWith(`${startFolder}/`)
      })
    }

    // Exclude Archive if not included
    if (!includeArchive) {
      filtered = filtered.filter((folder) => !folder.startsWith('@Archive'))
    }

    // Exclude Teamspaces if requested
    if (excludeTeamspaces) {
      filtered = filtered.filter((folder) => !folder.startsWith('%%NotePlanCloud%%'))
    }

    // Always include root folder
    if (!filtered.includes('/')) {
      filtered.unshift('/')
    }

    return filtered
  }, [folders, startFolder, includeArchive, excludeTeamspaces])

  // Handle creating a new folder
  const handleCreateFolder = async (folderName: string, parentFolderPath: string = '') => {
    if (!requestFromPlugin || !folderName || !folderName.trim()) {
      logError('FolderChooser', 'Cannot create folder: missing name or requestFromPlugin')
      return
    }

    try {
      setIsCreatingFolder(true)
      logDebug('FolderChooser', `Creating folder "${folderName}" in "${parentFolderPath || '/'}"`)

      const fullPath = parentFolderPath === '/' || parentFolderPath === '' ? folderName : `${parentFolderPath}/${folderName}`

      // requestFromPlugin resolves with just the data (folder path) on success, or rejects on error
      const createdFolder = await requestFromPlugin('createFolder', {
        folderPath: fullPath,
      })

      if (createdFolder && typeof createdFolder === 'string') {
        logDebug('FolderChooser', `Successfully created folder: "${createdFolder}"`)

        // Close the dialog and clear form
        setShowCreateDialog(false)
        setNewFolderName('')
        setParentFolder('')
        setCreateInParent(false)

        // Request folder list reload so the new folder appears
        if (onFoldersChanged) {
          onFoldersChanged()
        }

        // Close the dropdown and select the newly created folder
        setCloseDropdown(true) // Trigger dropdown close
        // Use setTimeout to ensure folders are reloaded first, then select the folder
        setTimeout(() => {
          onChange(createdFolder)
          // Reset closeDropdown after a brief delay to allow the dropdown to close
          setTimeout(() => {
            setCloseDropdown(false)
          }, 200)
        }, 100)
      } else {
        logError('FolderChooser', `Failed to create folder: Invalid response format`)
        alert(`Failed to create folder: Invalid response format`)
      }
    } catch (error) {
      logError('FolderChooser', `Error creating folder: ${error.message}`)
      alert(`Error creating folder: ${error.message}`)
    } finally {
      setIsCreatingFolder(false)
    }
  }

  // Handle selecting "New Folder" option
  const handleNewFolderClick = () => {
    setShowCreateDialog(true)
    setNewFolderName('')
    setParentFolder('')
    setCreateInParent(false)
  }

  // Handle creating folder in a selected parent (like Option-click)
  const handleCreateInFolder = (parentFolderPath: string) => {
    setShowCreateDialog(true)
    setNewFolderName('')
    setParentFolder(parentFolderPath)
    setCreateInParent(true)
  }

  // Format folder display based on includeFolderPath option
  // For teamspace folders, strip the %%NotePlanCloud%% prefix and show the folder path after the teamspace ID
  // This matches the behavior of createFolderRepresentation in userInput.js
  // Also filters out UUIDs (GUIDs) from the path to avoid showing them
  const formatFolderDisplay = (folder: string): string => {
    // Handle teamspace folders - strip the %%NotePlanCloud%% prefix
    if (folder.startsWith('%%NotePlanCloud%%')) {
      const teamspaceDetails = parseTeamspaceFilename(folder)
      if (teamspaceDetails.filepath === '/') {
        // Teamspace root folder - show as '/'
        return '/'
      } else {
        // Teamspace subfolder - filter out UUIDs from the filepath and show the clean path
        let cleanPath = teamspaceDetails.filepath
        // Filter out any UUID parts from the path (they might be in the middle or end)
        const pathParts = cleanPath.split('/').filter(Boolean)
        const filteredParts = pathParts.filter((part) => !RE_UUID.test(part))
        cleanPath = filteredParts.length > 0 ? filteredParts.join(' / ') : '/'

        if (includeFolderPath) {
          return cleanPath
        } else {
          // Show just the last part of the path
          return filteredParts.length > 0 ? filteredParts[filteredParts.length - 1] : '/'
        }
      }
    }

    // Regular folder handling
    if (includeFolderPath || folder === '/') {
      return folder
    }
    // Show just the last part of the path
    const parts = folder.split('/').filter(Boolean)
    return parts.length > 0 ? parts[parts.length - 1] : '/'
  }

  // Format folder display for selected value - includes teamspace info or truncated path
  const formatFolderDisplayForSelected = (folder: string): string => {
    // Handle teamspace folders - include teamspace name
    if (folder.startsWith('%%NotePlanCloud%%')) {
      const teamspaceDetails = parseTeamspaceFilename(folder)
      const teamspace = teamspaces.find((ts) => ts.id === teamspaceDetails.teamspaceID)
      const teamspaceName = teamspace ? teamspace.title : 'Teamspace'

      if (teamspaceDetails.filepath === '/') {
        // Teamspace root folder
        return teamspaceName
      } else {
        // Teamspace subfolder - filter out UUIDs and show teamspace name + path
        let cleanPath = teamspaceDetails.filepath
        const pathParts = cleanPath.split('/').filter(Boolean)
        const filteredParts = pathParts.filter((part) => !RE_UUID.test(part))
        cleanPath = filteredParts.length > 0 ? filteredParts.join(' / ') : '/'

        // If path is long, truncate it but keep teamspace name
        if (cleanPath.length > 30) {
          const lastPart = filteredParts.length > 0 ? filteredParts[filteredParts.length - 1] : '/'
          return `${teamspaceName} / ... / ${lastPart}`
        } else {
          return `${teamspaceName} / ${cleanPath}`
        }
      }
    }

    // Regular folder handling - if path is long, truncate it
    if (folder === '/') {
      return '/'
    }
    const parts = folder.split('/').filter(Boolean)
    if (parts.length > 2 && folder.length > 40) {
      // Show first part + ... + last part for long paths
      return `${parts[0]} / ... / ${parts[parts.length - 1]}`
    }
    // Show full path if not too long, or just last part if includeFolderPath is false
    if (includeFolderPath) {
      return folder
    }
    return parts.length > 0 ? parts[parts.length - 1] : '/'
  }

  // Prepare folder list with "New Folder" option if needed
  const folderListWithNewOption = useMemo(() => {
    const list = [...filteredFolders]
    if (includeNewFolderOption) {
      // Add "New Folder" option at the beginning
      list.unshift('__NEW_FOLDER__')
    }
    return list
  }, [filteredFolders, includeNewFolderOption])

  // Configure the SearchableChooser
  const config: ChooserConfig = {
    items: folderListWithNewOption,
    filterFn: (item: string, searchTerm: string) => {
      if (item === '__NEW_FOLDER__') {
        return 'new folder'.includes(searchTerm.toLowerCase())
      }
      const displayFolder = formatFolderDisplay(item)
      return displayFolder.toLowerCase().includes(searchTerm.toLowerCase())
    },
    getDisplayValue: (item: string) => {
      if (item === '__NEW_FOLDER__') {
        return '➕ New Folder'
      }
      // Use formatFolderDisplayForSelected for selected values to show more context
      return formatFolderDisplayForSelected(item)
    },
    getOptionText: (item: string) => {
      if (item === '__NEW_FOLDER__') {
        return '➕ New Folder'
      }
      return formatFolderDisplay(item)
    },
    getOptionTitle: (item: string) => {
      if (item === '__NEW_FOLDER__') {
        return 'Create a new folder'
      }
      return item // Full path as tooltip
    },
    truncateDisplay: truncatePath,
    onSelect: (item: string) => {
      if (item === '__NEW_FOLDER__') {
        handleNewFolderClick()
      } else {
        logDebug('FolderChooser', `Selected folder: ${item}`)
        onChange(item)
      }
    },
    emptyMessageNoItems: 'No folders available',
    emptyMessageNoMatch: 'No folders match',
    classNamePrefix: 'folder-chooser',
    iconClass: 'fa-folder',
    fieldType: 'folder-chooser',
    debugLogging: true,
    maxResults: 25,
    inputMaxLength: 100,
    dropdownMaxLength: 80,
    // Add Option-click support for creating subfolders
    onOptionClick: includeNewFolderOption
      ? (item: string) => {
          if (item !== '__NEW_FOLDER__') {
            handleCreateInFolder(item)
          }
        }
      : undefined,
    optionClickHint: includeNewFolderOption ? 'Create subfolder' : undefined,
    optionClickIcon: 'plus',
    // Folder decoration functions - use shared helper from @helpers/userInput.js
    getOptionIcon: (item: string) => {
      if (item === '__NEW_FOLDER__') return 'folder-plus'
      const decoration = getFolderDecorationFromPath(item, includeFolderPath, teamspaces)
      if (item.startsWith('%%NotePlanCloud%%') && teamspaces.length > 0) {
        logDebug('FolderChooser', `getOptionIcon for teamspace folder "${item}": icon=${decoration.icon}, teamspaces.length=${teamspaces.length}`)
      }
      return decoration.icon
    },
    getOptionColor: (item: string) => {
      if (item === '__NEW_FOLDER__') return 'orange-500'
      const decoration = getFolderDecorationFromPath(item, includeFolderPath, teamspaces)
      if (item.startsWith('%%NotePlanCloud%%') && teamspaces.length > 0) {
        logDebug('FolderChooser', `getOptionColor for teamspace folder "${item}": color=${decoration.color}, teamspaces.length=${teamspaces.length}`)
      }
      return decoration.color
    },
    getOptionShortDescription: (item: string) => {
      if (item === '__NEW_FOLDER__') return 'Add new'
      const decoration = getFolderDecorationFromPath(item, includeFolderPath, teamspaces)
      if (item.startsWith('%%NotePlanCloud%%') && teamspaces.length > 0) {
        logDebug(
          'FolderChooser',
          `getOptionShortDescription for teamspace folder "${item}": shortDesc=${decoration.shortDescription || 'null'}, teamspaces.length=${teamspaces.length}`,
        )
      }
      return decoration.shortDescription || undefined
    },
  }

  return (
    <>
      <SearchableChooser label={label} value={value} disabled={disabled} compactDisplay={compactDisplay} placeholder={placeholder} showValue={showValue} config={config} closeDropdown={closeDropdown} />
      {includeNewFolderOption && (
        <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', fontStyle: 'italic' }}>
          Click &quot;New Folder&quot; to create a folder. Hold Option (⌥) and click on any folder to create a subfolder inside it.
        </div>
      )}

      {/* Create Folder Dialog */}
      {showCreateDialog && (
        <div
          className="folder-chooser-create-dialog-overlay"
          onClick={() => {
            if (!isCreatingFolder) {
              setShowCreateDialog(false)
            }
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
        >
          <div
            className="folder-chooser-create-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              minWidth: '400px',
              maxWidth: '90vw',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>{createInParent ? `Create New Folder in "${formatFolderDisplay(parentFolder)}"` : 'Create New Folder'}</h3>
            {createInParent && (
              <div style={{ marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                <strong>Parent folder:</strong> {formatFolderDisplay(parentFolder)}
              </div>
            )}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Folder Name:</label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
                disabled={isCreatingFolder}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFolderName.trim() && !isCreatingFolder) {
                    handleCreateFolder(newFolderName.trim(), parentFolder)
                  } else if (e.key === 'Escape') {
                    setShowCreateDialog(false)
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="PCButton cancel-button"
                onClick={() => {
                  if (!isCreatingFolder) {
                    setShowCreateDialog(false)
                  }
                }}
                disabled={isCreatingFolder}
              >
                Cancel
              </button>
              <button
                type="button"
                className="PCButton save-button"
                onClick={() => handleCreateFolder(newFolderName.trim(), parentFolder)}
                disabled={!newFolderName.trim() || isCreatingFolder}
              >
                {isCreatingFolder ? 'Creating...' : 'Create Folder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default FolderChooser
