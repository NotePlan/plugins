// A set of helper function to help check the types of arbitrary
// values.
//
// This will be particularly useful when reading JSON.
// @flow

type Checker<T> = (mixed) => T

/**
 * Ensure a value is a string or throw with a descriptive error.
 * @param {mixed} value - Value to validate as a string.
 * @returns {string} The validated string value.
 * @throws {Error} If the value is not a string.
 */
export const checkString = (value: mixed): string => {
  if (typeof value === 'string') {
    return value
  }
  throw new Error(`Expected string, got ${typeof value}`)
}

/**
 * Ensure a value is a number or throw with a descriptive error.
 * @param {mixed} value - Value to validate as a number.
 * @returns {number} The validated number value.
 * @throws {Error} If the value is not a number.
 */
export const checkNumber = (value: mixed): number => {
  if (typeof value === 'number') {
    return value
  }
  throw new Error(`Expected number, got ${typeof value}`)
}

/**
 * Ensure a value is a boolean or throw with a descriptive error.
 * @param {mixed} value - Value to validate as a boolean.
 * @returns {boolean} The validated boolean value.
 * @throws {Error} If the value is not a boolean.
 */
export const checkBoolean = (value: mixed): boolean => {
  if (typeof value === 'boolean') {
    return value
  }
  throw new Error(`Expected boolean, got ${typeof value}`)
}

/**
 * Ensure a value is exactly `null` or throw with a descriptive error.
 * @param {mixed} value - Value to validate as null.
 * @returns {null} The validated null value.
 * @throws {Error} If the value is not null.
 */
export const checkNull = (value: mixed): null => {
  if (value === null) {
    return value
  }
  throw new Error(`Expected null, got ${typeof value}`)
}

/**
 * Ensure a value is exactly `undefined` or throw with a descriptive error.
 * @param {mixed} value - Value to validate as undefined.
 * @returns {void} `undefined` when validation succeeds.
 * @throws {Error} If the value is not undefined.
 */
export const checkUndefined = (value: mixed): void => {
  if (value === undefined) {
    return value
  }
  throw new Error(`Expected undefined, got ${typeof value}`)
}

/**
 * Compose two checkers and accept a value if either checker passes.
 * @template A, B
 * @param {Checker<A>} checkA - First type checker to try.
 * @param {Checker<B>} checkB - Second type checker to try if the first fails.
 * @returns {Checker<A|B>} A checker that validates against either A or B.
 * @throws {Error} Combined error message if both checks fail.
 */
export const checkOr =
  <A, B>(checkA: Checker<A>, checkB: Checker<B>): Checker<A | B> =>
  (value: mixed): A | B => {
    try {
      return checkA(value)
    } catch (eA) {
      try {
        return checkB(value)
      } catch (eB) {
        throw new Error(`${eA.toString()}\n${eB.toString()}`)
      }
    }
  }

/**
 * Create a checker that validates an array where every element passes a given checker.
 * @template T
 * @param {Checker<T>} checker - Checker to validate each element of the array.
 * @returns {Checker<$ReadOnlyArray<T>>} Checker for arrays of the given element type.
 * @throws {Error} If the value is not an array.
 */
export const checkArray =
  <T>(checker: Checker<T>): Checker<$ReadOnlyArray<T>> =>
  (value: mixed): Array<T> => {
    if (Array.isArray(value)) {
      for (const el of value) {
        checker(el)
      }
      // This is a limitation of Flow
      return (value: $FlowFixMe)
    }
    throw new Error(`Expected array, got ${typeof value}`)
  }

type CheckerToValue = <T>(Checker<T>) => T

/**
 * Create a checker for an object whose properties are validated by a map of property checkers.
 * Keys in `checkerObj` correspond to keys expected on the value being checked.
 * @template Obj
 * @param {{ +[string]: Checker<mixed> }} checkerObj - Map of property names to checker functions.
 * @returns {Checker<$ObjMap<Obj, CheckerToValue>>} Checker for objects matching the specified shape.
 * @throws {Error} If the value is not an object.
 */
export const checkObj =
  <Obj: { +[string]: Checker<mixed> }>(checkerObj: Obj): Checker<$ObjMap<Obj, CheckerToValue>> =>
  (value: mixed) => {
    if (typeof value === 'object' && value !== null) {
      for (const key in checkerObj) {
        checkerObj[key](value[key])
      }
      // This is a limitation of Flow
      return (value: $FlowFixMe)
    }
    throw new Error(`Expected object, got ${typeof value}`)
  }

/**
 * Run a checker with a default value, falling back to the default if validation fails.
 * @template T
 * @param {Checker<T>} checker - Type checker to validate the default value.
 * @param {T} defaultValue - Default value to return on failure.
 * @returns {T} Either the successfully checked value or the original default on error.
 */
export const checkWithDefault = <T>(checker: Checker<T>, defaultValue: T): T => {
  try {
    return checker(defaultValue)
  } catch {
    return defaultValue
  }
}
