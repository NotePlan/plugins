/* globals describe, expect, test, it, jest, beforeAll, beforeEach, afterEach */

import { parseQuestions } from '../src/journal'
import { DataStore } from '@mocks/index'

beforeAll(() => {
  // global.Calendar = Calendar
  // global.Clipboard = Clipboard
  // global.CommandBar = CommandBar
  global.DataStore = DataStore
  // global.Editor = Editor
  // global.NotePlan = NotePlan
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging
})

const pluginJson = 'jgclark.Journalling'

// Jest suite
describe('Journal', () => {
  describe('parseQuestions', () => {
    it('should parse questions correctly', () => {
      const config = {
        dailyReviewQuestions: `Health: @sleep(<int>) @fruitveg(<int>) #bible<boolean> #stretches<boolean> #closedRings<boolean>
Work: @work(<int>) @1CB(<int>) @CRC(<int>)
Mood: <mood>
Gratitude: <string>
God was: <string>
Alive: <string>
Not Great: <string>
Learn: <string>
Remember: <string>`
      }

      const questions = parseQuestions(config.dailyReviewQuestions)
      
      expect(questions.length).toBe(15)
      expect(questions[0].question).toBe('@sleep')
      expect(questions[0].type).toBe('int')
      expect(questions[0].lineIndex).toBe(0)
      expect(questions[1].question).toBe('@fruitveg')
      expect(questions[1].type).toBe('int')
      expect(questions[1].lineIndex).toBe(0)
      expect(questions[2].question).toBe('#bible')
      expect(questions[2].type).toBe('boolean')
      expect(questions[2].lineIndex).toBe(0)
      expect(questions[3].question).toBe('#stretches')
      expect(questions[3].type).toBe('boolean')
      expect(questions[4].question).toBe('#closedRings')
      expect(questions[4].type).toBe('boolean')
      expect(questions[5].question).toBe('@work')
      expect(questions[5].type).toBe('int')
      expect(questions[6].question).toBe('@1CB')
      expect(questions[6].type).toBe('int')
      expect(questions[7].question).toBe('@CRC')
      expect(questions[7].type).toBe('int')
      expect(questions[8].question).toBe('Mood')
      expect(questions[8].type).toBe('mood')
      expect(questions[9].question).toBe('Gratitude')
      expect(questions[9].type).toBe('string')
    })
  })
})
