/* global describe, expect, test */
import colors from 'chalk'
import * as sc from '../NPSyncedCopies'

const FILE = `${colors.yellow('helpers/NPSyncedCopies')}`

describe(`${FILE}`, () => {
  // TODO: need to add tests for: getSyncedCopiesAsList with mocks
  describe('getSyncedCopiesAsList', () => {
    test('should return empty list if no paragraphs', () => {
      const res = sc.getSyncedCopiesAsList([])
      expect(res).toEqual([])
    })
    test('should return a single synced copy', () => {
      const res = sc.getSyncedCopiesAsList([])
      expect(res).toEqual([])
    })
  })
})
