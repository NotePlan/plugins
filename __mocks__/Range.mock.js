/*
 * Range mock class
 *
 * Usage: const myRange = new Range({ param changes here })
 *
 */

export class Range {
  // Properties
  start = 0
  end = 1
  length = 1

  // Methods

  constructor(data?: any = {}) {
    this.__update(data)
  }

  __update(data?: any = {}) {
    Object.keys(data).forEach((key) => {
      this[key] = data[key]
    })
    return this
  }
}
