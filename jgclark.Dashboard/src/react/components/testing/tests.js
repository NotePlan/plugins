// @flow

/*
 * Tests for Dashboard
 * NOTES:
 * - Do not destructure the context variable except within the test function.
 * - Context variables are fixed at the test runtime, so if you have a waitFor statement, get the context variable again after it.
 */

import generalTests from './general.tests'
import dashboardSettingsTests from './dashboardSettings.tests'
import perspectivesTests from './perspectives.tests'

const testModules = [generalTests, dashboardSettingsTests, perspectivesTests] // Add new test modules here

import type { AppContextType } from '../AppContext'
import type { Test, TestGroup } from '@helpers/testing/testingUtils'

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
      test: (getContext, utils) => test.test(getContext, utils),
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
  const testGroups = testModules.map((testModule) => createTestGroup(testModule, getContext))
  return testGroups
}

export type TestGroup = {
  groupName: string,
  tests: Array<{
    name: string,
    skip?: boolean,
    test: () => Promise<void>,
  }>,
}
