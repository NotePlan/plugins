// @flow
/**
 * Tests for CommandBar.showForm batching of consecutive prompt / promptDate tags (NotePlan 3.21+).
 */

import { processPrompts } from '../lib/support/modules/prompts/PromptRegistry'
import '../lib/support/modules/prompts'

/* global describe, test, expect, jest, beforeEach */

jest.mock('@helpers/NPVersions', () => ({
  usersVersionHas: jest.fn((feature) => feature === 'commandBarForms'),
}))

describe('prompt form batch (CommandBar.showForm)', () => {
  const { usersVersionHas } = require('@helpers/NPVersions')

  beforeEach(() => {
    jest.clearAllMocks()
    global.DataStore = {
      settings: { _logLevel: 'none' },
      projectNotes: [],
      calendarNotes: [],
      calendarNoteByDateString: jest.fn(() => null),
    }
    global.NotePlan = { environment: { version: '3.21.0', platform: 'macOS' } }
    global.CommandBar = {
      showForm: jest.fn(),
      textPrompt: jest.fn().mockResolvedValue('fallback-single'),
      showOptions: jest.fn().mockResolvedValue({ value: 'optA', index: 0 }),
    }
  })

  test('batches two independent prompt tags into one showForm', async () => {
    global.CommandBar.showForm.mockResolvedValue({
      submitted: true,
      values: { firstName: 'Ada', lastName: 'Lovelace' },
    })

    const template =
      "<%- prompt('firstName', 'First name?') %>\n" + "<%- prompt('lastName', 'Last name?') %>\n" + 'Hello'

    const result = await processPrompts(template, {})

    expect(result).not.toBe(false)
    if (result === false) return
    expect(usersVersionHas).toHaveBeenCalledWith('commandBarForms')
    expect(global.CommandBar.showForm).toHaveBeenCalledTimes(1)
    expect(global.CommandBar.textPrompt).not.toHaveBeenCalled()
    expect(result.sessionData.firstName).toBe('Ada')
    expect(result.sessionData.lastName).toBe('Lovelace')
  })

  test('onePromptAtATime in session skips showForm batching (one dialog per prompt)', async () => {
    global.CommandBar.showForm.mockResolvedValue({
      submitted: true,
      values: { firstName: 'X', lastName: 'Y' },
    })
    global.CommandBar.textPrompt.mockResolvedValueOnce('One').mockResolvedValueOnce('Two')

    const template =
      "<%- prompt('firstName', 'First name?') %>\n" + "<%- prompt('lastName', 'Last name?') %>\n" + 'Hello'

    const result = await processPrompts(template, { onePromptAtATime: true })

    expect(result).not.toBe(false)
    if (result === false) return
    expect(global.CommandBar.showForm).not.toHaveBeenCalled()
    expect(global.CommandBar.textPrompt).toHaveBeenCalledTimes(2)
    expect(result.sessionData.firstName).toBe('One')
    expect(result.sessionData.lastName).toBe('Two')
  })

  test('onePromptAtATime under session.data skips batching (frontmatter shape)', async () => {
    global.CommandBar.textPrompt.mockResolvedValueOnce('A').mockResolvedValueOnce('B')

    const template = "<%- prompt('x', 'X?') %>\n<%- prompt('y', 'Y?') %>"
    const result = await processPrompts(template, { data: { onePromptAtATime: true } })

    expect(result).not.toBe(false)
    if (result === false) return
    expect(global.CommandBar.showForm).not.toHaveBeenCalled()
    expect(result.sessionData.x).toBe('A')
    expect(result.sessionData.y).toBe('B')
  })

  test('batchPrompts: false skips showForm batching', async () => {
    global.CommandBar.textPrompt.mockResolvedValueOnce('p').mockResolvedValueOnce('q')

    const template = "<%- prompt('a', 'A?') %>\n<%- prompt('b', 'B?') %>"
    const result = await processPrompts(template, { batchPrompts: false })

    expect(result).not.toBe(false)
    if (result === false) return
    expect(global.CommandBar.showForm).not.toHaveBeenCalled()
    expect(result.sessionData.a).toBe('p')
    expect(result.sessionData.b).toBe('q')
  })

  test('dependent options: second prompt uses session key from first — no batch, sequential prompts', async () => {
    global.CommandBar.showOptions.mockResolvedValue({ value: 'North', index: 0 })
    global.CommandBar.textPrompt.mockResolvedValue('Chicago')

    const template =
      "<%- prompt('choices', 'Pick', ['North','South']) %>\n" + "<%- prompt('city', 'City?', choices) %>"

    const result = await processPrompts(template, {})

    expect(result).not.toBe(false)
    if (result === false) return
    expect(global.CommandBar.showForm).not.toHaveBeenCalled()
    expect(global.CommandBar.showOptions).toHaveBeenCalledTimes(1)
    expect(global.CommandBar.textPrompt).toHaveBeenCalledTimes(1)
    expect(result.sessionData.choices).toBe('North')
    expect(result.sessionData.city).toBe('Chicago')
  })

  test('batched prompt(question, [choices]) uses the question as showForm label (not Answer)', async () => {
    global.CommandBar.showForm.mockResolvedValue({
      submitted: true,
      values: { Abstände_Review: '1w', Priority_prompt: 'A' },
    })

    const template =
      "<%- prompt('Abstände Review?',['1w','2w']) %>" + "<%- prompt('Priority prompt?',['A','B']) %>"

    const result = await processPrompts(template, {})
    expect(result).not.toBe(false)
    if (result === false) return
    expect(global.CommandBar.showForm).toHaveBeenCalledTimes(1)
    const formArg = global.CommandBar.showForm.mock.calls[0][0]
    expect(formArg.fields[0].title).toBe('Abstände Review?')
    expect(formArg.fields[0].label).toBe('Abstände Review?')
    expect(formArg.fields[1].title).toBe('Priority prompt?')
    expect(formArg.fields[1].label).toBe('Priority prompt?')
  })

  test('batched prompt(varName, message, [choices]) uses message as showForm label (not varName)', async () => {
    global.CommandBar.showForm.mockResolvedValue({
      submitted: true,
      values: { pick: 'A', Rhythm: '1w' },
    })

    const template =
      "<%- prompt('pick', 'Pick one?', ['A','B']) %>" + "<%- prompt('Rhythm?', ['1w','2w']) %>"
    const result = await processPrompts(template, {})
    expect(result).not.toBe(false)
    if (result === false) return
    const formArg = global.CommandBar.showForm.mock.calls[0][0]
    expect(formArg.fields[0].title).toBe('Pick one?')
    expect(formArg.fields[0].label).toBe('Pick one?')
    expect(formArg.fields[1].title).toBe('Rhythm?')
  })

  test('batched prompt with double-quoted question uses that string as label', async () => {
    global.CommandBar.showForm.mockResolvedValue({
      submitted: true,
      values: { Double_quoted: 'a', pick: 'B' },
    })

    const template = '<%- prompt("Double quoted?", ["a","b"]) %>' + "<%- prompt('pick', 'Second?', ['B','C']) %>"
    const result = await processPrompts(template, {})
    expect(result).not.toBe(false)
    if (result === false) return
    const formArg = global.CommandBar.showForm.mock.calls[0][0]
    expect(formArg.fields[0].title).toBe('Double quoted?')
    expect(formArg.fields[1].title).toBe('Second?')
  })

  test('batched <% execution %> prompt(question, [choices]) labels match <%- output %> form', async () => {
    global.CommandBar.showForm.mockResolvedValue({
      submitted: true,
      values: { Q: 'a', Y: 'c' },
    })

    const template = "<% prompt('Q?', ['a','b']) %><% prompt('Y?', ['c','d']) %>"
    const result = await processPrompts(template, {})
    expect(result).not.toBe(false)
    if (result === false) return
    const formArg = global.CommandBar.showForm.mock.calls[0][0]
    expect(formArg.fields[0].title).toBe('Q?')
    expect(formArg.fields[1].title).toBe('Y?')
  })

  test('batched prompt("What\'s the priority?", […]) uses full question as label (apostrophe inside double quotes)', async () => {
    global.CommandBar.showForm.mockResolvedValue({
      submitted: true,
      values: { What_s_the_priority: 'a', Other: 'c' },
    })

    const template =
      `<%- prompt("What's the priority?", ['a','b']) %>` + "<%- prompt('Other?', ['c','d']) %>"
    const result = await processPrompts(template, {})
    expect(result).not.toBe(false)
    if (result === false) return
    const formArg = global.CommandBar.showForm.mock.calls[0][0]
    expect(formArg.fields[0].title).toBe("What's the priority?")
    expect(formArg.fields[0].label).toBe("What's the priority?")
    expect(formArg.fields[1].title).toBe('Other?')
  })

  test('batched prompt(\'Comma, in, question?\', […]) uses full first argument as label', async () => {
    global.CommandBar.showForm.mockResolvedValue({
      submitted: true,
      values: { One_two_three: 'a', Z: 'x' },
    })

    const template =
      "<%- prompt('One, two, three?', ['a','b']) %>" + "<%- prompt('Z?', ['x','y']) %>"
    const result = await processPrompts(template, {})
    expect(result).not.toBe(false)
    if (result === false) return
    const formArg = global.CommandBar.showForm.mock.calls[0][0]
    expect(formArg.fields[0].title).toBe('One, two, three?')
    expect(formArg.fields[1].title).toBe('Z?')
  })

  test('non-prompt tag between prompts breaks contiguity — no showForm', async () => {
    global.CommandBar.showForm.mockResolvedValue({
      submitted: true,
      values: { x: '1', y: '2' },
    })

    const template =
      "<%- prompt('x', 'X?') %>\n" + '<%# not-a-prompt %>' + "\n<%- prompt('y', 'Y?') %>"

    const result = await processPrompts(template, {})
    expect(result).not.toBe(false)
    expect(global.CommandBar.showForm).not.toHaveBeenCalled()
  })

  test('cancelling the form returns false from processPrompts', async () => {
    global.CommandBar.showForm.mockResolvedValue({
      submitted: false,
      values: {},
    })

    const template = "<%- prompt('a', 'A?') %>\n<%- prompt('b', 'B?') %>"
    const result = await processPrompts(template, {})
    expect(result).toBe(false)
  })

  test('promptDate with [\'\', false] maps to date field without default "false" string', async () => {
    global.CommandBar.showForm.mockResolvedValue({
      submitted: true,
      values: { a: 'x', startDate: '2026-01-15' },
    })

    const template =
      "<%- prompt('a', 'A?') %>\n" + "<%- promptDate('startDate', 'Start date', ['', false]) %>"
    const result = await processPrompts(template, {})
    expect(result).not.toBe(false)
    if (result === false) return
    const formArg = global.CommandBar.showForm.mock.calls[0][0]
    const dateField = formArg.fields.find((f) => f.key === 'startDate')
    expect(dateField).toBeDefined()
    expect(dateField.type).toBe('date')
    expect(dateField.label).toBe('Start date')
    expect(dateField.format).toBe('yyyy-MM-dd')
    expect(dateField.default).toBeUndefined()
    expect(dateField.required).toBe(true)
  })

  test('promptDate JSON options can override showForm format (dateFormat)', async () => {
    global.CommandBar.showForm.mockResolvedValue({
      submitted: true,
      values: { title: 'x', when: '04/20/2026' },
    })

    const template =
      "<%- prompt('title', 'Title?') %>\n" +
      "<%- promptDate('when', 'When?', '{ dateFormat: \"MM/dd/yyyy\" }') %>"
    const result = await processPrompts(template, {})
    expect(result).not.toBe(false)
    if (result === false) return
    const formArg = global.CommandBar.showForm.mock.calls[0][0]
    const dateField = formArg.fields.find((f) => f.key === 'when')
    expect(dateField).toBeDefined()
    expect(dateField.format).toBe('MM/dd/yyyy')
  })

  test('batches prompt and promptDate when both need UI', async () => {
    global.CommandBar.showForm.mockResolvedValue({
      submitted: true,
      values: { title: 'Meet', when: '2026-04-20' },
    })

    const template = "<%- prompt('title', 'Title?') %>\n<%- promptDate('when', ['2026-04-01', false]) %>"
    const result = await processPrompts(template, {})
    expect(result).not.toBe(false)
    if (result === false) return
    expect(global.CommandBar.showForm).toHaveBeenCalledTimes(1)
    const formArg = global.CommandBar.showForm.mock.calls[0][0]
    expect(formArg).toEqual(
      expect.objectContaining({
        title: expect.any(String),
        submitText: expect.any(String),
        fields: expect.any(Array),
      }),
    )
    const fields = formArg.fields
    expect(fields.some((f) => f.type === 'string')).toBe(true)
    expect(fields.some((f) => f.type === 'date')).toBe(true)
    expect(result.sessionData.title).toBe('Meet')
    expect(result.sessionData.when).toBe('2026-04-20')
  })
})
