// CollapsibleObjectViewer.jsx
// @flow

import React, { useState, useEffect, useMemo, useRef } from 'react'
import isEqual from 'lodash/isEqual'
import { compareObjects } from '@helpers/dev'

type Props = {
  data: any,
  name?: string,
  startExpanded?: boolean,
  defaultExpandedKeys?: Array<string>,
}

type CollapsedPaths = {
  [string]: boolean,
}

type HighlightedPaths = {
  [string]: boolean,
}

const CollapsibleObjectViewer = ({ data, name = 'Context Variables', startExpanded = false, defaultExpandedKeys = [] }: Props): React.Node => {
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
  const [tooltip, setTooltip] = useState<{ visible: boolean, content: string }>({
    visible: false,
    content: '',
  })
  const [isMouseOver, setIsMouseOver] = useState<boolean>(false)
  const openedPathsRef = useRef<CollapsedPaths>(initializeOpenedPaths(data, name))

  // Memoize the data prop to prevent unnecessary re-renders
  const memoizedData = useMemo(() => data, [JSON.stringify(data)])

  // TODO: We should clean up openedPaths when the data changes to keep paths that don't exist anymore out of the openedPaths
  // But this was causing an endless loop because maybe data updates on every render, I don't know.
  // may need to figure out if/why data changes on every render
  // So for now, we'll just not clean up openedPaths.
  // useEffect to clean up openedPaths
  //   useEffect(() => {
  //     console.log('COV Effect triggered: Cleaning up openedPaths')

  //     const cleanOpenedPaths = (obj: any, path: string, paths: CollapsedPaths): CollapsedPaths => {
  //       if (!obj || typeof obj !== 'object') {
  //         console.log('COV Cleaning up openedPaths: Not an object')
  //         return {}
  //       }

  //       let validPaths: CollapsedPaths = {}
  //       Object.keys(obj).forEach((key) => {
  //         const currentPath = `${path}:${key}`
  //         if (paths[currentPath]) {
  //           validPaths[currentPath] = true
  //         }
  //         validPaths = {
  //           ...validPaths,
  //           ...cleanOpenedPaths(obj[key], currentPath, paths),
  //         }
  //       })
  //       return validPaths
  //     }

  //     const cleanedPaths = cleanOpenedPaths(memoizedData, name, openedPathsRef.current)

  //     console.log('COV Current openedPaths:', openedPathsRef.current)
  //     console.log('COV Cleaned paths:', cleanedPaths)

  //     if (!isEqual(openedPathsRef.current, cleanedPaths)) {
  //       console.log(`COV Updating openedPaths with cleaned paths ${compareObjects(openedPathsRef.current, cleanedPaths)}`)
  //       openedPathsRef.current = cleanedPaths
  //     }
  //   }, [memoizedData, name]) // Dependencies include memoizedData and name

  useEffect(() => {
    const newHighlightedPaths: HighlightedPaths = {}
    const checkChanges = (obj: any, path: string) => {
      if (!obj || typeof obj !== 'object') return
      Object.keys(obj).forEach((key) => {
        const currentPath = `${path}:${key}`
        if (JSON.stringify(obj[key]) !== JSON.stringify(memoizedData[key]) && memoizedData[key] !== undefined) {
          newHighlightedPaths[currentPath] = true
        }
        checkChanges(obj[key], currentPath)
      })
    }
    checkChanges(memoizedData, name)
    setHighlightedPaths((prev) => {
      if (!isEqual(prev, newHighlightedPaths)) {
        return newHighlightedPaths
      }
      return prev
    })
  }, [memoizedData, name])

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
          openedPathsRef.current[currentPath] = !openedPathsRef.current[currentPath]
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
      return (
        <div className={`${path.split(':')[0]} property-${path.replace(/:/g, '-')}`}>
          <span>{JSON.stringify(obj)}</span>
        </div>
      )
    }

    if (Array.isArray(obj)) {
      return obj.map((item, index) => {
        const currentPath = `${path}:${index}`
        const isExpandable = isObject(item)
        const isCollapsed = !openedPathsRef.current[currentPath]

        return (
          <div
            key={currentPath}
            className={`${path.split(':')[0]} property-${currentPath.replace(/:/g, '-')}`}
            style={{
              marginLeft: 20,
              backgroundColor: highlightedPaths[currentPath] ? '#ffffe0' : 'transparent',
            }}
          >
            {isExpandable ? (
              <div>
                <div onClick={(e) => toggleCollapse(currentPath, e)} style={{ cursor: 'pointer' }}>
                  {isCollapsed ? '▶' : '▼'} [{index}]
                </div>
                {!isCollapsed && renderObject(item, currentPath)}
              </div>
            ) : (
              <div>
                [{index}]: <span>{JSON.stringify(item)}</span>
              </div>
            )}
          </div>
        )
      })
    }

    // Sort the keys alphabetically
    const sortedKeys = Object.keys(obj).sort()

    return sortedKeys.map((key) => {
      const value = obj[key]
      const isExpandable = isObject(value)
      const currentPath = `${path}:${key}`
      const isCollapsed = !openedPathsRef.current[currentPath]

      return (
        <div
          key={currentPath}
          className={`property-${currentPath.replace(/:/g, '-')}`}
          style={{
            marginLeft: 20,
            backgroundColor: highlightedPaths[currentPath] ? '#ffffe0' : 'transparent',
          }}
        >
          {isExpandable ? (
            <div>
              <div onClick={(e) => toggleCollapse(currentPath, e)} style={{ cursor: 'pointer' }}>
                {isCollapsed ? '▶' : '▼'} <strong>{key}</strong>
              </div>
              {!isCollapsed && renderObject(value, currentPath)}
            </div>
          ) : (
            <div>
              <strong>{key}: </strong>
              <span>{JSON.stringify(value)}</span>
            </div>
          )}
        </div>
      )
    })
  }

  const rootIsCollapsed = !openedPathsRef.current[name]

  return (
    <div onMouseEnter={() => setIsMouseOver(true)} onMouseLeave={() => setIsMouseOver(false)} style={{ position: 'relative' }}>
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
      {!rootIsCollapsed && <div style={{ marginLeft: 20 }}>{renderObject(memoizedData, name)}</div>}
    </div>
  )
}

export default CollapsibleObjectViewer
