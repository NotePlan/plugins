// DebugPanel.jsx
// @flow

import React, { useState, useEffect, useRef } from 'react'
import CollapsibleObjectViewer from '@helpers/react/CollapsibleObjectViewer'
import { timer } from '@helpers/dev'
import ConsoleLogView from '@helpers/react/ConsoleLogView'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import './DebugPanel.css'

type LogEntry = {
  message: string,
  timestamp: Date,
  data?: any,
  type: string,
}

type TestResult = {
  status: string,
  message?: string,
  error?: string,
  expected?: any,
  received?: any,
  durationStr?: string,
  startTime?: Date,
  endTime?: Date,
}

type Results = {
  [string]: TestResult,
}

type Props = {
  defaultExpandedKeys?: Array<string>,
  contextVariables: { [key: string]: any },
  tests: Array<{ name: string, test: () => Promise<void> }>,
}

/**
 * DebugPanel component renders three columns: context variables, test definitions, and console logs.
 * It captures console methods globally and displays them in the ConsoleLogView.
 *
 * @param {Props} props - The props for the component.
 * @returns {React.Node} The rendered DebugPanel component.
 */
const DebugPanel = ({ defaultExpandedKeys = [], contextVariables, tests }: Props): React.Node => {
  const [results, setResults] = useState<Results>({})
  const [isRunning, setIsRunning] = useState<boolean>(false)
  const [runningTest, setRunningTest] = useState<?string>(null)
  const [consoleLogs, setConsoleLogs] = useState<Array<LogEntry>>([])
  const [logFilter, setLogFilter] = useState<?{ filterName: string, filterFunction: (log: LogEntry) => boolean }>(null)
  const originalConsoleMethodsRef = useRef({})

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

        const message = messageParts.join(' ')
        const timestamp = new Date()
        setConsoleLogs((prevLogs) => [...prevLogs, { message, timestamp, data, type: methodName }])

        // Call the original console method
        originalMethod.apply(console, args)
      }
    }

    // Methods to override
    const methodsToOverride = ['log', 'error', 'info']

    methodsToOverride.forEach((methodName) => {
      overrideConsoleMethod(methodName)
      console.log(`DebugPanel: console.${methodName} override is active`)
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

  // Example of runTest function for context
  const runTest = async (testName: string, testFunction: () => Promise<void>): Promise<void> => {
    if (isRunning) return
    setIsRunning(true)
    setRunningTest(testName)

    const startTime = new Date()
    console.log(`>>> Starting Test: ${testName} <<<`)

    try {
      await testFunction()
      const durationStr = timer(startTime)
      const endTime = new Date()
      setResults((prev) => ({
        ...prev,
        [testName]: { status: 'Passed', durationStr, startTime, endTime },
      }))
      console.log(`>>> Passed Test: ${testName} <<< Duration: ${durationStr}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const durationStr = timer(startTime)
      const endTime = new Date()
      console.error(`>>> Failed Test: ${testName} <<< Duration: ${durationStr}`)
      console.error(`Test failed: ${errorMessage}`)
      console.error(error)
      setResults((prev) => ({
        ...prev,
        [testName]: {
          status: 'Failed',
          error: errorMessage,
          durationStr,
          startTime,
          endTime,
        },
      }))
    } finally {
      setIsRunning(false)
      setRunningTest(null)
    }
  }

  const runAllTests = async () => {
    for (const { name, test } of tests) {
      await runTest(name, test)
    }
  }

  const showTestLogs = (testName: string) => {
    const testResult = results[testName]
    if (testResult?.startTime && testResult?.endTime) {
      console.log(`Filtering logs for test: ${testName}`)
      setLogFilter({
        filterName: testName,
        filterFunction: (log) => log.timestamp >= testResult.startTime && log.timestamp <= testResult.endTime,
      })
    }
  }

  const showAllLogs = () => {
    setLogFilter(null) // Clear the test filter
  }

  // Create a version of contextVariables without functions
  const contextVariablesWithoutFunctions = Object.keys(contextVariables).reduce((acc: { [key: string]: any }, key) => {
    if (typeof contextVariables[key] !== 'function') {
      acc[key] = contextVariables[key]
    }
    return acc
  }, {})

  return (
    <div style={{ height: '100vh', borderTop: '1px solid #ccc' }}>
      <PanelGroup direction="horizontal">
        {/* Left Pane: Context Variables */}
        <Panel defaultSize={25} minSize={10}>
          <div
            style={{
              padding: '10px',
              backgroundColor: '#f5f5f5',
              height: '100%',
              overflowY: 'auto',
            }}
          >
            <h3>Context</h3>
            <CollapsibleObjectViewer data={contextVariablesWithoutFunctions} name="Context Variables" startExpanded={false} defaultExpandedKeys={defaultExpandedKeys} />
          </div>
        </Panel>
        <PanelResizeHandle />
        {/* Middle Pane: Tests */}
        <Panel defaultSize={25} minSize={10}>
          <div
            style={{
              padding: '10px',
              height: '100%',
              overflowY: 'auto',
              backgroundColor: '#ffffff',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3>Tests</h3>
              <button
                onClick={runAllTests}
                style={{
                  backgroundColor: '#e0e0e0',
                  color: '#000',
                  border: '1px solid #ccc',
                  padding: '5px 10px',
                  cursor: 'pointer',
                }}
              >
                Run All Tests
              </button>
            </div>
            <ul style={{ listStyleType: 'none', padding: 0 }}>
              {tests.map(({ name, test }) => {
                const testStatus = results[name]?.status
                const isRunningTest = runningTest === name
                const iconColor = isRunningTest ? 'orange' : testStatus === 'Failed' ? 'red' : testStatus === 'Passed' ? 'green' : 'black'
                const durationStr = results[name]?.durationStr ? ` (${results[name].durationStr})` : ''

                return (
                  <li
                    key={name}
                    style={{
                      marginBottom: '10px',
                      borderBottom: '0.5px solid #eee',
                      paddingBottom: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <button
                        onClick={() => runTest(name, test)}
                        style={{
                          backgroundColor: '#e0e0e0',
                          color: '#000',
                          border: '1px solid #ccc',
                          padding: '5px 10px',
                          cursor: 'pointer',
                          marginRight: '10px',
                        }}
                      >
                        <i className="fa fa-play" style={{ color: iconColor }}></i>
                        {isRunningTest && <i className="fa fa-spinner fa-spin" style={{ marginLeft: '5px' }}></i>}
                      </button>
                      <div style={{ flex: 1 }}>
                        {name}
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span
                            style={{
                              color: testStatus === 'Passed' ? 'green' : testStatus === 'Failed' ? 'red' : '#000',
                              marginRight: '10px',
                            }}
                          >
                            {testStatus || ''}
                            {durationStr}
                          </span>
                          {results[name] && (
                            <button
                              onClick={() => showTestLogs(name)}
                              style={{
                                backgroundColor: '#e0e0e0',
                                color: '#000',
                                border: '1px solid #ccc',
                                padding: '2px 5px',
                                cursor: 'pointer',
                                fontSize: '12px',
                              }}
                            >
                              Show Logs
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {results[name]?.error && <div style={{ color: 'red', fontSize: '12px', marginTop: '5px' }}>{results[name].error}</div>}
                  </li>
                )
              })}
            </ul>
          </div>
        </Panel>
        <PanelResizeHandle />
        {/* Right Pane: Console Logs */}
        <Panel defaultSize={50} minSize={10}>
          <div
            style={{
              padding: '10px',
              height: '100%',
              overflowY: 'auto',
              backgroundColor: '#f5f5f5',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3>Console</h3>
            </div>
            <ConsoleLogView logs={consoleLogs} filter={logFilter} onClearLogs={() => setConsoleLogs([])} onShowAllLogs={showAllLogs} />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  )
}

export default DebugPanel
