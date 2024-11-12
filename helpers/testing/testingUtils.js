// @flow

export type TestResult = {
  message: string,
  expected?: any,
  received?: any,
}

export type TestFunction = () => Promise<TestResult>

/**
 * Runs a test suite and measures its execution time.
 *
 * @param {string} description - The description of the test suite.
 * @param {() => Promise<TestResult>} fn - The test function to execute.
 * @returns {Promise<TestResult>} The result of the test function, including execution time.
 */
export const describe = async (description: string, fn: () => Promise<TestResult>): Promise<TestResult> => {
  const startTime = performance.now()
  const result = await fn()
  const endTime = performance.now()
  const duration = endTime - startTime

  return {
    ...result,
    message: `${description}: ${result.message} (completed in ${duration.toFixed(2)} ms)`,
  }
}

/**
 * Runs a test function and measures its execution time.
 *
 * @param {() => Promise<TestResult>} testFunction - The test function to execute.
 * @returns {Promise<TestResult>} The result of the test function, including execution time.
 */
export const runTestWithTiming = async (testFunction: () => Promise<TestResult>): Promise<TestResult> => {
  const startTime = performance.now()
  const result = await testFunction()
  const endTime = performance.now()
  const duration = endTime - startTime

  return {
    ...result,
    message: `${result.message} (completed in ${duration.toFixed(2)} ms)`,
  }
}

/**
 * Waits for a specified time or until a condition is met.
 * REMEMBER to get context variables again after the waitFor statement if you want to see updates
 * @param {number | () => boolean} conditionOrTime - The condition to check or the time to wait in milliseconds.
 * @param {string} [conditionDesc=''] - A description of the condition, used in error messages.
 * @param {number} [timeout=5000] - The maximum time to wait in milliseconds if a condition is provided.
 * @param {number} [interval=100] - The interval to check the condition in milliseconds.
 * @returns {Promise<void>} Resolves when the condition is met or the timeout occurs.
 * @throws {Error} If the timeout occurs before the condition is met.
 */
export const waitFor = async (conditionOrTime: number | (() => boolean), conditionDesc: string = '', timeout: number = 5000, interval: number = 100): Promise<void> => {
  if (typeof conditionOrTime === 'number') {
    await new Promise((resolve) => setTimeout(resolve, conditionOrTime))
    return
  }

  const startTime = performance.now()
  let elapsed = 0

  while (elapsed < timeout) {
    await new Promise((resolve) => setTimeout(resolve, 0)) // Yield control to event loop to allow it to update context variables if necessary
    if (conditionOrTime()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
    elapsed = performance.now() - startTime
  }

  throw new Error(`Timeout waiting for condition${conditionDesc ? ` (${conditionDesc})` : ''}: after ${timeout} ms`)
}
