// CollapsibleObjectViewer.jsx
// @flow

import React, { useState, useEffect, useMemo, useRef } from 'react'
import isEqual from 'lodash/isEqual'
import './CollapsibleObjectViewer.css'
import type { Node } from 'react'

// Define a type for inline styles
type Style = {
  [key: string]: string | number,
}

type Props = {
  data: any,
  name?: string,
  startExpanded?: boolean,
  defaultExpandedKeys?: Array<string>,
  highlightRegex?: string,
  expandToShowHighlight?: boolean,
  filter?: boolean,
  useRegex?: boolean,
  onReset?: (reset: () => void) => void,
  sortKeys?: boolean,
  scroll?: boolean,
  style?: Style,
  onToggle?: (isExpanded: boolean) => void,
}

type CollapsedPaths = {
  [string]: boolean,
}

type HighlightedPaths = {
  [string]: 'match' | 'parent',
}

type TooltipState = {
  visible: boolean,
  content: string,
}

// Define isObject helper function
const isObject = (obj: any): boolean => obj !== null && typeof obj === 'object'

// Define classReplacer helper function
const classReplacer = (str: string): string =>
  str
    .replace(/[^a-zA-Z]/g, '')
    .replace(/ /g, '-')
    .replace(/:/g, ' ')

// Define renderObject function outside the component
function renderObject(
  obj: any,
  path: string,
  highlightedPaths: HighlightedPaths,
  changedPaths: HighlightedPaths,
  filter: boolean,
  openedPathsRef: { current: CollapsedPaths },
  toggleCollapse: (path: string, event: SyntheticMouseEvent<HTMLDivElement>) => void,
  parentMatches: boolean = false,
  highlightRegex: string = '',
  sortKeys?: boolean = true,
): React.Node {
  if (!isObject(obj)) {
    const highlightType = highlightedPaths[path]
    const isChanged = changedPaths[path]
    const isHighlighted = highlightType === 'match'
    const isParentHighlighted = highlightType === 'parent'
    const currentMatches = Boolean(highlightType)
    const isFilterActive = filter && highlightRegex.trim() !== ''

    if (isFilterActive && !currentMatches && !parentMatches) {
      return null
    }
    return (
      <div className={`property-${path.replace(/:/g, '-')}`} key={path} style={{ marginLeft: 10 }}>
        <div className={`property-line ${classReplacer(path)} ${isChanged ? 'changed' : isHighlighted ? 'highlighted' : isParentHighlighted ? 'parent-highlighted' : ''}`}>
          <strong>{path.split(':').pop()}: </strong>
          <span className="value">{JSON.stringify(obj)}</span>
        </div>
      </div>
    )
  }

  // Determine if the object is an array
  const isArray = Array.isArray(obj)
  const sortedKeys = isArray
    ? Object.keys(obj).sort((a, b) => Number(a) - Number(b)) // Sort numerically if it's an array
    : sortKeys
    ? Object.keys(obj).sort()
    : Object.keys(obj) // Sort alphabetically if it's an object

  // Check if the object or array is empty
  const isEmpty = sortedKeys.length === 0

  return (
    <div>
      {!isEmpty &&
        sortedKeys.map((key) => {
          const value = obj[key]
          const isExpandable = isObject(value) && Object.keys(value).length > 0
          const currentPath = `${path}:${key}`
          const isCollapsed = !openedPathsRef.current[currentPath]
          const highlightType = highlightedPaths[currentPath]
          const isHighlighted = highlightType === 'match'
          const isParentHighlighted = highlightType === 'parent'
          const isChanged = changedPaths[currentPath]

          if (filter && !highlightType) return null

          const classNames = ['property', classReplacer(currentPath), isChanged ? 'changed' : isHighlighted ? 'highlighted' : isParentHighlighted ? 'parent-highlighted' : '']
            .filter(Boolean)
            .join(' ')

          return (
            <div
              key={currentPath}
              className={classNames}
              style={{
                marginLeft: 10,
              }}
            >
              {isExpandable ? (
                <div className="expandable">
                  <div className="toggle" onClick={(e) => toggleCollapse(currentPath, e)} style={{ cursor: 'pointer' }}>
                    {isCollapsed ? '▶' : '▼'} <strong>{key}</strong>
                  </div>
                  {!isCollapsed &&
                    renderObject(value, currentPath, highlightedPaths, changedPaths, filter, openedPathsRef, toggleCollapse, parentMatches, highlightRegex, sortKeys)}
                </div>
              ) : (
                <div
                  className={`property-line ${classReplacer(currentPath)} ${
                    isChanged ? 'changed' : isHighlighted ? 'highlighted' : isParentHighlighted ? 'parent-highlighted' : ''
                  }`}
                >
                  <strong>{key}: </strong>
                  <span className="value">{JSON.stringify(value)}</span>
                </div>
              )}
            </div>
          )
        })}
    </div>
  )
}

