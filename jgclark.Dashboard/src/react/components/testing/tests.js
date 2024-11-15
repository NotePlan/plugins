// @flow

/*
 * Tests for Dashboard
 * NOTES:
 * - do not destructure the context va
 * - context variables are fixed at the test runtime. so if you have a waitFor statement, get the context variable again after it. See the sample test.
 */

// TODO:
// - make a test that adds a perspective with exclude folders, switches to it, reads it checks a property and deletes it

// Import test modules here and add them to the testGroups array
import generalTests from './general.tests'
import dashboardSettingsTests from './dashboardSettings.tests'
import perspectivesTests from './perspectives.tests'

import { logDebug } from '@helpers/react/reactDev'
import type { AppContextType } from '../AppContext'

type Test = {
  name: string,
  test: (getContext: () => AppContextType) => Promise<void>,
}

type TestGroup = {
  groupName: string,
  tests: Array<Test>,
}

/**
 * Helper function to create a test group from a test module.
 *
 * @param {Object} testModule - The test module containing groupName and tests.
 * @param {() => AppContextType} getContext - A function that returns the current context.
 * @returns {TestGroup} A test group object.
 */
const createTestGroup = (testModule: { groupName: string, tests: Array<Test> }, getContext: () => AppContextType): TestGroup => {
  return {
    groupName: testModule.groupName,
    tests: testModule.tests.map((test) => ({
      ...test,
      test: () => test.test(getContext),
    })),
  }
}

/**
 * Returns an array of test groups.
 *
 * @param {() => AppContextType} getContext - A function that returns the current context.
 * @returns {Array<TestGroup>} An array of test groups with names and test functions.
 */
export const getTestGroups = (getContext: () => AppContextType): Array<TestGroup> => {
  const testModules = [generalTests, dashboardSettingsTests, perspectivesTests] // Add new test modules here

  const testGroups = testModules.map((testModule) => createTestGroup(testModule, getContext))
  return testGroups
}

/**
 * Executes all tests sequentially.
 *
 * @param {Array<{ name: string, test: () => Promise<void> }>} tests - The array of test objects.
 */
export const runTestsSequentially = async (tests: Array<{ name: string, test: () => Promise<void> }>) => {
  for (const test of tests) {
    logDebug(`>>> Starting Test: ${test.name} <<<`)
    const startTime = performance.now()
    try {
      await test.test()
      const duration = performance.now() - startTime
      logDebug(`>>> Passed Test: ${test.name} <<< Duration: ${duration.toFixed(0)}ms`)
    } catch (error) {
      const duration = performance.now() - startTime
      console.error(`>>> Failed Test: ${test.name} <<< Duration: ${duration.toFixed(0)}ms`)
      console.error(`Test failed: ${error.message}`)
    }
  }
}
