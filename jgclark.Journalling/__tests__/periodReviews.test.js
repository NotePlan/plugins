/* globals describe, expect, test, it, jest, beforeAll, beforeEach, afterEach */

// Last updated: 2026-03-25 for v2.0.0.b3 by @Cursor

import { buildInitialReviewAnswersByFieldName, buildOutputFromReviewWindowAnswers, parseQuestions } from '../src/periodReviews'
import { getPeriodAdjectiveFromType, substituteReviewPeriodPlaceholders } from '../src/journalHelpers'
import { DataStore } from '@mocks/index'

beforeAll(() => {
  // global.Calendar = Calendar
  // global.Clipboard = Clipboard
  // global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = { paragraphs: [] }
  // global.NotePlan = NotePlan
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging
})

// Jest suite
describe('Reviews', () => {
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

    it('should parse duration type', () => {
      const raw = '@focus(<duration>)'
      const questions = parseQuestions(raw)
      expect(questions.length).toBe(1)
      expect(questions[0].type).toBe('duration')
      expect(questions[0].question).toBe('@focus')
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

    it('should ignore <datenext> as a question token', () => {
      const raw = `Next: <datenext>\nMood: <mood>`
      const questions = parseQuestions(raw)
      expect(questions.length).toBe(1)
      expect(questions[0].type).toBe('mood')
      expect(questions[0].question).toBe('Mood')
      expect(questions[0].lineIndex).toBe(1)
    })

    it('should ignore <nextdate> as a question token', () => {
      const raw = `Next: <nextdate>\nMood: <mood>`
      const questions = parseQuestions(raw)
      expect(questions.length).toBe(1)
      expect(questions[0].type).toBe('mood')
    })
  })

  describe('getPeriodAdjectiveFromType', () => {
    it('should return title-case adjectives for known period types', () => {
      expect(getPeriodAdjectiveFromType('day')).toBe('Daily')
      expect(getPeriodAdjectiveFromType('week')).toBe('Weekly')
      expect(getPeriodAdjectiveFromType('month')).toBe('Monthly')
      expect(getPeriodAdjectiveFromType('quarter')).toBe('Quarterly')
      expect(getPeriodAdjectiveFromType('year')).toBe('Yearly')
    })
    it('should return Calendar for unknown period type', () => {
      expect(getPeriodAdjectiveFromType('unknown')).toBe('(error: unknown period type)')
    })
  })

  describe('substituteReviewPeriodPlaceholders', () => {
    it('should expand <date>, <datenext>, and <nextdate>', () => {
      const s = 'A <date> B <datenext> C <nextdate>'
      expect(substituteReviewPeriodPlaceholders(s, '2024-W52', 'week')).toBe('A 2024-W52 B 2025-W01 C 2025-W01')
    })
  })

  describe('buildInitialReviewAnswersByFieldName', () => {
    it('should extract int, duration, boolean, mood, and string answers from review-style lines', () => {
      const config = {
        dailyReviewQuestions: `Health: @sleep(<duration>) @fruitveg(<int>) #bible<boolean> #stretches<boolean> #closedRings<boolean>
Work: @work(<int>) @1CB(<int>) @CRC(<int>)
Mood: <mood>
Gratitude: <string>
Not Great: <string>`,
      }
      const questions = parseQuestions(config.dailyReviewQuestions)
      const textLines = [
        'Not great: something not great',
        '### Journal',
        'Health: @sleep(7:32) @fruitveg(5) #bible #stretches #closedRings',
        'Work: @work(8) @1CB(1) @CRC(2)',
        'Mood: Calm',
        'Gratitude: Family time'
      ]
      const initial = buildInitialReviewAnswersByFieldName(questions, textLines)
      expect(initial.q_0).toBe('7:32')
      expect(initial.q_1).toBe('5')
      expect(initial.q_2).toBe('yes')
      expect(initial.q_3).toBe('yes')
      expect(initial.q_4).toBe('yes')
      expect(initial.q_5).toBe('8')
      expect(initial.q_6).toBe('1')
      expect(initial.q_7).toBe('2')
      expect(initial.q_8).toBe('Calm')
      expect(initial.q_9).toBe('Family time')
      expect(initial.q_10).toBe('something not great')
    })

    it('should prefer the first matching line when several exist', () => {
      const config = { dailyReviewQuestions: 'Gratitude: <string>' }
      const questions = parseQuestions(config.dailyReviewQuestions)
      const lines = ['Gratitude: first', 'Gratitude: second']
      const initial = buildInitialReviewAnswersByFieldName(questions, lines)
      expect(initial.q_0).toBe('first')
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

    it('should extract duration answers from review-style lines', () => {
      const config = { dailyReviewQuestions: '@focus(<duration>)' }
      const questions = parseQuestions(config.dailyReviewQuestions)
      const lines = ['@focus(1:45)']
      const initial = buildInitialReviewAnswersByFieldName(questions, lines)
      expect(initial.q_0).toBe('1:45')
    })
  })

  describe('buildOutputFromReviewWindowAnswers', () => {
    beforeEach(() => {
      global.Editor = { paragraphs: [] }
    })

    it('should build one line for a single string answer and append newline', () => {
      const raw = 'Gratitude: <string>'
      const parsedQuestions = parseQuestions(raw)
      const rawLines = raw.split('\n')
      const out = buildOutputFromReviewWindowAnswers(parsedQuestions, rawLines, '2026-03-27', 'day', { q_0: 'Family' })
      expect(out).toBe('Gratitude: Family\n')
    })

    it('should substitute <date> on template lines that have no questions', () => {
      const raw = 'For: <date>\nMood: <mood>'
      const parsedQuestions = parseQuestions(raw)
      const rawLines = raw.split('\n')
      const out = buildOutputFromReviewWindowAnswers(parsedQuestions, rawLines, '2026-W13', 'week', { q_0: 'Calm' })
      expect(out).toBe('For: 2026-W13\nMood: Calm\n')
    })

    it('should substitute <datenext> for the following period (weekly rollover)', () => {
      const raw = 'Next: <datenext>\nMood: <mood>'
      const parsedQuestions = parseQuestions(raw)
      const rawLines = raw.split('\n')
      const out = buildOutputFromReviewWindowAnswers(parsedQuestions, rawLines, '2024-W52', 'week', { q_0: 'Calm' })
      expect(out).toBe('Next: 2025-W01\nMood: Calm\n')
    })

    it('should substitute <nextdate> like <datenext>', () => {
      const raw = 'Next: <nextdate>\nMood: <mood>'
      const parsedQuestions = parseQuestions(raw)
      const rawLines = raw.split('\n')
      const out = buildOutputFromReviewWindowAnswers(parsedQuestions, rawLines, '2024-W52', 'week', { q_0: 'Calm' })
      expect(out).toBe('Next: 2025-W01\nMood: Calm\n')
    })

    it('should strip presentation delimiters before substituting <date>', () => {
      const raw = 'Period: <date> || (review)'
      const parsedQuestions = parseQuestions(raw)
      const rawLines = raw.split('\n')
      const out = buildOutputFromReviewWindowAnswers(parsedQuestions, rawLines, '2026-03', 'month', {})
      expect(out).toBe('Period: 2026-03 (review)\n')
    })

    it('should join multiple answers on the same line with a single space', () => {
      const raw = 'Health: @sleep(<int>) @fruitveg(<int>)'
      const parsedQuestions = parseQuestions(raw)
      const rawLines = raw.split('\n')
      const out = buildOutputFromReviewWindowAnswers(parsedQuestions, rawLines, '2026-03-27', 'day', {
        q_0: '7',
        q_1: '3',
      })
      expect(out).toBe('Health: @sleep(7) @fruitveg(3)\n')
    })

    it('should output duration answers in [H]H:MM format', () => {
      const raw = '@focus(<duration>)'
      const parsedQuestions = parseQuestions(raw)
      const rawLines = raw.split('\n')
      const out = buildOutputFromReviewWindowAnswers(parsedQuestions, rawLines, '2026-03-27', 'day', { q_0: '1:30' })
      expect(out).toBe('@focus(1:30)\n')
    })

    it('should omit invalid duration answers', () => {
      const raw = '@focus(<duration>)'
      const parsedQuestions = parseQuestions(raw)
      const rawLines = raw.split('\n')
      const out = buildOutputFromReviewWindowAnswers(parsedQuestions, rawLines, '2026-03-27', 'day', { q_0: '1:75' })
      expect(out).toBe('')
    })

    it('should combine multiline bullet answers with newlines (inline tag replacement keeps prefix)', () => {
      const raw = 'Wins: <bullets>'
      const parsedQuestions = parseQuestions(raw)
      const rawLines = raw.split('\n')
      const out = buildOutputFromReviewWindowAnswers(parsedQuestions, rawLines, '2026-03-27', 'day', { q_0: 'first win\nsecond win' })
      expect(out).toBe('Wins:\n- first win\n- second win\n')
    })

    it('should combine multiline checklist answers with newlines (inline tag replacement keeps prefix)', () => {
      const raw = 'Shop: <checklists>'
      const parsedQuestions = parseQuestions(raw)
      const rawLines = raw.split('\n')
      const out = buildOutputFromReviewWindowAnswers(parsedQuestions, rawLines, '2026-03-27', 'day', { q_0: 'eggs\nmilk' })
      expect(out).toBe('Shop:\n+ eggs\n+ milk\n')
    })

    it('should combine multiline task answers with newlines (inline tag replacement keeps prefix)', () => {
      const raw = 'Ship: <tasks>'
      const parsedQuestions = parseQuestions(raw)
      const rawLines = raw.split('\n')
      const out = buildOutputFromReviewWindowAnswers(parsedQuestions, rawLines, '2026-03-27', 'day', { q_0: 'task one\ntask two' })
      expect(out).toBe('Ship:\n* task one\n* task two\n')
    })

    it('should emit boolean tag when answer is true', () => {
      const raw = '#bible<boolean>'
      const parsedQuestions = parseQuestions(raw)
      const rawLines = raw.split('\n')
      const out = buildOutputFromReviewWindowAnswers(parsedQuestions, rawLines, '2026-03-27', 'day', { q_0: true })
      expect(out).toBe('#bible\n')
    })

    it('should omit line when boolean answer is false', () => {
      const raw = '#bible<boolean>'
      const parsedQuestions = parseQuestions(raw)
      const rawLines = raw.split('\n')
      const out = buildOutputFromReviewWindowAnswers(parsedQuestions, rawLines, '2026-03-27', 'day', { q_0: false })
      expect(out).toBe('')
    })

    it('should inject periodString after answers when the template line still contains <date>', () => {
      const parsedQuestions = [
        { question: 'Report', type: 'string', originalLine: 'Report <date>: <string>', lineIndex: 0 },
      ]
      const rawLines = ['Report <date>: <string>']
      const out = buildOutputFromReviewWindowAnswers(parsedQuestions, rawLines, '2026-Q1', 'quarter', { q_0: 'done' })
      expect(out).toBe('Report 2026-Q1: done\n')
    })

    it('should use submitted window answers even when the open note contains similar text', () => {
      const raw = 'Gratitude test: <string>'
      const parsedQuestions = parseQuestions(raw)
      const rawLines = raw.split('\n')
      global.Editor = {
        paragraphs: [{ content: 'Gratitude test: from note' }],
      }
      const out = buildOutputFromReviewWindowAnswers(parsedQuestions, rawLines, '2026-03-27', 'day', { q_0: 'from window' })
      expect(out).toBe('Gratitude test: from window\n')
    })

    it('should return empty string when there are no answers and no <date> lines', () => {
      const raw = 'Note: <string>'
      const parsedQuestions = parseQuestions(raw)
      const rawLines = raw.split('\n')
      const out = buildOutputFromReviewWindowAnswers(parsedQuestions, rawLines, '2026-03-27', 'day', {})
      expect(out).toBe('')
    })
  })
})
