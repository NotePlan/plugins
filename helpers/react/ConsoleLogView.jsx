// ConsoleLogView.jsx
// @flow

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import CollapsibleObjectViewer from '@helpers/react/CollapsibleObjectViewer'
import { dtl } from '@helpers/dev'
import './ConsoleLogView.css'

type LogEntry = {
  message: string,
  timestamp: Date,
  data?: any,
  type: string,
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
  showLogTimestamps?: boolean,
}

/**
 * Returns the CSS class for log messages based on their type and content.
 *
 * @param {string} type - The type of the log message.
 * @param {string} message - The log message.
 * @param {boolean} isSelected - Whether the log message is selected.
 * @param {number} index - The index of the log message for striped backgrounds.
 * @returns {string} The CSS class for the log message.
 */
const getLogClassName = (type: string, message: string, isSelected: boolean, index: number): string => {
  if (isSelected) return 'log-selected'
  if (message.startsWith('===')) return 'log-highlighted'
  if (message.startsWith('!!!')) return 'log-error'
  if (message.startsWith('>>>')) return 'log-info'
  if (message.startsWith('---')) return 'log-aquamarine'
  if (message.startsWith('___')) return 'log-orange'
  if (message.startsWith('~~~')) return 'log-thistle'
  return index % 2 === 0 ? 'log-stripe-even' : 'log-stripe-odd'
}

/**
 * LogData component renders the data items for a log entry.
 *
 * @param {Object} props - The props for the component.
 * @returns {React.Node} The rendered LogData component.
 */
type LogDataProps = {
  data: any,
  uniqueKey: string,
}

const LogData = ({ data, uniqueKey }: { data: any, uniqueKey: string }) => {
  if (Array.isArray(data)) {
    return (
      <div id={`data-container-${uniqueKey}`} className="data-container">
        {data.map((item, idx) => {
          let itemName = 'Object'
          let itemData = item

          const keys = Object.keys(item)
          if (Array.isArray(item)) {
            itemName = 'Array'
          } else if (typeof item === 'object' && item !== null) {
            if (keys.length === 1) {
              itemName = keys[0]
              itemData = item[itemName]
            } else if (keys.length === 0) {
              itemName = '(Empty Object)'
            }
          }

          return keys.length ? (
            <div key={`data-${uniqueKey}-${idx}`} className="data-item">
              <CollapsibleObjectViewer startExpanded={false} sortKeys={true} data={itemData} name={itemName} />
            </div>
          ) : (
            <div key={`data-${uniqueKey}-${idx}`} className="data-item">
              {itemName}
            </div>
          )
        })}
      </div>
    )
  }

  return null
}

