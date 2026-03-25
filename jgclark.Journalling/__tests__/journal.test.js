/* globals describe, expect, test, it, jest, beforeAll, beforeEach, afterEach */

import { buildInitialReviewAnswersByFieldName, parseQuestions } from '../src/journal'
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

  describe('buildInitialReviewAnswersByFieldName', () => {
    it('should extract int, boolean, mood, and string answers from review-style lines', () => {
      const config = {
        dailyReviewQuestions: `Health: @sleep(<int>) @fruitveg(<int>) #bible<boolean> #stretches<boolean> #closedRings<boolean>
Work: @work(<int>) @1CB(<int>) @CRC(<int>)
Mood: <mood>
Gratitude: <string>
God was: <string>`,
      }
      const questions = parseQuestions(config.dailyReviewQuestions)
      const lines = [
        'Health: @sleep(7) @fruitveg(5) #bible #stretches #closedRings',
        'Work: @work(8) @1CB(1) @CRC(2)',
        'Mood: Calm',
        'Gratitude: Family time',
        'God was: present',
      ]
      const initial = buildInitialReviewAnswersByFieldName(questions, lines)
      expect(initial.q_0).toBe('7')
      expect(initial.q_1).toBe('5')
      expect(initial.q_2).toBe('yes')
      expect(initial.q_3).toBe('yes')
      expect(initial.q_4).toBe('yes')
      expect(initial.q_5).toBe('8')
      expect(initial.q_6).toBe('1')
      expect(initial.q_7).toBe('2')
      expect(initial.q_8).toBe('Calm')
      expect(initial.q_9).toBe('Family time')
      expect(initial.q_10).toBe('present')
    })

    it('should prefer the last matching line when several exist', () => {
      const config = { dailyReviewQuestions: 'Gratitude: <string>' }
      const questions = parseQuestions(config.dailyReviewQuestions)
      const lines = ['Gratitude: first', 'Gratitude: second']
      const initial = buildInitialReviewAnswersByFieldName(questions, lines)
      expect(initial.q_0).toBe('second')
    })
  })
})
