/* globals describe, expect, test, it, jest, beforeAll, beforeEach, afterEach */

// Last updated: 2026-03-25 for v2.0.0.b3 by @Cursor

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
    it('should parse questions correctly (test 1)', () => {
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

    it('should parse bullets, checklists, and tasks types', () => {
      const raw = `Wins: <bullets>
Next: <checklists>
Do: <tasks>`
      const questions = parseQuestions(raw)
      expect(questions.length).toBe(3)
      expect(questions[0].type).toBe('bullets')
      expect(questions[1].type).toBe('checklists')
      expect(questions[2].type).toBe('tasks')
      expect(questions[0].question).toBe('Wins')
    })

    it('should parse markdown headings (## / ###) into h2/h3', () => {
      const raw = `## Top Heading\n### Sub Heading\nTitle: <string>`
      const questions = parseQuestions(raw)
      expect(questions.length).toBe(3)
      expect(questions[0].type).toBe('h2')
      expect(questions[0].question).toBe('Top Heading')
      expect(questions[0].lineIndex).toBe(0)
      expect(questions[1].type).toBe('h3')
      expect(questions[1].question).toBe('Sub Heading')
      expect(questions[1].lineIndex).toBe(1)
      expect(questions[2].type).toBe('string')
      expect(questions[2].question).toBe('Title')
      expect(questions[2].lineIndex).toBe(2)
    })

    it('should parse h2/h3 types in various positions', () => {
      const raw = `<h2> Top Heading\n<h3>Sub Heading\nTitle<h2>`
      const questions = parseQuestions(raw)
      expect(questions.length).toBe(3)
      expect(questions[0].type).toBe('h2')
      expect(questions[0].question).toBe('Top Heading')
      expect(questions[0].lineIndex).toBe(0)
      expect(questions[1].type).toBe('h3')
      expect(questions[1].question).toBe('Sub Heading')
      expect(questions[1].lineIndex).toBe(1)
      expect(questions[2].type).toBe('string')
      expect(questions[2].question).toBe('Title')
      expect(questions[2].lineIndex).toBe(2)
    })

    it('should cope with lines which are just <string> / <bullets> / <checklists> / <tasks>', () => {
      const config = {
        dailyReviewQuestions: `<string>
<bullets>
<h2>H2 Heading
<checklists>
### H3 Heading
<tasks>`,
      }
      const questions = parseQuestions(config.dailyReviewQuestions)
      expect(questions.length).toBe(6)
      expect(questions[0].type).toBe('string')
      expect(questions[0].question).toBe('')
      expect(questions[0].lineIndex).toBe(0)
      expect(questions[1].type).toBe('bullets')
      expect(questions[1].question).toBe('')
      expect(questions[1].lineIndex).toBe(1)
      expect(questions[2].type).toBe('h2')
      expect(questions[2].question).toBe('H2 Heading')
      expect(questions[2].lineIndex).toBe(2)
      expect(questions[3].type).toBe('checklists')
      expect(questions[3].question).toBe('')
      expect(questions[3].lineIndex).toBe(3)
      expect(questions[4].type).toBe('h3')
      expect(questions[4].question).toBe('H3 Heading')
      expect(questions[4].lineIndex).toBe(4)
      expect(questions[5].type).toBe('tasks')
      expect(questions[5].question).toBe('')
      expect(questions[5].lineIndex).toBe(5)
    })

    it('should ignore <date> as a question token', () => {
      const raw = `For: <date>\nMood: <mood>`
      const questions = parseQuestions(raw)
      expect(questions.length).toBe(1)
      expect(questions[0].type).toBe('mood')
      expect(questions[0].question).toBe('Mood')
      expect(questions[0].lineIndex).toBe(1)
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

    it('should extract multiline bullets, checklists, and tasks for pre-fill', () => {
      const config = {
        dailyReviewQuestions: `Wins: <bullets>
Shop: <checklists>
Ship: <tasks>`,
      }
      const questions = parseQuestions(config.dailyReviewQuestions)
      const lines = [
        'Wins: - a\n- b',
        'Shop: + eggs\n+ milk',
        'Ship: * task one\n* task two',
      ]
      const initial = buildInitialReviewAnswersByFieldName(questions, lines)
      expect(initial.q_0).toBe('a\nb')
      expect(initial.q_1).toBe('eggs\nmilk')
      expect(initial.q_2).toBe('task one\ntask two')
    })
  })
})
