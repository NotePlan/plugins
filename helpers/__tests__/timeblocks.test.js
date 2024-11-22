import { describe, expect, jest, test, beforeAll, afterAll } from '@jest/globals'
import colors from 'chalk'
import * as tb from '../timeblocks'
import { DataStore } from '@mocks/index'

beforeAll(() => {
  global.DataStore = DataStore
  DataStore.settings['_logLevel'] = 'DEBUG' // change between none and DEBUG to see more console output during test runs
})
const HELPER_NAME = `📙 ${colors.yellow('helpers/timeblocks')}`
const section = colors.blue
// const method = colors.magenta.bold

describe(`${HELPER_NAME}`, () => {
  describe('isTimeBlockLine', () => {
    describe('isTimeBlockLine SHOULD MATCH', () => {
      test('1a: yes: 1:30-2:45', () => {
        expect(tb.isTimeBlockLine('1:30-2:45')).toEqual(true)
      })
      test('1b: yes: - @done(2021-12-12) 2:30-3:45', () => {
        expect(tb.isTimeBlockLine('- @done(2021-12-12) 2:30-3:45')).toEqual(true)
      })
      test('7: yes: >2021-06-02 at 2:30-3:45', () => {
        expect(tb.isTimeBlockLine('>2021-06-02 at 2:30-3:45')).toEqual(true)
      })
      test('9: yes: >2021-06-02 2:15 - 3:45', () => {
        expect(tb.isTimeBlockLine('>2021-06-02 2:15 - 3:45')).toEqual(true)
      })
      test('10: yes: 2021-06-02 2:15 - 3:45', () => {
        expect(tb.isTimeBlockLine('2021-06-02 2:15 - 3:45')).toEqual(true)
      })
      test('11a: yes: >2021-06-02 16:00 - 16:45', () => {
        expect(tb.isTimeBlockLine('>2021-06-02 16:00 - 16:45')).toEqual(true)
      })
      test('11b: yes: 2021-06-02 16:00 - 16:45', () => {
        expect(tb.isTimeBlockLine('2021-06-02 16:00 - 16:45')).toEqual(true)
      })
      test('12: yes: @done(2021-12-12) 2:30-3:45', () => {
        expect(tb.isTimeBlockLine('@done(2021-12-12) 2:30-3:45')).toEqual(true)
      })
      test('22a: yes: 1️⃣ 6:00 AM - 8:30 AM - Part I', () => {
        expect(tb.isTimeBlockLine('1️⃣ 6:00 AM - 8:30 AM - Part I')).toEqual(true)
      })
      test('22b: yes:  7:00 AM - 9:30 AM - Part I', () => {
        expect(tb.isTimeBlockLine(' 7:00 AM - 9:30 AM - Part I')).toEqual(true)
      })
      test('25a: yes: do something 12:30', () => {
        expect(tb.isTimeBlockLine('do something 12:30')).toEqual(true)
      })
      test('25b: yes: do something 12:30, with following punctuation', () => {
        expect(tb.isTimeBlockLine('do something 12:30, with following punctuation')).toEqual(true)
      })
    })

    describe('isTimeBlockLine NON-MATCHES', () => {
      test('2a: no: at 2PM-3PM', () => {
        expect(tb.isTimeBlockLine('at 2PM-3PM')).toEqual(false)
      })
      test('2b: no: - @done(2021-12-12) at 2PM-3PM', () => {
        expect(tb.isTimeBlockLine('- @done(2021-12-12) at 2PM-3PM')).toEqual(false)
      })
      test('3a: no: at 2-3', () => {
        expect(tb.isTimeBlockLine('at 2-3')).toEqual(false)
      })
      test('3b: no: at 3 -4', () => {
        expect(tb.isTimeBlockLine('at 3 -4')).toEqual(false)
      })
      test('3c: no: at 4- 5', () => {
        expect(tb.isTimeBlockLine('at 4- 5')).toEqual(false)
      })
      test('3d: no: at 5 - 6', () => {
        expect(tb.isTimeBlockLine('at 5 - 6')).toEqual(false)
      })
      test('3e: no: at 6~7', () => {
        expect(tb.isTimeBlockLine('at 6~7')).toEqual(false)
      })
      test('3f: no: at 7to8', () => {
        expect(tb.isTimeBlockLine('at 7to8')).toEqual(false)
      })
      test('3g: no: at 8 to 9', () => {
        expect(tb.isTimeBlockLine('at 8 to 9')).toEqual(false)
      })
      test('3h: no: at 9–10', () => {
        expect(tb.isTimeBlockLine('at 9–10')).toEqual(false)
      })
      test('3i: no: at 10 - 11', () => {
        expect(tb.isTimeBlockLine('at 10 - 11')).toEqual(false)
      })
      test('3j: no: at11-12', () => {
        expect(tb.isTimeBlockLine('at11-12')).toEqual(false)
      })
      test('4: no: at 2-3PM', () => {
        expect(tb.isTimeBlockLine('at 2-3PM')).toEqual(false)
      })
      test('5: no: at 2PM-3', () => {
        expect(tb.isTimeBlockLine('at 2PM-3')).toEqual(false)
      })
      test('6: no: >2021-06-02 at 2-3', () => {
        expect(tb.isTimeBlockLine('>2021-06-02 at 2-3')).toEqual(false)
      })
      test('8: no: >2021-06-02 at 2am-3PM', () => {
        expect(tb.isTimeBlockLine('>2021-06-02 at 2am-3PM')).toEqual(false)
      })
      test('13: no: done at 2PM-3PM @done(2021-12-12)', () => {
        expect(tb.isTimeBlockLine('done at 2PM-3PM @done(2021-12-12)')).toEqual(false)
      })
      test('14: no: at 5-5:45pm', () => {
        expect(tb.isTimeBlockLine('at 5-5:45pm')).toEqual(false)
      })
      test('15: no: at 5pm', () => {
        expect(tb.isTimeBlockLine('at 5pm')).toEqual(false)
      })
      test('16a: no: at 5a', () => {
        expect(tb.isTimeBlockLine('at 5a')).toEqual(false)
      })
      test('16b: no: at 5p', () => {
        expect(tb.isTimeBlockLine('at 5p')).toEqual(false)
      })
      test('17: no: 2021-06-02 2.15PM-3.45PM (dots not allowed)', () => {
        expect(tb.isTimeBlockLine('2021-06-02 2.15PM-3.45PM')).toEqual(false)
      })
      test('18: no: 2PM-3PM', () => {
        expect(tb.isTimeBlockLine('2PM-3PM')).toEqual(false)
      })
      test('20: no: 2-3PM', () => {
        expect(tb.isTimeBlockLine('2-3PM')).toEqual(false)
      })
      test('19: no: 2-3', () => {
        expect(tb.isTimeBlockLine('2-3')).toEqual(false)
      })
      test('21: no: 2PM-3', () => {
        expect(tb.isTimeBlockLine('2PM-3')).toEqual(false)
      })
      // Not quite one of the ISO standard ways, so don't support it
      test('26: no: at TT23:45', () => {
        expect(tb.isTimeBlockLine('at TT23:45')).toEqual(false)
      })
      test('27: no: cost was 23.12', () => {
        expect(tb.isTimeBlockLine('cost was 23.12')).toEqual(false)
      })
      test('28: no: Philippians 2.6-11 says ...', () => {
        expect(tb.isTimeBlockLine('Philippians 2.6-11 says')).toEqual(false)
      })
      test('29: no: ### 21/11/2021  CCC Hybrid service', () => {
        expect(tb.isTimeBlockLine('### 21/11/2021  CCC Hybrid service')).toEqual(false)
      })
      test('30: no: terminal 5', () => {
        expect(tb.isTimeBlockLine('terminal 5')).toEqual(false)
      })
      test('31: no: * Do something <2022-01-05', () => {
        expect(tb.isTimeBlockLine('* Do something <2022-01-05')).toEqual(false)
      })
      test('32: no: * [x] Done something @done(2022-01-05)', () => {
        expect(tb.isTimeBlockLine('* [x] Done something @done(2022-01-05)')).toEqual(false)
      })
      test('33: no (though works in NP, but not according to spec): - TBT33 the temp is 17-18', () => {
        expect(tb.isTimeBlockLine('- TBT33 the temp is 17-18')).toEqual(false)
      })
      test('34: no: I sat 2pm onwards', () => {
        expect(tb.isTimeBlockLine('I sat 2pm onwards')).toEqual(false)
      })
      test('35: no: somethingfrom 2pm onwards', () => {
        expect(tb.isTimeBlockLine('somethingfrom 2pm onwards')).toEqual(false)
      })
      test('36: no: 1234:56', () => {
        expect(tb.isTimeBlockLine('1234:56')).toEqual(false)
      })
      test('37: calendar event links should not be timeblocks', () => {
        const cal = '![📅](2022-05-06 07:15:::6qr6nbulhd7k3aakvf61atfsrd@google.com:::NA:::Work-out @ Home:::#1BADF8)'
        expect(tb.isTimeBlockLine(cal)).toEqual(false)
      })
      test('38: no, as TB in a URL', () => {
        expect(tb.isTimeBlockLine('something in https://example.com/blog/2022-01-01/12:30 and nothing else')).toEqual(false)
      })
      test('39: yes, as TB not in a URL', () => {
        expect(tb.isTimeBlockLine('something in https://example.com/blog/2022-01-01/ends, 12:30')).toEqual(true)
      })
      // One of the ISO standard ways, but not supported by NP parsing, so don't support it fully
      test('40: no: 2021-12-02T12:34', () => {
        expect(tb.isTimeBlockLine('2021-12-02T12:34')).toEqual(false)
      })
    })

    describe('isTimeBlockLine using mustContainString arg2', () => {
      test('1: yes: at 11:00 - 12:00, at', () => {
        expect(tb.isTimeBlockLine('at 11:00 - 12:00', 'at')).toEqual(true)
      })
      test('2: no: at 11:00 - 12:00, AT', () => {
        expect(tb.isTimeBlockLine('at 11:00 - 12:00', 'AT')).toEqual(false)
      })
      test('3: no: at 11:00 - 12:00, bob', () => {
        expect(tb.isTimeBlockLine('at 11:00 - 12:00', 'bob')).toEqual(false)
      })
      test('4: no: at 11:00 - 12:00, catch', () => {
        expect(tb.isTimeBlockLine('at 11:00 - 12:00', 'catch')).toEqual(false)
      })
      // I don't think this makes sense, but that's how NP currently works
      test('5: yes: catch 11:00 - 12:00, at', () => {
        expect(tb.isTimeBlockLine('catch 11:00 - 12:00', 'at')).toEqual(true)
      })
      test('6: yes: ... at 3:00 ..., at', () => {
        expect(tb.isTimeBlockLine('bob at 3:00 ok', 'at')).toEqual(true)
      })
      test('25c: yes: do something 12:30, with emoji 🕑', () => {
        expect(tb.isTimeBlockLine('do something 12:30, with emoji 🕑', '🕑')).toEqual(true)
      })
    })
  })

  describe('getTimeBlockString()', () => {
    test("should return '' if no timeblock present", () => {
      expect(tb.getTimeBlockString('01. no timeblock here :')).toEqual('')
    })
    test("should return '12:30' ", () => {
      expect(tb.getTimeBlockString('something 2022-01-01 12:30 and nothing else')).toEqual('12:30')
    })
    test("should return 'at 2:00am-3:00PM'", () => {
      expect(tb.getTimeBlockString('- 2022-01-01 at 2:00am-3:00PM here')).toEqual('2:00am-3:00PM')
    })
    test("should return 'at 2:00am - 3:00PM'", () => {
      expect(tb.getTimeBlockString('>2022-01-01 at 2:00am - 3:00PM here')).toEqual('2:00am - 3:00PM')
    })
  })

  describe('isTimeBlockPara()', () => {
    describe('isTimeBlockPara() with 1 arg', () => {
      test("should return false: 'no timeblock here'", () => {
        const p = { type: 'open', content: '01. no timeblock here :' }
        expect(tb.isTimeBlockPara(p)).toEqual(false)
      })
      test("should return true: 'do something 12:30' ", () => {
        const p = { type: 'open', content: 'do something 12:30' }
        expect(tb.isTimeBlockPara(p)).toEqual(true)
      })
      test("should return true: '2:00am-3:00PM'", () => {
        const p = { type: 'open', content: '>2022-01-01 2:00am-3:00PM here' }
        expect(tb.isTimeBlockPara(p)).toEqual(true)
      })
      test("should return false: '12:30' in a URL ", () => {
        const p = { type: 'open', content: 'something in https://example.com/blog/2022-01-01/12:30 and nothing else' }
        expect(tb.isTimeBlockPara(p)).toEqual(false)
      })
      test("should return true: '2:00am-3:00PM' in a filepath", () => {
        const p = { type: 'open', content: '- [2022-01-01](file:/something/2:00am-3:00PM.txt) here' }
        expect(tb.isTimeBlockPara(p)).toEqual(false)
      })
    })

    describe('isTimeBlockPara() with timeblockTextMustContainString arg2', () => {
      test('1: yes: at 11:00-12:00, at', () => {
        const para = { content: 'at 11:00-12:00', type: 'list' }
        expect(tb.isTimeBlockPara(para, 'at')).toEqual(true)
      })
      test('2: no: at 11:00-12:00, AT', () => {
        const para = { content: 'at 11:00-12:00', type: 'list' }
        expect(tb.isTimeBlockPara(para, 'AT')).toEqual(false)
      })
      test('3: no: at 11:00-12:00, bob', () => {
        const para = { content: 'at 11:00-12:00', type: 'list' }
        expect(tb.isTimeBlockPara(para, 'bob')).toEqual(false)
      })
      test('4: no: at 11:00-12:00, catch', () => {
        const para = { content: 'at 11:00-12:00', type: 'list' }
        expect(tb.isTimeBlockPara(para, 'catch')).toEqual(false)
      })
      // I don't think this makes sense, but that's how NP currently works
      test('5: yes: catch 11:00-12:00, at', () => {
        const para = { content: 'catch 11:00-12:00', type: 'open' }
        expect(tb.isTimeBlockPara(para, 'at')).toEqual(true)
      })
      test('6: yes: bob at 3:00PM ok, at', () => {
        const para = { content: 'bob at 3:00PM ok', type: 'open' }
        expect(tb.isTimeBlockPara(para, 'at')).toEqual(true)
      })
    })
  })

  describe('isTypeThatCanHaveATimeBlock()', () => {
    test('type .open YES', () => {
      const p = { type: 'open' }
      expect(tb.isTypeThatCanHaveATimeBlock(p)).toEqual(true)
    })
    test('type .done YES', () => {
      const p = { type: 'done' }
      expect(tb.isTypeThatCanHaveATimeBlock(p)).toEqual(true)
    })
    test('type .title YES', () => {
      const p = { type: 'title' }
      expect(tb.isTypeThatCanHaveATimeBlock(p)).toEqual(true)
    })
    test('type .list YES', () => {
      const p = { type: 'list' }
      expect(tb.isTypeThatCanHaveATimeBlock(p)).toEqual(true)
    })
    test('type .scheduled NO', () => {
      const p = { type: 'scheduled' }
      expect(tb.isTypeThatCanHaveATimeBlock(p)).toEqual(false)
    })
    test('type .text NO', () => {
      const p = { type: 'text' }
      expect(tb.isTypeThatCanHaveATimeBlock(p)).toEqual(false)
    })
    test('type .cancelled NO', () => {
      const p = { type: 'cancelled' }
      expect(tb.isTypeThatCanHaveATimeBlock(p)).toEqual(false)
    })
    test('type .empty NO', () => {
      const p = { type: 'empty' }
      expect(tb.isTypeThatCanHaveATimeBlock(p)).toEqual(false)
    })
    test('type .quote NO', () => {
      const p = { type: 'quote' }
      expect(tb.isTypeThatCanHaveATimeBlock(p)).toEqual(false)
    })
  })

  // test the various overrides of timeblockTextMustContainString
  describe('getCurrentTimeBlockPara with timeblockTextMustContainString override', () => {
    const note = {
      paragraphs: [
        { content: 'Meeting 1:00PM-2:00PM' },
        { content: 'Lunch 12:00-1:00PM' },
        { content: 'Review 14:00-15:00' },
        { content: 'Gaming 3:00PM-4:00PM' },
        { content: 'Test time block 🤔 at 17:00-23:30' },
        { content: 'test without mustContainString 18:00-23:00' },
      ],
    }
    const thisISODate = new Date().toISOString().slice(0, 10)

    // START TESTS FOR PREFERENCE SET TO "at"
    describe('preference set to "at"', () => {
      beforeEach(() => {
        DataStore.preference = jest.fn().mockImplementation((key) => {
          if (key === 'timeblockTextMustContainString') {
            return 'at'
          }
          return savedPreference(key)
        })
      })
      afterEach(() => {
        // remove the mock implementation
        DataStore.preference.mockRestore()
      })
      test('13:30: should return the Meeting 1 time block', () => {
        // Mock the current time
        jest.useFakeTimers().setSystemTime(new Date(`${thisISODate}T13:30:00`))
        const tbPara = tb.getCurrentTimeBlockPara(note)
        expect(tbPara).not.toBeNull()
        expect(tbPara.content).toBe('Meeting 1:00PM-2:00PM')
      })
    })
    // END TESTS FOR PREFERENCE SET TO "at"
  })

  describe('getCurrentTimeBlockPara', () => {
    // WARNING: the emoji test fails if it is in single quotes not double quotes!
    const note = {
      paragraphs: [
        { content: 'Meeting 1:00PM-2:00PM' },
        { content: 'Lunch 12:00-1:00PM' },
        { content: 'Review 14:00-15:00' },
        { content: 'Gaming 3:00PM-4:00PM' },
        { content: 'Test time block 🤔 at 17:00-23:30' },
        { content: 'test without mustContainString 18:00-23:00' },
      ],
    }
    // Get today's ISO date
    const thisISODate = new Date().toISOString().slice(0, 10)
    test('13:30: should return the Meeting 1 time block', () => {
      // Mock the current time
      jest.useFakeTimers().setSystemTime(new Date(`${thisISODate}T13:30:00`))
      const tbPara = tb.getCurrentTimeBlockPara(note)
      expect(tbPara.content).toBe('Meeting 1:00PM-2:00PM')
    })
    test('14:30: should return the Review time block', () => {
      // Mock the current time
      jest.useFakeTimers().setSystemTime(new Date(`${thisISODate}T14:30:00`))
      const tbPara = tb.getCurrentTimeBlockPara(note)
      expect(tbPara.content).toBe('Review 14:00-15:00')
    })
    test('14:00: should return the Review time block', () => {
      // Mock the current time
      jest.useFakeTimers().setSystemTime(new Date(`${thisISODate}T14:00:00`))
      const tbPara = tb.getCurrentTimeBlockPara(note)
      expect(tbPara.content).toBe('Review 14:00-15:00')
    })
    test('15:00: should not return the Review time block, but Gaming', () => {
      // Mock the current time
      jest.useFakeTimers().setSystemTime(new Date(`${thisISODate}T15:00:00`))
      const tbPara = tb.getCurrentTimeBlockPara(note)
      expect(tbPara.content).toBe('Gaming 3:00PM-4:00PM')
    })
    test('16:00: should not return the Gaming time block', () => {
      // Mock the current time
      jest.useFakeTimers().setSystemTime(new Date(`${thisISODate}T16:00:00`))
      const tbPara = tb.getCurrentTimeBlockPara(note)
      expect(tbPara).toBe(null)
    })
    test('21:00: should return the emoji time block', () => {
      // Mock the current time
      jest.useFakeTimers().setSystemTime(new Date(`${thisISODate}T21:00:00`))
      const tbPara = tb.getCurrentTimeBlockPara(note)
      expect(tbPara.content).toBe('Test time block 🤔 at 17:00-23:30')
    })
    test("11:00: should not return time block as missing mustContainString 'at'", () => {
      // Mock the current time
      jest.useFakeTimers().setSystemTime(new Date(`${thisISODate}T11:00:00`))
      const tbPara = tb.getCurrentTimeBlockPara(note, false, 'at')
      expect(tbPara).toBe(null)
    })

    test('should return null if current time is after all blocks', () => {
      // Mock the current time
      jest.useFakeTimers().setSystemTime(new Date(`${thisISODate}T23:45:00`))
      const tbPara = tb.getCurrentTimeBlockPara(note)
      expect(tbPara).toBe(null)
    })

    afterAll(() => {
      jest.useRealTimers() // Restore the real timers after each test
    })
  })

  describe('getCurrentTimeBlockDetails', () => {
    const note = {
      paragraphs: [
        { content: 'Meeting 1:00PM-2:00PM' },
        { content: 'Lunch 12:00-1:00PM' },
        { content: 'Review 14:00-15:00' },
        { content: 'Gaming 3:00PM-4:00PM' },
        { content: 'Dinner at 5:00PM-6:00PM' },
        { content: 'Games from 6:00PM-7:00PM' },
      ],
    }
    // Get today's ISO date
    const thisISODate = new Date().toISOString().slice(0, 10)

    test('13:30: should return the Meeting 1 time block', () => {
      // Mock the current time
      jest.useFakeTimers().setSystemTime(new Date(`${thisISODate}T13:30:00`))
      const [timeBlock, content] = tb.getCurrentTimeBlockDetails(note)
      expect(timeBlock).toBe('1:00PM-2:00PM')
      expect(content).toBe('Meeting')
    })
    test('14:30: should return the Review time block', () => {
      // Mock the current time
      jest.useFakeTimers().setSystemTime(new Date(`${thisISODate}T14:30:00`))
      const [timeBlock, content] = tb.getCurrentTimeBlockDetails(note)
      expect(timeBlock).toBe('14:00-15:00')
      expect(content).toBe('Review')
    })
    test('14:00: should return the Review time block', () => {
      // Mock the current time
      jest.useFakeTimers().setSystemTime(new Date(`${thisISODate}T14:00:00`))
      const [timeBlock, content] = tb.getCurrentTimeBlockDetails(note)
      expect(timeBlock).toBe('14:00-15:00')
      expect(content).toBe('Review')
    })
    test('15:00: should not return the Review time block, but Gaming', () => {
      // Mock the current time
      jest.useFakeTimers().setSystemTime(new Date(`${thisISODate}T15:00:00`))
      const [timeBlock, content] = tb.getCurrentTimeBlockDetails(note)
      expect(timeBlock).toBe('3:00PM-4:00PM')
      expect(content).toBe('Gaming')
    })
    test('17:00: should return the Dinner time block without mustContainString', () => {
      // Mock the current time
      jest.useFakeTimers().setSystemTime(new Date(`${thisISODate}T17:00:00`))
      const [timeBlock, content] = tb.getCurrentTimeBlockDetails(note, 'at')
      expect(timeBlock).toBe('5:00PM-6:00PM')
      expect(content).toBe('Dinner')
    })
    test('18:00: should return the Games time block without mustContainString', () => {
      // Mock the current time
      jest.useFakeTimers().setSystemTime(new Date(`${thisISODate}T18:00:00`))
      const [timeBlock, content] = tb.getCurrentTimeBlockDetails(note, 'from')
      expect(timeBlock).toBe('6:00PM-7:00PM')
      expect(content).toBe('Games')
    })

    test('should return an empty tuple if current time is after all blocks', () => {
      // Mock the current time
      jest.useFakeTimers().setSystemTime(new Date(`${thisISODate}T22:30:00`))
      const [timeBlock, content] = tb.getCurrentTimeBlockDetails(note)
      expect(timeBlock).toBe('')
      expect(content).toBe('')
    })

    afterAll(() => {
      jest.useRealTimers() // Restore the real timers after each test
    })
  })
})
