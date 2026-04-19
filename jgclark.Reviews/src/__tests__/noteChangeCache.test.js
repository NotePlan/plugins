/* globals afterEach, describe, expect, test */
// @flow

import { getNoteChangedDateMs, getNoteChangeTimeMsForCache } from '../projectClass.js'

describe('getNoteChangedDateMs', () => {
  test('returns ms for Date changedDate', () => {
    const d = new Date('2024-06-01T12:00:00.000Z')
    const note = { changedDate: d, filename: 'x.md' }
    expect(getNoteChangedDateMs((note: any))).toBe(d.getTime())
  })

  test('returns ms for numeric changedDate', () => {
    const t = 1700000000000
    const note = { changedDate: t, filename: 'x.md' }
    expect(getNoteChangedDateMs((note: any))).toBe(t)
  })

  test('returns null when changedDate missing', () => {
    const note = { filename: 'x.md' }
    expect(getNoteChangedDateMs((note: any))).toBeNull()
  })
})

describe('getNoteChangeTimeMsForCache', () => {
  const savedEditor = global.Editor

  afterEach(() => {
    global.Editor = savedEditor
  })

  test('returns null when note is open in Editor and checkEditor true', () => {
    const note = { changedDate: new Date(), filename: 'Projects/a.md' }
    global.Editor = { note: { filename: 'Projects/a.md' } }
    expect(getNoteChangeTimeMsForCache((note: any), true)).toBeNull()
  })

  test('returns ms when Editor is different note', () => {
    const d = new Date('2024-01-15T00:00:00.000Z')
    const note = { changedDate: d, filename: 'Projects/a.md' }
    global.Editor = { note: { filename: 'Other.md' } }
    expect(getNoteChangeTimeMsForCache((note: any), true)).toBe(d.getTime())
  })

  test('returns ms when checkEditor false even if same file in Editor', () => {
    const d = new Date('2024-01-15T00:00:00.000Z')
    const note = { changedDate: d, filename: 'Projects/a.md' }
    global.Editor = { note: { filename: 'Projects/a.md' } }
    expect(getNoteChangeTimeMsForCache((note: any), false)).toBe(d.getTime())
  })
})
