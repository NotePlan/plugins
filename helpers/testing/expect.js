// @flow

import AssertionError from './CustomError'

type MatcherFunction = (expected: any, varNameOrMsg?: string) => void

type Matchers = {
  toBe: MatcherFunction,
  toEqual: MatcherFunction,
  toBeUndefined: MatcherFunction,
  toBeNull: MatcherFunction,
  toBeTruthy: MatcherFunction,
  toBeFalsy: MatcherFunction,
  toContain: MatcherFunction,
  toHaveLength: MatcherFunction,
  toBeGreaterThan: MatcherFunction,
  toBeLessThan: MatcherFunction,
  // Add more matchers as needed
}

/**
 * A simple assertion library similar to Jest's expect function.
 *
 * @param {any} actual - The actual value to test against expectations.
 * @returns {Object} An object containing matcher functions.
 */
export const expect = (actual: any): Object => {
  const matchers: Matchers = {
    /**
     * Asserts that the actual value is strictly equal to the expected value.
     *
     * @param {any} expected - The expected value.
     * @param {string} [varNameOrMsg] - An optional variable name or message.
     * @throws {AssertionError} If the assertion fails.
     */
    toBe: (expected: any, varNameOrMsg?: string): void => {
      if (actual !== expected) {
        const message = `Expected ${varNameOrMsg || 'value'} to be ${String(expected)} but received ${String(actual)}`
        throw new AssertionError(message, expected, actual)
      }
    },
    /**
     * Asserts that the actual value is deeply equal to the expected value.
     *
     * @param {any} expected - The expected value.
     * @param {string} [varNameOrMsg] - An optional variable name or message.
     * @throws {AssertionError} If the assertion fails.
     */
    toEqual: (expected: any, varNameOrMsg?: string): void => {
      const isEqual = JSON.stringify(actual) === JSON.stringify(expected)
      if (!isEqual) {
        const message = `Expected ${varNameOrMsg || 'value'} to equal ${JSON.stringify(expected)} but received ${JSON.stringify(actual)}`
        throw new AssertionError(message, expected, actual)
      }
    },
    /**
     * Asserts that the actual value is undefined.
     *
     * @param {string} [varNameOrMsg] - An optional variable name or message.
     * @throws {AssertionError} If the assertion fails.
     */
    toBeUndefined: (varNameOrMsg?: string): void => {
      if (actual !== undefined) {
        const message = `Expected ${varNameOrMsg || 'value'} to be undefined but received ${String(actual)}`
        throw new AssertionError(message, undefined, actual)
      }
    },
    /**
     * Asserts that the actual value is null.
     *
     * @param {string} [varNameOrMsg] - An optional variable name or message.
     * @throws {AssertionError} If the assertion fails.
     */
    toBeNull: (varNameOrMsg?: string): void => {
      if (actual !== null) {
        const message = `Expected ${varNameOrMsg || 'value'} to be null but received ${String(actual)}`
        throw new AssertionError(message, null, actual)
      }
    },
    /**
     * Asserts that the actual value is truthy.
     *
     * @param {string} [varNameOrMsg] - An optional variable name or message.
     * @throws {AssertionError} If the assertion fails.
     */
    toBeTruthy: (varNameOrMsg?: string): void => {
      if (!actual) {
        const message = `Expected ${varNameOrMsg || 'value'} to be truthy but received ${String(actual)}`
        throw new AssertionError(message, true, actual)
      }
    },
    /**
     * Asserts that the actual value is falsy.
     *
     * @param {string} [varNameOrMsg] - An optional variable name or message.
     * @throws {AssertionError} If the assertion fails.
     */
    toBeFalsy: (varNameOrMsg?: string): void => {
      if (actual) {
        const message = `Expected ${varNameOrMsg || 'value'} to be falsy but received ${String(actual)}`
        throw new AssertionError(message, false, actual)
      }
    },
    /**
     * Asserts that the actual array contains the specified item.
     *
     * @param {any} item - The item expected to be in the array.
     * @param {string} [varNameOrMsg] - An optional variable name or message.
     * @throws {AssertionError} If the assertion fails.
     */
    toContain: (item: any, varNameOrMsg?: string): void => {
      if (!Array.isArray(actual)) {
        const message = `Expected ${varNameOrMsg || 'value'} to be an array but received ${String(actual)}`
        throw new AssertionError(message, 'array', actual)
      }
      if (!actual.includes(item)) {
        const message = `Expected array ${varNameOrMsg || 'value'} to contain ${String(item)} but it does not`
        throw new AssertionError(message, item, actual)
      }
    },
    /**
     * Asserts that the actual value has the specified length.
     *
     * @param {number} length - The expected length.
     * @param {string} [varNameOrMsg] - An optional variable name or message.
     * @throws {AssertionError} If the assertion fails.
     */
    toHaveLength: (length: number, varNameOrMsg?: string): void => {
      if (!actual || typeof actual.length !== 'number') {
        const message = `Expected ${varNameOrMsg || 'value'} to have a length property but it does not`
        throw new AssertionError(message, length, actual)
      }
      if (actual.length !== length) {
        const message = `Expected ${varNameOrMsg || 'value'} to have length ${length} but received ${actual.length}`
        throw new AssertionError(message, length, actual.length)
      }
    },
    /**
     * Asserts that the actual value is greater than the specified value.
     *
     * @param {number} value - The value to compare against.
     * @param {string} [varNameOrMsg] - An optional variable name or message.
     * @throws {AssertionError} If the assertion fails.
     */
    toBeGreaterThan: (value: number, varNameOrMsg?: string): void => {
      if (typeof actual !== 'number' || actual <= value) {
        const message = `Expected ${varNameOrMsg || 'value'} to be greater than ${String(value)} but received ${String(actual)}`
        throw new AssertionError(message, value, actual)
      }
    },
    /**
     * Asserts that the actual value is less than the specified value.
     *
     * @param {number} value - The value to compare against.
     * @param {string} [varNameOrMsg] - An optional variable name or message.
     * @throws {AssertionError} If the assertion fails.
     */
    toBeLessThan: (value: number, varNameOrMsg?: string): void => {
      if (typeof actual !== 'number' || actual >= value) {
        const message = `Expected ${varNameOrMsg || 'value'} to be less than ${String(value)} but received ${String(actual)}`
        throw new AssertionError(message, value, actual)
      }
    },
    // Add more matchers as needed
  }

  const notMatchers: Matchers = {}
  for (const [key, matcher] of Object.entries(matchers)) {
    notMatchers[key] = (expected: any, varNameOrMsg?: string): void => {
      try {
        matcher(expected, varNameOrMsg)
      } catch (error) {
        return
      }
      const message = `Expected ${varNameOrMsg || 'value'} not to ${key.replace('to', '').toLowerCase()} ${String(expected)}`
      throw new AssertionError(message, expected, actual)
    }
  }

  return {
    ...matchers,
    not: notMatchers,
  }
}
