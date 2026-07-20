// @flow
/* global describe, expect, test, beforeAll */
import { calcOffsetDateStr } from '@helpers/NPdateTime'
import {
  RE_OFFSET_DATE,
  RE_OFFSET_DATE_CAPTURE,
} from '@helpers/dateTime'
import {
  appendComputedFinalDateToContent,
  isSectionBoundary,
  setCurrentTargetDateIfBareDate,
  type CtdOrigin,
} from '../src/offsets'

/**
 * Mirror applyOffsetInLine date calculation.
 * @param {string} dateOffsetString
 * @param {string} baseDate
 * @param {string} lastCalcDate
 * @returns {string}
 */
function calcDateForOffset(dateOffsetString: string, baseDate: string, lastCalcDate: string): string {
  if (dateOffsetString.startsWith('^')) {
    return calcOffsetDateStr(lastCalcDate, dateOffsetString.slice(1), 'offset')
  }
  return calcOffsetDateStr(baseDate, dateOffsetString, 'offset')
}

/** @typedef {{content: string, level: number, type?: string}} OffsetLineSpec */

/**
 * Simulate processDateOffsets loop over a note outline using production helpers.
 * @param {Array<OffsetLineSpec>} lines
 * @param {boolean} addComputedFinalDate
 * @returns {{lines: Array<string>, ctdAtEnd: string, ctdOriginAtEnd: CtdOrigin}}
 */
function simulateProcessDateOffsets(
  lines: Array<OffsetLineSpec>,
  addComputedFinalDate: boolean,
): { lines: Array<string>, ctdAtEnd: string, ctdOriginAtEnd: CtdOrigin } {
  const outputLines: Array<string> = lines.map((l) => l.content)
  let currentTargetDate = ''
  let currentTargetDateOrigin: CtdOrigin = ''
  let currentTargetDateLine = 0
  let previousFoundLevel = 0
  let lastCalcDate = ''

  for (let n = 0; n < lines.length; n++) {
    const { content, level: thisLevel, type = 'text' } = lines[n]

    if (isSectionBoundary(thisLevel, previousFoundLevel, content, type)) {
      if (currentTargetDate !== '') {
        outputLines[currentTargetDateLine] = appendComputedFinalDateToContent(
          outputLines[currentTargetDateLine],
          currentTargetDateOrigin,
          lastCalcDate,
          currentTargetDateLine,
          addComputedFinalDate,
        )
      }
      currentTargetDate = ''
      currentTargetDateOrigin = ''
      currentTargetDateLine = 0
      lastCalcDate = ''
    }

    const ctdInfo = setCurrentTargetDateIfBareDate(content, thisLevel, previousFoundLevel, n)
    if (ctdInfo.ctd !== '') {
      currentTargetDate = ctdInfo.ctd
      currentTargetDateLine = ctdInfo.ctdLine
      currentTargetDateOrigin = ctdInfo.ctdOrigin
      previousFoundLevel = ctdInfo.ctdLevel
    }

    if (content.match(RE_OFFSET_DATE)) {
      const dateOffsetStrings = content.match(RE_OFFSET_DATE_CAPTURE) ?? ['']
      const dateOffsetString = dateOffsetStrings[1]
      if (dateOffsetString !== '' && currentTargetDate !== '') {
        const calcDate = calcDateForOffset(dateOffsetString, currentTargetDate, lastCalcDate)
        lastCalcDate = calcDate
        // Replace offset, collapse leftover double spaces (from " {offset}" -> " >date "), then trim trailing whitespace
        outputLines[n] = content.replace(`{${dateOffsetString}}`, ` >${calcDate} `).replace(/(\S) {2,}/g, '$1 ').trimEnd()
      }
    }
  }

  return { lines: outputLines, ctdAtEnd: currentTargetDate, ctdOriginAtEnd: currentTargetDateOrigin }
}

beforeAll(() => {
  DataStore.settings['_logLevel'] = 'none'
})

