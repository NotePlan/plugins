// @flow
/**
 * Tests for explicit `promptForm({ ... })` tag (NotePlan 3.21+ CommandBar.showForm).
 */

import { extractPromptFormObjectSource } from '../lib/support/modules/prompts/PromptFormHandler'
import { processPrompts } from '../lib/support/modules/prompts/PromptRegistry'
import '../lib/support/modules/prompts'

/* global describe, test, expect, jest, beforeEach */

jest.mock('@helpers/NPVersions', () => ({
  usersVersionHas: jest.fn((feature) => feature === 'commandBarForms'),
}))

describe('promptForm tag', () => {
  const { usersVersionHas } = require('@helpers/NPVersions')

  beforeEach(() => {
    jest.clearAllMocks()
    usersVersionHas.mockImplementation((feature) => feature === 'commandBarForms')
    global.DataStore = {
      settings: { _logLevel: 'none' },
      projectNotes: [],
      calendarNotes: [],
      calendarNoteByDateString: jest.fn(() => null),
    }
    global.CommandBar = {
      showForm: jest.fn(),
      textPrompt: jest.fn().mockResolvedValue('typed'),
      showOptions: jest.fn().mockResolvedValue({ value: 'opt', index: 0 }),
    }
  })

  test('extractPromptFormObjectSource reads object after promptForm(', () => {
    const src = `promptForm({ title: 'Hi', fields: [{ type: 'string', key: 'a', title: 'A' }] })`
    const inner = extractPromptFormObjectSource(src)
    expect(inner).toBe("{ title: 'Hi', fields: [{ type: 'string', key: 'a', title: 'A' }] }")
  })

  test('extractPromptFormObjectSource supports leading await', () => {
    const inner = extractPromptFormObjectSource(`await promptForm({ fields: [{type:'string',key:'k',title:'K'}] })`)
    expect(inner).toContain('key')
    expect(inner).toContain('k')
  })

  test('processPrompts calls showForm once and sets session keys', async () => {
    global.CommandBar.showForm.mockResolvedValue({
      submitted: true,
      values: { docName: 'Note A', owner: 'Pat' },
    })

    const formCall =
      "promptForm({ title: 'Setup', submitText: 'Go', fields: [" +
      "{ type: 'string', key: 'docName', title: 'Document name' }," +
      "{ type: 'string', key: 'owner', title: 'Owner', choices: ['Pat', 'Kim'] }" +
      '] })'

    const template = `<%- ${formCall} %>\nName: <%- docName %>`
    const result = await processPrompts(template, {})

    expect(result).not.toBe(false)
    if (result === false) return
    expect(usersVersionHas).toHaveBeenCalled()
    expect(global.CommandBar.showForm).toHaveBeenCalledTimes(1)
    const arg = global.CommandBar.showForm.mock.calls[0][0]
    expect(arg.title).toBe('Setup')
    expect(arg.submitText).toBe('Go')
    expect(arg.fields).toHaveLength(2)
    expect(result.sessionData.docName).toBe('Note A')
    expect(result.sessionData.owner).toBe('Pat')
    expect(result.sessionTemplateData).toContain('Name: <%- docName %>')
    expect(result.sessionTemplateData).not.toContain('promptForm(')
  })

  test('cancelling promptForm returns false', async () => {
    global.CommandBar.showForm.mockResolvedValue({ submitted: false, values: {} })
    const template = `<%- promptForm({ fields: [{ type: 'string', key: 'x', title: 'X' }] }) %>`
    const result = await processPrompts(template, {})
    expect(result).toBe(false)
  })

  test('parse error yields HTML error comment in template', async () => {
    global.CommandBar.showForm.mockResolvedValue({ submitted: true, values: {} })
    const template = '<%- promptForm(not an object) %>'
    const result = await processPrompts(template, {})
    expect(result).not.toBe(false)
    if (result === false) return
    expect(result.sessionTemplateData).toMatch(/Error: promptForm/)
    expect(global.CommandBar.showForm).not.toHaveBeenCalled()
  })

  test('falls back to textPrompt when commandBarForms gate is off', async () => {
    usersVersionHas.mockImplementation(() => false)
    global.CommandBar.textPrompt.mockResolvedValue('solo')

    const template = `<%- promptForm({ fields: [{ type: 'string', key: 'only', title: 'One' }] }) %>`
    const result = await processPrompts(template, {})

    expect(result).not.toBe(false)
    if (result === false) return
    expect(global.CommandBar.showForm).not.toHaveBeenCalled()
    expect(global.CommandBar.textPrompt).toHaveBeenCalled()
    expect(result.sessionData.only).toBe('solo')
  })
})
