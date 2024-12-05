// @flow

import React, { useState, useEffect, useRef } from 'react'
import type { TestGroup, Results, LogEntry } from './DebugPanel'
import { timer } from '@np/helpers/dev'
import './TestingPane.css'

type Props = {
  testGroups: Array<TestGroup>,
  onLogsFiltered: (filter: ?{ filterName: string, filterFunction: (log: LogEntry) => boolean }) => void,
  getContext: () => any, // Function to get the context
}

type CollapsedGroups = {
  [groupName: string]: boolean,
}

const TestingPane = ({ testGroups, onLogsFiltered, getContext }: Props): React.Node => {
  const [results, setResults] = useState<Results>({})
  const [runningTests, setRunningTests] = useState<Set<string>>(new Set())
  const [runningGroups, setRunningGroups] = useState<Set<string>>(new Set())
  const [pausedTests, setPausedTests] = useState<{ [testName: string]: string }>({})
  const pausedTestResolvers = useRef<{ [testName: string]: () => void }>({})
  const [collapsedGroups, setCollapsedGroups] = useState<CollapsedGroups>(() => {
    const initialCollapsedState: CollapsedGroups = {}
    testGroups.forEach((group) => {
      initialCollapsedState[group.groupName] = true // All groups start collapsed
    })
    return initialCollapsedState
  })
  const [showSpinner, setShowSpinner] = useState<boolean>(false)
  const [waitingTest, setWaitingTest] = useState<string | null>(null)

  /**
   * Waits for a specified duration after the last console log entry.
   * Sometimes processing is still happening after a test runs and we don't want to
   * start a new test until things are quieted down and stable. because there is some console
   * logging, that can be our indication of when we are ready to start the next test in a test
   * group run or in an allTests run and between test groups.
   * @param {number} waitTime - The time to wait in milliseconds after the last log entry.
   * @returns {Promise<void>} Resolves when the wait time has passed without new log entries.
   */
  const waitForConsoleQuietness = (waitTime: number = 1000): Promise<void> => {
    return new Promise((resolve) => {
      let lastLogTime = Date.now()

      const logListener = () => {
        lastLogTime = Date.now()
      }

      const methodsToOverride = ['log', 'error', 'info']
      methodsToOverride.forEach((methodName) => {
        const originalMethod = console[methodName]
        // @ts-ignore
        console[methodName] = (...args) => {
          logListener()
          originalMethod.apply(console, args)
        }
      })

      const checkQuietness = () => {
        if (Date.now() - lastLogTime >= waitTime) {
          setShowSpinner(false) // Hide spinner when quietness is achieved
          resolve()
        } else {
          setTimeout(checkQuietness, 100)
        }
      }

      setShowSpinner(true) // Show spinner when starting to wait
      checkQuietness()
    })
  }

  // Effect to automatically expand groups with failed tests
  useEffect(() => {
    testGroups.forEach((group) => {
      const groupResults = group.tests.map((test) => results[test.name])
      const anyFailed = groupResults.some((result) => result?.status === 'Failed')
      if (anyFailed && collapsedGroups[group.groupName]) {
        setCollapsedGroups((prev) => ({
          ...prev,
          [group.groupName]: false, // Expand the group if any test failed
        }))
      }
    })
  }, [results, testGroups, collapsedGroups])

  /**
   * Runs an individual test.
   *
   * @param {string} testName - The name of the test.
   * @param {(getContext: () => AppContextType, utils: { pause: (msg?: string) => Promise<void> }) => Promise<void>} testFunction - The test function to execute.
   * @returns {Promise<void>}
   */
  const runTest = async (testName: string, testFunction: (getContext: () => any, utils: { pause: (msg?: string) => Promise<void> }) => Promise<void>): Promise<void> => {
    if (runningTests.has(testName)) return
    setWaitingTest(testName)
    await waitForConsoleQuietness() // Wait for console to be quiet before running the test
    setWaitingTest(null)
    setRunningTests((prev) => new Set(prev).add(testName))

    const startTime = new Date()
    console.log(`=== Starting Test: ${testName} ===`)

    const pause = (msg: string = ''): Promise<void> =>
      new Promise((resolve) => {
        pausedTestResolvers.current[testName] = resolve
        setPausedTests((prev) => ({ ...prev, [testName]: msg }))
      })

    try {
      await testFunction(getContext, { pause })
      const durationStr = timer(startTime)
      const endTime = new Date()
      console.log(`--- Passed Test: ${testName} Duration: ${durationStr} ---`)
      setResults((prev) => ({
        ...prev,
        [testName]: { status: 'Passed', durationStr, startTime, endTime },
      }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const durationStr = timer(startTime)
      const endTime = new Date()
      console.error(`!!! Failed Test: ${testName} Duration: ${durationStr} !!!`)
      console.error(`!!! Test failed: ${errorMessage} !!!`)
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
      setRunningTests((prev) => {
        const newSet = new Set(prev)
        newSet.delete(testName)
        return newSet
      })
    }
  }

  /**
   * Resets the test results for a given set of tests.
   *
   * @param {Array<{ name: string }>} tests - The tests to reset.
   */
  const resetTestResults = (tests: Array<{ name: string, skip?: boolean, test?: Function }>) => {
    setResults((prevResults) => {
      const newResults = { ...prevResults }
      tests.forEach((test) => {
        newResults[test.name] = { status: '', error: '', durationStr: '' }
      })
      return newResults
    })
    setRunningTests(new Set())
    console.log('Test results have been reset.')
  }

  /**
   * Runs all tests in a specific group.
   *
   * @param {TestGroup} group - The group of tests to run.
   */
  const runAllTestsInGroup = async (group: TestGroup) => {
    // @ts-ignore
    resetTestResults(group?.tests ?? []) // Reset results for the specific group
    if (runningGroups.has(group.groupName)) return
    setRunningGroups((prev) => new Set(prev).add(group.groupName))
    setCollapsedGroups((prev) => ({
      ...prev,
      [group.groupName]: false, // Expand the group
    }))
    for (const test of group.tests) {
      if (!test.skip) {
        setWaitingTest(test.name)
        await runTest(test.name, test.test)
      }
    }
    setWaitingTest(null)
    setRunningGroups((prev) => {
      const newSet = new Set(prev)
      newSet.delete(group.groupName)
      return newSet
    })
  }

  /**
   * Runs all tests across all groups.
   */
  const runAllTests = async () => {
    // @ts-ignore
    testGroups.forEach((group) => resetTestResults(group.tests)) // Reset results for all groups
    for (const group of testGroups) {
      await runAllTestsInGroup(group)
    }

    // Collapse groups where all tests have passed
    setCollapsedGroups((prev) => {
      const newCollapsedState = { ...prev }
      testGroups.forEach((group) => {
        const allPassed = group.tests.every((test) => results[test.name]?.status === 'Passed')
        if (allPassed) {
          newCollapsedState[group.groupName] = true
        }
      })
      return newCollapsedState
    })
  }

  /**
   * Filters logs for a specific timeframe by capturing the start and end times.
   *
   * @param {string} name - The name of the filter.
   */
  const showLogsForTimeframe = (name: string) => {
    const result = results[name]
    if (result?.startTime && result?.endTime) {
      const startTime = result.startTime
      const endTime = result.endTime
      console.log(`Filtering logs for: ${name}`)
      onLogsFiltered({
        filterName: name,
        filterFunction: (log) => {
          if (startTime && endTime && log.timestamp) {
            return log.timestamp >= startTime && log.timestamp <= endTime
          } else {
            console.error(`!!! "${name}" has no valid start or end time for filtering logs !!!`)
          }
          return false
        },
      })
    }
  }

  return (
    <div
      className="inner-panel-padding"
      style={{
        backgroundColor: '#f5f5f5',
        overflowY: 'auto',
        height: '100%',
        maxHeight: '100vh',
      }}
    >
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
      {testGroups.map((group) => {
        const isGroupRunning = runningGroups.has(group.groupName)

        // Compute group results
        const groupResults = group.tests.map((test) => results[test.name])
        const allPassed = group.tests.length > 0 && group.tests.every((test) => results[test.name]?.status === 'Passed')
        const anyFailed = group.tests.some((test) => results[test.name]?.status === 'Failed')

        // Determine group status message
        const groupStatus = anyFailed ? 'Failed' : allPassed ? 'Passed' : ''

        return (
          <div key={group.groupName}>
            <div
              style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', backgroundColor: '#f5f5f5', padding: '5px 0px 5px 0px' }}
              onClick={() => {
                setCollapsedGroups((prev) => ({
                  ...prev,
                  [group.groupName]: !prev[group.groupName],
                }))
              }}
            >
              <span style={{ marginRight: '5px' }}>{collapsedGroups[group.groupName] ? '▶' : '▼'}</span>
              <h4 style={{ margin: 0, flex: 1 }}>
                {group.groupName}
                {groupStatus && <span style={{ marginLeft: '10px', color: groupStatus === 'Passed' ? 'green' : 'red', fontSize: '14px' }}>{groupStatus}</span>}
              </h4>
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
                <i className="fa fa-play" style={{ color: isGroupRunning ? 'orange' : 'black' }}></i>
                {isGroupRunning && <i className="fa fa-spinner fa-spin" style={{ marginLeft: '5px' }}></i>}
              </button>
            </div>
            {!collapsedGroups[group.groupName] && (
              <ul style={{ listStyleType: 'none', padding: 0 }}>
                {group.tests.map(({ name, test, skip }) => {
                  const testStatus = results[name]?.status
                  const isRunningTest = runningTests.has(name)
                  const isPaused = pausedTests[name] !== undefined
                  const isWaitingForQuietness = waitingTest === name
                  const iconColor = isWaitingForQuietness
                    ? 'black'
                    : isPaused
                    ? 'purple'
                    : isRunningTest
                    ? 'orange'
                    : testStatus === 'Failed'
                    ? 'red'
                    : testStatus === 'Passed'
                    ? 'green'
                    : skip
                    ? 'grey'
                    : 'black'
                  const durationStr = results[name]?.durationStr ? ` (${results[name].durationStr})` : ''
                  const statusText = skip ? 'Skipped' : testStatus || ''

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
                          <i className={`fa ` + (isPaused ? 'fa-pause' : isWaitingForQuietness ? 'fa-hourglass fa-spin' : 'fa-play')} style={{ color: iconColor }}></i>
                          {isRunningTest && !isPaused && <i className="fa fa-spinner fa-spin" style={{ marginLeft: '5px' }}></i>}
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
                              {statusText}
                              {durationStr}
                            </span>
                            {results[name] &&
                              !runningTests.has(name) && ( // Show Logs button only if test is not running
                                <button
                                  onClick={() => showLogsForTimeframe(name)}
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
                      {isPaused && (
                        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center' }}>
                          <span style={{ marginRight: '10px' }}>Paused: {pausedTests[name] || 'Test Paused.'}</span>
                          <button
                            onClick={() => {
                              if (pausedTestResolvers.current[name]) {
                                pausedTestResolvers.current[name]()
                                delete pausedTestResolvers.current[name]
                                setPausedTests((prev) => {
                                  const newPausedTests = { ...prev }
                                  delete newPausedTests[name]
                                  return newPausedTests
                                })
                              }
                            }}
                            style={{
                              backgroundColor: '#e0e0e0',
                              color: '#000',
                              border: '1px solid #ccc',
                              padding: '2px 5px',
                              cursor: 'pointer',
                              fontSize: '12px',
                            }}
                          >
                            Continue
                          </button>
                        </div>
                      )}
                      {results[name]?.error && <div style={{ color: 'red', fontSize: '12px', marginTop: '5px' }}>{results[name].error}</div>}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default TestingPane
