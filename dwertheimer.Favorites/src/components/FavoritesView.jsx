// @flow
//--------------------------------------------------------------------------
// FavoritesView Component
// Browse and open favorite notes and commands
//--------------------------------------------------------------------------

import React, { useState, useEffect, useRef, useCallback, useMemo, type Node } from 'react'
import { AppProvider, useAppContext } from './AppContext.jsx'
import { FilterableList } from '@helpers/react/FilterableList'
import { type ListItemAction } from '@helpers/react/List'
import { logDebug, logError } from '@helpers/react/reactDev.js'
import { defaultNoteIconDetails } from '@helpers/NPnote.js'
import DynamicDialog from '@helpers/react/DynamicDialog/DynamicDialog'
import { type TSettingItem } from '@helpers/react/DynamicDialog/DynamicDialog'
import { type NoteOption } from '@helpers/react/DynamicDialog/NoteChooser'
import { waitForCondition } from '@helpers/promisePolyfill'
import { InfoIcon } from '@helpers/react/InfoIcon'
import IdleTimer from '@helpers/react/IdleTimer'
import './FavoritesView.css'

// Idle timeout: reset to notes view and focus filter after 1 minute of inactivity
const IDLE_TIMEOUT_MS = 60000 // 1 minute

type FavoriteNote = {
  filename: string,
  title: string,
  type: string,
  frontmatterAttributes?: Object,
  icon?: string,
  color?: string,
  folder?: string,
}

type FavoriteCommand = {
  name: string,
  description?: string,
  jsFunction: string,
  data?: string,
}

type FavoritesViewProps = {
  data: any,
  dispatch: Function,
  reactSettings: any,
  setReactSettings: Function,
  onSubmitOrCancelCallFunctionNamed: string,
}

/**
 * FavoritesView Component
 * @param {FavoritesViewProps} props
 * @returns {React$Node}
 */
