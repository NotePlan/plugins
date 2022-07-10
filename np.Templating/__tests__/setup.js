/* global jest */

global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
}
