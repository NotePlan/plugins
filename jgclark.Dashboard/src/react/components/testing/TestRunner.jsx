// @flow

import React, { useState, useRef, useEffect } from 'react'
import { getTests } from './tests'
import { useAppContext } from '../AppContext'
import CollapsibleObjectViewer from '@helpers/react/CollapsibleObjectViewer'
import { timer } from '@helpers/dev'
import './TestRunner.css'

type TestResult = {
  status: string,
  message?: string,
  error?: string,
  logs?: Array<string>,
  expected?: any,
  received?: any,
  duration?: number,
}

type Results = {
  [string]: TestResult,
}

type Props = {
  defaultExpandedKeys?: Array<string>,
}

/**
 * TestRunner component renders two columns: context variables and test definitions.
 * It also indicates test progress using a spinner and captures console logs during test runs.
 *
 * @returns {React.Node} The rendered TestRunner component.
 */
const TestRunner = ({ defaultExpandedKeys = [] }: Props): React.Node => {
  const [results, setResults] = useState<Results>({})
  const [isRunning, setIsRunning] = useState<boolean>(false)
  const [consoleLogs, setConsoleLogs] = useState<Array<string>>([])
  const [runningTest, setRunningTest] = useState<string | null>(null)

  const originalConsoleLog = useRef(console.log)

  const context = useAppContext()

  const { dashboardSettings, perspectiveSettings, pluginData, reactSettings } = context
  const contextVariables = {
    dashboardSettings,
    perspectiveSettings,
    pluginData,
    reactSettings,
  }

  const tests = getTests(context)

  useEffect(() => {
    const log = (...args) => {
      setConsoleLogs((prevLogs) => [...prevLogs, args.join(' ')])
      originalConsoleLog.current(...args)
    }

    const originalLog = console.log
    console.log = log

    return () => {
      console.log = originalLog
    }
  }, [])

  const runTest = async (testName: string, testFunction: () => Promise<void>): Promise<void> => {
    setIsRunning(true)
    setRunningTest(testName)
    setConsoleLogs([]) // Clear logs when a new test is run
    const startTime = new Date()
    try {
      await testFunction()
      setResults((prev) => ({
        ...prev,
        [testName]: { status: 'Passed', logs: consoleLogs, duration: timer(startTime) },
      }))
    } catch (error) {
      const endTime = performance.now() // End timing
      if (error instanceof Error) {
        setResults((prev) => ({
          ...prev,
          [testName]: { status: 'Failed', error: error.message, logs: consoleLogs, duration: timer(startTime) },
        }))
      } else {
        setResults((prev) => ({
          ...prev,
          [testName]: { status: 'Failed', error: String(error), logs: consoleLogs, duration: timer(startTime) },
        }))
      }
    } finally {
      setIsRunning(false)
      setRunningTest(null)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%', borderTop: '1px solid #ccc' }}>
      <div style={{ flex: '1', minWidth: '25%', padding: '10px', borderRight: '1px solid #ccc', backgroundColor: '#f9f9f9' }}>
        <h3>Context Variables</h3>
        <CollapsibleObjectViewer data={contextVariables} name="Context Variables" startExpanded={false} defaultExpandedKeys={defaultExpandedKeys} />
      </div>
      <div style={{ flex: '2', padding: '10px' }}>
        <h3>Tests</h3>
        <ul style={{ listStyleType: 'none', padding: 0 }}>
          {tests.map(({ name, test }) => {
            const testStatus = results[name]?.status
            const isRunningTest = runningTest === name
            const iconColor = isRunningTest ? 'yellow' : testStatus === 'Failed' ? 'red' : testStatus === 'Passed' ? 'green' : 'black'
            const duration = results[name]?.duration ? ` (${results[name].duration})` : ''

            return (
              <li key={name} style={{ marginBottom: '10px', borderBottom: '0.5px solid #eee', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <div style={{ marginRight: '10px' }}>
                    <button onClick={() => runTest(name, test)} style={{ backgroundColor: '#d3d3d3', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer' }}>
                      <i className="fa fa-play" style={{ color: iconColor }}></i>
                      {isRunningTest && <i className="fa fa-spinner fa-spin" style={{ marginLeft: '5px' }}></i>}
                    </button>
                  </div>
                  <div style={{ flex: 1 }}>
                    <strong>{name}</strong>
                    <div className="test-result" style={{ marginTop: '5px', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: testStatus === 'Passed' ? 'green' : 'red' }}>
                        {testStatus || ''}
                        {duration}
                      </span>
                      {results[name]?.error && <div style={{ color: 'red', fontSize: '12px' }}>{results[name].error}</div>}
                      {results[name]?.logs && results[name].logs.length > 0 && (
                        <CollapsibleObjectViewer data={results[name].logs} name="Logs" startExpanded={true} defaultExpandedKeys={defaultExpandedKeys} />
                      )}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

export default TestRunner
