/* globals describe, expect, test */

import { DataStore, Editor, CommandBar, NotePlan } from '@mocks/index'
import { getStartTimeFromPara } from '../dashboardHelpers.js'
import { clo, logDebug } from '@helpers/dev'

// Make DataStore and Editor available globally for the source code
global.DataStore = DataStore
global.Editor = Editor
global.CommandBar = CommandBar
global.NotePlan = NotePlan

// tests start here

describe('sectionHelpers', () => {
  /**
   * Tests for sortSections
   */
  describe('getStartTimeFromPara() tests', () => {
    test('should return 10:00 from 10:00-11:00', () => {
      const para = {
        content: 'just a time range 10:00-11:00',
      }
      const startTime = getStartTimeFromPara(para)
      expect(startTime).toBe('10:00')
    })
    test('should return 10:00 from 10:00', () => {
      const para = {
        content: 'just a time 10:00',
      }
      const startTime = getStartTimeFromPara(para)
      expect(startTime).toBe('10:00')
    })
    test('should return 10:00 from 10:00AM-11:00PM', () => {
      const para = {
        content: '2025-05-09 10:00AM-11:00PM',
      }
      const startTime = getStartTimeFromPara(para)
      expect(startTime).toBe('10:00')
    })
    test('should return 10:00 from 10:00AM', () => {
      const para = {
        content: '2025-05-09 10:00AM',
      }
      const startTime = getStartTimeFromPara(para)
      expect(startTime).toBe('10:00')
    })
    test('should return 10:00', () => {
      const para = {
        content: 'other text 10:00 AM',
      }
      const startTime = getStartTimeFromPara(para)
      expect(startTime).toBe('10:00')
    })
    test('should return 23:00', () => {
      const para = {
        content: 'other text 11:00 PM',
      }
      const startTime = getStartTimeFromPara(para)
      expect(startTime).toBe('23:00')
    })
    test('should return "none" if the para does not have a valid time', () => {
      const para = {
        content: '2025-05-09 10-11',
      }
      const startTime = getStartTimeFromPara(para)
      expect(startTime).toBe('none')
    })
  })
})