const LogLine = ({ message, data, uniqueKey }: { message: string, data: any, uniqueKey: string }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const toggleExpansion = () => setIsExpanded((prev) => !prev)

  return (
    <div id={`log-${uniqueKey}`} className={`log-line ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="log-message">
        {message}
        {data && (
          <span className="log-object-toggle" onClick={toggleExpansion}>
            {isExpanded ? '▼' : '▶'} Object
          </span>
        )}
      </div>
      {isExpanded && data && <LogData data={data} uniqueKey={uniqueKey} />}
    </div>
  )
}

/**
 * ConsoleLogView component displays console logs with filtering, searching, and auto-scrolling capabilities.
 *
 * @param {Props} props - The props for the component.
 * @returns {React.Node} The rendered ConsoleLogView component.
 */
const ConsoleLogView = ({ logs = [], filter, initialFilter = '', initialSearch = '', onClearLogs, onShowAllLogs, showLogTimestamps = false }: Props): React.Node => {
  const [filterText, setFilterText] = useState(initialFilter)
  const [searchText, setSearchText] = useState(initialSearch)
  const [useRegexFilter, setUseRegexFilter] = useState(false)
  const [useRegexSearch, setUseRegexSearch] = useState(false)
  const [searchIndex, setSearchIndex] = useState(-1)
  const [autoScroll, setAutoScroll] = useState(false)
  const logContainerRef = useRef<?HTMLDivElement>(null)
  const searchInputRef = useRef<?HTMLInputElement>(null)
  const filterInputRef = useRef<?HTMLInputElement>(null)
  const [activeLogFilter, setActiveLogFilter] = useState<?string>(null)
  const [currentFilter, setCurrentFilter] = useState<?string>(null)
  const [searchMatches, setSearchMatches] = useState<Array<number>>([])
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(-1)

  const highlightSearchTerm = (text: string, searchTerm: string): React.Node => {
    if (!searchTerm) return text

    const regex = useRegexSearch ? new RegExp(searchTerm, 'gi') : new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    const parts = text.split(regex)
    const matches = text.match(regex)

    return parts.reduce((acc: Array<React.Node>, part: string, index: number) => {
      if (index < parts.length - 1) {
        acc.push(
          part,
          <span key={index} className="highlight">
            {matches ? matches[index] : ''}
          </span>,
        )
      } else {
        acc.push(part)
      }
      return acc
    }, [])
  }

  // Memoize filtered logs
  const filteredLogs = useMemo(() => {
    let newFilteredLogs = logs
    if (filter?.filterFunction) {
      newFilteredLogs = newFilteredLogs.filter(filter.filterFunction)
    }
    if (filterText) {
      try {
        const regex = useRegexFilter ? new RegExp(filterText, 'i') : null
        newFilteredLogs = newFilteredLogs.filter((log) => (regex ? regex.test(log.message) : log.message.toLowerCase().includes(filterText.toLowerCase())))
      } catch (e) {
        console.error('Invalid regex:', e)
      }
    }
    return newFilteredLogs
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

  const handleFilterChange = useCallback((e: SyntheticInputEvent<HTMLInputElement>) => {
    setFilterText(e.target.value)
  }, [])

  const handleSearchChange = useCallback(
    (e: SyntheticInputEvent<HTMLInputElement>) => {
      const searchValue = e.target.value
      setSearchText(searchValue)
      setSearchIndex(-1)
      const matches = filteredLogs.reduce((acc, log, index) => {
        const regex = useRegexSearch ? new RegExp(searchValue, 'i') : null
        if (regex ? regex.test(log.message) : log.message.toLowerCase().includes(searchValue.toLowerCase())) {
          acc.push(index)
        }
        return acc
      }, [])
      setSearchMatches(matches)
      setCurrentMatchIndex(matches.length > 0 ? 0 : -1)
    },
    [filteredLogs, useRegexSearch],
  )

  const navigateSearchMatches = (direction: 'next' | 'prev') => {
    if (searchMatches.length === 0) return
    setCurrentMatchIndex((prevIndex) => {
      const newIndex = direction === 'next' ? prevIndex + 1 : prevIndex - 1
      const wrappedIndex = (newIndex + searchMatches.length) % searchMatches.length
      const logElement = document.getElementById(`log-${filteredLogs[searchMatches[wrappedIndex]].timestamp.toISOString()}`)
      if (logElement) {
        logElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return wrappedIndex
    })
  }

  const clearFilters = useCallback(() => {
    setFilterText('')
    setSearchText('')
    setSearchIndex(-1)
    setUseRegexFilter(false)
    setUseRegexSearch(false)
    onShowAllLogs()
  }, [onShowAllLogs])

  const handleSearchKeyPress = useCallback(
    (e: SyntheticKeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const index = filteredLogs.findIndex((log) => {
          const regex = useRegexSearch ? new RegExp(searchText, 'i') : null
          return regex ? regex.test(log.message) : log.message.toLowerCase().includes(searchText.toLowerCase())
        })
        setSearchIndex(index)
        if (index !== -1 && logContainerRef.current) {
          const logElement = document.getElementById(`log-${filteredLogs[index].timestamp.toISOString()}`)
          if (logElement) {
            logElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }
      }
    },
    [filteredLogs, searchText, useRegexSearch],
  )

  // Attach the keypress event to the search input
  useEffect(() => {
    const searchInput = searchInputRef.current
    if (searchInput) {
      searchInput.addEventListener('keydown', handleSearchKeyPress)
    }
    return () => {
      if (searchInput) {
        searchInput.removeEventListener('keydown', handleSearchKeyPress)
      }
    }
  }, [handleSearchKeyPress])

  const showTestLogs = (testName: string) => {
    const testResult = results[testName]
    if (testResult?.startTime && testResult?.endTime) {
      console.log(`Filtering logs for test: ${testName}`)
      setCurrentFilter(`Showing logs for test: ${testName}`)
      onTestLogsFiltered({
        filterName: testName,
        filterFunction: (log) => {
          if (testResult.startTime && testResult.endTime && log.timestamp) {
            return log.timestamp >= testResult.startTime && log.timestamp <= testResult.endTime
          }
          return false
        },
      })
    }
  }

  const clearLogFilter = () => {
    setCurrentFilter(null)
    onShowAllLogs()
  }

  const getTimeDiv = (time: Date, text: string = ''): React.Node => {
    const dtlTime = dtl(time)
    // dtlTime looks like 2024-11-20 17:29:35.148
    const noMs = dtlTime.split('.')
    // reduce redundancy if this is a logdebug that already shows the time
    const secs = text.includes(noMs[0]) ? noMs[1] : dtlTime.split(':')[2]
    return (
      <span title={dtlTime} className="log-timestamp">
        {secs}
      </span>
    )
  }

  // Memoize rendered log entries
  const renderedLogs = useMemo(() => {
    return filteredLogs.map((log, index) => {
      const uniqueKey = log.timestamp.toISOString()
      const isSelected = searchMatches.includes(index) && index === searchMatches[currentMatchIndex]
      const logClassName = getLogClassName(log.type, log.message, isSelected, index)

      return (
        <div key={`${index}-${uniqueKey}`} id={`log-${uniqueKey}`} className={logClassName}>
          {showLogTimestamps && log.timestamp && getTimeDiv(log.timestamp, log.message)}
          {highlightSearchTerm(log.message, searchText)}
          {log.data && <LogData data={log.data} uniqueKey={uniqueKey} />}
        </div>
      )
    })
  }, [filteredLogs, searchText, searchMatches, currentMatchIndex])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (e.metaKey && e.key === 'g') {
        e.preventDefault()
        navigateSearchMatches('next')
      } else if (e.metaKey && e.shiftKey && e.key === 'G') {
        e.preventDefault()
        navigateSearchMatches('prev')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [navigateSearchMatches])

  return (
    <div className="console-log-view inner-panel-padding">
      {/* Top Row: Filter and Search */}
      <div className="controls">
        <div className="control-group">
          <label>Filter:</label>
          <input ref={filterInputRef} type="text" value={filterText} onChange={handleFilterChange} placeholder="Filter logs" />
          <button onClick={() => setUseRegexFilter(!useRegexFilter)} className={useRegexFilter ? 'active' : ''}>
            .*
          </button>
        </div>
        <div className="control-group">
          <label>Search:</label>
          <input ref={searchInputRef} type="text" value={searchText} onChange={handleSearchChange} placeholder="Search logs" />
          <button onClick={() => setUseRegexSearch(!useRegexSearch)} className={useRegexSearch ? 'active' : ''}>
            .*
          </button>
          <button onClick={() => navigateSearchMatches('prev')}>Prev</button>
          <button onClick={() => navigateSearchMatches('next')}>Next</button>
        </div>
        <div className="button-group">
          <button onClick={clearFilters}>Clear Filters</button>
          <button onClick={onClearLogs}>Clear Logs</button>
          {currentFilter && <button onClick={clearLogFilter}>Show All Logs</button>}
        </div>
      </div>

      {/* Filter Message */}
      {currentFilter && (
        <div className="filter-message" style={{ marginBottom: '10px', fontWeight: 'bold' }}>
          {currentFilter}
        </div>
      )}

      {/* Log Output */}
      <div ref={logContainerRef} className="log-container">
        {renderedLogs}
      </div>
    </div>
  )
}

export default ConsoleLogView
