// ConsoleLogView.jsx
// @flow

import React, { useState, useRef, useEffect } from 'react'

type LogEntry = {
  message: string,
  timestamp: Date,
}

type Filter = {
  filterName: string,
  filterFunction: (log: LogEntry) => boolean,
}

type Props = {
  logs: Array<LogEntry>,
  filter?: Filter,
  initialFilter?: string,
  initialSearch?: string,
  onClearLogs: () => void,
  onShowAllLogs: () => void,
}

/**
 * ConsoleLogView component displays console logs with filtering, searching, and auto-scrolling capabilities.
 *
 * @param {Props} props - The props for the component.
 * @returns {React.Node} The rendered ConsoleLogView component.
 */
const ConsoleLogView = ({ logs = [], filter, initialFilter = '', initialSearch = '', onClearLogs, onShowAllLogs }: Props): React.Node => {
  const [filterText, setFilterText] = useState(initialFilter)
  const [searchText, setSearchText] = useState(initialSearch)
  const [useRegexFilter, setUseRegexFilter] = useState(false)
  const [useRegexSearch, setUseRegexSearch] = useState(false)
  const [filteredLogs, setFilteredLogs] = useState<Array<LogEntry>>([])
  const [searchIndex, setSearchIndex] = useState(-1)
  const [autoScroll, setAutoScroll] = useState(true)
  const logContainerRef = useRef<?HTMLDivElement>(null)
  const searchInputRef = useRef<?HTMLInputElement>(null)
  const filterInputRef = useRef<?HTMLInputElement>(null)

  // Update filtered logs when logs, filterText, or filterFunction change
  useEffect(() => {
    let newFilteredLogs = logs
    if (filter?.filterFunction) {
      newFilteredLogs = newFilteredLogs.filter(filter.filterFunction)
    }
    if (filterText) {
      try {
        const regex = useRegexFilter ? new RegExp(filterText, 'i') : null
        newFilteredLogs = newFilteredLogs.filter((log) => (regex ? regex.test(log.message) : log.message.toLowerCase().includes(filterText.toLowerCase())))
      } catch (e) {
        // Invalid regex, ignore filter
      }
    }
    setFilteredLogs(newFilteredLogs)
    setSearchIndex(-1) // Reset search index when filter changes
  }, [filterText, useRegexFilter, logs, filter])

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll) {
      const container = logContainerRef.current
      if (container) {
        container.scrollTop = container.scrollHeight
      }
    }
  }, [filteredLogs, autoScroll])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault()
        if (e.shiftKey) {
          findPrevious()
        } else {
          findNext()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchText, filteredLogs, searchIndex])

  // Scroll to the searched line
  useEffect(() => {
    if (searchIndex >= 0 && searchIndex < filteredLogs.length) {
      const container = logContainerRef.current
      const lineElement = container?.children[searchIndex]
      if (lineElement instanceof HTMLElement) {
        lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [searchIndex])

  const findNext = () => {
    if (!searchText) return
    let index = searchIndex
    const total = filteredLogs.length
    for (let i = 1; i <= total; i++) {
      const nextIndex = (index + i) % total
      if (matchesSearch(filteredLogs[nextIndex].message)) {
        setSearchIndex(nextIndex)
        return
      }
    }
  }

  const findPrevious = () => {
    if (!searchText) return
    let index = searchIndex
    const total = filteredLogs.length
    for (let i = 1; i <= total; i++) {
      const prevIndex = (index - i + total) % total
      if (matchesSearch(filteredLogs[prevIndex].message)) {
        setSearchIndex(prevIndex)
        return
      }
    }
  }

  const matchesSearch = (line: string): boolean => {
    try {
      const regex = useRegexSearch ? new RegExp(searchText, 'i') : null
      return regex ? regex.test(line) : line.toLowerCase().includes(searchText.toLowerCase())
    } catch (e) {
      return false
    }
  }

  const handleFilterChange = (e: SyntheticInputEvent<HTMLInputElement>) => {
    setFilterText(e.target.value)
  }

  const handleSearchChange = (e: SyntheticInputEvent<HTMLInputElement>) => {
    setSearchText(e.target.value)
    setSearchIndex(-1)
  }

  const highlightMatch = (line: string): string => {
    if (!searchText) return line
    try {
      const regex = new RegExp(searchText, 'gi')
      return line.replace(regex, (match) => `<mark>${match}</mark>`)
    } catch (e) {
      return line
    }
  }

  const clearFilters = () => {
    setFilterText('')
    setSearchText('')
    setSearchIndex(-1)
  }

  const toggleButtonStyle = (isActive: boolean) => ({
    backgroundColor: isActive ? '#007bff' : 'unset',
    color: isActive ? '#fff' : '#000',
    border: '1px solid #ccc',
    padding: '2px 5px',
    cursor: 'pointer',
    marginRight: '5px',
    borderRadius: '3px',
  })

  const getClassNameFromMessage = (message: string): string => {
    const firstWord = message.split(' ')[0]
    // Ensure the class name is CSS legal by replacing non-alphanumeric characters with underscores
    return firstWord.replace(/[^a-zA-Z0-9_-]/g, '_')
  }

  return (
    <div style={{ fontFamily: 'monospace', fontSize: '11pt', width: '100%' }}>
      {/* Top Row: Filter and Search */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
        {/* Filter */}
        <div style={{ marginRight: '20px', display: 'flex', alignItems: 'center' }}>
          <label style={{ marginRight: '5px' }}>Filter:</label>
          <input ref={filterInputRef} type="text" value={filterText} onChange={handleFilterChange} placeholder="Filter logs" style={{ marginRight: '5px' }} />
          <button onClick={() => setUseRegexFilter(!useRegexFilter)} style={toggleButtonStyle(useRegexFilter)}>
            .*
          </button>
        </div>
        {/* Search */}
        <div style={{ marginRight: '20px', display: 'flex', alignItems: 'center' }}>
          <label style={{ marginRight: '5px' }}>Search:</label>
          <input ref={searchInputRef} type="text" value={searchText} onChange={handleSearchChange} placeholder="Search logs" style={{ marginRight: '5px' }} />
          <button onClick={() => setUseRegexSearch(!useRegexSearch)} style={toggleButtonStyle(useRegexSearch)}>
            .*
          </button>
        </div>
        {/* Scroll Display */}
        <div style={{ marginRight: '20px' }}>
          <label>
            <input type="checkbox" checked={autoScroll} onChange={() => setAutoScroll(!autoScroll)} style={{ marginRight: '5px' }} />
            Auto-scroll
          </label>
        </div>
        {/* Show All Logs Button */}
        <button onClick={onShowAllLogs} style={{ marginLeft: 'auto' }}>
          Clear Filters
        </button>
        {/* Clear Logs Button */}
        <button onClick={onClearLogs} style={{ marginLeft: '10px' }}>
          Clear Logs
        </button>
      </div>

      {/* Filtered Test Indicator */}
      {filter?.filterName && (
        <div style={{ marginBottom: '5px', color: '#007bff' }}>
          Filtered to show test: <strong>{filter.filterName}</strong>
        </div>
      )}

      {/* Log Output */}
      <div
        ref={logContainerRef}
        style={{
          maxHeight: '90vh',
          overflowY: 'auto',
          width: '100%',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          border: '1px solid #ccc',
        }}
      >
        {filteredLogs.map((log, index) => {
          const line = log.message
          const isMatch = matchesSearch(line)
          const isSelected = index === searchIndex
          const className = getClassNameFromMessage(line)
          return (
            <div
              key={index}
              className={className}
              style={{
                backgroundColor: isSelected ? '#ffff99' : index % 2 === 0 ? '#ffffff' : '#f9f9f9',
                padding: '2px 5px',
              }}
            >
              {isMatch ? <span dangerouslySetInnerHTML={{ __html: highlightMatch(line) }}></span> : line}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ConsoleLogView
