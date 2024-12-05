/* global jest */

global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
}

describe('Placeholder', () => {
  test('Placeholder', async () => {
    expect(true).toBe(true)
  })
})
