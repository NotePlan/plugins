// CustomError.js
// @flow

class AssertionError extends Error {
  expected: any
  received: any

  constructor(message: string, expected: any, received: any) {
    super(message)
    this.expected = expected
    this.received = received
  }
}

export default AssertionError
