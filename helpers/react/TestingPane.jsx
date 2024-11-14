// @flow

import React, { useState } from 'react'
import { timer } from '@helpers/dev'
import type { TestGroup, Results, LogEntry } from './DebugPanel'
import './TestingPane.css'

type Props = {
  testGroups: Array<TestGroup>,
  onTestLogsFiltered: (filter: ?{ filterName: string, filterFunction: (log: LogEntry) => boolean }) => void,
}

const TestingPane = ({ testGroups, onTestLogsFiltered }: Props): React.Node => {
  const [results, setResults] = useState<Results>({})
  const [isRunning, setIsRunning] = useState<boolean>(false)
  const [runningTest, setRunningTest] = useState<?string>(null)
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    const initialCollapsedState = {}
    testGroups.forEach((group) => {
      initialCollapsedState[group.groupName] = true // All groups start collapsed
    })
    return initialCollapsedState
  })

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

  const runAllTestsInGroup = async (group: TestGroup) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [group.groupName]: false, // Expand the group
    }))
    for (const test of group.tests) {
      await runTest(test.name, test.test)
    }
  }

  const runAllTests = async () => {
    for (const group of testGroups) {
      await runAllTestsInGroup(group)
    }
  }

  const showTestLogs = (testName: string) => {
    const testResult = results[testName]
    if (testResult?.startTime && testResult?.endTime) {
      console.log(`Filtering logs for test: ${testName}`)
      onTestLogsFiltered({
        filterName: testName,
        filterFunction: (log) => log.timestamp >= testResult.startTime && log.timestamp <= testResult.endTime,
      })
    }
  }

  return (
    <div className="full-height-pane inner-panel-padding" style={{ backgroundColor: '#f5f5f5' }}>
      <div className="testing-pane-button-header">
        <h3></h3>
        <button
          className="testing-run-all-button"
          onClick={runAllTests}
          style={{
            backgroundColor: '#e0e0e0',
            color: '#000',
            border: '1px solid #ccc',
            cursor: 'pointer',
          }}
        >
          Run All Tests
        </button>
      </div>
      {testGroups.map((group) => (
        <div key={group.groupName}>
          <div
            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', backgroundColor: '#f5f5f5', padding: '5px 0px 5px 0px' }}
            onClick={() =>
              setCollapsedGroups((prev) => ({
                ...prev,
                [group.groupName]: !prev[group.groupName],
              }))
            }
          >
            <span style={{ marginRight: '5px' }}>{collapsedGroups[group.groupName] ? '▶' : '▼'}</span>
            <h4 style={{ margin: 0, flex: 1 }}>{group.groupName}</h4>
            <button
              onClick={(e) => {
                e.stopPropagation() // Prevent collapsing when clicking the button
                runAllTestsInGroup(group)
              }}
              style={{
                backgroundColor: '#e0e0e0',
                color: '#000',
                border: '1px solid #ccc',
                padding: '3px 15px', // Adjusted padding for a more rectangular shape
                cursor: 'pointer',
                marginLeft: 'auto',
              }}
            >
              <i className="fa fa-play" style={{ color: isRunning ? 'orange' : 'black' }}></i>
              {isRunning && <i className="fa fa-spinner fa-spin" style={{ marginLeft: '5px' }}></i>}
            </button>
          </div>
          {!collapsedGroups[group.groupName] && (
            <ul style={{ listStyleType: 'none', padding: 0 }}>
              {group.tests.map(({ name, test }) => {
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
          )}
        </div>
      ))}
    </div>
  )
}

export default TestingPane
