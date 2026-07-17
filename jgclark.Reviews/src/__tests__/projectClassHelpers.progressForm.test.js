/* @flow */
//-----------------------------------------------------------------------------
// Tests for progress form helpers (CommandBar.showForm parse path)
//-----------------------------------------------------------------------------

import { parseRawProgressFormValues } from '../projectClassHelpers'

describe('parseRawProgressFormValues', () => {
  test('accepts empty comment so pause/resume can skip a Progress line', () => {
    const parsed = parseRawProgressFormValues({
      submitted: true,
      values: {
        comment: '',
        progressDate: '2026-07-17',
        percentComplete: '',
      },
    })
    expect(parsed).not.toBeNull()
    expect(parsed?.comment).toBe('')
    expect(parsed?.progressDateStr).toBe('2026-07-17')
    expect(parsed?.percentStr).toBe('')
  })

  test('still parses a normal comment and optional percent', () => {
    const parsed = parseRawProgressFormValues({
      submitted: true,
      values: {
        comment: '  Pausing for travel  ',
        progressDate: '2026-07-17',
        percentComplete: 40,
      },
    })
    expect(parsed).toEqual({
      comment: 'Pausing for travel',
      progressDateStr: '2026-07-17',
      percentStr: '40',
    })
  })

  test('returns null when form was cancelled', () => {
    expect(parseRawProgressFormValues({ submitted: false, values: {} })).toBeNull()
  })
})
