/* globals describe, expect, test, beforeAll, afterAll */
// import colors from 'chalk'
// import /* differenceInCalendarDays, endOfDay, startOfDay, eachMinuteOfInterval, */ 'date-fns'
import * as tb from '../src/timeblocking-helpers'
import { getTasksByType } from '@helpers/sorting'

import { JSP } from '@helpers/dev'

import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, Note /* Paragraph */ } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging
})

const PLUGIN_NAME = `dwertheimer.EventAutomations`
// const section = colors.blue

const config = {
  todoChar: '*' /* character at the front of a timeblock line - can be *,-,or a heading, e.g. #### */,
  timeBlockTag: `#🕑` /* placed at the end of the timeblock to show it was created by this plugin */,
  timeBlockHeading: 'Time Blocks' /* if this heading exists in the note, timeblocks will be placed under it */,
  workDayStart: '08:00' /* needs to be in 24 hour format (two digits, leading zero) */,
  workDayEnd: '18:00' /* needs to be in 24 hour format (two digits, leading zero) */,
  durationMarker: "'" /* signifies how long a task is, e.g. apostrophe: '2h5m or use another character, e.g. tilde: ~2h5m */,
  intervalMins: 5 /* inverval on which to calculate time blocks */,
  removeDuration: true /* remove duration when creating timeblock text */,
  nowStrOverride: '00:00' /* for testing */,
  defaultDuration: 10 /* default duration of a task that has no duration/end time */,
  includeLinks: '[[internal#links]]',
}

// import { isNullableTypeAnnotation } from '@babel/types'

