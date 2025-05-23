/* global describe, it, expect, beforeAll, afterAll, jest */

import { render } from '../templateProcessor'
import TemplatingEngine from '../../TemplatingEngine'
import NPTemplating from '../../NPTemplating'

// Mock NotePlan environment for testing
const mockNotePlanEnvironment = () => {
  global.CommandBar = {
    prompt: jest.fn().mockResolvedValue('OK'),
  }

  global.DataStore = {
    settings: {},
    preference: jest.fn().mockReturnValue(''),
    loadJSON: jest.fn().mockReturnValue({
      templateFolderName: '@Templates',
      templateLocale: 'en-US',
      templateGroupTemplatesByFolder: false,
      dateFormat: 'YYYY-MM-DD',
      timeFormat: 'HH:mm',
      defaultFormats: {
        now: 'YYYY-MM-DD HH:mm',
      },
      userFirstName: '',
      userLastName: '',
      userEmail: '',
      userPhone: '',
      services: {},
    }),
    saveJSON: jest.fn().mockReturnValue(true),
  }

  global.NotePlan = {
    environment: {
      languageCode: 'en-US',
      templateFolder: '@Templates',
    },
  }

  global.Clipboard = {
    string: 'test clipboard content',
  }
}

const cleanupNotePlanEnvironment = () => {
  delete global.CommandBar
  delete global.DataStore
  delete global.NotePlan
  delete global.Clipboard
}

describe('Template Processor', () => {
  beforeAll(() => {
    mockNotePlanEnvironment()
  })

  afterAll(() => {
    cleanupNotePlanEnvironment()
  })

  describe('templateConfig integration', () => {
    it('should make helper modules available when templateConfig is provided via TemplatingEngine directly', async () => {
      const templateData = 'Current time: <%- time.now() %>'
      const mockConfig = {
        templateFolderName: '@Templates',
        templateLocale: 'en-US',
        templateGroupTemplatesByFolder: false,
        dateFormat: 'YYYY-MM-DD',
        timeFormat: 'HH:mm',
        defaultFormats: {
          now: 'YYYY-MM-DD HH:mm',
        },
      }

      // Test TemplatingEngine directly to avoid config override issues
      const engine = new TemplatingEngine(mockConfig)
      const result = await engine.render(templateData, {}, {})

      // Should not be an error message
      expect(result).not.toContain('==Error Rendering templateData.==')
      expect(result).not.toContain('Unable to identify error location')

      // Should contain a rendered time (basic pattern check)
      expect(result).toMatch(/Current time: \d{2}:\d{2}/)
    })

    it('should make helper modules available when going through NPTemplating.render() - REAL WORLD SCENARIO', async () => {
      const templateData = 'Current time: <%- time.now() %>'

      // This should reproduce the real-world scenario
      const result = await NPTemplating.render(templateData, {}, {})

      console.log('NPTemplating.render result:', result)
      console.log('NPTemplating.templateConfig:', JSON.stringify(NPTemplating.templateConfig, null, 2))

      // Should not be an error message
      expect(result).not.toContain('==Error Rendering templateData.==')
      expect(result).not.toContain('Unable to identify error location')

      // Should contain a rendered time (basic pattern check)
      expect(result).toMatch(/Current time: \d{2}:\d{2}/)
    })

    it('should fall back gracefully when no templateConfig is provided', async () => {
      const templateData = 'Just text, no templates'

      const result = await render(templateData, {}, {})

      expect(result).toBe('Just text, no templates')
    })
  })
})
