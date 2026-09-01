/* globals describe, expect, it, beforeAll */

import { DataStore } from '@mocks/index'
import { getNoteFromEditorWindow, getOpenEditorNote } from '../NPEditor'

beforeAll(() => {
  global.DataStore = DataStore
  DataStore.settings['_logLevel'] = 'none'
  global.Editor = { paragraphs: [] }
})

describe('helpers/NPEditor', () => {
  describe('getNoteFromEditorWindow', () => {
    it('should return Editor.note when set', () => {
      const note = { type: 'Notes', filename: 'foo.md', title: 'Foo' }
      expect(getNoteFromEditorWindow({ note, type: 'Notes', filename: 'foo.md' })).toBe(note)
    })

    it('should fall back to the editor window for calendar notes when Editor.note is null', () => {
      const editorWindow = {
        note: null,
        type: 'Calendar',
        filename: '20260517.md',
        title: 'Friday thoughts',
      }
      expect(getNoteFromEditorWindow(editorWindow)).toBe(editorWindow)
    })
  })

  describe('getOpenEditorNote', () => {
    it('should find a calendar note in split when global Editor is non-calendar', () => {
      const editorWas = global.Editor
      const notePlanWas = global.NotePlan
      const projectNote = { type: 'Notes', filename: 'Projects/foo.md', title: 'Foo project' }
      const dailyNote = { type: 'Calendar', filename: '20260831.md', title: '2026-08-31' }
      const dailyEditor = {
        note: dailyNote,
        type: 'Calendar',
        filename: '20260831.md',
        selection: { start: 42, end: 42 },
      }
      global.Editor = {
        note: projectNote,
        type: 'Notes',
        filename: 'Projects/foo.md',
      }
      global.NotePlan = {
        editors: [global.Editor, dailyEditor],
      }
      expect(getOpenEditorNote({ noteType: 'Calendar' })).toBe(dailyNote)
      global.Editor = editorWas
      global.NotePlan = notePlanWas
    })

    it('should prefer split editor with selection among matching calendar notes', () => {
      const editorWas = global.Editor
      const notePlanWas = global.NotePlan
      const projectNote = { type: 'Notes', filename: 'Projects/foo.md', title: 'Foo project' }
      const yesterdayDaily = { type: 'Calendar', filename: '20260830.md', title: '2026-08-30' }
      const todayDaily = { type: 'Calendar', filename: '20260831.md', title: '2026-08-31' }
      global.Editor = {
        note: projectNote,
        type: 'Notes',
        filename: 'Projects/foo.md',
      }
      global.NotePlan = {
        editors: [
          global.Editor,
          {
            note: yesterdayDaily,
            type: 'Calendar',
            filename: '20260830.md',
            selection: { start: 0, end: 0 },
          },
          {
            note: todayDaily,
            type: 'Calendar',
            filename: '20260831.md',
            selection: { start: 100, end: 100 },
          },
        ],
      }
      expect(getOpenEditorNote({ noteType: 'Calendar' })).toBe(todayDaily)
      global.Editor = editorWas
      global.NotePlan = notePlanWas
    })

    it('should fall back to global Editor for calendar notes when Editor.note is null', () => {
      const editorWas = global.Editor
      const notePlanWas = global.NotePlan
      global.Editor = {
        note: null,
        type: 'Calendar',
        filename: '20260517.md',
        title: 'Friday thoughts',
      }
      global.NotePlan = { editors: [global.Editor] }
      expect(getOpenEditorNote({ noteType: 'Calendar' })).toBe(global.Editor)
      global.Editor = editorWas
      global.NotePlan = notePlanWas
    })
  })
})