// Jest suite
describe(`${PLUGIN_NAME}`, () => {
  describe('timeblocking-helpers.js', () => {
    describe('createIntervalMap ', () => {
      test('should create timeMap of 5min intervals all day ', () => {
        const result = tb.createIntervalMap({ start: new Date('2020-01-01 08:00:00'), end: new Date('2020-01-01 24:00:00') }, 'isSet', {
          step: 5,
        })
        expect(result[0]).toEqual({ start: '08:00', busy: 'isSet', index: 0 })
        expect(result[191]).toEqual({ start: '23:55', busy: 'isSet', index: 191 })
        expect(result.length).toEqual(193)
      })
      test('should create timeMap of 3min intervals all day ', () => {
        const result = tb.createIntervalMap({ start: new Date('2020-01-01 00:00:00'), end: new Date('2020-01-01 23:59:59') }, null, {
          step: 3,
        })
        expect(result[0]).toEqual({ start: '00:00', busy: null, index: 0 })
        expect(result[479]).toEqual({ start: '23:57', busy: null, index: 479 })
        expect(result.length).toEqual(480)
      })
      test('should return null when params are null', () => {
        const result = tb.createIntervalMap({ start: new Date('2020-01-01 00:00:00'), end: new Date('2020-01-01 23:59:59') }, null, {})
        expect(result).toEqual([])
      })
    })
    test('getBlankDayMap(5) returns all-day map of 5 min intervals ', () => {
      const result = tb.getBlankDayMap(5)
      expect(result[0]).toEqual({ start: '00:00', busy: false, index: 0 })
      expect(result[287]).toEqual({ start: '23:55', busy: false, index: 287 })
      expect(result.length).toEqual(288)
    })
    describe('blockTimeFor ', () => {
      test('should mark time map slots as busy (with title) for time of event in 2nd param', () => {
        const map = tb.getBlankDayMap(5)
        const result = tb.blockTimeFor(map, { start: '08:00', end: '09:00', title: 'testing' }, config)
        expect(result.newMap[0]).toEqual({ start: '00:00', busy: false, index: 0 })
        expect(result.newMap[95]).toEqual({ start: '07:55', busy: false, index: 95 })
        expect(result.newMap[96]).toEqual({ start: '08:00', busy: 'testing', index: 96 })
        expect(result.newMap[107]).toEqual({ start: '08:55', busy: 'testing', index: 107 })
        expect(result.newMap[108]).toEqual({ start: '09:00', busy: false, index: 108 })
        expect(result.newMap[287]).toEqual({ start: '23:55', busy: false, index: 287 })
      })
      test('should mark time map as busy: true for item without name ', () => {
        const map = tb.getBlankDayMap(5)
        const result = tb.blockTimeFor(map, { start: '08:00', end: '09:00' }, config)
        expect(result.itemText).toEqual('')
        expect(result.newMap[0]).toEqual({ start: '00:00', busy: false, index: 0 })
        expect(result.newMap[96]).toEqual({ start: '08:00', busy: true, index: 96 })
        expect(result.newMap[107]).toEqual({ start: '08:55', busy: true, index: 107 })
        expect(result.newMap[108]).toEqual({ start: '09:00', busy: false, index: 108 })
      })
    })
    describe('attachTimeblockTag', () => {
      test('should attach the given timeblock tag to a line of text', () => {
        expect(tb.attachTimeblockTag('test', '#tag')).toEqual('test #tag')
      })
      test('should not duplicate tag when attaching to a line which already has the tag', () => {
        expect(tb.attachTimeblockTag('test #tag', '#tag')).toEqual('test #tag')
      })
    })
    describe('createTimeBlockLine ', () => {
      test('should create timeblock text in form "* HH:MM-HH:MM [name] #timeblocktag" ', () => {
        const cfg = { ...config, timeBlockTag: '#tag', removeDuration: true }
        expect(tb.createTimeBlockLine({ title: 'foo', start: '08:00', end: '09:00' }, cfg)).toEqual('* 08:00-09:00 foo #tag')
      })
      test('should return empty string if title is empty', () => {
        const cfg = { ...config, timeBlockTag: '#tag', removeDuration: true }
        expect(tb.createTimeBlockLine({ title: '', start: '08:00', end: '09:00' }, cfg)).toEqual('')
      })
      test("should not remove duration time signature ('2h22m) from text when removeDuration config is false", () => {
        const cfg = { ...config, timeBlockTag: '#tag', removeDuration: false }
        expect(tb.createTimeBlockLine({ title: "foo bar '2h22m", start: '08:00', end: '09:00' }, cfg)).toEqual("* 08:00-09:00 foo bar '2h22m #tag")
      })
      test("should remove duration time signature ('2h22m) from text when removeDuration config is true", () => {
        const cfg = { ...config, timeBlockTag: '#tag', removeDuration: true }
        expect(tb.createTimeBlockLine({ title: "foo bar '2h22m", start: '08:00', end: '09:00' }, cfg)).toEqual('* 08:00-09:00 foo bar #tag')
      })
      test('should add tb text when timeblockTextMustContainString is set', () => {
        const cfg = { ...config, timeblockTextMustContainString: '#tb', removeDuration: true }
        expect(tb.createTimeBlockLine({ title: "foo bar '2h22m", start: '08:00', end: '09:00' }, cfg)).toEqual('* 08:00-09:00 foo bar #🕑 #tb')
      })
      test('should not add tb text when timeblockTextMustContainString is set and tb text is already in the string', () => {
        const cfg = { ...config, timeblockTextMustContainString: '#tb', removeDuration: true }
        expect(tb.createTimeBlockLine({ title: "foo bar#tb '2h22m", start: '08:00', end: '09:00' }, cfg)).toEqual('* 08:00-09:00 foo bar#tb #🕑')
      })
    })
    describe('blockOutEvents ', () => {
      test('should block (only) times on the time map for the event given', () => {
        const map = tb.getBlankDayMap(5)
        const events = [{ date: new Date('2021-01-01 00:10'), endDate: new Date('2021-01-01 00:21'), title: 'event1' }]
        const returnVal = tb.blockOutEvents(events, map, config)
        expect(returnVal[1].busy).toEqual(false)
        expect(returnVal[2].busy).toEqual('event1')
        expect(returnVal[5].busy).toEqual(false)
      })
      test('should not block times for an event if availability flag is 1 (free)', () => {
        const map = tb.getBlankDayMap(5)
        const events = [{ date: new Date('2021-01-01 00:10'), endDate: new Date('2021-01-01 00:21'), title: 'event1', availability: 1 }]
        const returnVal = tb.blockOutEvents(events, map, config)
        expect(returnVal[1].busy).toEqual(false)
        expect(returnVal[2].busy).toEqual(false)
        expect(returnVal[5].busy).toEqual(false)
      })
      test('overlapping events should get blocked with the later events reflected in the busy field', () => {
        const map = tb.getBlankDayMap(5)
        const events = [{ date: new Date('2021-01-01 00:10'), endDate: new Date('2021-01-01 00:21'), title: 'event1' }]
        events.push({
          date: new Date('2021-01-01 00:20'),
          endDate: new Date('2021-01-01 00:30'),
          title: 'event2',
        })
        const returnVal = tb.blockOutEvents(events, map, config)
        expect(returnVal[4].busy).toEqual('event2')
        expect(returnVal[6].busy).toEqual(false)
      })
      test('If calendar items have no endDate, they are ignored', () => {
        const map = tb.getBlankDayMap(5)
        const events = [{ date: new Date('2021-01-01 00:20'), title: 'event3' }]
        const returnVal = tb.blockOutEvents(events, map, config)
        expect(returnVal.filter((t) => t.busy === 'event3')).toEqual([])
      })
    })

    test('removeDurationParameter ', () => {
      // hours and mins
      expect(tb.removeDurationParameter('this is foo ~2h22m', '~')).toEqual('this is foo')
      // minutes only
      expect(tb.removeDurationParameter('this is foo ~22m', '~')).toEqual('this is foo')
      // multiple splits (after the duration)
      expect(tb.removeDurationParameter('this is foo ~22m (2)', '~')).toEqual('this is foo (2)')
      // multiple splits (before the duration)
      expect(tb.removeDurationParameter('this is foo (2) ~22m', '~')).toEqual('this is foo (2)')
    })

    test('getDurationFromLine ', () => {
      expect(tb.getDurationFromLine('', "'")).toEqual(0)
      expect(tb.getDurationFromLine('no time sig', "'")).toEqual(0)
      expect(tb.getDurationFromLine(" '2m", "'")).toEqual(2)
      expect(tb.getDurationFromLine(" '2h", "'")).toEqual(120)
      expect(tb.getDurationFromLine(" '2.5h", "'")).toEqual(150)
      expect(tb.getDurationFromLine(" '2.5m", "'")).toEqual(3)
      expect(tb.getDurationFromLine(" '2h5m", "'")).toEqual(125)
    })

    test('addDurationToTasks ', () => {
      const res = tb.addDurationToTasks([{ content: `foo '1h4m` }], config)
      expect(res[0].duration).toEqual(64)
    })

    test('removeDateTagsFromArray ', () => {
      const inputArray = [
        { indents: 1, type: 'open', content: 'thecontent >today', rawContent: '* thecontent >today' },
        { indents: 0, type: 'scheduled', content: '2thecontent >2021-01-01', rawContent: '* 2thecontent >2021-01-01' },
        { indents: 0, type: 'scheduled', content: '', rawContent: '' },
      ]
      const returnval = tb.removeDateTagsFromArray(inputArray)
      expect(returnval[0].content).toEqual('thecontent')
      expect(returnval[1].rawContent).toEqual('* 2thecontent')
      expect(returnval[2].content).toEqual('')
    })

    describe('timeIsAfterWorkHours', () => {
      const config = { workDayStart: '08:00', workDayEnd: '17:00' }
      test('should be true when now is >= workdayEnd', () => {
        expect(tb.timeIsAfterWorkHours('17:00', config)).toEqual(true)
      })
      test('should be false when now is < workdayEnd', () => {
        expect(tb.timeIsAfterWorkHours('16:59', config)).toEqual(false)
      })
    })

    describe('filterTimeMapToOpenSlots', () => {
      test('filterTimeMapToOpenSlots ', () => {
        const timeMap = [
          { start: '00:00', busy: false },
          { start: '00:05', busy: false },
        ]
        let cfg = { ...config, workDayStart: '00:00', workDayEnd: '23:59', nowStrOverride: '00:02 ' }
        // expect(tb.filterTimeMapToOpenSlots(timeMap, nowStr, workDayStart, workDayEnd)).toEqual(true)
        expect(tb.filterTimeMapToOpenSlots(timeMap, cfg)).toEqual(timeMap.slice(1, 2)) // now is after first item
        cfg.nowStrOverride = '00:00'
        expect(tb.filterTimeMapToOpenSlots(timeMap, cfg)).toEqual(timeMap) // now is equal to first item
        cfg = { ...cfg, workDayStart: '00:01' }
        expect(tb.filterTimeMapToOpenSlots(timeMap, cfg)).toEqual(timeMap.slice(1, 2)) // workDayStart is after first item
        cfg = { ...cfg, workDayStart: '00:05' }
        expect(tb.filterTimeMapToOpenSlots(timeMap, cfg)).toEqual(timeMap.slice(1, 2)) // workDayStart is equal to 2nd item
        cfg = { ...config, workDayEnd: '00:00', nowStrOverride: '00:00' }
        expect(tb.filterTimeMapToOpenSlots(timeMap, cfg)).toEqual([]) // workDayEnd is before 1st item
        cfg = { ...config, workDayStart: '00:00', workDayEnd: '00:03', nowStrOverride: '00:00' }
        expect(tb.filterTimeMapToOpenSlots(timeMap, cfg, '00:00')).toEqual(timeMap.slice(0, 1)) // workDayEnd is before 2st item
        cfg = { ...config, workDayStart: '00:00', workDayEnd: '00:30', nowStrOverride: '00:00', timeblockTextMustContainString: '#tb', mode: 'BY_TIMEBLOCK_TAG' }
        timeMap.push({ start: '00:10', busy: 'work #tb' })
        const result = tb.filterTimeMapToOpenSlots(timeMap, cfg, '00:00')
        expect(result[2]).toEqual(timeMap[2]) // does not screen out timeblocks
      })
    })

    test('makeAllItemsTodos ', () => {
      const types = ['open', 'done', 'scheduled', 'cancelled', 'title', 'quote', 'list', 'text']
      const expec = ['open', 'done', 'scheduled', 'cancelled', 'title', 'quote', 'open', 'open']
      const paras = types.map((type) => ({ type, content: `was:${type}` }))
      const res = tb.makeAllItemsTodos(paras)
      res.forEach((item, i) => {
        expect(item.type).toEqual(expec[i])
      })
    })

    test('createOpenBlockObject ', () => {
      const cfg = { ...config, intervalMins: 2 }
      expect(tb.createOpenBlockObject({ start: '00:00', end: '00:10' }, cfg, false).minsAvailable).toEqual(10)
      expect(tb.createOpenBlockObject({ start: '00:00', end: '00:10' }, cfg, true).minsAvailable).toEqual(12)
      expect(tb.createOpenBlockObject({ start: '00:00', end: '02:10' }, cfg, false).minsAvailable).toEqual(130)
      expect(tb.createOpenBlockObject({ start: '00:00', end: '02:10' }, cfg, false)).toEqual({
        start: '00:00',
        end: '02:10',
        minsAvailable: 130,
      })
      expect(tb.createOpenBlockObject({ start: '00:00', end: '02:10' }, cfg, true)).toEqual({
        start: '00:00',
        end: '02:12',
        minsAvailable: 132,
      })
      expect(tb.createOpenBlockObject({ start: new Date(), end: '02:10' }, cfg, true)).toEqual(null)
    })

    test('findTimeBlocks ', () => {
      // empty map should return empty array
      expect(tb.findTimeBlocks([])).toEqual([])
      let timeMap = [
        { start: '00:05', busy: false, index: 0 },
        { start: '00:15', busy: false, index: 2 } /* this one should cause a break */,
        { start: '00:20', busy: false, index: 3 },
        { start: '00:30', busy: false, index: 5 } /* this one should cause a break */,
      ]
      let timeBlocks = tb.findTimeBlocks(timeMap, config)
      expect(timeBlocks[0]).toEqual({ start: '00:05', end: '00:10', minsAvailable: 5, title: '' })
      expect(timeBlocks[1]).toEqual({ start: '00:15', end: '00:25', minsAvailable: 10, title: '' })
      expect(timeBlocks[2]).toEqual({ start: '00:30', end: '00:35', minsAvailable: 5, title: '' })

      timeMap = [
        // test the whole map is available/contiguous
        { start: '00:15', busy: false, index: 2 },
        { start: '00:20', busy: false, index: 3 },
        { start: '00:25', busy: false, index: 4 },
      ]
      timeBlocks = tb.findTimeBlocks(timeMap, config)
      expect(timeBlocks.length).toEqual(1)
      expect(timeBlocks[0]).toEqual({ start: '00:15', end: '00:30', minsAvailable: 15, title: '' })
      timeMap = [
        // one item and one contiguous block
        { start: '00:00', busy: false, index: 0 },
        { start: '00:15', busy: false, index: 2 },
        { start: '00:20', busy: false, index: 3 },
        { start: '00:25', busy: false, index: 4 },
      ]
      timeBlocks = tb.findTimeBlocks(timeMap, config)
      expect(timeBlocks.length).toEqual(2)
      expect(timeBlocks[0]).toEqual({ start: '00:00', end: '00:05', minsAvailable: 5, title: '' })
      expect(timeBlocks[1]).toEqual({ start: '00:15', end: '00:30', minsAvailable: 15, title: '' })
      timeMap = [
        // one item and one contiguous block
        { start: '23:40', busy: false, index: 0 },
        { start: '23:45', busy: false, index: 1 },
        { start: '23:50', busy: false, index: 2 },
        { start: '23:55', busy: false, index: 3 },
      ]
      timeBlocks = tb.findTimeBlocks(timeMap, config)
      expect(timeBlocks.length).toEqual(1)
      expect(timeBlocks[0]).toEqual({ start: '23:40', end: '23:59', minsAvailable: 20, title: '' }) //FIXME: this doesn't seem right!
      timeMap = [
        // one item and one contiguous block
        { start: '23:40', busy: false, index: 0 },
        { start: '23:45', busy: 'foo #tb', index: 1 },
        { start: '23:50', busy: 'foo #tb', index: 2 },
        { start: '23:55', busy: false, index: 3 },
      ]
      timeBlocks = tb.findTimeBlocks(timeMap, config)
      expect(timeBlocks.length).toEqual(3)
      expect(timeBlocks[1].minsAvailable).toEqual(10)
      expect(timeBlocks[1].title).toEqual('foo #tb')
    })

    describe('addMinutesToTimeText', () => {
      test('should add time properly', () => {
        expect(tb.addMinutesToTimeText('00:00', 21)).toEqual('00:21')
        expect(tb.addMinutesToTimeText('00:00', 180)).toEqual('03:00')
        expect(tb.addMinutesToTimeText('00:50', 20)).toEqual('01:10')
      })
      test('should gracefully fail on bad input', () => {
        expect(tb.addMinutesToTimeText(new Date(), 21)).toEqual('')
      })
    })

    describe('getTimeBlockTimesForEvents ', () => {
      test('basic PRIORITY_FIRST test', () => {
        const timeMap = [
          // one item and one contiguous block
          { start: '00:00', busy: false, index: 0 },
          { start: '00:15', busy: false, index: 2 },
          { start: '00:20', busy: false, index: 3 },
          { start: '00:25', busy: false, index: 4 },
        ]
        const todos = [
          { content: "!! line1 '8m", type: 'open' },
          { content: "! line2 '1m", type: 'open' },
          { content: "!!! line3 '7m", type: 'open' },
        ]
        const todosByType = getTasksByType(todos)
        const cfg = {
          ...config,
          workDayStart: '00:00',
          workDayEnd: '23:59',
          nowStrOverride: '00:00',
          mode: 'PRIORITY_FIRST',
          allowEventSplits: true,
        }
        // returns {blockList, timeBlockTextList, timeMap}
        const res = tb.getTimeBlockTimesForEvents(timeMap, todosByType['open'], cfg)
        expect(res.timeBlockTextList).toEqual([
          '* 00:00-00:05 !!! line3 (1) #🕑',
          '* 00:15-00:17 !!! line3 (2) #🕑',
          '* 00:20-00:28 !! line1 #🕑',
          /* '* 00:20-00:21 ! line2 #🕑', LINE2 DOES NOT HAVE A SLOT */
        ])
      })
      test("should work if it's now later in the day ", () => {
        // test with time later in the day
        const todos = [
          { content: "!! line1 '8m", type: 'open' },
          { content: "! line2 '1m", type: 'open' },
          { content: "!!! line3 '7m", type: 'open' },
        ]
        const todosByType = getTasksByType(todos)
        const cfg = {
          ...config,
          workDayStart: '00:00',
          workDayEnd: '23:59',
          nowStrOverride: '00:19',
          mode: 'PRIORITY_FIRST',
          allowEventSplits: true,
        }
        const timeMap2 = [
          // one item and one contiguous block
          { start: '00:00', busy: false, index: 0 },
          { start: '00:15', busy: false, index: 2 },
          { start: '00:20', busy: false, index: 3 },
          { start: '00:25', busy: false, index: 4 },
        ]
        const res = tb.getTimeBlockTimesForEvents(timeMap2, todosByType['open'], cfg)
        expect(res.timeBlockTextList).toEqual([`* 00:20-00:27 !!! line3 ${config.timeBlockTag}`])
      })
      test('calling options.mode = LARGEST_FIRST', () => {
        // test with calling options.mode = 'LARGEST_FIRST'
        const todos = [
          { content: "!! line1 '8m", type: 'open' },
          { content: "! line2 '1m", type: 'open' },
          { content: "!!! line3 '7m", type: 'open' },
        ]
        const todosByType = getTasksByType(todos)
        const cfg = {
          ...config,
          workDayStart: '00:00',
          workDayEnd: '23:59',
          nowStrOverride: '00:00',
          mode: 'LARGEST_FIRST',
          allowEventSplits: true,
        }
        const res = tb.getTimeBlockTimesForEvents([{ start: '00:00', busy: false, index: 0 }], todosByType['open'], cfg)
        expect(res.timeBlockTextList).toEqual([
          '* 00:00-00:05 !! line1 (1) #🕑',
          /* '* 00:20-00:21 ! line2 #🕑', LINE2 DOES NOT HAVE A SLOT */
        ])
        // test with calling no options.mode (just for coverage of switch statement)
      })
      test('calling options.mode = <empty> tests default in switch', () => {
        const todos = [
          { content: "!! line1 '8m", type: 'open' },
          { content: "! line2 '1m", type: 'open' },
          { content: "!!! line3 '7m", type: 'open' },
        ]
        const todosByType = getTasksByType(todos)

        const cfg = {
          ...config,
          workDayStart: '00:00',
          workDayEnd: '23:59',
          nowStrOverride: '00:00',
          mode: '',
          allowEventSplits: true,
        }
        const res = tb.getTimeBlockTimesForEvents([{ start: '00:00', busy: false, index: 0 }], todosByType['open'], cfg)
        expect(res.timeBlockTextList).toEqual([])
      })
      test('should place only items that fit in rest of day', () => {
        const timeMap = [
          // one item and one contiguous block
          { start: '23:40', busy: false, index: 0 },
          { start: '23:45', busy: false, index: 1 },
          { start: '23:50', busy: false, index: 2 },
          { start: '23:55', busy: false, index: 4 },
        ]
        const todos = [
          { content: "!! line1 '8m", type: 'open' },
          { content: "! line2 '1m", type: 'open' },
          { content: "!!! line3 '7m", type: 'open' },
        ]
        const todosByType = getTasksByType(todos)

        const cfg = {
          ...config,
          workDayStart: '23:00',
          intervalMins: 5,
          workDayEnd: '23:59',
          nowStrOverride: '23:54',
          mode: 'PRIORITY_FIRST',
          allowEventSplits: false,
        }
        const res = tb.getTimeBlockTimesForEvents(timeMap, todosByType['open'], cfg)
        expect(res.timeBlockTextList).toEqual(['* 23:55-23:56 ! line2 #🕑'])
      })
      test('should place single BY_TIMEBLOCK_TAG items inside timeblock of that name', () => {
        const timeMap = [
          // one item and one contiguous block
          { start: '23:45', busy: 'timblock #tb', index: 1 },
          { start: '23:50', busy: 'timblock #tb', index: 2 },
          { start: '23:55', busy: 'timblock #tb', index: 3 },
        ]
        const todos = [{ content: "! line2 '5m #timblock", type: 'open' }]
        const todosByType = getTasksByType(todos)

        const cfg = {
          ...config,
          workDayStart: '23:00',
          intervalMins: 5,
          workDayEnd: '23:59',
          nowStrOverride: '23:00',
          mode: 'BY_TIMEBLOCK_TAG',
          timeblockTextMustContainString: '#tb',
          allowEventSplits: false,
        }
        const result = tb.getTimeBlockTimesForEvents(timeMap, todosByType['open'], cfg)
        expect(result.timeBlockTextList).toEqual(expect.arrayContaining(['* 23:45-23:50 ! line2 #timblock #🕑 #tb']))
      })
      test('should place BY_TIMEBLOCK_TAG items inside timeblock of that name when there are other blocks', () => {
        const timeMap = [
          // one item and one contiguous block
          { start: '23:40', busy: false, index: 0 },
          { start: '23:45', busy: 'timblock #tb', index: 1 },
          { start: '23:50', busy: 'timblock #tb', index: 2 },
          { start: '23:55', busy: 'timblock #tb', index: 3 },
          { start: '24:00', busy: false, index: 4 },
          { start: '24:05', busy: false, index: 5 },
        ]
        const todos = [
          { content: "!! line1 '2m", type: 'open' },
          { content: "! line2 '5m #timblock", type: 'open' },
          { content: "!!! line3 '5m", type: 'open' },
        ]
        const todosByType = getTasksByType(todos)

        const cfg = {
          ...config,
          workDayStart: '23:00',
          intervalMins: 5,
          workDayEnd: '23:59',
          nowStrOverride: '23:00',
          mode: 'BY_TIMEBLOCK_TAG',
          timeblockTextMustContainString: '#tb',
          allowEventSplits: false,
        }
        const result = tb.getTimeBlockTimesForEvents(timeMap, todosByType['open'], cfg)
        expect(result.timeBlockTextList).toEqual(expect.arrayContaining(['* 23:45-23:50 ! line2 #timblock #🕑 #tb']))
      })
    })

    test('blockTimeAndCreateTimeBlockText ', () => {
      let timeMap = [
        { start: '00:00', busy: false, index: 0 },
        { start: '00:05', busy: false, index: 1 },
      ]
      let blockList = tb.findTimeBlocks(timeMap, config)
      let block = { start: '00:00', end: '00:05', title: "test '2m" }
      const timeBlockTextList = []
      let tbm = { timeMap, blockList, timeBlockTextList }
      const cfg = { ...config, nowStrOverride: '00:00', workDayStart: '00:00' }
      // (1) Base test. Block a time and return proper results
      const result = tb.blockTimeAndCreateTimeBlockText(tbm, block, cfg)
      expect(result).toEqual({
        blockList: [{ end: '00:10', minsAvailable: 5, start: '00:05', title: '' }],
        timeBlockTextList: [`* 00:00-00:05 test ${config.timeBlockTag}`],
        timeMap: [{ busy: false, index: 1, start: '00:05' }],
      })
      // (2) Run a second test on the result of the first test.
      // comes back with empty timeMap and blockList b/c interval is 5m
      block = { start: '00:05', end: '00:07', title: "test2 '2m" }
      const result2 = tb.blockTimeAndCreateTimeBlockText(result, block, cfg)
      expect(result2).toEqual({
        blockList: [],
        timeBlockTextList: [`* 00:00-00:05 test ${config.timeBlockTag}`, `* 00:05-00:07 test2 ${config.timeBlockTag}`],
        timeMap: [],
      })
      // (3) Run a third test
      // but with a 2m interval. Should split the block and send back the remainder
      block = { start: '00:00', end: '00:02', title: "test2 '2m" }
      timeMap = [
        { start: '00:00', busy: false, index: 0 },
        { start: '00:02', busy: false, index: 1 },
        { start: '00:04', busy: false, index: 2 },
        { start: '00:06', busy: false, index: 3 },
      ]
      cfg.intervalMins = 2
      blockList = tb.findTimeBlocks(timeMap, cfg)
      tbm = { timeMap, blockList, timeBlockTextList: [] }
      const result3 = tb.blockTimeAndCreateTimeBlockText(tbm, block, cfg)
      expect(result3).toEqual({
        blockList: [{ start: '00:02', end: '00:08', minsAvailable: 6, title: '' }],
        timeBlockTextList: [`* 00:00-00:02 test2 ${config.timeBlockTag}`],
        timeMap: [
          { start: '00:02', busy: false, index: 1 },
          { start: '00:04', busy: false, index: 2 },
          { start: '00:06', busy: false, index: 3 },
        ],
      })
    })

    describe('matchTasksToSlots ', () => {
      test('should insert content that fits without splitting ', () => {
        const tasks = [{ content: "line1 '2m" }, { content: "line2 '1m" }]
        const timeMap = [
          { start: '00:02', busy: false, index: 1 },
          { start: '00:04', busy: false, index: 2 },
          { start: '00:06', busy: false, index: 3 },
          /* block[0]: start:00:02 end:00:08 minsAvailable: 6 */
          { start: '00:20', busy: false, index: 10 },
          { start: '00:22', busy: false, index: 11 },
          /* block[1]: start:00:20 end:00:24 minsAvailable: 4 */
        ]
        const timeBlocks = [{ start: '00:02', end: '00:08', minsAvailable: 6 }]
        const cfg = { ...config, nowStrOverride: '00:00', workDayStart: '00:00', intervalMins: 2 }
        // First check that items that fit inside the time block work properly
        const res = tb.matchTasksToSlots(tasks, { blockList: timeBlocks, timeMap }, cfg)
        expect(res.timeBlockTextList[0]).toEqual(`* 00:02-00:04 line1 ${config.timeBlockTag}`)
        expect(res.timeBlockTextList[1]).toEqual(`* 00:04-00:05 line2 ${config.timeBlockTag}`)
        expect(res.blockList[0]).toEqual({ start: '00:06', end: '00:08', minsAvailable: 2, title: '' })
        expect(res.blockList[1]).toEqual({ start: '00:20', end: '00:24', minsAvailable: 4, title: '' })
        expect(res.timeMap[0]).toEqual({ start: '00:06', busy: false, index: 3 })
        expect(res.timeMap[1]).toEqual({ start: '00:20', busy: false, index: 10 })
        expect(res.timeMap[2]).toEqual({ start: '00:22', busy: false, index: 11 })
      })
      test('items that do not fit in slots get split when allowEventSplits = true', () => {
        // Now check that items that don't fit inside the time block get split properly
        // Even if the whole task can't find a slot
        const cfg = {
          ...config,
          nowStrOverride: '00:00',
          workDayStart: '00:00',
          intervalMins: 2,
          allowEventSplits: true,
        }
        const timeMap2 = [
          { start: '00:02', busy: false, index: 1 },
          { start: '00:04', busy: false, index: 2 },
          { start: '00:06', busy: false, index: 3 },
          /* block[0]: start:00:02 end:00:08 minsAvailable: 6 */
          { start: '00:20', busy: false, index: 10 },
          { start: '00:22', busy: false, index: 11 },
          /* block[1]: start:00:20 end:00:24 minsAvailable: 4 */
        ]
        const nonFittingTask = [{ content: "line3 '12m" }]
        const timeBlocks = [
          { start: '00:02', end: '00:08', minsAvailable: 6 },
          { start: '00:20', end: '00:24', minsAvailable: 4 },
        ]
        const res = tb.matchTasksToSlots(nonFittingTask, { blockList: timeBlocks, timeMap: timeMap2, timeBlockTextList: [] }, cfg)
        expect(res.timeBlockTextList[0]).toEqual(`* 00:02-00:08 line3 (1) ${config.timeBlockTag}`)
        expect(res.timeBlockTextList[1]).toEqual(`* 00:20-00:24 line3 (2) ${config.timeBlockTag}`)
        expect(res.timeBlockTextList.length).toEqual(2)
        expect(res.timeMap.length).toEqual(0)
        expect(res.blockList.length).toEqual(0)
      })
      test('no time for even one task', () => {
        // Now check that items that don't fit inside the time block get split properly
        const cfg = {
          ...config,
          nowStrOverride: '00:00',
          workDayStart: '00:00',
          workDayEnd: '00:08',
          intervalMins: 2,
        }
        const timeMap2 = [
          { start: '00:00', busy: false, index: 0 },
          { start: '00:02', busy: false, index: 1 },
          { start: '00:04', busy: false, index: 2 },
          { start: '00:06', busy: false, index: 3 },
        ]
        const nonFittingTasks = [{ content: "wont get placed '12m" }]
        const timeBlocks = [] // irrelevant because will be rebuilt
        const res = tb.matchTasksToSlots(nonFittingTasks, { blockList: timeBlocks, timeMap: timeMap2, timeBlockTextList: [] }, cfg)
        expect(res.timeBlockTextList.length).toEqual(0)
        expect(Object.keys(res.noTimeForTasks).length).toEqual(1)
        expect(res.noTimeForTasks['_'].length).toEqual(1)
        expect(res.noTimeForTasks['_'][0]).toEqual({ content: `wont get placed '12m` })
      })
      test('items that do not fit in slots do not get split when allowEventSplits is missing', () => {
        // Now check that items that don't fit inside the time block get split properly
        // Even if the whole task can't find a slot
        const cfg = {
          ...config,
          nowStrOverride: '00:00',
          workDayStart: '00:00',
          intervalMins: 2,
        }
        const timeMap2 = [
          { start: '00:02', busy: false, index: 1 },
          { start: '00:04', busy: false, index: 2 },
          { start: '00:06', busy: false, index: 3 },
          /* block[0]: start:00:02 end:00:08 minsAvailable: 6 */
          { start: '00:20', busy: false, index: 10 },
          { start: '00:22', busy: false, index: 11 },
          { start: '00:24', busy: false, index: 12 },
          { start: '00:26', busy: false, index: 13 },
          { start: '00:28', busy: false, index: 14 },
          /* block[1]: start:00:20 end:00:24 minsAvailable: 4 */
        ]
        const nonFittingTask = [{ content: "wont get placed '12m" }]
        const fittingTask = [{ content: "gets placed '8m" }]
        const timeBlocks = [] // irrelevant because will be rebuilt
        const res = tb.matchTasksToSlots([...nonFittingTask, ...fittingTask], { blockList: timeBlocks, timeMap: timeMap2, timeBlockTextList: [] }, cfg)
        expect(res.timeBlockTextList.length).toEqual(1)
        expect(res.timeBlockTextList[0]).toEqual(`* 00:20-00:28 gets placed ${config.timeBlockTag}`)
      })
      test('items that do not fit in slots get split', () => {
        // now test line which had no time attached
        const timeBlocks = [{ start: '00:00', end: '00:20', minsAvailable: 20 }]
        const timeMap = [{ start: '00:00', busy: false, index: 1 }]
        const cfg = { ...config, nowStrOverride: '00:00', workDayStart: '00:00', intervalMins: 20, defaultDuration: 13 }
        const res = tb.matchTasksToSlots([{ content: 'line4' }], { blockList: timeBlocks, timeMap: timeMap, timeBlockTextList: [] }, cfg)
        expect(res.timeBlockTextList).toEqual([`* 00:00-00:13 line4 ${config.timeBlockTag}`])
      })
      // dbw: skipping these tests for now because I think they are well covered elsewhere and this is not actually the path
      // for the BY_TIMEBLOCK_TAG mode. Leaving them in case they are useful later.
      test.skip('Mode: BY_TIMEBLOCK_TAG Put tasks inside timeblocks with their name - single item', () => {
        // now test line which had no time attached
        const timeBlocks = [{ start: '00:00', end: '00:20', minsAvailable: 20, title: 'timblock' }]
        const timeMap = [{ start: '00:00', busy: false, index: 1 }]
        const cfg = { ...config, nowStrOverride: '00:00', workDayStart: '00:00', intervalMins: 20, defaultDuration: 5, mode: 'BY_TIMEBLOCK_TAG' }
        const res = tb.matchTasksToSlots([{ content: 'Do something #timblock' }], { blockList: timeBlocks, timeMap: timeMap, timeBlockTextList: [] }, cfg)
        expect(res.timeBlockTextList).toEqual(['* 00:00-00:05 Do something #timblock #🕑'])
      })
      test.skip('Mode: BY_TIMEBLOCK_TAG Put tasks inside timeblocks with their name - multi items', () => {
        // now test line which had no time attached
        const timeBlocks = [
          { start: '00:00', end: '00:20', minsAvailable: 20, title: '' },
          { start: '00:40', end: '01:00', minsAvailable: 20, title: 'timblock' },
          { start: '01:30', end: '01:50', minsAvailable: 20, title: '' },
        ]
        const timeMap = [
          { start: '00:00', busy: false, index: 1 },
          { start: '00:40', busy: 'timblock #tb', index: 5 },
        ]
        const cfg = {
          ...config,
          nowStrOverride: '00:00',
          workDayStart: '00:00',
          intervalMins: 20,
          defaultDuration: 5,
          mode: 'BY_TIMEBLOCK_TAG',
          timeblockTextMustContainString: '#tb',
        }
        const sortedTaskList = [{ content: 'Do something #timblock' }, { content: 'line2' }, { content: 'line3' }]
        const res = tb.matchTasksToSlots(sortedTaskList, { blockList: timeBlocks, timeMap: timeMap, timeBlockTextList: [] }, cfg)
        expect(res.timeBlockTextList).toEqual([`* 00:00-00:13 line4 ${config.timeBlockTag}`])
      })
    })

    describe('getRegExOrString', () => {
      test('should return items that are a string', () => {
        const res = tb.getRegExOrString('a string')
        expect(res).toEqual('a string')
        expect(typeof res).toEqual('string')
      })
      test('should return Regex for items that are regex', () => {
        const res = tb.getRegExOrString('/a regex/')
        expect(res).toEqual(new RegExp('a regex'))
      })
      test('should work when there are spaces', () => {
        const res = tb.getRegExOrString(' /a regex/ ')
        expect(res).toEqual(new RegExp('a regex'))
      })
    })

    describe('includeTasksWithPatterns', () => {
      test('should include only tasks that contain a string', () => {
        const tasks = [{ content: 'foo' }, { content: 'bar' }, { content: 'baz' }]
        const result = tb.includeTasksWithPatterns(tasks, 'ba')
        expect(result.length).toEqual(2)
        expect(result[0].content).toEqual('bar')
        expect(result[1].content).toEqual('baz')
      })
      test('should include only tasks that match a regex', () => {
        const tasks = [{ content: 'foo' }, { content: 'bar' }, { content: 'baz' }]
        const result = tb.includeTasksWithPatterns(tasks, /ba/)
        expect(result.length).toEqual(2)
        expect(result[0].content).toEqual('bar')
        expect(result[1].content).toEqual('baz')
      })
      test('should work when the input string is comma-separated list', () => {
        const tasks = [{ content: 'foo' }, { content: 'bar' }, { content: 'baz' }]
        const result = tb.includeTasksWithPatterns(tasks, 'foo,baz')
        expect(result.length).toEqual(2)
        expect(result[0].content).toEqual('foo')
        expect(result[1].content).toEqual('baz')
      })
      test('should work when the input string is comma-separated list with a regex', () => {
        const tasks = [{ content: 'foo' }, { content: 'bar' }, { content: 'baz' }]
        const result = tb.includeTasksWithPatterns(tasks, '/^f/,baz')
        expect(result.length).toEqual(2)
        expect(result[0].content).toEqual('foo')
        expect(result[1].content).toEqual('baz')
      })
      test('should include tasks that match an array of patterns', () => {
        const tasks = [{ content: 'foo' }, { content: 'bar' }, { content: 'baz' }]
        const result = tb.includeTasksWithPatterns(tasks, ['az', /^f/])
        expect(result.length).toEqual(2)
        expect(result[0].content).toEqual('foo')
        expect(result[1].content).toEqual('baz')
      })
      test('should include tasks that match an array of patterns with spaces', () => {
        const tasks = [{ content: 'foo' }, { content: 'bar' }, { content: 'baz' }]
        const result = tb.includeTasksWithPatterns(tasks, ' foo, baz ')
        expect(result.length).toEqual(2)
        expect(result[0].content).toEqual('foo')
        expect(result[1].content).toEqual('baz')
      })
    })
    describe('excludeTasksWithPatterns', () => {
      test('should include only tasks that do not contain the string/regex', () => {
        const tasks = [{ content: 'foo' }, { content: 'bar' }, { content: 'baz' }]
        const result = tb.excludeTasksWithPatterns(tasks, 'ba')
        expect(result.length).toEqual(1)
        expect(result[0].content).toEqual('foo')
      })
      test('should exclude tasks that match a regex', () => {
        const tasks = [{ content: 'foo' }, { content: 'bar' }, { content: 'baz' }]
        const result = tb.excludeTasksWithPatterns(tasks, '/ba/')
        expect(result[0].content).toEqual('foo')
      })
      test('should exclude tasks with hashtags', () => {
        const tasks = [{ content: 'foo #planning' }, { content: '#lao bar' }, { content: 'baz' }]
        const result = tb.excludeTasksWithPatterns(tasks, '#planning,#lao')
        expect(result.length).toEqual(1)
        expect(result[0].content).toEqual('baz')
      })
      test('should exclude tasks with spaces', () => {
        const tasks = [{ content: 'foo #planning' }, { content: '#lao bar' }, { content: 'baz' }]
        const result = tb.excludeTasksWithPatterns(tasks, '#planning , #lao')
        expect(result.length).toEqual(1)
        expect(result[0].content).toEqual('baz')
      })
    })

    describe('dwertheimer.EventAutomations - timeblocking.getFullParagraphsCorrespondingToSortList ', () => {
      const origParas = [
        { content: 'foo', rawContent: 'foo' },
        { content: 'bar', rawContent: 'bar' },
        { content: 'baz', rawContent: 'baz' },
      ]
      const sortList = [
        { content: 'baz', raw: 'baz' },
        { content: 'foo', raw: 'foo' },
        { content: 'bar', raw: 'bar' },
      ]
      test('should match the order', () => {
        const res = tb.getFullParagraphsCorrespondingToSortList(origParas, sortList)
        expect(res.length).toEqual(3)
        expect(res[0]).toEqual(origParas[2])
      })
      test('should exclude tasks with spaces', () => {
        const res = tb.getFullParagraphsCorrespondingToSortList(origParas, sortList)
        expect(res[0]).toEqual(origParas[2])
      })
    })

    describe('appendLinkIfNecessary', () => {
      let fname
      beforeAll(() => {
        fname = Editor.filename
        Editor.filename = 'foo.md'
      })
      afterAll(() => {
        Editor.filename = fname
      })
      const paragraphs = [
        { content: 'foo', type: 'done', filename: 'foof.md' },
        { content: 'bar', type: 'open', filename: 'barf.md' },
        { content: 'baz', type: 'list', filename: 'bazf.txt' },
        { content: 'baz', type: 'text', filename: 'bazf.txt' },
      ]

      test('should do nothing if includeLinks is OFF', () => {
        const res = tb.appendLinkIfNecessary(paragraphs, { ...config, includeLinks: 'OFF' })
        expect(res).toEqual(paragraphs)
      })
      test('should do nothing if todos array is empty', () => {
        const res = tb.appendLinkIfNecessary([], config)
        expect(res).toEqual([])
      })
      test('should do nothing if todo type is title', () => {
        const p = [{ type: 'title', content: 'foo' }]
        const res = tb.appendLinkIfNecessary(p, config)
        expect(res).toEqual(p)
      })
      test('should add wikilink to content in form of [[title#heading]]', () => {
        const note = new Note({ title: 'foo', filename: Editor.filename })
        const p = [{ type: 'open', content: 'ugh', heading: 'bar', note }]
        note.paragraphs = p
        const res = tb.appendLinkIfNecessary(p, { ...config, includeLinks: '[[internal#links]]' })
        expect(res[0].content).toEqual('ugh [[foo^123456]]')
      })
      test('should add url-style link to content in form of noteplan://', () => {
        const note = new Note({ title: 'foo', filename: Editor.filename })
        const p = [{ type: 'open', content: 'ugh', heading: 'bar', filename: 'baz', note }]
        note.paragraphs = p
        const res = tb.appendLinkIfNecessary(p, { ...config, includeLinks: 'Pretty Links', linkText: '%' })
        expect(res[0].content).toEqual('ugh [%](noteplan://x-callback-url/openNote?noteTitle=foo%5E123456)')
      })
    })
    /*
     * cleanText()
     */
    describe('cleanText()' /* function */, () => {
      test('should do nothing if no text to replace', () => {
        const before = ''
        const after = before
        const replacements = []
        const result = tb.cleanText(before, replacements)
        expect(result).toEqual(after)
      })
      test('should do nothing if matchers to replace', () => {
        const before = 'foo bar baz'
        const after = before
        const replacements = []
        const result = tb.cleanText(before, replacements)
        expect(result).toEqual(after)
      })
      test('should do a basic string replace', () => {
        const before = 'foo bar baz'
        const after = 'foo baz'
        const replacements = ['bar']
        const result = tb.cleanText(before, replacements)
        expect(result).toEqual(after)
      })
      test('should do a basic regex replace', () => {
        const before = 'foo bar baz'
        const after = 'foo baz'
        const replacements = [/bar/]
        const result = tb.cleanText(before, replacements)
        expect(result).toEqual(after)
      })
      test('should clean up double spaces', () => {
        const before = 'foo  bar  baz'
        const after = 'foo baz'
        const replacements = [/bar/]
        const result = tb.cleanText(before, replacements)
        expect(result).toEqual(after)
      })
      test('should remove timeblock at start', () => {
        const before = '00:01-12:22 foo bar baz'
        const after = 'foo bar baz'
        const replacements = [new RegExp(`^\\d{2}:\\d{2}-\\d{2}:\\d{2} `)]
        const result = tb.cleanText(before, replacements)
        expect(result).toEqual(after)
      })
    })

    /*
     * cleanTimeBlockLine()
     */
    describe('cleanTimeBlockLine()' /* function */, () => {
      test('should remove time', () => {
        const before = '00:01-12:22 foo bar baz'
        const after = 'foo bar baz'
        const config = { timeBlockTag: '#🕑' }
        const result = tb.cleanTimeBlockLine(before, config)
        expect(result).toEqual(after)
      })
      test('should remove ATB tag', () => {
        const before = 'foo bar baz #🕑'
        const after = 'foo bar baz'
        const config = { timeBlockTag: '#🕑' }
        const result = tb.cleanTimeBlockLine(before, config)
        expect(result).toEqual(after)
      })
      test('should remove duration 5m', () => {
        const before = "foo bar baz '5m"
        const after = 'foo bar baz'
        const config = { timeBlockTag: '🕑', durationMarker: "'" }
        const result = tb.cleanTimeBlockLine(before, config)
        expect(result).toEqual(after)
      })
      test('should remove wiki link', () => {
        const before = 'foo bar baz [[foo]]'
        const after = 'foo bar baz'
        const config = { timeBlockTag: '🕑', durationMarker: "'" }
        const result = tb.cleanTimeBlockLine(before, config)
        expect(result).toEqual(after)
      })
      test('should remove any url', () => {
        const before = 'foo [bar](noteplan://baz)'
        const after = 'foo'
        const config = { timeBlockTag: '🕑', durationMarker: "'" }
        const result = tb.cleanTimeBlockLine(before, config)
        expect(result).toEqual(after)
      })
      test('what if there are two urls on a line', () => {
        const before = 'foo [bar](noteplan://baz) zoo [bar](noteplan://baz)'
        const after = 'foo zoo'
        const config = { timeBlockTag: '🕑', durationMarker: "'" }
        const result = tb.cleanTimeBlockLine(before, config)
        expect(result).toEqual(after)
      })
      test('should remove today tag', () => {
        const before = 'foo >today'
        const after = 'foo'
        const config = { timeBlockTag: '🕑', durationMarker: "'" }
        const result = tb.cleanTimeBlockLine(before, config)
        expect(result).toEqual(after)
      })
      test('should remove date tag', () => {
        const before = 'foo >2022-01-01'
        const after = 'foo'
        const config = { timeBlockTag: '🕑', durationMarker: "'" }
        const result = tb.cleanTimeBlockLine(before, config)
        expect(result).toEqual(after)
      })
      test('should remove week tag', () => {
        const before = 'foo >2022-W01'
        const after = 'foo'
        const config = { timeBlockTag: '🕑', durationMarker: "'" }
        const result = tb.cleanTimeBlockLine(before, config)
        expect(result).toEqual(after)
      })
      test('should remove month tag', () => {
        const before = 'foo >2022-01'
        const after = 'foo'
        const config = { timeBlockTag: '🕑', durationMarker: "'" }
        const result = tb.cleanTimeBlockLine(before, config)
        expect(result).toEqual(after)
      })
      test('should remove quarter tag', () => {
        const before = 'foo >2022-Q1'
        const after = 'foo'
        const config = { timeBlockTag: '🕑', durationMarker: "'" }
        const result = tb.cleanTimeBlockLine(before, config)
        expect(result).toEqual(after)
      })
      test('should remove year tag', () => {
        const before = 'foo >2022'
        const after = 'foo'
        const config = { timeBlockTag: '🕑', durationMarker: "'" }
        const result = tb.cleanTimeBlockLine(before, config)
        expect(result).toEqual(after)
      })
    })

    // describe('isAutoTimeBlockLine', () => {
    //   test('should return null if there are no ATB lines', () => {
    //     const line = '222 no timeblock in here #foo'
    //     expect(tb.isAutoTimeBlockLine(line, {})).toEqual(null)
    //   })
    //   test('should find a standard timeblock line', () => {
    //     const line = '- 21:00-21:15 Respond to x.la [–](noteplan://x-callback-url/openNote?filename=20220512.md) #🕑'
    //     const exp = 'Respond to x.la'
    //     expect(tb.isAutoTimeBlockLine(line, {})).toEqual(exp)
    //   })
    //   test('should find a * at the front', () => {
    //     const line = '* 21:00-21:15 Respond to x.la [–](noteplan://x-callback-url/openNote?filename=20220512.md) #🕑'
    //     const exp = 'Respond to x.la'
    //     expect(tb.isAutoTimeBlockLine(line, {})).toEqual(exp)
    //   })
    //   test('should find with nonstandard tag', () => {
    //     const line =
    //       '* 21:00-21:15 Respond to x.la [–](noteplan://x-callback-url/openNote?filename=20220512.md) #something'
    //     const exp = 'Respond to x.la'
    //     expect(tb.isAutoTimeBlockLine(line, {})).toEqual(exp)
    //   })
    //   test('should find with a wiki link', () => {
    //     const line = '- 19:20-19:35 Send landing page howto [[yo#something]] #🕑'
    //     const exp = `Send landing page howto`
    //     expect(tb.isAutoTimeBlockLine(line, {})).toEqual(exp)
    //   })
    // })
  })
})

