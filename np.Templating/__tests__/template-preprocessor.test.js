/**
 * @jest-environment jsdom
 */

/**
 * Tests for the template preprocessor
 * Tests the conversion of single-quoted JSON to double-quoted JSON in templates
 */

// @flow
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import TemplatingEngine from '../lib/TemplatingEngine'
import { preProcessTags } from '../lib/rendering/templateProcessor'
import { DataStore } from '@mocks/index'

// for Flow errors with Jest
/* global describe, beforeEach, afterEach, test, expect, jest */

// Add Jest to Flow globals
declare var describe: any
declare var beforeEach: any
declare var afterEach: any
declare var test: any
declare var expect: any

// Helper to load test fixtures
const factory = async (factoryName = '') => {
  const factoryFilename = path.join(__dirname, 'factories', factoryName)
  if (existsSync(factoryFilename)) {
    return await fs.readFile(factoryFilename, 'utf-8')
  }
  return 'FACTORY_NOT_FOUND'
}

describe('preProcessTags Function Tests', () => {
  let templatingEngine

  beforeEach(() => {
    templatingEngine = new TemplatingEngine({}, '')

    // Mock DataStore.invokePluginCommandByName
    DataStore.invokePluginCommandByName = jest.fn().mockResolvedValue('mocked result')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('should return the original content when there are no matches', async () => {
    const template = '<% const x = 5; %>'
    const { newTemplateData } = await preProcessTags(template)

    expect(newTemplateData).toBe(template)
  })

  test('should handle null input gracefully', async () => {
    const { newTemplateData } = await preProcessTags(null)
    expect(newTemplateData).toEqual('')
  })

  test('should handle undefined input gracefully', async () => {
    const { newTemplateData } = await preProcessTags(undefined)
    expect(newTemplateData).toEqual('')
  })

  test('should not modify function calls inside template literals', async () => {
    const template = `<% const eventInfoString = \`eventTitle=\${eventTitle};eventNotes=\${eventNotes};eventLink=\${eventLink};calendarItemLink=\${calendarItemLink};eventAttendees=\${eventAttendees};eventAttendeeNames=\${eventAttendeeNames};eventLocation=\${eventLocation};eventCalendar=\${eventCalendar};eventStart=\${eventDate("YYYY-MM-DD HH:MM")};eventEnd=\${eventEndDate("YYYY-MM-DD HH:MM")}\`.replace("\\n"," "); -%>`
    const { newTemplateData } = await preProcessTags(template)
    expect(newTemplateData).toBe(template)
  })

  test('should handle nested template literals', async () => {
    const template = `<% const nestedTemplate = \`outer \${inner \`nested \${deepest()}\`}\`; -%>`
    const { newTemplateData } = await preProcessTags(template)
    expect(newTemplateData).toBe(template)
  })

  test('should handle template literals with multiple function calls', async () => {
    const template = `<% const multiFunc = \`start \${func1()} middle \${func2()} end \${func3()}\`; -%>`
    const { newTemplateData } = await preProcessTags(template)
    expect(newTemplateData).toBe(template)
  })

  test('should handle template literals with method chains', async () => {
    const template = `<% const chained = \`\${obj.method1().method2().method3()}\`; -%>`
    const { newTemplateData } = await preProcessTags(template)
    expect(newTemplateData).toBe(template)
  })

  test('should handle template literals with ternary operators', async () => {
    const template = `<% const ternary = \`\${condition ? func1() : func2()}\`; -%>`
    const { newTemplateData } = await preProcessTags(template)
    expect(newTemplateData).toBe(template)
  })

  test('should handle template literals with arrow functions', async () => {
    const template = `<% const arrow = \`\${items.map(item => processItem(item))}\`; -%>`
    const { newTemplateData } = await preProcessTags(template)
    expect(newTemplateData).toBe(template)
  })

  test('should handle template literals with async/await expressions', async () => {
    const template = `<% const asyncExpr = \`\${await asyncFunc()}\`; -%>`
    const { newTemplateData } = await preProcessTags(template)
    expect(newTemplateData).toBe(template)
  })

  test('should handle template literals with object destructuring', async () => {
    const template = `<% const destructured = \`\${({ prop1, prop2 } = getProps())}\`; -%>`
    const { newTemplateData } = await preProcessTags(template)
    expect(newTemplateData).toBe(template)
  })

  test('should handle template literals with array methods', async () => {
    const template = `<% const arrayMethods = \`\${items.filter(x => x > 0).map(x => x * 2).reduce((a, b) => a + b)}\`; -%>`
    const { newTemplateData } = await preProcessTags(template)
    expect(newTemplateData).toBe(template)
  })

  test('should handle template literals with template literal tags', async () => {
    const template = `<% const tagged = \`\${tag\`nested template\`}\`; -%>`
    const { newTemplateData } = await preProcessTags(template)
    expect(newTemplateData).toBe(template)
  })
})
