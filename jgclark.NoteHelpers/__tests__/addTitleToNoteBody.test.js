// @flow
/* eslint-disable no-unused-vars */
/* eslint-disable import/order */
/* global jest, it, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach */

import * as f from '../src/addTitleToNoteBody.js'
import { CustomConsole } from '@jest/console'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, Note, NotePlan, Paragraph, simpleFormatter } from '@mocks/index'

const PLUGIN_NAME = `jgclark.NoteHelpers`
const FILENAME = `addTitleToNoteBody.js`

/**
 * Build a regular note from markdown content for these tests.
 * @param {string} content
 * @param {string} filename
 * @returns {any}
 */
function noteFromContent(content: string, filename: string = 'Projects/Test.md'): any {
  return new Note({
    content,
    filename,
    type: 'Notes',
  })
}

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    beforeAll(() => {
      global.Calendar = Calendar
      global.Clipboard = Clipboard
      global.CommandBar = CommandBar
      global.DataStore = DataStore
      global.Editor = Editor
      global.NotePlan = new NotePlan()
      global.Paragraph = Paragraph
      global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
      DataStore.settings['_logLevel'] = 'none'
    })

    describe('normalizeFrontmatterTitle', () => {
      test('trims whitespace', () => {
        expect(f.normalizeFrontmatterTitle('  Project Alpha  ')).toEqual('Project Alpha')
      })
      test('strips matching YAML quotes', () => {
        expect(f.normalizeFrontmatterTitle('"Quoted Title"')).toEqual('Quoted Title')
        expect(f.normalizeFrontmatterTitle("'Quoted Title'")).toEqual('Quoted Title')
      })
      test('returns empty string for nullish values', () => {
        expect(f.normalizeFrontmatterTitle(null)).toEqual('')
        expect(f.normalizeFrontmatterTitle(undefined)).toEqual('')
      })
    })

    describe('getBodyH1Plan', () => {
      test('returns add plan when frontmatter title exists and body has no H1', () => {
        const note = noteFromContent('---\ntitle: Project Alpha\n---\nSome intro\n')
        const plan = f.getBodyH1Plan(note)
        expect(plan).not.toEqual(null)
        if (!plan) return
        expect(plan.action).toEqual('add')
        expect(plan.title).toEqual('Project Alpha')
        expect(plan.insertionIndex).toEqual(3)
        expect(plan.existingH1Content).toEqual(null)
      })

      test('returns null when the first body H1 already matches title:', () => {
        const note = noteFromContent('---\ntitle: Project Alpha\n---\n# Project Alpha\nSome intro\n')
        expect(f.getBodyH1Plan(note)).toEqual(null)
      })

      test('returns update plan when the first body H1 does not match title:', () => {
        const note = noteFromContent('---\ntitle: Project Alpha\n---\n# Old Title\nSome intro\n')
        const plan = f.getBodyH1Plan(note)
        expect(plan).not.toEqual(null)
        if (!plan) return
        expect(plan.action).toEqual('update')
        expect(plan.title).toEqual('Project Alpha')
        expect(plan.existingH1Content).toEqual('Old Title')
        expect(plan.h1LineIndex).toEqual(3)
      })

      test('returns null when there is no frontmatter', () => {
        const note = noteFromContent('# Project Alpha\nSome intro\n')
        expect(f.getBodyH1Plan(note)).toEqual(null)
      })

      test('returns null when title: is empty', () => {
        const note = noteFromContent('---\ntitle:\n---\nSome intro\n')
        expect(f.getBodyH1Plan(note)).toEqual(null)
      })

      test('finds an H1 after blank lines following frontmatter', () => {
        const note = noteFromContent('---\ntitle: Project Alpha\n---\n\n# Old Title\n')
        const plan = f.getBodyH1Plan(note)
        expect(plan).not.toEqual(null)
        if (!plan) return
        expect(plan.action).toEqual('update')
        expect(plan.existingH1Content).toEqual('Old Title')
      })

      test('strips quotes from a quoted title: value', () => {
        const note = noteFromContent('---\ntitle: "Project Alpha"\n---\nSome intro\n')
        const plan = f.getBodyH1Plan(note)
        expect(plan).not.toEqual(null)
        if (!plan) return
        expect(plan.title).toEqual('Project Alpha')
        expect(plan.action).toEqual('add')
      })
    })

    describe('applyBodyH1FromFrontmatter', () => {
      test('inserts an H1 at the start of the body', () => {
        const note = noteFromContent('---\ntitle: Project Alpha\n---\nSome intro\n')
        const plan = f.getBodyH1Plan(note)
        expect(plan).not.toEqual(null)
        if (!plan) return
        const changed = f.applyBodyH1FromFrontmatter(note, plan)
        expect(changed).toEqual(true)
        const added = f.findFirstBodyH1(note)
        expect(added).not.toEqual(null)
        if (!added) return
        expect(added.content).toEqual('Project Alpha')
        expect(added.headingLevel).toEqual(1)
        expect(added.lineIndex).toEqual(3)
      })

      test('updates a mismatched H1 in place', () => {
        const note = noteFromContent('---\ntitle: Project Alpha\n---\n# Old Title\nSome intro\n')
        const plan = f.getBodyH1Plan(note)
        expect(plan).not.toEqual(null)
        if (!plan) return
        const changed = f.applyBodyH1FromFrontmatter(note, plan)
        expect(changed).toEqual(true)
        const updated = f.findFirstBodyH1(note)
        expect(updated).not.toEqual(null)
        if (!updated) return
        expect(updated.content).toEqual('Project Alpha')
        expect(updated.lineIndex).toEqual(3)
      })
    })
  })
})
