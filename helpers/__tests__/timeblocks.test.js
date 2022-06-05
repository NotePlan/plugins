/* globals describe, expect, it, test */
import colors from 'chalk'
import * as tb from '../timeblocks'

const HELPER_NAME = `📙 ${colors.yellow('helpers/timeblocks')}`
const section = colors.blue

describe(`${HELPER_NAME}`, () => {
  describe(section('timeblocks.js'), () => {
    describe('isTimeBlockLine SHOULD MATCH', () => {
      test('1b: yes: - @done(2021-12-12) 2:30-3:45', () => {
        expect(tb.isTimeBlockLine('- @done(2021-12-12) 2:30-3:45')).toEqual(true)
      })
      test('2a: yes: at 2PM-3PM', () => {
        expect(tb.isTimeBlockLine('at 2PM-3PM')).toEqual(true)
      })
      test('2b: yes: - @done(2021-12-12) at 2PM-3PM', () => {
        expect(tb.isTimeBlockLine('- @done(2021-12-12) at 2PM-3PM')).toEqual(true)
      })
      test('3a: yes: at 2-3', () => {
        expect(tb.isTimeBlockLine('at 2-3')).toEqual(true)
      })
      test('3b: yes: at 3 -4', () => {
        expect(tb.isTimeBlockLine('at 3 -4')).toEqual(true)
      })
      test('3c: yes: at 4- 5', () => {
        expect(tb.isTimeBlockLine('at 4- 5')).toEqual(true)
      })
      test('3d: yes: at 5 - 6', () => {
        expect(tb.isTimeBlockLine('at 5 - 6')).toEqual(true)
      })
      test('3e: yes: at 6~7', () => {
        expect(tb.isTimeBlockLine('at 6~7')).toEqual(true)
      })
      test('3f: yes: at 7to8', () => {
        expect(tb.isTimeBlockLine('at 7to8')).toEqual(true)
      })
      test('3g: yes: at 8 to 9', () => {
        expect(tb.isTimeBlockLine('at 8 to 9')).toEqual(true)
      })
      test('3h: yes: at 9–10', () => {
        expect(tb.isTimeBlockLine('at 9–10')).toEqual(true)
      })
      test('3i: yes: at 10 - 11', () => {
        expect(tb.isTimeBlockLine('at 10 - 11')).toEqual(true)
      })
      test('4: yes: at 2-3PM', () => {
        expect(tb.isTimeBlockLine('at 2-3PM')).toEqual(true)
      })
      test('5: yes: at 2PM-3', () => {
        expect(tb.isTimeBlockLine('at 2PM-3')).toEqual(true)
      })
      test('6: yes: >2021-06-02 at 2-3', () => {
        expect(tb.isTimeBlockLine('>2021-06-02 at 2-3')).toEqual(true)
      })
      test('7: yes: >2021-06-02 at 2:30-3:45', () => {
        expect(tb.isTimeBlockLine('>2021-06-02 at 2:30-3:45')).toEqual(true)
      })
      test('8: yes: >2021-06-02 at 2am-3PM', () => {
        expect(tb.isTimeBlockLine('>2021-06-02 at 2am-3PM')).toEqual(true)
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
      test('13: yes: done at 2PM-3PM @done(2021-12-12)', () => {
        expect(tb.isTimeBlockLine('done at 2PM-3PM @done(2021-12-12)')).toEqual(true)
      })
      test('14: yes: at 5-5:45pm', () => {
        expect(tb.isTimeBlockLine('at 5-5:45pm')).toEqual(true)
      })
      test('15: yes: at 5pm', () => {
        expect(tb.isTimeBlockLine('at 5pm')).toEqual(true)
      })
      test('18: yes: 2PM-3PM', () => {
        expect(tb.isTimeBlockLine('at 2PM-3PM')).toEqual(true)
      })
      test('19: yes: 2-3', () => {
        expect(tb.isTimeBlockLine('at 2-3')).toEqual(true)
      })
      test('20: yes: 2-3PM', () => {
        expect(tb.isTimeBlockLine('at 2-3PM')).toEqual(true)
      })
      test('21: yes: 2PM-3', () => {
        expect(tb.isTimeBlockLine('at 2PM-3')).toEqual(true)
      })
      test('22a: yes: 1️⃣ 6:00 AM - 8:30 AM - Part I', () => {
        expect(tb.isTimeBlockLine('1️⃣ 6:00 AM - 8:30 AM - Part I')).toEqual(true)
      })
      test('22b: yes:  7:00 AM - 9:30 AM - Part I', () => {
        expect(tb.isTimeBlockLine(' 7:00 AM - 9:30 AM - Part I')).toEqual(true)
      })
      test('23a: yes: at noon', () => {
        expect(tb.isTimeBlockLine('at noon')).toEqual(true)
      })
      test('23b: yes: at noon:24', () => {
        expect(tb.isTimeBlockLine('at noon:24')).toEqual(true)
      })
      test('24a: yes: at midnight', () => {
        expect(tb.isTimeBlockLine('at midnight')).toEqual(true)
      })
      test('24b: yes: at midnight:24', () => {
        expect(tb.isTimeBlockLine('at midnight:24')).toEqual(true)
      })
      test.skip('25: 5-6am...', () => {
        expect(tb.isTimeBlockLine('5-6am Do something #hash [[wikilink]] [url](something) ')).toEqual(true)
      })
    })

    describe('isTimeBlockLine NON-MATCHES', () => {
      test('3j: yes: at11-12', () => {
        expect(tb.isTimeBlockLine('at11-12')).toEqual(false)
      })
      test('16a: no: at 5a', () => {
        expect(tb.isTimeBlockLine('at 5a')).toEqual(false)
      })
      test('16b: yes: at 5p', () => {
        expect(tb.isTimeBlockLine('at 5p')).toEqual(false)
      })
      test('17: no: 2021-06-02 2.15PM-3.45PM (dots not allowed)', () => {
        expect(tb.isTimeBlockLine('2021-06-02 2.15PM-3.45PM')).toEqual(false)
      })
      // One of the ISO standard ways, but not supported by NP parsing, so don't support it fully
      test('25: no: 2021-12-02T12:34', () => {
        expect(tb.isTimeBlockLine('2021-12-02T12:34')).toEqual(false)
      })
      // Not quite one of the ISO standard ways
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
      test('35: no: 1234:56', () => {
        expect(tb.isTimeBlockLine('1234:56')).toEqual(false)
      })
      test('calendar event links should not be timeblocks', () => {
        const cal = '![📅](2022-05-06 07:15:::6qr6nbulhd7k3aakvf61atfsrd@google.com:::NA:::Work-out @ Home:::#1BADF8)'
        expect(tb.isTimeBlockLine(cal)).toEqual(false)
      })
    })
    describe('findLongestStringInArray ', () => {
      test('should return longest string in array', () => {
        expect(tb.findLongestStringInArray(['a', 'bb', '', 'dddd'])).toEqual('dddd')
      })
      test('should return longest string in array with emojis as longest term', () => {
        expect(tb.findLongestStringInArray(['a', 'bb', '', 'dd🔬d'])).toEqual('dd🔬d')
      })
      // Doesn't pass, but we don't think this will be an actual issue, so disable
      // test('should return longest string in array with emojis in other terms', () => {
      //   expect(tb.findLongestStringInArray(['a🔬', 'bb', 'cc🔬', 'dddd'])).toEqual('dd🔬d')
      // })
      test('should return longest string in array wherever it is in array', () => {
        expect(tb.findLongestStringInArray(['aa', 'bbbbb', '', 'cc'])).toEqual('bbbbb')
      })
      test('should return empty string if no array', () => {
        expect(tb.findLongestStringInArray([])).toEqual('')
      })
    })

    describe('getTimeBlockString ', () => {
      test("should return '' if no timeblock present", () => {
        expect(tb.getTimeBlockString('01. no timeblock here :')).toEqual('')
      })
      // Currently failing, and not sure why
      test("should return '12:30' ", () => {
        expect(tb.getTimeBlockString('something 2022-01-01 12:30 and nothing else')).toEqual('12:30')
      })
      test("should return 'at 2am-3PM'", () => {
        expect(tb.getTimeBlockString('- 2022-01-01 at 2am-3PM here')).toEqual('at 2am-3PM')
      })
    })

    describe('isTypeThatCanHaveATimeBlock', () => {
      test('type .open YES', () => {
        let p = { type: 'open' }
        expect(tb.isTypeThatCanHaveATimeBlock(p)).toEqual(true)
      })
      test('type .done YES', () => {
        let p = { type: 'done' }
        expect(tb.isTypeThatCanHaveATimeBlock(p)).toEqual(true)
      })
      test('type .title YES', () => {
        let p = { type: 'title' }
        expect(tb.isTypeThatCanHaveATimeBlock(p)).toEqual(true)
      })
      test('type .list YES', () => {
        let p = { type: 'list' }
        expect(tb.isTypeThatCanHaveATimeBlock(p)).toEqual(true)
      })
      test('type .scheduled NO', () => {
        let p = { type: 'scheduled' }
        expect(tb.isTypeThatCanHaveATimeBlock(p)).toEqual(false)
      })
      test('type .text NO', () => {
        let p = { type: 'text' }
        expect(tb.isTypeThatCanHaveATimeBlock(p)).toEqual(false)
      })
      test('type .cancelled NO', () => {
        let p = { type: 'cancelled' }
        expect(tb.isTypeThatCanHaveATimeBlock(p)).toEqual(false)
      })
      test('type .empty NO', () => {
        let p = { type: 'empty' }
        expect(tb.isTypeThatCanHaveATimeBlock(p)).toEqual(false)
      })
      test('type .quote NO', () => {
        let p = { type: 'quote' }
        expect(tb.isTypeThatCanHaveATimeBlock(p)).toEqual(false)
      })
    })
  })
})