const CollapsibleObjectViewer = ({
  data,
  name = 'Context Variables',
  startExpanded = false,
  defaultExpandedKeys = [],
  highlightRegex = '',
  expandToShowHighlight = false,
  filter = false,
  useRegex = false,
  onReset = () => {},
  sortKeys = true,
  scroll = false,
  style = {},
  onToggle,
}: Props): React.Node => {
  const openedPathsRef = useRef<CollapsedPaths>({})
  const [highlightedPaths, setHighlightedPaths] = useState<HighlightedPaths>({})
  const [changedPaths, setChangedPaths] = useState<HighlightedPaths>({})
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    content: '',
  })
  const [isMouseOver, setIsMouseOver] = useState<boolean>(false)
  const [, setRenderTrigger] = useState(0) // Dummy state to force re-render

  // Memoize data to prevent unnecessary re-renders
  const memoizedData = useMemo(() => data, [data])

  // Track previous data using useRef for comparison
  const prevDataRef = useRef<any>()

  // Initialize opened paths only once
  useEffect(() => {
    if (!isEqual(prevDataRef.current, data)) {
      prevDataRef.current = data
      const initializeOpenedPaths = (obj: any, path: string): CollapsedPaths => {
        let openedPaths: CollapsedPaths = {}
        const shouldExpand = startExpanded || defaultExpandedKeys.some((expandedKey) => expandedKey.startsWith(path))
        if (shouldExpand) {
          openedPaths[path] = true
        }

        if (!obj || typeof obj !== 'object') {
          return openedPaths
        }

        Object.keys(obj).forEach((key) => {
          const currentPath = `${path}:${key}`
          const nestedOpenedPaths = initializeOpenedPaths(obj[key], currentPath)
          openedPaths = {
            ...openedPaths,
            ...nestedOpenedPaths,
          }
        })

        return openedPaths
      }

      openedPathsRef.current = initializeOpenedPaths(data, name)
    }
  }, [data, name, startExpanded, defaultExpandedKeys])

  // Update highlighted paths when highlightRegex changes
  useEffect(() => {
    const newHighlightedPaths: HighlightedPaths = {}

    const trimmedRegex = highlightRegex.trim()
    if (trimmedRegex === '') {
      setHighlightedPaths({})
      return
    }

    try {
      const regex = useRegex ? new RegExp(trimmedRegex) : new RegExp(trimmedRegex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')

      const isPathSearch = trimmedRegex.includes(':')

      const checkMatches = (obj: any, path: string) => {
        if (!obj || typeof obj !== 'object') return
        Object.keys(obj).forEach((key) => {
          const currentPath = `${path}:${key}`
          const value = obj[key]

          const pathMatch = isPathSearch && regex.test(currentPath)
          const keyOrValueMatch = !isPathSearch && (regex.test(key) || regex.test(String(value)))

          if (pathMatch || keyOrValueMatch) {
            newHighlightedPaths[currentPath] = 'match'

            // Expand parent paths to show the highlighted item
            let pathParts = currentPath.split(':')
            pathParts.pop() // Remove the last part since currentPath is already highlighted
            while (pathParts.length > 0) {
              const partialPath = pathParts.join(':')
              // Only set as 'parent' if not already a 'match'
              if (newHighlightedPaths[partialPath] !== 'match') {
                newHighlightedPaths[partialPath] = 'parent'
              }
              if (expandToShowHighlight) {
                openedPathsRef.current[partialPath] = true
              }
              pathParts.pop()
            }
          }

          if (typeof value === 'object') {
            checkMatches(value, currentPath)
          }
        })
      }

      checkMatches(memoizedData, name)
      setHighlightedPaths(newHighlightedPaths)
      setRenderTrigger((prev) => prev + 1) // Trigger re-render
    } catch (error) {
      console.error('Invalid regex:', error)
      setHighlightedPaths({})
    }
  }, [memoizedData, name, highlightRegex, expandToShowHighlight, filter, useRegex])

  // Handle tooltip visibility based on keyboard events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isMouseOver) {
        if (event.altKey) {
          setTooltip({ visible: true, content: 'Option key: Expand/collapse first-level children' })
        } else if (event.metaKey) {
          setTooltip({ visible: true, content: 'Command key: Expand/collapse entire hierarchy' })
        } else {
          setTooltip({ visible: false, content: '' })
        }
      }
    }

    const handleKeyUp = () => {
      setTooltip({ visible: false, content: '' })
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const getObjectByPath = (obj: any, path: string): any => {
    return path
      .split(':')
      .slice(1)
      .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), obj)
  }

  const toggleCollapse = (path: string, event: SyntheticMouseEvent<HTMLDivElement>): void => {
    const isOptionClick = event.altKey
    const isMetaClick = event.metaKey

    // Toggle the current path
    openedPathsRef.current = {
      ...openedPathsRef.current,
      [path]: !openedPathsRef.current[path],
    }

    const toggleChildren = (obj: any, parentPath: string, toggleAll: boolean) => {
      if (!isObject(obj)) return

      Object.keys(obj).forEach((key) => {
        const currentPath = `${parentPath}:${key}`
        if (parentPath === path || toggleAll) {
          openedPathsRef.current[currentPath] = !openedPathsRef.current[currentPath]
        }

        if (toggleAll) {
          toggleChildren(obj[key], currentPath, toggleAll)
        }
      })
    }

    const targetObject = getObjectByPath(data, path)

    if (isOptionClick) {
      toggleChildren(targetObject, path, false)
    }

    if (isMetaClick) {
      toggleChildren(targetObject, path, true)
    }

    setRenderTrigger((prev) => prev + 1) // Force re-render
  }

  const rootIsCollapsed = !openedPathsRef.current[name]

  // Reset function to reset the opened paths
  const reset = () => {
    const initializeOpenedPaths = (obj: any, path: string): CollapsedPaths => {
      let openedPaths: CollapsedPaths = {}
      const shouldExpand = startExpanded || defaultExpandedKeys.some((expandedKey) => expandedKey.startsWith(path))
      if (shouldExpand) {
        openedPaths[path] = true
      }

      if (!obj || typeof obj !== 'object') {
        return openedPaths
      }

      Object.keys(obj).forEach((key) => {
        const currentPath = `${path}:${key}`
        const nestedOpenedPaths = initializeOpenedPaths(obj[key], currentPath)
        openedPaths = {
          ...openedPaths,
          ...nestedOpenedPaths,
        }
      })

      return openedPaths
    }

    openedPathsRef.current = initializeOpenedPaths(data, name)
    setRenderTrigger((prev) => prev + 1) // Force re-render
  }

  // Call the onReset function when the component mounts
  useEffect(() => {
    onReset(reset)
  }, [onReset, reset])

  const handleToggle = (isExpanded: boolean) => {
    if (onToggle) {
      onToggle(isExpanded)
    }
    // ... existing toggle logic ...
  }

  return (
    <div
      className="collapsible-object-viewer"
      onMouseEnter={() => {
        setIsMouseOver(true)
        setTooltip({ visible: false, content: '' })
      }}
      onMouseLeave={() => {
        setIsMouseOver(false)
        setTooltip({ visible: false, content: '' })
      }}
      style={{
        ...style,
        position: 'relative',
        overflowY: scroll ? 'auto' : 'visible',
        maxHeight: scroll ? '90vh' : 'unset',
      }}
    >
      {tooltip.visible && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            backgroundColor: 'lightgray',
            padding: '3px',
            borderRadius: '3px',
            fontSize: '12px',
            zIndex: 1000,
          }}
        >
          {tooltip.content}
        </div>
      )}
      <div onClick={(e) => toggleCollapse(name, e)} style={{ cursor: 'pointer', fontWeight: 'bold' }}>
        {rootIsCollapsed ? '▶' : '▼'} {name}
      </div>
      {!rootIsCollapsed && (
        <div style={{ marginLeft: 15 }}>
          {renderObject(memoizedData, name, highlightedPaths, changedPaths, filter, openedPathsRef, toggleCollapse, false, highlightRegex, sortKeys)}
        </div>
      )}
    </div>
  )
}

export default (CollapsibleObjectViewer: React.AbstractComponent<Props>)