/*
appendLinkIfNecessary
*/

/*
 * getNamedTimeBlocks()
 */
describe('getNamedTimeBlocks()' /* function */, () => {
  test('should return empty array if no named blocks', () => {
    const blocks = [
      { start: '00:00', end: '00:20', minsAvailable: 20, title: '' },
      { start: '00:40', end: '01:00', minsAvailable: 20, title: '' },
    ]
    const result = tb.getNamedTimeBlocks(blocks)
    expect(result).toEqual([])
  })
})

/*
 * processByTimeBlockTag()
 */
describe('processByTimeBlockTag()' /* function */, () => {
  test('When in mode: BY_TIMEBLOCK_TAG, should do exactly the same as matchTaskToSlots if there are no named slots (e.g. you have not specified a matching time block)', () => {
    // now test line which had no time attached
    const timeBlocks = [
      { start: '00:00', end: '00:10', minsAvailable: 10, title: '' },
      { start: '00:40', end: '00:45', minsAvailable: 5, title: '' },
    ]
    const timeMap = [
      { start: '00:00', busy: false, index: 1 },
      { start: '00:05', busy: false, index: 2 },
      { start: '00:40', busy: false, index: 5 },
    ]
    const cfg = {
      ...config,
      nowStrOverride: '00:00',
      workDayStart: '00:00',
      intervalMins: 5,
      defaultDuration: 5,
      mode: 'BY_TIMEBLOCK_TAG',
      timeblockTextMustContainString: '#tb',
    }
    const sortedTaskList = [{ content: 'Do something #timblock' }, { content: 'line2' }, { content: 'line3' }]
    const timeBlockTextList = ['* 00:00-00:05 Do something #timblock #🕑 #tb', '* 00:05-00:10 line2 #🕑 #tb', '* 00:40-00:45 line3 #🕑 #tb']
    const res = tb.processByTimeBlockTag(sortedTaskList, { blockList: timeBlocks, timeMap: timeMap, timeBlockTextList: [] }, cfg)
    expect(res.timeBlockTextList).toEqual(timeBlockTextList)
  })
  test('should place one named item', () => {
    // now test line which had no time attached
    const timeBlocks = [
      { start: '00:00', end: '00:20', minsAvailable: 20, title: '' },
      { start: '00:20', end: '00:30', minsAvailable: 10, title: 'foo' },
      { start: '00:30', end: '00:35', minsAvailable: 5, title: '' },
    ]
    const timeMap = [
      { start: '00:00', busy: false, index: 1 },
      { start: '00:05', busy: false, index: 2 },
      { start: '00:10', busy: false, index: 3 },
      { start: '00:15', busy: false, index: 4 },
      { start: '00:20', busy: 'foo #tb', index: 5 },
      { start: '00:25', busy: 'foo #tb', index: 6 },
      { start: '00:30', busy: false, index: 7 },
    ]
    const cfg = {
      ...config,
      nowStrOverride: '00:00',
      workDayStart: '00:00',
      intervalMins: 20,
      defaultDuration: 5,
      mode: 'BY_TIMEBLOCK_TAG',
      timeblockTextMustContainString: '#tb',
    }
    const sortedTaskList = [{ content: 'Do something #foo' }]
    const res = tb.processByTimeBlockTag(sortedTaskList, { blockList: timeBlocks, timeMap: timeMap, timeBlockTextList: [] }, cfg)
    expect(res.timeBlockTextList).toEqual([`* 00:20-00:25 Do something #foo #🕑 #tb`])
  })
  test('should place two tasks in one named timeblock', () => {
    // now test line which had no time attached
    const timeBlocks = [
      { start: '00:00', end: '00:20', minsAvailable: 20, title: '' },
      { start: '00:20', end: '00:30', minsAvailable: 10, title: 'foo' },
      { start: '00:30', end: '00:35', minsAvailable: 5, title: '' },
    ]
    const timeMap = [
      { start: '00:00', busy: false, index: 1 },
      { start: '00:05', busy: false, index: 2 },
      { start: '00:10', busy: false, index: 3 },
      { start: '00:15', busy: false, index: 4 },
      { start: '00:20', busy: 'foo #tb', index: 5 },
      { start: '00:25', busy: 'foo #tb', index: 6 },
      { start: '00:30', busy: false, index: 7 },
    ]
    const cfg = {
      ...config,
      nowStrOverride: '00:00',
      workDayStart: '00:00',
      intervalMins: 20,
      defaultDuration: 5,
      mode: 'BY_TIMEBLOCK_TAG',
      timeblockTextMustContainString: '#tb',
    }
    const sortedTaskList = [{ content: 'Do something #foo' }, { content: 'Do something else #foo' }]
    const res = tb.processByTimeBlockTag(sortedTaskList, { blockList: timeBlocks, timeMap: timeMap, timeBlockTextList: [] }, cfg)
    expect(res.timeBlockTextList).toEqual(['* 00:20-00:25 Do something #foo #🕑 #tb', '* 00:25-00:30 Do something else #foo #🕑 #tb'])
  })
  test('should place two tasks in one named timeblock but not a third that doesnt fit', () => {
    // now test line which had no time attached
    const timeBlocks = [
      { start: '00:00', end: '00:20', minsAvailable: 20, title: '' },
      { start: '00:25', end: '00:35', minsAvailable: 10, title: 'foo' },
      { start: '00:40', end: '00:45', minsAvailable: 5, title: 'bar' },
    ]
    const timeMap = [
      { start: '00:00', busy: false, index: 1 },
      { start: '00:05', busy: false, index: 2 },
      { start: '00:10', busy: false, index: 3 },
      { start: '00:15', busy: false, index: 4 },
      { start: '00:25', busy: 'foo #tb', index: 10 },
      { start: '00:30', busy: 'foo #tb', index: 11 },
      { start: '00:40', busy: 'bar #tb', index: 20 },
    ]
    const cfg = {
      ...config,
      nowStrOverride: '00:00',
      workDayStart: '00:00',
      intervalMins: 5,
      defaultDuration: 5,
      mode: 'BY_TIMEBLOCK_TAG',
      timeblockTextMustContainString: '#tb',
    }
    const sortedTaskList = [{ content: 'Do something #foo' }, { content: 'Do something else #foo' }, { content: 'this wont fit #foo' }]
    const res = tb.processByTimeBlockTag(sortedTaskList, { blockList: timeBlocks, timeMap: timeMap, timeBlockTextList: [] }, cfg)
    expect(res.timeBlockTextList).toEqual(['* 00:25-00:30 Do something #foo #🕑 #tb', '* 00:30-00:35 Do something else #foo #🕑 #tb'])
  })
  test('should place two tasks in one named timeblock and another in another one', () => {
    // now test line which had no time attached
    const timeBlocks = [
      { start: '00:00', end: '00:05', minsAvailable: 5, title: '' },
      { start: '00:20', end: '00:30', minsAvailable: 10, title: 'foo' },
      { start: '00:40', end: '00:50', minsAvailable: 10, title: 'bar' },
    ]
    const timeMap = [
      { start: '00:00', busy: false, index: 1 },
      { start: '00:20', busy: '#foo #tb', index: 5 },
      { start: '00:25', busy: '#foo #tb', index: 6 },
      { start: '00:40', busy: '#bar #tb', index: 10 },
      { start: '00:45', busy: '#bar #tb', index: 11 },
    ]
    const cfg = {
      ...config,
      nowStrOverride: '00:00',
      workDayStart: '00:00',
      intervalMins: 5,
      defaultDuration: 5,
      mode: 'BY_TIMEBLOCK_TAG',
      timeblockTextMustContainString: '#tb',
    }
    const sortedTaskList = [{ content: 'this is another #bar' }, { content: 'Do something #foo' }, { content: 'Do something else #foo' }]
    const res = tb.processByTimeBlockTag(sortedTaskList, { blockList: timeBlocks, timeMap: timeMap, timeBlockTextList: [] }, cfg)
    expect(res.timeBlockTextList).toEqual(expect.arrayContaining(['* 00:20-00:25 Do something #foo #🕑 #tb']))
    expect(res.timeBlockTextList).toEqual(expect.arrayContaining(['* 00:25-00:30 Do something else #foo #🕑 #tb']))
    expect(res.timeBlockTextList).toEqual(expect.arrayContaining(['* 00:40-00:45 this is another #bar #🕑 #tb']))
  })
  test('should place tasks in a named timeblock and a plain task in a regular open area', () => {
    // now test line which had no time attached
    const timeBlocks = [
      { start: '00:00', end: '00:05', minsAvailable: 5, title: '' },
      { start: '00:20', end: '00:30', minsAvailable: 10, title: 'foo' },
      { start: '00:40', end: '00:50', minsAvailable: 10, title: 'bar' },
    ]
    const timeMap = [
      { start: '00:00', busy: false, index: 1 },
      { start: '00:20', busy: '#foo 🕑', index: 5 },
      { start: '00:25', busy: '#foo 🕑', index: 6 },
      { start: '00:40', busy: '#bar 🕑', index: 10 },
      { start: '00:45', busy: '#bar 🕑', index: 11 },
    ]
    const cfg = {
      ...config,
      nowStrOverride: '00:00',
      workDayStart: '00:00',
      intervalMins: 5,
      defaultDuration: 5,
      mode: 'BY_TIMEBLOCK_TAG',
      timeblockTextMustContainString: '🕑',
    }
    const sortedTaskList = [{ content: 'this is another #bar' }, { content: 'Do something #foo' }, { content: 'Do something outside' }]
    const res = tb.processByTimeBlockTag(sortedTaskList, { blockList: timeBlocks, timeMap: timeMap, timeBlockTextList: [] }, cfg)
    expect(res.timeBlockTextList).toEqual(expect.arrayContaining(['* 00:00-00:05 Do something outside #🕑']))
    expect(res.timeBlockTextList).toEqual(expect.arrayContaining(['* 00:20-00:25 Do something #foo #🕑']))
    expect(res.timeBlockTextList).toEqual(expect.arrayContaining(['* 00:40-00:45 this is another #bar #🕑']))
  })
})
