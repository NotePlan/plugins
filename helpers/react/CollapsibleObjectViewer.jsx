// CollapsibleObjectViewer.jsx
// @flow

import React, { useState, useEffect, useMemo, useRef } from 'react'
import isEqual from 'lodash/isEqual'
import './CollapsibleObjectViewer.css'

type Props = {
  data: any,
  name?: string,
  startExpanded?: boolean,
  defaultExpandedKeys?: Array<string>,
  highlightRegex?: string,
  expandToShowHighlight?: boolean,
  filter?: boolean,
  onReset?: (reset: () => void) => void,
}

type CollapsedPaths = {
  [string]: boolean,
}

type HighlightedPaths = {
  [string]: boolean,
}

type TooltipState = {
  visible: boolean,
  content: string,
}

// Define isObject helper function
const isObject = (obj: any): boolean %checks => obj !== null && typeof obj === 'object'

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
): React.Node {
  if (!isObject(obj)) {
    const isHighlighted = highlightedPaths[path]
    const isChanged = changedPaths[path]
    if (filter && !isHighlighted) return null

    return (
      <div className={`property-${path.replace(/:/g, '-')} ${isChanged ? 'changed' : ''}`} key={path}>
        <div className="value">{JSON.stringify(obj)}</div>
      </div>
    )
  }

  // Determine if the object is an array
  const isArray = Array.isArray(obj)
  const sortedKeys = isArray
    ? Object.keys(obj).sort((a, b) => Number(a) - Number(b)) // Sort numerically if it's an array
    : Object.keys(obj).sort() // Sort alphabetically if it's an object

  return sortedKeys.map((key) => {
    const value = obj[key]
    const isExpandable = isObject(value)
    const currentPath = `${path}:${key}`
    const isCollapsed = !openedPathsRef.current[currentPath]
    const isHighlighted = highlightedPaths[currentPath]
    const isChanged = changedPaths[currentPath]

    // Ensure that paths leading to a match are shown
    if (filter && !isHighlighted) return null

    return (
      <div
        key={currentPath}
        className={`property ${classReplacer(currentPath)} ${isHighlighted ? 'highlighted' : ''}`}
        style={{
          marginLeft: 10,
        }}
      >
        {isExpandable ? (
          <div className="expandable">
            <div className="toggle" onClick={(e) => toggleCollapse(currentPath, e)} style={{ cursor: 'pointer' }}>
              {isCollapsed ? '▶' : '▼'} <strong>{key}</strong>
            </div>
            {!isCollapsed && renderObject(value, currentPath, highlightedPaths, changedPaths, filter, openedPathsRef, toggleCollapse)}
          </div>
        ) : (
          <div className={`property-line ${classReplacer(currentPath)} ${isChanged ? 'changed' : isHighlighted ? 'highlighted' : ''}`}>
            <strong>{key}: </strong>
            <span className="value">{JSON.stringify(value)}</span>
          </div>
        )}
      </div>
    )
  })
}

const CollapsibleObjectViewer = ({
  data,
  name = 'Context Variables',
  startExpanded = false,
  defaultExpandedKeys = [],
  highlightRegex = '',
  expandToShowHighlight = false,
  filter = false,
  onReset = () => {},
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

  // Initialize opened paths only once
  useEffect(() => {
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
  }, [data, name, startExpanded, defaultExpandedKeys])

  // Update highlighted paths when highlightRegex changes
  useEffect(() => {
    const newHighlightedPaths: HighlightedPaths = {}

    const trimmedRegex = highlightRegex.trim()
    if (trimmedRegex === '') {
      setHighlightedPaths({})
      return
    }

    const regex = new RegExp(trimmedRegex, 'i')
    const isPathSearch = trimmedRegex.includes(':')

    const checkMatches = (obj: any, path: string) => {
      if (!obj || typeof obj !== 'object') return
      Object.keys(obj).forEach((key) => {
        const currentPath = `${path}:${key}`
        const value = obj[key]

        const pathMatch = isPathSearch && regex.test(currentPath)
        const keyOrValueMatch = !isPathSearch && (regex.test(key) || regex.test(String(value)))

        if (pathMatch || keyOrValueMatch) {
          newHighlightedPaths[currentPath] = true

          // Ensure all parent paths are highlighted
          let pathParts = currentPath.split(':')
          while (pathParts.length > 0) {
            const partialPath = pathParts.join(':')
            newHighlightedPaths[partialPath] = true
            pathParts.pop()
          }

          if (expandToShowHighlight) {
            pathParts = currentPath.split(':')
            while (pathParts.length > 0) {
              const partialPath = pathParts.join(':')
              openedPathsRef.current[partialPath] = true
              pathParts.pop()
            }
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
  }, [memoizedData, name, highlightRegex, expandToShowHighlight, filter])

  // Handle tooltip visibility based on keyboard events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isMouseOver) {
        if (event.altKey) {
          setTooltip({ visible: true, content: 'Option key: Expand/collapse first-level children' })
        } else if (event.metaKey) {
          setTooltip({ visible: true, content: 'Command key: Expand/collapse entire hierarchy' })
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
  }, [isMouseOver])

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

  return (
    <div className="collapsible-object-viewer" onMouseEnter={() => setIsMouseOver(true)} onMouseLeave={() => setIsMouseOver(false)} style={{ position: 'relative' }}>
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
      {!rootIsCollapsed && <div style={{ marginLeft: 15 }}>{renderObject(memoizedData, name, highlightedPaths, changedPaths, filter, openedPathsRef, toggleCollapse)}</div>}
    </div>
  )
}

export default (CollapsibleObjectViewer: React.AbstractComponent<Props>)
