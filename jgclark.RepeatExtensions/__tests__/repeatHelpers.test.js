/* global describe, expect, test, beforeAll */
// @flow
import { generateNewRepeatDate } from '../src/repeatHelpers'
// import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan /*, Note, Paragraph */ } from '@mocks/index'

describe('generateNewRepeatDate', () => {
  describe('tests from calendar notes', () => {
    test('1d repeat from 20240614 on 20240616 with no due date -> 2024-06-15', () => {
      const mockNote = { date: new Date('2024-06-14'), type: 'Calendar', filename: '20240614.md' }
      const currentContent = 'text @repeat(1d)'
      const completedDate = '2024-06-16'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2024-06-15')
    })

    test('+1d repeat from 20240614 on 20240616 with no due date -> 2024-06-17', () => {
      const mockNote = { date: new Date('2024-06-14'), type: 'Calendar', filename: '20240614.md' }
      const currentContent = 'text @repeat(+1d)'
      const completedDate = '2024-06-16'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2024-06-17')
    })

    test('1d repeat from 20240616 on 20240616 with due date 2024-06-16 -> 2024-06-17', () => {
      const mockNote = { date: new Date('2024-06-14'), type: 'Calendar', filename: '20240614.md' }
      const currentContent = 'text @repeat(+1d) >2024-06-16'
      const completedDate = '2024-06-16'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2024-06-17')
    })

    test('1w repeat from 2024-W45 with no due date -> 2024-W46', () => {
      const mockNote = { date: new Date('2024-10-14'), type: 'Calendar', filename: '2024-W45.md' }
      const currentContent = 'test text @repeat(1w) >2024-W45'
      const completedDate = '2024-11-02'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2024-W46')
    })

    test('+1w repeat from 2024-W45 with no due date -> 2024-W47', () => {
      const mockNote = { date: new Date('2024-10-14'), type: 'Calendar', filename: '2024-W45.md' }
      const currentContent = 'test text @repeat(+1w) >2024-W45'
      const completedDate = '2024-11-14'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2024-W47')
    })
  })
})
