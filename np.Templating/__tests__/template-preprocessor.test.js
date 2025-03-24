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
import NPTemplating from '../lib/NPTemplating'
import { DataStore } from '@mocks/index'

// for Flow errors with Jest
/* global describe, beforeEach, afterEach, test, expect, jest */

// Add Jest to Flow globals
declare var describe: any
declare var beforeEach: any
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

describe('NPTemplating.preProcess JSON handling', () => {
  let templatingEngine

  beforeEach(() => {
    templatingEngine = new TemplatingEngine({})

    // Mock DataStore.invokePluginCommandByName
    DataStore.invokePluginCommandByName = jest.fn().mockResolvedValue('mocked result')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('should convert single-quoted JSON property names to double-quoted in invokePluginCommandByName calls', async () => {
    const template = await factory('single-quoted-json-template.ejs')
    const { newTemplateData } = await NPTemplating.preProcess(template)

    // Given the current implementation, it will add double quotes to property names and values
    expect(newTemplateData).toContain('"numDays"')
    expect(newTemplateData).toContain('"sectionHeading"')
    expect(newTemplateData).toContain('"runSilently"')

    // Original single quotes in property names and values should be gone
    expect(newTemplateData).not.toContain("'numDays'")
    expect(newTemplateData).not.toContain("'sectionHeading'")
    expect(newTemplateData).not.toContain("'runSilently'")

    // The original call should be recognizable, except for the quotes in the JSON
    expect(newTemplateData).toContain("DataStore.invokePluginCommandByName('Remove section from recent notes'")
    expect(newTemplateData).toContain("'np.Tidy'")
  })

  test('should process multiple invokePluginCommandByName calls in one template', async () => {
    const template = await factory('single-quoted-json-template.ejs')
    const { newTemplateData } = await NPTemplating.preProcess(template)

    // First call - property names should have double quotes
    expect(newTemplateData).toContain('"numDays"')
    expect(newTemplateData).toContain('"sectionHeading"')
    expect(newTemplateData).toContain('"runSilently"')

    // Second call - should also have the second plugin command
    expect(newTemplateData).toContain("DataStore.invokePluginCommandByName('Weather forecast','np.Weather'")
  })

  test('should return the original content when there are no matches', async () => {
    const template = '<% const x = 5; %>'
    const { newTemplateData } = await NPTemplating.preProcess(template)

    expect(newTemplateData).toBe(template)
  })

  test('should handle null input gracefully', async () => {
    const { newTemplateData } = await NPTemplating.preProcess(null)
    expect(newTemplateData).toBe(null)
  })

  test('should handle undefined input gracefully', async () => {
    const { newTemplateData } = await NPTemplating.preProcess(undefined)
    expect(newTemplateData).toBe(undefined)
  })
})
