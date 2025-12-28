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
import './FavoritesView.css'

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

  // Request function
  const requestFromPlugin = useCallback((command: string, dataToSend: any = {}, timeout: number = 10000): Promise<any> => {
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
  }, [dispatch])

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

  // Handle item click
  const handleItemClick = useCallback((item: FavoriteNote | FavoriteCommand, event: MouseEvent) => {
    const isOptionClick = event.altKey || event.metaKey === false && event.ctrlKey // Alt key (option on Mac)
    const isCmdClick = event.metaKey || event.ctrlKey // Cmd key (meta on Mac, ctrl on Windows)

    if (showNotes) {
      // $FlowFixMe[incompatible-cast] - item is FavoriteNote when showNotes is true
      const note: FavoriteNote = (item: any)
      // Send action to plugin to open note
      dispatch('SEND_TO_PLUGIN', [
        'openNote',
        {
          filename: note.filename,
          newWindow: isCmdClick, // Cmd-click opens in floating window
          splitView: isOptionClick, // Option-click opens in split view
        },
      ], 'FavoritesView: openNote')
    } else {
      // $FlowFixMe[incompatible-cast] - item is FavoriteCommand when showNotes is false
      const command: FavoriteCommand = (item: any)
      // Send action to plugin to run command
      dispatch('SEND_TO_PLUGIN', [
        'runCommand',
        {
          jsFunction: command.jsFunction,
          data: command.data,
        },
      ], 'FavoritesView: runCommand')
    }
  }, [showNotes, dispatch])

  // Get current items based on view type
  const currentItems = useMemo(() => {
    return showNotes ? favoriteNotes : favoriteCommands
  }, [showNotes, favoriteNotes, favoriteCommands])

  // Render note item
  const renderNoteItem = useCallback((item: any, index: number): Node => {
    // $FlowFixMe[incompatible-cast] - item is FavoriteNote when showNotes is true
    const note: FavoriteNote = item
    const folder = note.folder || ''
    const folderDisplay = folder && folder !== '/' ? `${folder} / ` : ''
    const displayTitle = note.title || note.filename || 'Untitled'
    
    // Always show an icon - use note icon if provided, otherwise use default
    const icon = note.icon || defaultNoteIconDetails.icon
    const color = note.color || defaultNoteIconDetails.color

    return (
      <div className="favorites-item-note">
        <i className={`fa ${icon} favorites-item-icon`} style={{ color: color }} />
        <div className="favorites-item-content">
          <div className="favorites-item-title">{displayTitle}</div>
          {folder && folder !== '/' && (
            <div className="favorites-item-folder">{folderDisplay}</div>
          )}
        </div>
      </div>
    )
  }, [])

  // Render command item
  const renderCommandItem = useCallback((item: any, index: number): Node => {
    // $FlowFixMe[incompatible-cast] - item is FavoriteCommand when showNotes is false
    const command: FavoriteCommand = item
    return (
      <div className="favorites-item-command">
        <i className="fa fa-terminal favorites-item-icon" />
        <div className="favorites-item-content">
          <div className="favorites-item-title">{command.name}</div>
          {command.description && (
            <div className="favorites-item-description">{command.description}</div>
          )}
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
  const getItemLabel = useCallback((item: any): string => {
    if (showNotes) {
      // $FlowFixMe[incompatible-cast] - item is FavoriteNote when showNotes is true
      const note: FavoriteNote = item
      return note.title || note.filename || ''
    } else {
      // $FlowFixMe[incompatible-cast] - item is FavoriteCommand when showNotes is false
      const command: FavoriteCommand = item
      return command.name || ''
    }
  }, [showNotes])

  // Handle toggle change
  const handleToggleChange = useCallback((newShowNotes: boolean) => {
    setShowNotes(newShowNotes)
    setReactSettings((prev: any) => ({ ...prev, showNotes: newShowNotes }))
    setFilterText('') // Clear filter when switching
    setSelectedIndex(null) // Reset selection
  }, [setReactSettings])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
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
      const item = currentItems[selectedIndex]
      if (item) {
        handleItemClick(item, (event: any))
      }
    }
  }, [currentItems, selectedIndex, handleItemClick])

  // Handle filter input keydown
  const handleFilterKeyDown = useCallback((e: any) => { // SyntheticKeyboardEvent<HTMLInputElement>
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
  }, [currentItems.length, handleKeyDown])

  const listRef = useRef<?HTMLDivElement>(null)

  return (
    <div className="favorites-view-container">
      {/* Header - only show if floating window */}
      {pluginData?.showFloating && (
        <div className="favorites-view-window-header">
          <h1 className="favorites-view-title">Favorites</h1>
        </div>
      )}
      <div className="favorites-view-header">
        <div className="favorites-view-toggle">
          <label className="favorites-toggle-label">
            <input
              type="radio"
              name="favorites-view-type"
              checked={showNotes}
              onChange={() => handleToggleChange(true)}
            />
            <span>Favorite Notes</span>
          </label>
          <label className="favorites-toggle-label">
            <input
              type="radio"
              name="favorites-view-type"
              checked={!showNotes}
              onChange={() => handleToggleChange(false)}
            />
            <span>Favorite Commands</span>
          </label>
        </div>
      </div>
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
      />
    </div>
  )
}

/**
 * Root FavoritesView Component with AppProvider
 */
export function FavoritesView({
  data,
  dispatch,
  reactSettings,
  setReactSettings,
  onSubmitOrCancelCallFunctionNamed,
}: FavoritesViewProps): Node {
  // Map to store pending requests
  const pendingRequestsRef = useRef<Map<string, { resolve: (data: any) => void, reject: (error: Error) => void, timeoutId: any }>>(new Map())

  const { pluginData } = data
  const windowIdRef = useRef<?string>(pluginData?.windowId || 'favorites-browser-window')

  useEffect(() => {
    windowIdRef.current = pluginData?.windowId || 'favorites-browser-window'
  }, [pluginData?.windowId])

  // Request function for AppContext
  const requestFromPlugin = useCallback((command: string, dataToSend: any = {}, timeout: number = 10000): Promise<any> => {
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
  }, [dispatch])

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

  const sendActionToPlugin = useCallback((command: string, dataToSend: any) => {
    dispatch('SEND_TO_PLUGIN', [command, dataToSend], `FavoritesView: sendActionToPlugin: ${String(command)}`)
  }, [dispatch])

  const sendToPlugin = useCallback((command: string, dataToSend: any) => {
    dispatch('SEND_TO_PLUGIN', [command, dataToSend], `FavoritesView: sendToPlugin: ${String(command)}`)
  }, [dispatch])

  const updatePluginData = useCallback((newData: any, messageForLog?: string) => {
    const newFullData = { ...data, pluginData: newData }
    dispatch('UPDATE_DATA', newFullData, messageForLog)
  }, [data, dispatch])

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

