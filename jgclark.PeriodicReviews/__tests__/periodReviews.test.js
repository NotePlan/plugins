/* globals describe, expect, test, it, jest, beforeAll, beforeEach, afterEach */

// Last updated: 2026-03-25 for v2.0.0.b3 by @Cursor

import {
  buildNextPeriodNotePlanSectionHeadingTitle,
  buildNextPlanSectionHeadingTitle,
  getPeriodAdjectiveFromType,
  getPlanItemsNameForPeriodType,
  mergeUniqueSummaryDoneTaskLines,
  normalizePlanningTaskLinesFromForm,
  splitMergedSummaryDoneLinesIntoWinsAndOthers,
  substituteReviewPeriodPlaceholders,
  summaryTaskLineDedupeKey,
} from '../src/periodicReviewHelpers'
import { extractPlanSectionItems, taskContentIsSummaryWin } from '../src/periodReviews'
import { buildReviewHTML } from '../src/reviewHTMLViewGenerator'
import {
  buildInitialReviewAnswersByFieldName,
  buildOutputFromReviewWindowAnswers,
  parseQuestions,
} from '../src/reviewQuestions'
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

    it('should parse <integer> the same as <int>', () => {
      const raw = `Hours: <integer> || Count: <int>`
      const questions = parseQuestions(raw)
      expect(questions.length).toBe(2)
      expect(questions[0].type).toBe('int')
      expect(questions[0].question).toBe('Hours')
      expect(questions[1].type).toBe('int')
      expect(questions[1].question).toBe('Count')
    })

    it('should strip full <string> tokens from label text (no stray marker for the review window)', () => {
      const questions = parseQuestions('Gratitude: <string>')
      expect(questions.length).toBe(1)
      expect(questions[0].type).toBe('string')
      expect(questions[0].question).toBe('Gratitude')
      expect(questions[0].question).not.toMatch(/[<>]/)
    })

    it('should cope with lines which are just <string> / <bullets> / <checklists> / <tasks>', () => {
      const config = {
        dailyReviewQuestions: `<string>
<bullets>
## H2 Heading
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

  describe('buildReviewHTML', () => {
    it('should substitute <date> in ## heading text (parsed question, not only raw line)', () => {
      const raw = `## Weekly Review for <date>
Wins: <string>`
      const parsedQuestions = parseQuestions(raw)
      const rawLines = raw.split('\n')
      const html = buildReviewHTML(
        { moods: 'Calm,Busy' },
        parsedQuestions,
        rawLines,
        [],
        [],
        '2026-W13',
        'week',
        [],
        'onReviewWindowAction',
        'Top Wins',
        {},
        [],
      )
      expect(html).toContain('Weekly Review for')
      expect(html).toContain('2026-W13')
      expect(html).not.toContain('&lt;date&gt;')
    })

    it('should render a ## heading line as one heading (segment regex must not split after the first word)', () => {
      const raw = `## Stats for <date>
Mood: <mood>`
      const parsedQuestions = parseQuestions(raw)
      const rawLines = raw.split('\n')
      const html = buildReviewHTML(
        { moods: 'Calm,Busy' },
        parsedQuestions,
        rawLines,
        [],
        [],
        '2026-04-06',
        'day',
        [],
        'onReviewWindowAction',
        'Big Wins',
        {},
        [],
      )
      expect(html).toContain('Stats for 2026-04-06')
      expect(html).not.toContain('review-line-text-fragment"> for 2026-04-06</span>')
    })

    it('should keep daily completed-tasks and events inside #summary section-wrap when carry-over plan items exist', () => {
      const raw = `## Stats for <date>
Mood: <mood>`
      const parsedQuestions = parseQuestions(raw)
      const rawLines = raw.split('\n')
      const eventsForPeriod = [
        {
          title: 'Pray for Jill',
          date: new Date('2026-04-07T10:00:00'),
          endDate: new Date('2026-04-07T10:18:00'),
          isAllDay: false,
        },
      ]
      const html = buildReviewHTML(
        { moods: 'Calm,Busy' },
        parsedQuestions,
        rawLines,
        [],
        [],
        '2026-04-07',
        'day',
        eventsForPeriod,
        'onReviewWindowAction',
        'Wins',
        {},
        [{ content: 'Rest day', isDone: false }],
      )
      const summaryMarker = 'id="summary">'
      const summaryStart = html.indexOf(summaryMarker)
      expect(summaryStart).toBeGreaterThan(-1)
      const afterSummary = html.slice(summaryStart + summaryMarker.length)
      const formIdx = afterSummary.indexOf('<form id="review-form"')
      expect(formIdx).toBeGreaterThan(-1)
      const summaryInner = afterSummary.slice(0, formIdx)
      const completedIdx = summaryInner.indexOf('completed tasks')
      expect(completedIdx).toBeGreaterThan(-1)
      let depth = 1
      const upToCompleted = summaryInner.slice(0, completedIdx)
      const re = /<\/div\s*>|<div\b/gi
      let m
      while ((m = re.exec(upToCompleted)) !== null) {
        if (m[0].startsWith('</')) depth--
        else depth++
      }
      expect(depth).toBeGreaterThan(0)
    })

    it('should list wins first then "other completed task(s)" heading and other dones (daily, each once)', () => {
      const raw = `Mood: <mood>`
      const parsedQuestions = parseQuestions(raw)
      const rawLines = raw.split('\n')
      const html = buildReviewHTML(
        { moods: 'Calm,Busy' },
        parsedQuestions,
        rawLines,
        ['* >> Planned win @done(2026-04-07)'],
        ['Plain task @done(2026-04-07)'],
        '2026-04-07',
        'day',
        [],
        'onReviewWindowAction',
        'Big Wins',
        {},
        [],
      )
      expect(html.indexOf('summary-content-wins')).toBe(-1)
      expect(html).toContain('summary-content-completed-tasks')
      expect(html).toContain('1 other completed task')
      expect(html).not.toMatch(/\b2 completed tasks\b/)
      expect(html.indexOf('Planned win')).toBeLessThan(html.indexOf('other completed'))
      expect(html.indexOf('other completed')).toBeLessThan(html.indexOf('Plain task'))
    })
  })

  describe('splitMergedSummaryDoneLinesIntoWinsAndOthers', () => {
    it('should split merged list after last leading win line', () => {
      const merged = [
        '* >> Win @done(2026-04-08)',
        'Plain @done(2026-04-08)',
      ]
      const { wins, others } = splitMergedSummaryDoneLinesIntoWinsAndOthers(merged)
      expect(wins).toEqual(['* >> Win @done(2026-04-08)'])
      expect(others).toEqual(['Plain @done(2026-04-08)'])
    })
  })

  describe('mergeUniqueSummaryDoneTaskLines', () => {
    it('should keep win order, drop duplicate keys, and omit lines matching carry-over text', () => {
      const wins = ['* >> A @done(2026-04-08)', '  * >> A @done(2026-04-08)  ']
      const rest = ['B @done(2026-04-08)', 'B @done(2026-04-08)']
      expect(mergeUniqueSummaryDoneTaskLines(wins, rest, [])).toEqual(['* >> A @done(2026-04-08)', 'B @done(2026-04-08)'])
      expect(
        mergeUniqueSummaryDoneTaskLines(['x @done'], ['y'], [{ content: 'x @done', isDone: false }]),
      ).toEqual(['y'])
    })

    it('should treat summaryTaskLineDedupeKey as trim-only', () => {
      expect(summaryTaskLineDedupeKey('  hello  ')).toBe('hello')
    })
  })

  describe('taskContentIsSummaryWin', () => {
    it('should treat >> after optional task marker and priorities as a win', () => {
      expect(taskContentIsSummaryWin('* >> Ship it @done(2026-04-08)')).toBe(true)
      expect(taskContentIsSummaryWin('>> Ship it @done(2026-04-08)')).toBe(true)
      expect(taskContentIsSummaryWin('! >> Ship @done(2026-04-08)')).toBe(true)
      expect(taskContentIsSummaryWin('Regular task @done(2026-04-08)')).toBe(false)
    })

    it('should treat #win / #bigwin as wins regardless of >>', () => {
      expect(taskContentIsSummaryWin('Launched #win @done(2026-04-08)')).toBe(true)
      expect(taskContentIsSummaryWin('Big thing #bigwin @done(2026-04-08)')).toBe(true)
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

    it('should extract token duration answers even when template segment has extra prefix text', () => {
      const config = { dailyReviewQuestions: 'Health: @sleep(<duration>) @fruitveg(<int>)' }
      const questions = parseQuestions(config.dailyReviewQuestions)
      const lines = ['@sleep(7:52)']
      const initial = buildInitialReviewAnswersByFieldName(questions, lines)
      expect(initial.q_0).toBe('7:52')
    })

    it('should extract token int answers even when template segment has extra prefix text', () => {
      const config = { dailyReviewQuestions: 'Health: @sleep(<duration>) @fruitveg(<int>)' }
      const questions = parseQuestions(config.dailyReviewQuestions)
      const lines = ['@fruitveg(5)']
      const initial = buildInitialReviewAnswersByFieldName(questions, lines)
      expect(initial.q_1).toBe('5')
    })

    it('should extract token number answers even when template segment has extra prefix text', () => {
      const config = { dailyReviewQuestions: 'Stats: @weight(<number>)' }
      const questions = parseQuestions(config.dailyReviewQuestions)
      const lines = ['@weight(6.8)']
      const initial = buildInitialReviewAnswersByFieldName(questions, lines)
      expect(initial.q_0).toBe('6.8')
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

    it('should substitute answers into <integer> segments like <int>', () => {
      const raw = 'Count: <integer>'
      const parsedQuestions = parseQuestions(raw)
      const rawLines = raw.split('\n')
      const out = buildOutputFromReviewWindowAnswers(parsedQuestions, rawLines, '2026-03-27', 'day', { q_0: '42' })
      expect(out).toBe('Count: 42\n')
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

  describe('planning helpers', () => {
    it('buildNextPlanSectionHeadingTitle should format review-window planning block title', () => {
      expect(buildNextPlanSectionHeadingTitle('Top 3 Wins', 'week')).toBe('Planning: Top 3 Wins for the next week')
      expect(buildNextPlanSectionHeadingTitle('Big 3 Rocks', 'day')).toBe('Planning: Big 3 Rocks for the next day')
      expect(buildNextPlanSectionHeadingTitle('Goals', 'quarter')).toBe('Planning: Goals for the next quarter')
    })

    it('buildNextPeriodNotePlanSectionHeadingTitle should use plan name and target period calendar title', () => {
      expect(buildNextPeriodNotePlanSectionHeadingTitle('Top 3 Wins', '2026-W14')).toBe('Top 3 Wins for 2026-W14')
      expect(buildNextPeriodNotePlanSectionHeadingTitle('Big Rocks', '2026-04-04')).toBe('Big Rocks for 2026-04-04')
      expect(buildNextPeriodNotePlanSectionHeadingTitle('Goals', '2026-Q2')).toBe('Goals for 2026-Q2')
    })

    it('getPlanItemsNameForPeriodType should use defaults when config keys missing or blank', () => {
      const minimal = {}
      expect(getPlanItemsNameForPeriodType(minimal, 'day')).toBe('Big Rocks')
      expect(getPlanItemsNameForPeriodType(minimal, 'week')).toBe('Top Wins')
      const custom = { weekPlanItemsName: 'Wins' }
      expect(getPlanItemsNameForPeriodType(custom, 'week')).toBe('Wins')
    })

    it('normalizePlanningTaskLinesFromForm should strip task markers and >>', () => {
      expect(normalizePlanningTaskLinesFromForm('')).toEqual([])
      expect(normalizePlanningTaskLinesFromForm('  a  \n\n* >> b')).toEqual(['a', 'b'])
      expect(normalizePlanningTaskLinesFromForm('>> solo')).toEqual(['solo'])
    })

    it('extractPlanSectionItems should read open and done tasks under matching H2', () => {
      const heading = 'Top 3 Wins for the next week'
      const note = {
        paragraphs: [
          { type: 'title', headingLevel: 2, content: heading, lineIndex: 0 },
          { type: 'open', content: '* >> First', lineIndex: 1 },
          { type: 'done', content: '* >> Second @done(2026-03-30)', lineIndex: 2 },
        ],
      }
      const items = extractPlanSectionItems(note, heading)
      expect(items.length).toBe(2)
      expect(items[0].isDone).toBe(false)
      expect(items[1].isDone).toBe(true)
      expect(items[0].content).toContain('First')
    })

    it('extractPlanSectionItems should include cancelled >> tasks as not done (summary treats like open)', () => {
      const note = {
        paragraphs: [
          { type: 'title', headingLevel: 2, content: 'Home', lineIndex: 0 },
          { type: 'cancelled', content: '>> Sort new Santander account', lineIndex: 1 },
          { type: 'done', content: 'Update milk order again @done(2026-04-12 00:05)', lineIndex: 2 },
        ],
      }
      const items = extractPlanSectionItems(note, '')
      expect(items.length).toBe(1)
      expect(items[0].isDone).toBe(false)
      expect(items[0].content).toContain('Sort new Santander')
    })
  })
})
