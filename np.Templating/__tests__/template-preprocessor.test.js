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

  test('should return the original content when there are no matches', async () => {
    const template = '<% const x = 5; %>'
    const { newTemplateData } = await NPTemplating.preProcess(template)

    expect(newTemplateData).toBe(template)
  })

  test('should handle null input gracefully', async () => {
    const { newTemplateData } = await NPTemplating.preProcess(null)
    expect(newTemplateData).toEqual('')
  })

  test('should handle undefined input gracefully', async () => {
    const { newTemplateData } = await NPTemplating.preProcess(undefined)
    expect(newTemplateData).toEqual('')
  })
})
