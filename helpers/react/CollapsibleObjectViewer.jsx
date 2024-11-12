// CollapsibleObjectViewer.jsx
// @flow

import React, { useState, useEffect, useMemo, useRef } from 'react'
import isEqual from 'lodash/isEqual'
import { compareObjects } from '@helpers/dev'
import './CollapsibleObjectViewer.css'

type Props = {
  data: any,
  name?: string,
  startExpanded?: boolean,
  defaultExpandedKeys?: Array<string>,
  highlightRegex?: string,
  expandToShowHighlight?: boolean,
  filter?: boolean,
  onReset: () => void,
}

type CollapsedPaths = {
  [string]: boolean,
}

type HighlightedPaths = {
  [string]: boolean,
}

const CollapsibleObjectViewer = ({
  data,
  name = 'Context Variables',
  startExpanded = false,
  defaultExpandedKeys = [],
  highlightRegex = '',
  expandToShowHighlight = false,
  filter = false,
  onReset,
}: Props): React.Node => {
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

  const [highlightedPaths, setHighlightedPaths] = useState<HighlightedPaths>({})
  const [changedPaths, setChangedPaths] = useState<HighlightedPaths>({})
  const [tooltip, setTooltip] = useState<{ visible: boolean, content: string }>({
    visible: false,
    content: '',
  })
  const [isMouseOver, setIsMouseOver] = useState<boolean>(false)
  const openedPathsRef = useRef<CollapsedPaths>(initializeOpenedPaths(data, name))

  // Memoize the data prop to prevent unnecessary re-renders
  const memoizedData = useMemo(() => data, [JSON.stringify(data)])

  useEffect(() => {
    const newHighlightedPaths: HighlightedPaths = {}
    const newChangedPaths: HighlightedPaths = {}

    const checkChanges = (obj: any, path: string) => {
      if (!obj || typeof obj !== 'object') return
      Object.keys(obj).forEach((key) => {
        const currentPath = `${path}:${key}`
        if (JSON.stringify(obj[key]) !== JSON.stringify(memoizedData[key]) && memoizedData[key] !== undefined) {
          newChangedPaths[currentPath] = true
          setTimeout(() => {
            setChangedPaths((prev) => {
              const updated = { ...prev }
              delete updated[currentPath]
              return updated
            })
          }, 1000) // 1 second highlight
        }
        if ((highlightRegex && new RegExp(highlightRegex.trim(), 'i').test(key)) || new RegExp(highlightRegex.trim(), 'i').test(JSON.stringify(obj[key]))) {
          newHighlightedPaths[currentPath] = true
          if (expandToShowHighlight) {
            let pathParts = currentPath.split(':')
            while (pathParts.length > 0) {
              const partialPath = pathParts.join(':')
              openedPathsRef.current[partialPath] = true
              pathParts.pop()
            }
          }
        }
        checkChanges(obj[key], currentPath)
      })
    }
    checkChanges(memoizedData, name)
    setHighlightedPaths(newHighlightedPaths)
    setChangedPaths(newChangedPaths)
  }, [memoizedData, name, highlightRegex, expandToShowHighlight])

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

  const isObject = (obj: any): boolean => obj && typeof obj === 'object'

  const getObjectByPath = (obj: any, path: string): any => {
    return path
      .split(':')
      .slice(1)
      .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), obj)
  }

  const toggleCollapse = (path: string, event: SyntheticMouseEvent<HTMLDivElement>): void => {
    console.log(`COV Toggling collapse for path: ${path}`)
    const isOptionClick = event.altKey
    const isMetaClick = event.metaKey

    // Toggle the current path
    openedPathsRef.current = {
      ...openedPathsRef.current,
      [path]: !openedPathsRef.current[path],
    }
    console.log(`COV New state after toggle: ${Object.keys(openedPathsRef.current).length} keys`)

    const toggleChildren = (obj: any, parentPath: string, toggleAll: boolean) => {
      if (!isObject(obj)) return

      console.log(`COV Toggling children for path: ${parentPath}`)
      Object.keys(obj).forEach((key) => {
        console.log(`COV Toggling child: ${key}`)
        const currentPath = `${parentPath}:${key}`
        if (parentPath === path || toggleAll) {
          openedPathsRef.current[currentPath] = true // for now trying not a toggle but a force open. was: !openedPathsRef.current[currentPath]
        }

        if (toggleAll) {
          toggleChildren(obj[key], currentPath, toggleAll)
        }
      })
    }

    const targetObject = getObjectByPath(data, path)

    if (isOptionClick) {
      console.log('COV Option key pressed: Toggling first-level children')
      toggleChildren(targetObject, path, false)
      console.log(`COV Option key pressed: Toggling first-level children; after toggle: ${JSON.stringify(openedPathsRef.current)} keys`)
    }

    if (isMetaClick) {
      console.log('COV Meta key pressed: Toggling entire hierarchy')
      toggleChildren(targetObject, path, true)
    }
  }

  const renderObject = (obj: any, path: string): React.Node => {
    if (!isObject(obj)) {
      const isHighlighted = highlightedPaths[path]
      const isChanged = changedPaths[path]
      if (filter && !isHighlighted) return null

      return (
        <div className={`property-${path.replace(/:/g, '-')} ${isChanged ? 'changed' : ''}`}>
          <div className="value">{JSON.stringify(obj)}</div>
        </div>
      )
    }

    // Sort the keys alphabetically
    const sortedKeys = Object.keys(obj).sort()

    return sortedKeys.map((key) => {
      const value = obj[key]
      const isExpandable = isObject(value)
      const currentPath = `${path}:${key}`
      const isCollapsed = !openedPathsRef.current[currentPath]
      const isHighlighted = highlightedPaths[currentPath]
      const isChanged = changedPaths[currentPath]

      if (filter && !isHighlighted && isCollapsed) return null
      const classReplacer = (str: string) =>
        str
          .replace(/[^a-zA-Z]/g, '')
          .replace(/ /g, '-')
          .replace(/:/g, ' ')
      return (
        <div
          key={currentPath}
          className={`property ${classReplacer(currentPath)}`}
          style={{
            marginLeft: 10,
          }}
        >
          {isExpandable ? (
            <div className="expandable">
              <div className="toggle" onClick={(e) => toggleCollapse(currentPath, e)} style={{ cursor: 'pointer' }}>
                {isCollapsed ? '▶' : '▼'} <strong>{key}</strong>
              </div>
              {!isCollapsed && renderObject(value, currentPath)}
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

  const rootIsCollapsed = !openedPathsRef.current[name]

  // Reset function to reset the opened paths
  const reset = () => {
    openedPathsRef.current = initializeOpenedPaths(data, name)
  }

  // Call the onReset function when the component mounts
  useEffect(() => {
    onReset && onReset()
  }, [onReset])

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
      {!rootIsCollapsed && <div style={{ marginLeft: 10 }}>{renderObject(memoizedData, name)}</div>}
    </div>
  )
}

export default CollapsibleObjectViewer
