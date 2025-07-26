/* global jest, describe, test, expect */

global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}

global.DataStore = {
  settings: { _logLevel: 'none' },
  projectNotes: [],
  calendarNotes: [],
}

describe('Test Environment Setup', () => {
  test('should have mocked console', async () => {
    await Promise.resolve()
    expect(global.console.log).toBeDefined()
  })
})
