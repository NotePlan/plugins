// A set of helper function to help check the types of arbitrary
// values.
//
// This will be particularly useful when reading JSON.
// @flow

type Checker<T> = (val: unknown) => T

export const checkString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value
  }
  throw new Error(`Expected string, got ${typeof value}`)
}

export const checkNumber = (value: unknown): number => {
  if (typeof value === 'number') {
    return value
  }
  throw new Error(`Expected number, got ${typeof value}`)
}

export const checkBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value
  }
  throw new Error(`Expected boolean, got ${typeof value}`)
}

export const checkNull = (value: unknown): null => {
  if (value === null) {
    return value
  }
  throw new Error(`Expected null, got ${typeof value}`)
}

export const checkUndefined = (value: unknown): void => {
  if (value === undefined) {
    return value
  }
  throw new Error(`Expected undefined, got ${typeof value}`)
}

export const checkOr =
  <A, B>(checkA: Checker<A>, checkB: Checker<B>): Checker<A | B> =>
  (value: unknown): A | B => {
    try {
      return checkA(value)
    } catch (eA: any) {
      try {
        return checkB(value)
      } catch (eB: any) {
        throw new Error(`${eA.toString()}\n${eB.toString()}`)
      }
    }
  }

export const checkArray =
  <T>(checker: Checker<T>): Checker<ReadonlyArray<T>> =>
  (value: unknown): Array<T> => {
    if (Array.isArray(value)) {
      for (const el of value) {
        checker(el)
      }
      // This is a limitation of Flow
      return (value as any)
    }
    throw new Error(`Expected array, got ${typeof value}`)
  }

type CheckerToValue = <T>(checker: Checker<T>) => T

export const checkObj =
  <Obj extends { [key: string]: Checker<unknown> }>(checkerObj: Obj): Checker<{
    [key in keyof Obj]: Obj[key] extends Checker<infer T> ? T : never
  }> => (value: unknown) => {
    if (typeof value === 'object' && value !== null) {
      for (const key in checkerObj) {
        // @ts-ignore
        checkerObj[key](value[key])
      }
      // This is a limitation of Flow
      return (value as any)
    }
    throw new Error(`Expected object, got ${typeof value}`)
  }

export const checkWithDefault = <T>(checker: Checker<T>, defaultValue: T): T => {
  try {
    return checker(defaultValue)
  } catch {
    return defaultValue
  }
}