describe('CTD origin (heading vs from-task behaviour)', () => {
  describe('setCurrentTargetDateIfBareDate()', () => {
    test('heading line with bare date -> origin heading', () => {
      const result = setCurrentTargetDateIfBareDate('### Christmas Cards 2021-12-25', -1, 0, 0)
      expect(result).toEqual({
        ctd: '2021-12-25',
        ctdLine: 0,
        ctdLevel: -1,
        ctdOrigin: 'heading',
      })
    })

    test('task line with bare date -> origin task', () => {
      const result = setCurrentTargetDateIfBareDate("* Bob's birthday on 2021-09-14", 0, 0, 2)
      expect(result).toEqual({
        ctd: '2021-09-14',
        ctdLine: 2,
        ctdLevel: 0,
        ctdOrigin: 'task',
      })
    })

    test('line without bare date -> empty origin', () => {
      const result = setCurrentTargetDateIfBareDate('* Write cards {-20d}', 0, 0, 1)
      expect(result).toEqual({
        ctd: '',
        ctdLine: 0,
        ctdLevel: 0,
        ctdOrigin: '',
      })
    })

    test('ignores @done(...) dates as CTD', () => {
      const result = setCurrentTargetDateIfBareDate('* Done item @done(2021-09-14)', 0, 0, 0)
      expect(result.ctdOrigin).toEqual('')
      expect(result.ctd).toEqual('')
    })
  })

  describe('appendComputedFinalDateToContent()', () => {
    test('appends for heading origin when setting enabled', () => {
      const result = appendComputedFinalDateToContent('### Christmas Cards 2021-12-25', 'heading', '2021-12-28', 0, true)
      expect(result).toEqual('### Christmas Cards 2021-12-25 to 2021-12-28')
    })

    test('does not append for task origin', () => {
      const result = appendComputedFinalDateToContent("* Bob's birthday on 2021-09-14", 'task', '2021-09-14', 0, true)
      expect(result).toEqual("* Bob's birthday on 2021-09-14")
    })

    test('does not append when setting disabled', () => {
      const result = appendComputedFinalDateToContent('### Section 2021-12-25', 'heading', '2021-12-28', 0, false)
      expect(result).toEqual('### Section 2021-12-25')
    })

    test('appends for heading on line 0 (ctdLine >= 0)', () => {
      const result = appendComputedFinalDateToContent('### First line 2022-03-01', 'heading', '2022-03-04', 0, true)
      expect(result).toEqual('### First line 2022-03-01 to 2022-03-04')
    })

    test('does not append for deadline+offset task line', () => {
      const result = appendComputedFinalDateToContent('* Post cards deadline 2021-12-18 >2021-12-08', 'task', '2021-12-08', 0, true)
      expect(result).toEqual('* Post cards deadline 2021-12-18 >2021-12-08')
    })
  })

  describe('isSectionBoundary() - unchanged carry-forward rules', () => {
    test('does not clear task CTD when reaching sibling at same indent', () => {
      expect(isSectionBoundary(0, 0, '* Some other task {-1d}', 'text')).toEqual(false)
    })

    test('clears on blank line', () => {
      expect(isSectionBoundary(0, 0, '', 'text')).toEqual(true)
    })

    test('clears on new heading', () => {
      expect(isSectionBoundary(-1, 0, '### Next section 2022-01-01', 'title')).toEqual(true)
    })

    test('clears when dedenting below CTD level', () => {
      expect(isSectionBoundary(0, 1, '* Back to parent level', 'text')).toEqual(true)
    })

    test('keeps heading CTD for child tasks at deeper indent', () => {
      expect(isSectionBoundary(1, -1, '  * Find present {-6d}', 'text')).toEqual(false)
    })
  })

  describe('simulateProcessDateOffsets() - end-to-end behaviour', () => {
    test('heading section: sibling tasks share heading date; final date appended to heading', () => {
      const { lines } = simulateProcessDateOffsets(
        [
          { content: '### Christmas Cards 2021-12-25', level: -1, type: 'title' },
          { content: '* Write cards {-20d}', level: 0 },
          { content: '* Store spare cards {+3d}', level: 0 },
          { content: '', level: 0 },
        ],
        true,
      )
      expect(lines[0]).toEqual('### Christmas Cards 2021-12-25 to 2021-12-28')
      expect(lines[1]).toEqual('* Write cards >2021-12-05')
      expect(lines[2]).toEqual('* Store spare cards >2021-12-28')
    })

    test('from-task CTD: sibling task inherits date; no append to task line', () => {
      const { lines } = simulateProcessDateOffsets(
        [
          { content: "* Bob's birthday on 2021-09-14", level: 0 },
          { content: '  * Find present {-6d}', level: 1 },
          { content: '* Some other task {-1d}', level: 0 },
          { content: '', level: 0 },
        ],
        true,
      )
      expect(lines[0]).toEqual("* Bob's birthday on 2021-09-14")
      expect(lines[1]).toEqual('  * Find present >2021-09-08')
      expect(lines[2]).toEqual('* Some other task >2021-09-13')
    })

    test('from-task CTD: later task with its own date replaces CTD for following lines', () => {
      const { lines } = simulateProcessDateOffsets(
        [
          { content: "* Bob's birthday on 2021-09-14", level: 0 },
          { content: '* Alice birthday on 2021-10-01', level: 0 },
          { content: '* Send card {-3d}', level: 0 },
          { content: '', level: 0 },
        ],
        true,
      )
      expect(lines[2]).toEqual('* Send card >2021-09-28')
    })

    test('deadline on same line: offset computed, task line not appended with final date', () => {
      const { lines } = simulateProcessDateOffsets(
        [
          { content: '* Post cards deadline !2021-12-18 {-10d}', level: 0 },
          { content: '', level: 0 },
        ],
        true,
      )
      expect(lines[0]).toEqual('* Post cards deadline !2021-12-18 >2021-12-08')
    })

    test('new heading clears previous heading section and appends final date to previous heading only', () => {
      const { lines } = simulateProcessDateOffsets(
        [
          { content: '### Section A 2021-12-25', level: -1, type: 'title' },
          { content: '* Task A {-10d}', level: 0 },
          { content: '### Section B 2022-06-01', level: -1, type: 'title' },
          { content: '* Task B {+1d}', level: 0 },
        ],
        true,
      )
      expect(lines[0]).toEqual('### Section A 2021-12-25 to 2021-12-15')
      expect(lines[1]).toEqual('* Task A >2021-12-15')
      expect(lines[2]).toEqual('### Section B 2022-06-01')
      expect(lines[3]).toEqual('* Task B >2022-06-02')
    })

    test('addComputedFinalDate disabled: no heading append', () => {
      const { lines } = simulateProcessDateOffsets(
        [
          { content: '### Christmas Cards 2021-12-25', level: -1, type: 'title' },
          { content: '* Write cards {-20d}', level: 0 },
          { content: '', level: 0 },
        ],
        false,
      )
      expect(lines[0]).toEqual('### Christmas Cards 2021-12-25')
      expect(lines[1]).toEqual('* Write cards >2021-12-05')
    })
  })
})