function FavoritesViewComponent({
  data,
  dispatch,
  reactSettings,
  setReactSettings,
  onSubmitOrCancelCallFunctionNamed: _onSubmitOrCancelCallFunctionNamed,
}: FavoritesViewProps): Node {
  const { pluginData } = data

  // Map to store pending requests for request/response pattern
  const pendingRequestsRef = useRef<Map<string, { resolve: (data: any) => void, reject: (error: Error) => void, timeoutId: any }>>(new Map())

  // Store windowId in a ref
  const windowIdRef = useRef<?string>(pluginData?.windowId || 'favorites-browser-window')

  // Update windowId ref when pluginData changes
  useEffect(() => {
    windowIdRef.current = pluginData?.windowId || 'favorites-browser-window'
  }, [pluginData?.windowId])

  // State
  const [favoriteNotes, setFavoriteNotes] = useState<Array<FavoriteNote>>([])
  const [favoriteCommands, setFavoriteCommands] = useState<Array<FavoriteCommand>>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [filterText, setFilterText] = useState<string>('')
  const [selectedIndex, setSelectedIndex] = useState<?number>(null)
  const [showNotes, setShowNotes] = useState<boolean>(reactSettings?.showNotes !== false) // Default to notes
  const [projectNotes, setProjectNotes] = useState<Array<NoteOption>>([])
  const [presetCommands, setPresetCommands] = useState<Array<{ label: string, value: string }>>([])
  const [showAddNoteDialog, setShowAddNoteDialog] = useState<boolean>(false)
  const [showAddCommandDialog, setShowAddCommandDialog] = useState<boolean>(false)
  const [addNoteDialogData, setAddNoteDialogData] = useState<{ [key: string]: any }>({})
  const [addCommandDialogData, setAddCommandDialogData] = useState<{ [key: string]: any }>({})
  const [newlyAddedFilename, setNewlyAddedFilename] = useState<?string>(null) // Track newly added item for highlighting
  const listRef = useRef<?HTMLElement>(null) // Ref for scrolling to items
  const filterInputRef = useRef<?HTMLInputElement>(null) // Ref for the filter input field

  // Request function
  const requestFromPlugin = useCallback(
    (command: string, dataToSend: any = {}, timeout: number = 10000): Promise<any> => {
      if (!command) throw new Error('requestFromPlugin: command must be called with a string')

      const correlationId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      logDebug('FavoritesView', `requestFromPlugin: command="${command}", correlationId="${correlationId}"`)

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          const pending = pendingRequestsRef.current.get(correlationId)
          if (pending) {
            pendingRequestsRef.current.delete(correlationId)
            logDebug('FavoritesView', `requestFromPlugin TIMEOUT: command="${command}", correlationId="${correlationId}"`)
            reject(new Error(`Request timeout: ${command}`))
          }
        }, timeout)

        pendingRequestsRef.current.set(correlationId, { resolve, reject, timeoutId })

        const requestData = {
          ...dataToSend,
          __correlationId: correlationId,
          __requestType: 'REQUEST',
          __windowId: windowIdRef.current || '',
        }

        dispatch('SEND_TO_PLUGIN', [command, requestData], `FavoritesView: requestFromPlugin: ${String(command)}`)
      })
        .then((result) => {
          logDebug('FavoritesView', `requestFromPlugin RESOLVED: command="${command}", correlationId="${correlationId}"`)
          return result
        })
        .catch((error) => {
          logError('FavoritesView', `requestFromPlugin REJECTED: command="${command}", correlationId="${correlationId}", error="${error.message}"`)
          throw error
        })
    },
    [dispatch],
  )

  // Listen for RESPONSE messages
  useEffect(() => {
    const handleResponse = (event: MessageEvent) => {
      const { data: eventData } = event
      if (eventData && typeof eventData === 'object' && eventData.type === 'RESPONSE' && eventData.payload) {
        const payload = eventData.payload
        if (payload && typeof payload === 'object') {
          const correlationId = (payload: any).correlationId
          const success = (payload: any).success
          if (correlationId && typeof correlationId === 'string') {
            const { data: responseData, error } = (payload: any)
            const pending = pendingRequestsRef.current.get(correlationId)
            if (pending) {
              pendingRequestsRef.current.delete(correlationId)
              clearTimeout(pending.timeoutId)
              if (success) {
                pending.resolve(responseData)
              } else {
                pending.reject(new Error(error || 'Request failed'))
              }
            }
          }
        }
      }
    }

    window.addEventListener('message', handleResponse)
    return () => {
      window.removeEventListener('message', handleResponse)
      pendingRequestsRef.current.forEach((pending) => {
        clearTimeout(pending.timeoutId)
      })
      pendingRequestsRef.current.clear()
    }
  }, [])

  // Load favorite notes
  const loadFavoriteNotes = useCallback(async () => {
    try {
      setLoading(true)
      const notes = await requestFromPlugin('getFavoriteNotes')
      if (Array.isArray(notes)) {
        setFavoriteNotes(notes)
        logDebug('FavoritesView', `Loaded ${notes.length} favorite notes`)
      }
    } catch (error) {
      logError('FavoritesView', `Error loading favorite notes: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }, [requestFromPlugin])

  // Effect to scroll to and highlight newly added item
  useEffect(() => {
    if (newlyAddedFilename && favoriteNotes.length > 0 && listRef.current) {
      // Find the index of the newly added item
      const newIndex = favoriteNotes.findIndex((note) => note.filename === newlyAddedFilename)
      if (newIndex >= 0) {
        // Wait a bit for DOM to update, then scroll to the item
        setTimeout(() => {
          const item = listRef.current?.querySelector(`[data-index="${newIndex}"]`)
          if (item instanceof HTMLElement) {
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
            // Remove highlight after animation completes (2 seconds)
            setTimeout(() => {
              setNewlyAddedFilename(null)
            }, 2000)
          }
        }, 100)
      }
    }
  }, [newlyAddedFilename, favoriteNotes])

  // Load favorite commands
  const loadFavoriteCommands = useCallback(async () => {
    try {
      setLoading(true)
      const commands = await requestFromPlugin('getFavoriteCommands')
      if (Array.isArray(commands)) {
        setFavoriteCommands(commands)
        logDebug('FavoritesView', `Loaded ${commands.length} favorite commands`)
      }
    } catch (error) {
      logError('FavoritesView', `Error loading favorite commands: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }, [requestFromPlugin])

  // Load data when view type changes
  useEffect(() => {
    if (showNotes) {
      loadFavoriteNotes()
    } else {
      loadFavoriteCommands()
    }
  }, [showNotes, loadFavoriteNotes, loadFavoriteCommands])

  // Load project notes for NoteChooser
  const loadProjectNotes = useCallback(async () => {
    try {
      const notes = await requestFromPlugin('getProjectNotes')
      if (Array.isArray(notes)) {
        setProjectNotes(notes)
        logDebug('FavoritesView', `Loaded ${notes.length} project notes`)
      }
    } catch (error) {
      logError('FavoritesView', `Error loading project notes: ${error.message}`)
    }
  }, [requestFromPlugin])

  // Load preset commands for command dialog
  const loadPresetCommands = useCallback(async () => {
    try {
      const commands = await requestFromPlugin('getPresetCommands')
      if (Array.isArray(commands)) {
        setPresetCommands(commands)
        logDebug('FavoritesView', `Loaded ${commands.length} preset commands`)
      }
    } catch (error) {
      logError('FavoritesView', `Error loading preset commands: ${error.message}`)
    }
  }, [requestFromPlugin])

  // Handle adding favorite note dialog
  const handleAddNoteDialogSave = useCallback(
    async (updatedSettings: { [key: string]: any }) => {
      try {
        if (updatedSettings.note) {
          const filename = updatedSettings.note

          // Close dialog immediately
          setShowAddNoteDialog(false)
          setAddNoteDialogData({})

          // Add the favorite
          // Note: requestFromPlugin resolves with result.data (unwrapped), or rejects on error
          // If we get here without throwing, the request succeeded
          const response = await requestFromPlugin('addFavoriteNote', { filename })
          logDebug('FavoritesView', `addFavoriteNote response:`, response)

          // Show success toast
          dispatch('SHOW_TOAST', {
            type: 'SUCCESS',
            msg: 'Favorite note added successfully',
            timeout: 3000,
          })

          // Reload the favorites list first
          await loadFavoriteNotes()

          // Wait for the note to appear in the list by checking the actual list data
          // We need to reload and check, since state updates are async
          const found = await waitForCondition(
            async () => {
              // Reload notes to get fresh data, then check
              if (showNotes) {
                const notes = await requestFromPlugin('getFavoriteNotes')
                if (Array.isArray(notes)) {
                  return notes.some((note) => note.filename === filename)
                }
              }
              return false
            },
            { maxWaitMs: 3000, checkIntervalMs: 150 },
          )

          // Reload one more time to ensure UI is in sync
          await loadFavoriteNotes()

          // Set the newly added filename for highlighting (useEffect will handle scrolling)
          setNewlyAddedFilename(filename)

          if (found) {
            logDebug('FavoritesView', 'Successfully added favorite note and found it in list')
          } else {
            logError('FavoritesView', 'Added favorite note but could not find it in list after waiting')
          }
        }
      } catch (error) {
        logError('FavoritesView', `Error adding favorite note: ${error.message}`)
        dispatch('SHOW_TOAST', {
          type: 'ERROR',
          msg: `Error adding favorite: ${error.message}`,
          timeout: 3000,
        })
      }
    },
    [requestFromPlugin, loadFavoriteNotes, dispatch, showNotes, favoriteNotes],
  )

  const handleAddNoteDialogCancel = useCallback(() => {
    setShowAddNoteDialog(false)
    setAddNoteDialogData({})
  }, [])

  const handleAddFavoriteNote = useCallback(async () => {
    // Load notes if not already loaded
    if (projectNotes.length === 0) {
      await loadProjectNotes()
    }
    setShowAddNoteDialog(true)
  }, [projectNotes, loadProjectNotes])

  // Handle adding favorite command dialog
  const handleAddCommandDialogSave = useCallback(
    async (updatedSettings: { [key: string]: any }) => {
      try {
        if (updatedSettings.preset && updatedSettings.commandName && updatedSettings.url) {
          const response = await requestFromPlugin('addFavoriteCommand', {
            jsFunction: updatedSettings.preset,
            name: updatedSettings.commandName,
            data: updatedSettings.url,
          })
          if (response && response.success) {
            await loadFavoriteCommands()
            setShowAddCommandDialog(false)
            setAddCommandDialogData({})
            logDebug('FavoritesView', 'Successfully added favorite command')
          } else {
            logError('FavoritesView', `Failed to add favorite command: ${response?.message || 'Unknown error'}`)
          }
        }
      } catch (error) {
        logError('FavoritesView', `Error adding favorite command: ${error.message}`)
      }
    },
    [requestFromPlugin, loadFavoriteCommands],
  )

  const handleAddCommandDialogCancel = useCallback(() => {
    setShowAddCommandDialog(false)
    setAddCommandDialogData({})
  }, [])

  const handleAddCommandButtonClick = useCallback(
    async (key: string, value: string) => {
      if (key === 'getCallbackURL') {
        try {
          const urlResponse = await requestFromPlugin('getCallbackURL', {})
          if (urlResponse && urlResponse.success && urlResponse.url) {
            // Update the URL field in the dialog
            setAddCommandDialogData((prev) => ({ ...prev, url: urlResponse.url }))
            logDebug('FavoritesView', `Got URL from Link Creator: ${urlResponse.url}`)
          }
        } catch (error) {
          logError('FavoritesView', `Error getting callback URL: ${error.message}`)
        }
        return false // Don't close dialog
      }
    },
    [requestFromPlugin],
  )

  const handleAddFavoriteCommand = useCallback(async () => {
    // Load preset commands if not already loaded
    if (presetCommands.length === 0) {
      await loadPresetCommands()
    }

    if (presetCommands.length === 0) {
      logError('FavoritesView', 'No preset commands available')
      return
    }

    setShowAddCommandDialog(true)
  }, [presetCommands, loadPresetCommands])

  // Handle item click
  // Note: __windowId is automatically injected by Root.jsx sendToPlugin, so we don't need to add it here
  const handleItemClick = useCallback(
    (item: FavoriteNote | FavoriteCommand, event: MouseEvent) => {
      const isOptionClick = event.altKey || (event.metaKey === false && event.ctrlKey) // Alt key (option on Mac)
      const isCmdClick = event.metaKey || event.ctrlKey // Cmd key (meta on Mac, ctrl on Windows)

      if (showNotes) {
        // $FlowFixMe[incompatible-cast] - item is FavoriteNote when showNotes is true
        const note: FavoriteNote = (item: any)
        // Send action to plugin to open note
        dispatch(
          'SEND_TO_PLUGIN',
          [
            'openNote',
            {
              filename: note.filename,
              newWindow: isCmdClick, // Cmd-click opens in floating window
              splitView: isOptionClick, // Option-click opens in split view
            },
          ],
          'FavoritesView: openNote',
        )
      } else {
        // $FlowFixMe[incompatible-cast] - item is FavoriteCommand when showNotes is false
        const command: FavoriteCommand = (item: any)
        // Send action to plugin to run command
        dispatch(
          'SEND_TO_PLUGIN',
          [
            'runCommand',
            {
              jsFunction: command.jsFunction,
              data: command.data,
            },
          ],
          'FavoritesView: runCommand',
        )
      }
    },
    [showNotes, dispatch],
  )

  // Get current items based on view type
  const currentItems = useMemo(() => {
    return showNotes ? favoriteNotes : favoriteCommands
  }, [showNotes, favoriteNotes, favoriteCommands])

  // Handle removing favorite note
  const handleRemoveFavorite = useCallback(
    async (filename: string) => {
      try {
        await requestFromPlugin('removeFavoriteNote', { filename })
        // Show toast notification
        dispatch('SHOW_TOAST', {
          type: 'SUCCESS',
          msg: 'Favorite note removed',
          timeout: 2000,
        })
        // Reload the favorites list
        await loadFavoriteNotes()
      } catch (error) {
        logError('FavoritesView', `Error removing favorite note: ${error.message}`)
        dispatch('SHOW_TOAST', {
          type: 'ERROR',
          msg: `Error removing favorite: ${error.message}`,
          timeout: 3000,
        })
      }
    },
    [requestFromPlugin, loadFavoriteNotes, dispatch],
  )

  // Handle idle timeout: reset to notes view and focus filter
  const handleIdleTimeout = useCallback(() => {
    setShowNotes(true)
    setFilterText('')
    setSelectedIndex(null)
    // Scroll list to top and focus the filter input after a brief delay to ensure it's rendered
    setTimeout(() => {
      // Get toolbar height offset (same calculation as Toast.css: calc(1rem + var(--noteplan-toolbar-height, 0)))
      const root = document.documentElement
      if (!root) return

      const toolbarHeight = parseInt(getComputedStyle(root).getPropertyValue('--noteplan-toolbar-height') || '0', 10)
      const oneRem = parseFloat(getComputedStyle(root).fontSize || '16px')
      const scrollOffset = oneRem + toolbarHeight

      // Helper function to find scrollable ancestor
      const findScrollableAncestor = (el: HTMLElement): ?HTMLElement => {
        let parent: ?Element = el.parentElement
        while (parent) {
          if (parent instanceof HTMLElement) {
            const style = getComputedStyle(parent)
            if (style.overflow === 'auto' || style.overflow === 'scroll' || style.overflowY === 'auto' || style.overflowY === 'scroll') {
              return parent
            }
          }
          parent = parent.parentElement
        }
        return null
      }

      // Scroll list to top
      if (listRef.current) {
        const firstItem = listRef.current.querySelector('[data-index="0"]')
        if (firstItem instanceof HTMLElement) {
          // Use scrollIntoView with offset by scrolling the parent container
          const scrollableParent = findScrollableAncestor(firstItem)
          if (scrollableParent) {
            const itemRect = firstItem.getBoundingClientRect()
            const parentRect = scrollableParent.getBoundingClientRect()
            const currentScrollTop = scrollableParent.scrollTop
            const targetScrollTop = currentScrollTop + (itemRect.top - parentRect.top) - scrollOffset
            scrollableParent.scrollTop = Math.max(0, targetScrollTop)
          } else {
            firstItem.scrollIntoView({ block: 'start', behavior: 'instant' })
          }
        } else if (listRef.current instanceof HTMLElement) {
          // If no items, try scrolling the container itself with offset
          const scrollableParent = listRef.current.parentElement?.parentElement
          if (scrollableParent instanceof HTMLElement && scrollableParent.scrollTop !== undefined) {
            scrollableParent.scrollTop = scrollOffset
          }
        }
      }
      // Focus the filter input
      if (filterInputRef.current) {
        filterInputRef.current.focus()
      }
    }, 0)
  }, [])

  // Render note item
  const renderNoteItem = useCallback(
    (item: any, index: number): Node => {
      // $FlowFixMe[incompatible-cast] - item is FavoriteNote when showNotes is true
      const note: FavoriteNote = item
      const folder = note.folder || ''
      const folderDisplay = folder && folder !== '/' ? `${folder} / ` : ''
      const displayTitle = note.title || note.filename || 'Untitled'

      // Always show an icon - use note icon if provided, otherwise use default
      const icon = note.icon || defaultNoteIconDetails.icon
      const color = note.color || defaultNoteIconDetails.color
      const isNewlyAdded = newlyAddedFilename === note.filename

      return (
        <div className={`favorites-item-note ${isNewlyAdded ? 'favorites-item-newly-added' : ''}`}>
          <i className={`fa ${icon} favorites-item-icon`} style={{ color: color }} />
          <div className="favorites-item-content">
            <div className="favorites-item-title">{displayTitle}</div>
            {folder && folder !== '/' && <div className="favorites-item-folder">{folderDisplay}</div>}
          </div>
          <InfoIcon
            text="Remove from favorites"
            position="left"
            icon="fa-star"
            iconClassName="info-icon-outline-on-hover"
            showOnClick={false}
            showOnHover={true}
            showImmediately={false}
            className="favorites-unfavorite-icon"
            onClick={(e: MouseEvent) => {
              e.preventDefault()
              e.stopPropagation()
              handleRemoveFavorite(note.filename)
            }}
          />
        </div>
      )
    },
    [newlyAddedFilename, handleRemoveFavorite],
  )

  // Render command item
  const renderCommandItem = useCallback((item: any, index: number): Node => {
    // $FlowFixMe[incompatible-cast] - item is FavoriteCommand when showNotes is false
    const command: FavoriteCommand = item
    return (
      <div className="favorites-item-command">
        <i className="fa fa-terminal favorites-item-icon" />
        <div className="favorites-item-content">
          <div className="favorites-item-title">{command.name}</div>
          {command.description && <div className="favorites-item-description">{command.description}</div>}
        </div>
      </div>
    )
  }, [])

  // Filter function for notes
  const filterNote = useCallback((item: any, text: string): boolean => {
    if (!text) return true
    // $FlowFixMe[incompatible-cast] - item is FavoriteNote when showNotes is true
    const note: FavoriteNote = item
    const searchText = text.toLowerCase()
    const title = (note.title || '').toLowerCase()
    const folder = (note.folder || '').toLowerCase()
    return title.includes(searchText) || folder.includes(searchText)
  }, [])

  // Filter function for commands
  const filterCommand = useCallback((item: any, text: string): boolean => {
    if (!text) return true
    // $FlowFixMe[incompatible-cast] - item is FavoriteCommand when showNotes is false
    const command: FavoriteCommand = item
    const searchText = text.toLowerCase()
    const name = (command.name || '').toLowerCase()
    const description = (command.description || '').toLowerCase()
    return name.includes(searchText) || description.includes(searchText)
  }, [])

  // Get item label for filtering
  const getItemLabel = useCallback(
    (item: any): string => {
      if (showNotes) {
        // $FlowFixMe[incompatible-cast] - item is FavoriteNote when showNotes is true
        const note: FavoriteNote = item
        return note.title || note.filename || ''
      } else {
        // $FlowFixMe[incompatible-cast] - item is FavoriteCommand when showNotes is false
        const command: FavoriteCommand = item
        return command.name || ''
      }
    },
    [showNotes],
  )

  // Handle toggle change
  const handleToggleChange = useCallback(
    (newShowNotes: boolean) => {
      setShowNotes(newShowNotes)
      setReactSettings((prev: any) => ({ ...prev, showNotes: newShowNotes }))
      setFilterText('') // Clear filter when switching
      setSelectedIndex(null) // Reset selection
    },
    [setReactSettings],
  )

  // Handle keyboard navigation
  // Arrow keys only navigate (change selectedIndex) - they do NOT trigger actions
  // Click and Enter trigger actions (run command or open note)
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        // Arrow navigation only - no action triggered
        const newIndex = selectedIndex === null || selectedIndex === undefined ? 0 : selectedIndex + 1
        if (newIndex < currentItems.length) {
          setSelectedIndex(newIndex)
          // Scroll into view
          setTimeout(() => {
            if (listRef.current) {
              const item = listRef.current.querySelector(`[data-index="${newIndex}"]`)
              if (item instanceof HTMLElement) {
                item.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
                item.focus()
              }
            }
          }, 0)
        }
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        // Arrow navigation only - no action triggered
        if (selectedIndex !== null && selectedIndex !== undefined && selectedIndex > 0) {
          const newIndex = selectedIndex - 1
          setSelectedIndex(newIndex)
          // Scroll into view
          setTimeout(() => {
            if (listRef.current) {
              const item = listRef.current.querySelector(`[data-index="${newIndex}"]`)
              if (item instanceof HTMLElement) {
                item.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
                item.focus()
              }
            }
          }, 0)
        }
      } else if (event.key === 'Enter' && selectedIndex !== null && selectedIndex !== undefined && selectedIndex >= 0 && selectedIndex < currentItems.length) {
        event.preventDefault()
        // Enter key triggers the action (run command via x-callback URL or open note)
        const item = currentItems[selectedIndex]
        if (item) {
          handleItemClick(item, (event: any))
        }
      }
    },
    [currentItems, selectedIndex, handleItemClick],
  )

  // Handle filter input keydown
  const handleFilterKeyDown = useCallback(
    (e: any) => {
      // SyntheticKeyboardEvent<HTMLInputElement>
      if (e.key === 'ArrowDown' && currentItems.length > 0) {
        e.preventDefault()
        setSelectedIndex(0)
        // Focus the list with setTimeout to ensure DOM is updated
        setTimeout(() => {
          if (listRef.current) {
            const firstItem = listRef.current.querySelector('[data-index="0"]')
            if (firstItem instanceof HTMLElement) {
              firstItem.focus()
            }
          }
        }, 0)
      } else if (e.key === 'Tab' && !e.shiftKey && currentItems.length > 0) {
        e.preventDefault()
        setSelectedIndex(0)
        setTimeout(() => {
          if (listRef.current) {
            const firstItem = listRef.current.querySelector('[data-index="0"]')
            if (firstItem instanceof HTMLElement) {
              firstItem.focus()
            }
          }
        }, 0)
      } else {
        // Pass other keys to handleKeyDown
        handleKeyDown(e.nativeEvent)
      }
    },
    [currentItems.length, handleKeyDown],
  )

  return (
    <div className="favorites-view-container">
      {/* Header - only show if floating window */}
      {pluginData?.showFloating && (
        <div className="favorites-view-window-header">
          <h1 className="favorites-view-title">Favorites</h1>
        </div>
      )}
      <div className="favorites-view-header">
        <div className="favorites-view-header-controls">
          <div className="favorites-view-segmented-control">
            <button
              type="button"
              className={`favorites-segment-button ${showNotes ? 'favorites-segment-button-active' : ''}`}
              onClick={() => handleToggleChange(true)}
              aria-pressed={showNotes}
            >
              <i className="fa fa-file-alt favorites-segment-icon" />
              <span>Notes</span>
            </button>
            <button
              type="button"
              className={`favorites-segment-button ${!showNotes ? 'favorites-segment-button-active' : ''}`}
              onClick={() => handleToggleChange(false)}
              aria-pressed={!showNotes}
            >
              <i className="fa fa-slash-forward favorites-segment-icon" />
              <span>Commands</span>
            </button>
          </div>
          <button
            type="button"
            className="favorites-new-button"
            onClick={() => {
              if (showNotes) {
                handleAddFavoriteNote()
              } else {
                handleAddFavoriteCommand()
              }
            }}
            title={showNotes ? 'Add new favorite note' : 'Add new favorite command'}
          >
            <i className="fa fa-plus favorites-new-icon" />
            <span>New</span>
          </button>
        </div>
      </div>
      <IdleTimer idleTime={IDLE_TIMEOUT_MS} onIdleTimeout={handleIdleTimeout} />
      <FilterableList
        items={currentItems}
        displayType="noteplan-sidebar"
        renderItem={showNotes ? renderNoteItem : renderCommandItem}
        onItemClick={handleItemClick}
        selectedIndex={selectedIndex}
        emptyMessage={showNotes ? 'No favorite notes found' : 'No favorite commands found'}
        loading={loading}
        filterText={filterText}
        onFilterChange={setFilterText}
        filterPlaceholder={showNotes ? 'Filter notes...' : 'Filter commands...'}
        filterFunction={showNotes ? filterNote : filterCommand}
        getItemLabel={getItemLabel}
        onKeyDown={handleKeyDown}
        onFilterKeyDown={handleFilterKeyDown}
        listRef={listRef}
        filterInputRef={filterInputRef}
        optionKeyDecoration={showNotes ? { icon: 'fa-columns', text: 'Split View' } : undefined}
        commandKeyDecoration={showNotes ? { icon: 'fa-window-restore', text: 'Floating Window' } : undefined}
      />

      {/* Add Favorite Note Dialog */}
      <DynamicDialog
        isOpen={showAddNoteDialog}
        title="Add Favorite Note"
        className="favorites-note-dialog"
        items={[
          {
            type: 'note-chooser',
            key: 'note',
            label: 'Select a note to add as favorite',
            includeCalendarNotes: false,
            includePersonalNotes: true,
            includeRelativeNotes: false,
            includeTeamspaceNotes: true,
            required: true,
            shortDescriptionOnLine2: true,
            showTitleOnly: true,
          },
          {
            type: 'markdown-preview',
            key: 'notePreview',
            label: 'Note Preview',
            sourceNoteKey: 'note',
            compactDisplay: false,
          },
        ]}
        onSave={handleAddNoteDialogSave}
        onCancel={handleAddNoteDialogCancel}
        isModal={true}
        notes={projectNotes}
        requestFromPlugin={requestFromPlugin}
        onNotesChanged={() => {
          loadProjectNotes().catch((error) => {
            logError('FavoritesView', `Error reloading notes: ${error.message}`)
          })
        }}
      />

      {/* Add Favorite Command Dialog */}
      <DynamicDialog
        isOpen={showAddCommandDialog}
        title="Add Favorite Command"
        items={[
          {
            type: 'dropdown-select',
            key: 'preset',
            label: 'Choose a preset to set/reset',
            options: presetCommands.map((cmd) => ({ label: cmd.label, value: cmd.value, isDefault: false })),
            required: true,
          },
          {
            type: 'input',
            key: 'commandName',
            label: 'Command Name',
            description: 'What human-readable text do you want to use for the command? (this is the text you will see in the Command Bar when you type slash)',
            placeholder: 'Enter command name',
            required: true,
          },
          {
            type: 'input',
            key: 'url',
            label: 'X-Callback URL or Web URL',
            description: 'Enter the X-Callback URL or Web URL to run when this command is selected',
            placeholder: 'noteplan://x-callback-url/... or https://...',
            required: true,
            value: addCommandDialogData.url || '',
          },
          {
            type: 'button',
            key: 'getCallbackURL',
            label: 'Use Link Creator',
            buttonText: 'Get X-Callback URL from Link Creator',
          },
        ]}
        onSave={handleAddCommandDialogSave}
        onCancel={handleAddCommandDialogCancel}
        isModal={true}
        handleButtonClick={handleAddCommandButtonClick}
      />
    </div>
  )
}

