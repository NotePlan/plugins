/* global jest, describe, test, expect, beforeAll */
/* eslint-disable */

import { CustomConsole } from '@jest/console'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter } from '@mocks/index'
import { getSuggestedTitleFromContent } from '../src/newNote'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
  DataStore.settings['_logLevel'] = 'none'
})

describe('getSuggestedTitleFromContent', () => {
  test('returns frontmatter title when available', () => {
    const content = '---\ntitle: Frontmatter Title\nstatus: active\n---\n# Heading title\nBody'
    expect(getSuggestedTitleFromContent(content)).toBe('Frontmatter Title')
  })

  test('returns first-line title field when available', () => {
    const content = 'title: Inline Title\nBody line'
    expect(getSuggestedTitleFromContent(content)).toBe('Inline Title')
  })

  test('strips heading markers from first line', () => {
    const content = '# Heading Title \nBody line'
    expect(getSuggestedTitleFromContent(content)).toBe('Heading Title')
  })

  test('returns plain first line when no title markers exist', () => {
    const content = 'Just a normal first line \nSecond line'
    expect(getSuggestedTitleFromContent(content)).toBe('Just a normal first line')
  })

  test('returns empty string for empty content', () => {
    expect(getSuggestedTitleFromContent('')).toBe('')
  })
})
