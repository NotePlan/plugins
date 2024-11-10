// @flow

import AssertionError from './CustomError'

type MatcherFunction = (...args: Array<any>) => void

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
     * @throws {Error} If the assertion fails.
     */
    toBe: (expected: any): void => {
      if (actual !== expected) {
        throw new AssertionError(`Expected ${String(actual)} to be ${String(expected)}`, expected, actual)
      }
    },
    /**
     * Asserts that the actual value is deeply equal to the expected value.
     *
     * @param {any} expected - The expected value.
     * @throws {Error} If the assertion fails.
     */
    toEqual: (expected: any): void => {
      const isEqual = JSON.stringify(actual) === JSON.stringify(expected)
      if (!isEqual) {
        throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`)
      }
    },
    /**
     * Asserts that the actual value is undefined.
     *
     * @throws {Error} If the assertion fails.
     */
    toBeUndefined: (): void => {
      if (actual !== undefined) {
        throw new Error(`Expected ${String(actual)} to be undefined`)
      }
    },
    /**
     * Asserts that the actual value is null.
     *
     * @throws {Error} If the assertion fails.
     */
    toBeNull: (): void => {
      if (actual !== null) {
        throw new Error(`Expected ${String(actual)} to be null`)
      }
    },
    /**
     * Asserts that the actual value is truthy.
     *
     * @throws {Error} If the assertion fails.
     */
    toBeTruthy: (): void => {
      if (!actual) {
        throw new Error(`Expected ${String(actual)} to be truthy`)
      }
    },
    /**
     * Asserts that the actual value is falsy.
     *
     * @throws {Error} If the assertion fails.
     */
    toBeFalsy: (): void => {
      if (actual) {
        throw new Error(`Expected ${String(actual)} to be falsy`)
      }
    },
    /**
     * Asserts that the actual array contains the specified item.
     *
     * @param {any} item - The item expected to be in the array.
     * @throws {Error} If the assertion fails.
     */
    toContain: (item: any): void => {
      if (!Array.isArray(actual)) {
        throw new Error(`Expected ${String(actual)} to be an array`)
      }
      if (!actual.includes(item)) {
        throw new Error(`Expected array ${JSON.stringify(actual)} to contain ${String(item)}`)
      }
    },
    /**
     * Asserts that the actual value has the specified length.
     *
     * @param {number} length - The expected length.
     * @throws {Error} If the assertion fails.
     */
    toHaveLength: (length: number): void => {
      if (!actual || typeof actual.length !== 'number') {
        throw new Error(`Expected ${String(actual)} to have a length property`)
      }
      if (actual.length !== length) {
        throw new Error(`Expected length ${actual.length} to be ${length}`)
      }
    },
    /**
     * Asserts that the actual value is greater than the specified value.
     *
     * @param {number} value - The value to compare against.
     * @throws {Error} If the assertion fails.
     */
    toBeGreaterThan: (value: number): void => {
      if (typeof actual !== 'number' || actual <= value) {
        throw new Error(`Expected ${String(actual)} to be greater than ${String(value)}`)
      }
    },
    /**
     * Asserts that the actual value is less than the specified value.
     *
     * @param {number} value - The value to compare against.
     * @throws {Error} If the assertion fails.
     */
    toBeLessThan: (value: number): void => {
      if (typeof actual !== 'number' || actual >= value) {
        throw new Error(`Expected ${String(actual)} to be less than ${String(value)}`)
      }
    },
    // Add more matchers as needed
  }

  const notMatchers: Matchers = {}
  for (const [key, matcher] of Object.entries(matchers)) {
    notMatchers[key] = (...args: Array<any>): void => {
      try {
        matcher(...args)
      } catch (error) {
        return
      }
      throw new Error(`Expected ${String(actual)} not to ${key.replace('to', '').toLowerCase()} ${args.map(String).join(', ')}`)
    }
  }

  return {
    ...matchers,
    not: notMatchers,
  }
}
