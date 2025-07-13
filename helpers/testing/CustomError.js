// CustomError.js
// @flow

class AssertionError extends Error {
  expected: any
  received: any
  condition: string
  constructor(message: string, expected: any, received: any) {
    super(message)
    this.expected = expected
    this.received = received
    this.condition = message
  }
}

export default AssertionError
