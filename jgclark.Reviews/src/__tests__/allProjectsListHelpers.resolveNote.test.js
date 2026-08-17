// @flow
/* eslint-disable */
/* globals describe, expect, test, beforeEach, jest */
import { DataStore, asTNote } from '@mocks/index'
import { resolveProjectNoteFromListFilename } from '../allProjectsListHelpers'

describe('resolveProjectNoteFromListFilename', () => {
  beforeEach(() => {
    const notesByFilename: { [string]: TNote } = {}
    global.DataStore = {
      ...DataStore,
      projectNoteByFilename: jest.fn((filename: string): ?TNote => notesByFilename[filename] ?? null),
      projectNoteByTitle: jest.fn((): ?$ReadOnlyArray<TNote> => null),
      noteByFilename: jest.fn((): ?TNote => null),
      _notesByFilename: notesByFilename,
    }
  })

  test('returns the note at the given filename when it still exists', () => {
    const note = asTNote({ filename: 'CCC Projects/Light Party 2025.md', title: 'Light Party 2025' })
    global.DataStore._notesByFilename['CCC Projects/Light Party 2025.md'] = note

    expect(resolveProjectNoteFromListFilename('CCC Projects/Light Party 2025.md')).toBe(note)
  })

  test('finds the note under @Archive when the pre-move filename is gone', () => {
    const archived = asTNote({ filename: '@Archive/CCC Projects/Light Party 2025.md', title: 'Light Party 2025' })
    global.DataStore._notesByFilename['@Archive/CCC Projects/Light Party 2025.md'] = archived

    expect(resolveProjectNoteFromListFilename('CCC Projects/Light Party 2025.md')).toBe(archived)
  })

  test('falls back to title search across folders, preferring an @Archive match', () => {
    const archived = asTNote({ filename: '@Archive/CCC Projects/Light Party 2025.md', title: 'Light Party 2025' })
    const other = asTNote({ filename: 'CCC Projects/Light Party 2026.md', title: 'Light Party 2026' })
    global.DataStore.projectNoteByTitle = jest.fn((): ?$ReadOnlyArray<TNote> => [other, archived])

    expect(resolveProjectNoteFromListFilename('CCC Projects/Light Party 2025.md')).toBe(archived)
  })

  test('returns null when the note cannot be found (does not invent a path)', () => {
    expect(resolveProjectNoteFromListFilename('CCC Projects/Missing Project.md')).toBeNull()
  })

  test('returns null for an empty filename', () => {
    expect(resolveProjectNoteFromListFilename('')).toBeNull()
  })
})
