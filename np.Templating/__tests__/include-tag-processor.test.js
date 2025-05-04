/**
 * @jest-environment jsdom
 */

/**
 * Tests specifically for the _processIncludeTag function in NPTemplating
 * This handles the complex logic of template inclusion
 */

import NPTemplating from '../lib/NPTemplating'
import FrontmatterModule from '../lib/support/modules/FrontmatterModule'
import { DataStore } from '@mocks/index'

// for Flow errors with Jest
/* global describe, beforeEach, afterEach, test, expect, jest */

describe('NPTemplating _processIncludeTag', () => {
  let context
  // Mock for NPTemplating.getTemplate
  const getTemplateMock = jest.fn()
  // Mock for FrontmatterModule().isFrontmatterTemplate
  const mockIsFrontmatterTemplate = jest.fn()
  // Mock for NPTemplating.preRender
  const preRenderMock = jest.fn()
  // Mock for NPTemplating.render
  const renderMock = jest.fn()
  // Mock for NPTemplating.preProcessNote
  const preProcessNoteMock = jest.fn()
  // Mock for NPTemplating.preProcessCalendar
  const preProcessCalendarMock = jest.fn()

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks()

    // Mock NPTemplating methods
    jest.spyOn(NPTemplating, 'getTemplate').mockImplementation(getTemplateMock)
    jest.spyOn(NPTemplating, 'preRender').mockImplementation(preRenderMock)
    jest.spyOn(NPTemplating, 'render').mockImplementation(renderMock)
    jest.spyOn(NPTemplating, 'preProcessNote').mockImplementation(preProcessNoteMock)
    jest.spyOn(NPTemplating, 'preProcessCalendar').mockImplementation(preProcessCalendarMock)

    // Mock the FrontmatterModule
    jest.mock('../lib/support/modules/FrontmatterModule', () => {
      return jest.fn().mockImplementation(() => {
        return { isFrontmatterTemplate: mockIsFrontmatterTemplate }
      })
    })

    // Standard context object for testing
    context = {
      templateData: 'Initial data',
      sessionData: {},
      override: {},
    }
  })

  // Test case 1: Handle comment tags
  test('should ignore comment tags', async () => {
    const tag = `<%# include('someTemplate') %>`
    const initialData = `Some text before ${tag} some text after.`
    context.templateData = initialData

    await NPTemplating._processIncludeTag(tag, context)

    // Expect templateData to remain unchanged because it's a comment
    expect(context.templateData).toBe(initialData)
  })

  // Test case 2: Handle invalid include tag parsing
  test('should replace tag with error message if include info cannot be parsed', async () => {
    const tag = '<%- include() %>' // Invalid tag with empty include
    context.templateData = `Text ${tag} more text.`

    await NPTemplating._processIncludeTag(tag, context)

    // Expect the tag to be replaced with an error message
    expect(context.templateData).toBe('Text **Unable to parse include** more text.')
  })

  // Test case 3: Handle frontmatter template includes
  test('should process frontmatter template include correctly', async () => {
    const tag = `<%- include('myTemplate') %>`
    const templateName = 'myTemplate'
    const templateContent = '---\ntitle: Test\n---\nBody content'
    const frontmatterAttrs = { title: 'Test', sessionVar: 'value' }
    const frontmatterBody = 'Body content'
    const renderedTemplate = 'Rendered Body Content'

    context.templateData = `Before ${tag} After`
    context.sessionData = { sessionVar: 'value' }

    // Setup mocks for this scenario
    getTemplateMock.mockResolvedValue(templateContent)
    mockIsFrontmatterTemplate.mockReturnValue(true) // It IS a frontmatter template
    preRenderMock.mockResolvedValue({ frontmatterAttributes: frontmatterAttrs, frontmatterBody })
    renderMock.mockResolvedValue(renderedTemplate)

    await NPTemplating._processIncludeTag(tag, context)

    // Verify mocks were called
    expect(getTemplateMock).toHaveBeenCalledWith(templateName, { silent: true })
    expect(mockIsFrontmatterTemplate).toHaveBeenCalledWith(templateContent)
    expect(preRenderMock).toHaveBeenCalledWith(templateContent, context.sessionData)
    expect(renderMock).toHaveBeenCalledWith(frontmatterBody, context.sessionData) // Pass sessionData, not the full attributes

    // Verify context updates
    expect(context.sessionData).toEqual({ ...context.sessionData, ...frontmatterAttrs })
    expect(context.templateData).toBe(`Before ${renderedTemplate} After`)
  })

  // Test case 4: Handle frontmatter template include with variable assignment
  test('should process frontmatter template include with variable assignment', async () => {
    const tag = `<% let myVar = include('myTemplate') %>`
    const templateName = 'myTemplate'
    const templateContent = '---\ntitle: Test\n---\nBody content'
    const frontmatterAttrs = { title: 'Test' }
    const frontmatterBody = 'Body content'
    const renderedTemplate = 'Rendered Body Content'

    context.templateData = `Some text ${tag} other text`

    // Setup mocks
    getTemplateMock.mockResolvedValue(templateContent)
    mockIsFrontmatterTemplate.mockReturnValue(true)
    preRenderMock.mockResolvedValue({ frontmatterAttributes: frontmatterAttrs, frontmatterBody })
    renderMock.mockResolvedValue(renderedTemplate)

    await NPTemplating._processIncludeTag(tag, context)

    // Verify override object is updated
    expect(context.override).toEqual({ myVar: renderedTemplate })
    // Verify the tag is removed from templateData
    expect(context.templateData).toBe('Some text  other text')
  })

  // Test case 5: Handle non-frontmatter template (standard note)
  test('should process non-frontmatter template as a note include', async () => {
    const tag = `<%- include('regularNote') %>`
    const noteName = 'regularNote'
    const noteContent = 'This is the content of the regular note.'

    context.templateData = `Before ${tag} After`

    // Setup mocks
    getTemplateMock.mockResolvedValue(noteContent) // Assume getTemplate returns content
    mockIsFrontmatterTemplate.mockReturnValue(false) // It is NOT a frontmatter template
    preProcessNoteMock.mockResolvedValue(noteContent) // Simulate preProcessNote return

    await NPTemplating._processIncludeTag(tag, context)

    // Verify mocks
    expect(getTemplateMock).toHaveBeenCalledWith(noteName, { silent: true })
    expect(mockIsFrontmatterTemplate).toHaveBeenCalledWith(noteContent)
    expect(preProcessNoteMock).toHaveBeenCalledWith(noteName) // Ensure preProcessNote is called

    // Verify templateData is updated with note content
    expect(context.templateData).toBe(`Before ${noteContent} After`)
  })

  // Test case 6: Handle special calendar date include
  test('should process special calendar date include', async () => {
    const tag = `<%- include('20230101') %>`
    const dateString = '20230101'
    const calendarContent = 'Calendar content for 20230101'

    context.templateData = `Before ${tag} After`

    // Setup mocks
    getTemplateMock.mockResolvedValue('') // getTemplate might return empty for date string
    mockIsFrontmatterTemplate.mockReturnValue(false) // Date string is not frontmatter
    preProcessCalendarMock.mockResolvedValue(calendarContent)

    await NPTemplating._processIncludeTag(tag, context)

    // Verify mocks
    expect(getTemplateMock).toHaveBeenCalledWith(dateString, { silent: true })
    expect(mockIsFrontmatterTemplate).toHaveBeenCalledWith('')
    expect(preProcessCalendarMock).toHaveBeenCalledWith(dateString)

    // Verify templateData updated with calendar content
    expect(context.templateData).toBe(`Before ${calendarContent} After`)
  })
})
