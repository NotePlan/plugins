// CollapsibleObjectViewer.jsx
// @flow

import React, { useState, useEffect } from 'react'

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
  const initializeCollapsedPaths = (obj: any, path: string): CollapsedPaths => {
    let initialCollapsedPaths: CollapsedPaths = {}

    const shouldExpand = defaultExpandedKeys.some((expandedKey) => expandedKey.startsWith(path))
    initialCollapsedPaths[path] = startExpanded ? false : !shouldExpand

    if (!obj || typeof obj !== 'object') {
      return initialCollapsedPaths
    }

    Object.keys(obj).forEach((key) => {
      const currentPath = `${path}:${key}`
      const nestedCollapsedPaths = initializeCollapsedPaths(obj[key], currentPath)
      initialCollapsedPaths = {
        ...initialCollapsedPaths,
        ...nestedCollapsedPaths,
      }
    })

    return initialCollapsedPaths
  }

  const [collapsedPaths, setCollapsedPaths] = useState<CollapsedPaths>(() => initializeCollapsedPaths(data, name))
  const [highlightedPaths, setHighlightedPaths] = useState<HighlightedPaths>({})
  const [initialData, setInitialData] = useState(data)

  useEffect(() => {
    // Only reset collapsedPaths if data has significantly changed
    if (JSON.stringify(data) !== JSON.stringify(initialData)) {
      const newCollapsedPaths = initializeCollapsedPaths(data, name)
      setCollapsedPaths(newCollapsedPaths)
      setInitialData(data)
    }
  }, [name, startExpanded, defaultExpandedKeys])

  useEffect(() => {
    const newHighlightedPaths: HighlightedPaths = {}
    const checkChanges = (obj: any, path: string) => {
      if (!obj || typeof obj !== 'object') return
      Object.keys(obj).forEach((key) => {
        const currentPath = `${path}:${key}`
        if (JSON.stringify(obj[key]) !== JSON.stringify(initialData[key]) && initialData[key] !== undefined) {
          newHighlightedPaths[currentPath] = true
        }
        checkChanges(obj[key], currentPath)
      })
    }
    checkChanges(data, name)
    setHighlightedPaths((prev) => {
      if (JSON.stringify(prev) !== JSON.stringify(newHighlightedPaths)) {
        return newHighlightedPaths
      }
      return prev
    })
  }, [data, initialData, name])

  const isObject = (obj: any): boolean => obj && typeof obj === 'object'

  const toggleCollapse = (path: string): void => {
    setCollapsedPaths((prevState) => ({
      ...prevState,
      [path]: !prevState[path],
    }))
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
        const isCollapsed = collapsedPaths[currentPath]

        return (
          <div
            key={currentPath}
            className={`${path.split(':')[0]} property-${currentPath.replace(/:/g, '-')}`}
            style={{ marginLeft: 20, backgroundColor: highlightedPaths[currentPath] ? '#ffffe0' : 'transparent' }}
          >
            {isExpandable ? (
              <div>
                <div onClick={() => toggleCollapse(currentPath)} style={{ cursor: 'pointer' }}>
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
      const isCollapsed = collapsedPaths[currentPath]

      return (
        <div
          key={currentPath}
          className={`property-${currentPath.replace(/:/g, '-')}`}
          style={{ marginLeft: 20, backgroundColor: highlightedPaths[currentPath] ? '#ffffe0' : 'transparent' }}
        >
          {isExpandable ? (
            <div>
              <div onClick={() => toggleCollapse(currentPath)} style={{ cursor: 'pointer' }}>
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

  const rootIsCollapsed = collapsedPaths[name]

  return (
    <div>
      <div onClick={() => toggleCollapse(name)} style={{ cursor: 'pointer', fontWeight: 'bold' }}>
        {rootIsCollapsed ? '▶' : '▼'} {name}
      </div>
      {!rootIsCollapsed && <div style={{ marginLeft: 20 }}>{renderObject(data, name)}</div>}
    </div>
  )
}

export default CollapsibleObjectViewer