/**
 * Root FavoritesView Component with AppProvider
 */
export function FavoritesView({ data, dispatch, reactSettings, setReactSettings, onSubmitOrCancelCallFunctionNamed }: FavoritesViewProps): Node {
  // Map to store pending requests
  const pendingRequestsRef = useRef<Map<string, { resolve: (data: any) => void, reject: (error: Error) => void, timeoutId: any }>>(new Map())

  const { pluginData } = data
  const windowIdRef = useRef<?string>(pluginData?.windowId || 'favorites-browser-window')

  useEffect(() => {
    windowIdRef.current = pluginData?.windowId || 'favorites-browser-window'
  }, [pluginData?.windowId])

  // Request function for AppContext
  const requestFromPlugin = useCallback(
    (command: string, dataToSend: any = {}, timeout: number = 10000): Promise<any> => {
      if (!command) throw new Error('requestFromPlugin: command must be called with a string')

      const correlationId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          const pending = pendingRequestsRef.current.get(correlationId)
          if (pending) {
            pendingRequestsRef.current.delete(correlationId)
            reject(new Error(`Request timeout: ${command}`))
          }
        }, timeout)

        pendingRequestsRef.current.set(correlationId, { resolve, reject, timeoutId })

        const requestData = {
          ...dataToSend,
          __correlationId: correlationId,
          __requestType: 'REQUEST',
          __windowId: windowIdRef.current || '',
        }

        dispatch('SEND_TO_PLUGIN', [command, requestData], `FavoritesView: requestFromPlugin: ${String(command)}`)
      })
    },
    [dispatch],
  )

  // Listen for RESPONSE messages
  useEffect(() => {
    const handleResponse = (event: MessageEvent) => {
      const { data: eventData } = event
      if (eventData && typeof eventData === 'object' && eventData.type === 'RESPONSE' && eventData.payload) {
        const payload = eventData.payload
        if (payload && typeof payload === 'object') {
          const correlationId = (payload: any).correlationId
          const success = (payload: any).success
          if (correlationId && typeof correlationId === 'string') {
            const { data: responseData, error } = (payload: any)
            const pending = pendingRequestsRef.current.get(correlationId)
            if (pending) {
              pendingRequestsRef.current.delete(correlationId)
              clearTimeout(pending.timeoutId)
              if (success) {
                pending.resolve(responseData)
              } else {
                pending.reject(new Error(error || 'Request failed'))
              }
            }
          }
        }
      }
    }

    window.addEventListener('message', handleResponse)
    return () => {
      window.removeEventListener('message', handleResponse)
      pendingRequestsRef.current.forEach((pending) => {
        clearTimeout(pending.timeoutId)
      })
      pendingRequestsRef.current.clear()
    }
  }, [])

  const sendActionToPlugin = useCallback(
    (command: string, dataToSend: any) => {
      dispatch('SEND_TO_PLUGIN', [command, dataToSend], `FavoritesView: sendActionToPlugin: ${String(command)}`)
    },
    [dispatch],
  )

  const sendToPlugin = useCallback(
    (command: string, dataToSend: any) => {
      dispatch('SEND_TO_PLUGIN', [command, dataToSend], `FavoritesView: sendToPlugin: ${String(command)}`)
    },
    [dispatch],
  )

  const updatePluginData = useCallback(
    (newData: any, messageForLog?: string) => {
      const newFullData = { ...data, pluginData: newData }
      dispatch('UPDATE_DATA', newFullData, messageForLog)
    },
    [data, dispatch],
  )

  return (
    <AppProvider
      sendActionToPlugin={sendActionToPlugin}
      sendToPlugin={sendToPlugin}
      requestFromPlugin={requestFromPlugin}
      dispatch={dispatch}
      pluginData={pluginData}
      updatePluginData={updatePluginData}
      reactSettings={reactSettings}
      setReactSettings={setReactSettings}
    >
      <FavoritesViewComponent
        data={data}
        dispatch={dispatch}
        reactSettings={reactSettings}
        setReactSettings={setReactSettings}
        onSubmitOrCancelCallFunctionNamed={onSubmitOrCancelCallFunctionNamed}
      />
    </AppProvider>
  )
}
