// @flow

import React, { useState, useEffect, useRef, useMemo } from 'react'
import CollapsibleObjectViewer from '@helpers/react/CollapsibleObjectViewer'
import ConsoleLogView from '@helpers/react/ConsoleLogView'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import './DebugPanel.css'
import SearchBox from '@helpers/react/SearchBox'
import TestingPane from './TestingPane'

export type LogEntry = {
  message: string,
  timestamp: Date,
  data?: any,
  type: string,
}

export type TestResult = {
  status: string,
  message?: string,
  error?: string,
  expected?: any,
  received?: any,
  durationStr?: string,
  startTime?: Date,
  endTime?: Date,
}

export type Results = {
  [string]: TestResult,
}

export type Test = {
  name: string,
  test: () => Promise<void>,
}

export type TestGroup = {
  groupName: string,
  tests: Array<Test>,
}

type Props = {
  defaultExpandedKeys?: Array<string>,
  contextVariables: { [key: string]: any },
  testGroups: Array<TestGroup>,
}

const methodsToOverride = ['log', 'error', 'info']

const DebugPanel = ({ defaultExpandedKeys = [], contextVariables, testGroups = [] }: Props): React.Node => {
  const [consoleLogs, setConsoleLogs] = useState<Array<LogEntry>>([])
  const [logFilter, setLogFilter] = useState<?{ filterName: string, filterFunction: (log: LogEntry) => boolean }>(null)
  const originalConsoleMethodsRef = useRef({})
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [highlightRegex, setHighlightRegex] = useState<string>('')
  const [useRegex, setUseRegex] = useState<boolean>(false)
  const [expandToShow, setExpandToShow] = useState<boolean>(false)
  const [filter, setFilter] = useState<boolean>(false)
  const resetViewerRef = useRef<() => void>(() => {})

  useEffect(() => {
    console.log('DebugPanel: starting up before the console methods override')

    const overrideConsoleMethod = (methodName: string) => {
      const originalMethod = console[methodName]
      originalConsoleMethodsRef.current[methodName] = originalMethod

      console[methodName] = (...args) => {
        const messageParts = []
        let data = null

        args.forEach((arg) => {
          if (typeof arg === 'object' && arg !== null) {
            data = arg
          } else {
            messageParts.push(typeof arg === 'string' ? arg : JSON.stringify(arg))
          }
        })

        const message = messageParts.join(', ')
        const timestamp = new Date()

        setTimeout(() => {
          setConsoleLogs((prevLogs) => [...prevLogs, { message, timestamp, data, type: methodName }].slice(-500))
        }, 0)

        // originalMethod.apply(console, args)
      }
    }

    methodsToOverride.forEach((methodName) => {
      overrideConsoleMethod(methodName)
    })

    return () => {
      console.log('DebugPanel: tearing down the console methods override')
      methodsToOverride.forEach((methodName) => {
        if (console[methodName] === originalConsoleMethodsRef.current[methodName]) {
          console.log(`DebugPanel: console.${methodName} override is being removed`)
          console[methodName] = originalConsoleMethodsRef.current[methodName]
        }
      })
    }
  }, [])

  const showAllLogs = () => {
    setLogFilter(null)
  }

  const contextVariablesWithoutFunctions = useMemo(() => {
    return Object.keys(contextVariables).reduce((acc: { [key: string]: any }, key) => {
      if (typeof contextVariables[key] !== 'function') {
        acc[key] = contextVariables[key]
      }
      return acc
    }, {})
  }, [contextVariables])

  const handleReset = () => {
    setHighlightRegex('')
    setUseRegex(false)
    setExpandToShow(false)
    setFilter(false)
    if (resetViewerRef.current) {
      resetViewerRef.current()
    }
  }

  return (
    <div style={{ height: '100vh', borderTop: '1px solid #ccc' }} ref={containerRef}>
      <PanelGroup direction="horizontal">
        <Panel className="context-vars-pane full-height-pane" defaultSize={25} minSize={10}>
          <div className="debug-pane-header consistent-header" style={{ backgroundColor: '#f5f5f5' }}>
            <h3>Context</h3>
          </div>
          <SearchBox
            onSearchChange={(text) => setHighlightRegex(text.trim())}
            onToggleRegex={setUseRegex}
            onToggleExpand={setExpandToShow}
            onToggleFilter={setFilter}
            onReset={handleReset}
            useRegex={useRegex}
            expandToShow={expandToShow}
            filter={filter}
          />
          <CollapsibleObjectViewer
            data={contextVariablesWithoutFunctions}
            name="Context Variables"
            startExpanded={false}
            defaultExpandedKeys={defaultExpandedKeys}
            highlightRegex={highlightRegex}
            expandToShowHighlight={expandToShow}
            filter={filter}
            onReset={(reset) => (resetViewerRef.current = reset)}
          />
        </Panel>
        <PanelResizeHandle className="panel-resize-handle" />
        <Panel defaultSize={25} minSize={10}>
          <div className="testing-pane full-height-pane" style={{ backgroundColor: '#f5f5f5' }}>
            <div className="debug-pane-header consistent-header">
              <h3>Testing</h3>
            </div>
            <TestingPane testGroups={testGroups} onTestLogsFiltered={setLogFilter} />
          </div>
        </Panel>
        <PanelResizeHandle className="panel-resize-handle" />
        <Panel defaultSize={50} minSize={10} className="console-pane full-height-pane inner-panel-padding">
          <div className="debug-pane-header consistent-header">
            <h3>Console</h3>
          </div>
          <ConsoleLogView logs={consoleLogs} filter={logFilter} onClearLogs={() => setConsoleLogs([])} onShowAllLogs={showAllLogs} />
        </Panel>
      </PanelGroup>
    </div>
  )
}

export default DebugPanel
