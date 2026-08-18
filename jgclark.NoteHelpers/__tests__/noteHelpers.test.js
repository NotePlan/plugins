/* global jest, describe, test, expect, beforeAll */
/* eslint-disable */

import { CustomConsole } from '@jest/console'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, Note, NotePlan, simpleFormatter } from '@mocks/index'
import { updateFrontMatterVars } from '@helpers/NPFrontMatter'
import { getInput } from '@helpers/userInput'
import { addItemToFrontmatter, getSettings, parseTriggerString, rewriteLocalHeadingMarkdownLinks } from '../src/noteHelpers'

jest.mock('@helpers/NPFrontMatter', () => {
  const actual = jest.requireActual('@helpers/NPFrontMatter')
  return {
    ...actual,
    updateFrontMatterVars: jest.fn(() => true),
  }
})

jest.mock('@helpers/userInput', () => {
  const actual = jest.requireActual('@helpers/userInput')
  return {
    ...actual,
    getInput: jest.fn(),
    showMessage: jest.fn(async () => {}),
  }
})

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

describe('rewriteLocalHeadingMarkdownLinks', () => {
  test('rewrites a local heading link using arg0 not arg1', () => {
    const input = 'See [Tasks](#Tasks) below'
    const out = rewriteLocalHeadingMarkdownLinks(input)
    expect(out).toContain('command=jump%20to%20heading')
    expect(out).toContain('arg0=')
    expect(out).not.toContain('arg1=')
    expect(out).toContain(`arg0=${encodeURIComponent('Tasks')}`)
  })

  test('leaves non-heading markdown links unchanged', () => {
    const input = 'See [site](https://example.com) please'
    expect(rewriteLocalHeadingMarkdownLinks(input)).toEqual(input)
  })
})

describe('addItemToFrontmatter', () => {
  test('uses the supplied value argument and does not prompt', async () => {
    getInput.mockClear()
    updateFrontMatterVars.mockClear()
    const note = new Note({
      content: '---\ntitle: Test\n---\nBody\n',
      filename: 'Projects/Test.md',
      type: 'Notes',
    })
    const res = await addItemToFrontmatter(note, 'status', 'active')
    expect(res).toEqual(true)
    expect(getInput).not.toHaveBeenCalled()
    expect(updateFrontMatterVars).toHaveBeenCalledWith(note, { status: 'active' })
  })
})

describe('parseTriggerString', () => {
  test('parses a frontmatter-style trigger string', () => {
    expect(parseTriggerString('onEditorWillSave => jgclark.DashboardReact.decideWhetherToUpdateDashboard')).toEqual({
      triggerName: 'onEditorWillSave',
      pluginID: 'jgclark.DashboardReact',
      commandName: 'decideWhetherToUpdateDashboard',
    })
  })

  test('returns null for empty or malformed strings', () => {
    expect(parseTriggerString('')).toEqual(null)
    expect(parseTriggerString('onEditorWillSave')).toEqual(null)
    expect(parseTriggerString('onEditorWillSave => onlyonepart')).toEqual(null)
  })
})

describe('getSettings', () => {
  test('returns live DataStore.settings when present', async () => {
    DataStore.settings = { _logLevel: 'none', defaultFMText: 'author: test', authorID: 'JC', dateFormat: 'ISO' }
    const config = await getSettings()
    expect(config.defaultFMText).toEqual('author: test')
    expect(config.authorID).toEqual('JC')
  })
})
