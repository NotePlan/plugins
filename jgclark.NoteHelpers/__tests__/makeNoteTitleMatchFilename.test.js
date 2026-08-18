// @flow
/* global describe, test, expect, beforeAll */
/* eslint-disable */

import { CustomConsole } from '@jest/console'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, Note, NotePlan, simpleFormatter } from '@mocks/index'
import { applyTitleMatchPlan, getFilenameStemAsTitle, getTitleMatchPlan } from '../src/helpers/makeNoteTitleMatchFilename'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = new NotePlan()
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
  DataStore.settings['_logLevel'] = 'none'
})

/**
 * Build a regular note from markdown content for these tests.
 * @param {string} content
 * @param {string} filename
 * @returns {any}
 */
function noteFromContent(content: string, filename: string): any {
  return new Note({
    content,
    filename,
    type: 'Notes',
  })
}

describe('getFilenameStemAsTitle', () => {
  test('strips folder and extension', () => {
    const note = noteFromContent('# Hello\n', 'Projects/New Title.md')
    expect(getFilenameStemAsTitle(note)).toEqual('New Title')
  })
})

describe('getTitleMatchPlan', () => {
  test('plans an H1 update for a note without frontmatter', () => {
    const note = noteFromContent('# Old Title\nBody\n', 'Projects/New Title.md')
    const plan = getTitleMatchPlan(note)
    expect(plan).not.toEqual(null)
    if (!plan) return
    expect(plan.hasFrontmatter).toEqual(false)
    expect(plan.newTitle).toEqual('New Title')
    expect(plan.currentTitle).toEqual('Old Title')
    expect(plan.alreadyMatches).toEqual(false)
    expect(plan.h1LineIndex).toEqual(0)
  })

  test('plans a frontmatter title update and does not treat --- as the title', () => {
    const note = noteFromContent('---\ntitle: Old Title\n---\n# Old Title\nBody\n', 'Projects/New Title.md')
    const plan = getTitleMatchPlan(note)
    expect(plan).not.toEqual(null)
    if (!plan) return
    expect(plan.hasFrontmatter).toEqual(true)
    expect(plan.currentTitle).toEqual('Old Title')
    expect(plan.newTitle).toEqual('New Title')
    expect(plan.alreadyMatches).toEqual(false)
    expect(note.paragraphs[0].type).toEqual('separator')
  })

  test('alreadyMatches when FM title and H1 already equal the filename stem', () => {
    const note = noteFromContent('---\ntitle: New Title\n---\n# New Title\nBody\n', 'Projects/New Title.md')
    const plan = getTitleMatchPlan(note)
    expect(plan).not.toEqual(null)
    if (!plan) return
    expect(plan.alreadyMatches).toEqual(true)
  })
})

describe('applyTitleMatchPlan', () => {
  test('updates a body H1 in place without frontmatter', () => {
    const note = noteFromContent('# Old Title\nBody\n', 'Projects/New Title.md')
    const plan = getTitleMatchPlan(note)
    expect(plan).not.toEqual(null)
    if (!plan) return
    expect(applyTitleMatchPlan(note, plan)).toEqual(true)
    expect(note.paragraphs[0].content).toEqual('New Title')
    expect(note.paragraphs[0].type).toEqual('title')
  })

  test('keeps the opening --- fence on a frontmatter note', () => {
    const note = noteFromContent('---\ntitle: Old Title\n---\n# Old Title\nBody\n', 'Projects/New Title.md')
    const plan = getTitleMatchPlan(note)
    expect(plan).not.toEqual(null)
    if (!plan) return
    applyTitleMatchPlan(note, plan)
    expect(note.paragraphs[0].type).toEqual('separator')
    expect(note.paragraphs[0].content === '---' || note.paragraphs[0].rawContent.includes('---')).toBe(true)
    const h1 = note.paragraphs.find((p) => p.type === 'title' && p.headingLevel === 1)
    expect(h1).toBeTruthy()
    if (h1) expect(h1.content).toEqual('New Title')
  })
})
