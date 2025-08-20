/**
 * @jest-environment node
 */

import { TemplatingEngine } from '../lib/TemplatingEngine'
import { analyzeErrorWithAI } from '../lib/engine/aiAnalyzer'

// Mock NotePlan global
global.NotePlan = {
  ai: jest.fn(),
  environment: {
    languageCode: 'en',
  },
}

// Mock DataStore
global.DataStore = {
  settings: {
    _logLevel: 'none',
  },
}

// Mock console methods
global.console = {
  log: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}

describe('AI Error Analysis Override', () => {
  let originalNotePlan

  beforeEach(() => {
    // Store original NotePlan
    originalNotePlan = global.NotePlan

    // Reset mocks
    jest.clearAllMocks()
  })

  afterEach(() => {
    // Restore original NotePlan
    global.NotePlan = originalNotePlan
  })

  describe('Frontmatter Override', () => {
    it('should disable AI error analysis when disableAIErrorAnalysis is set in frontmatter', async () => {
      // Mock NotePlan.AI to ensure it's not called
      global.NotePlan.ai = jest.fn().mockResolvedValue('AI Analysis Result')

      const originalError = 'ReferenceError: undefinedVariable is not defined'
      const templateData = 'Template content with error'
      const originalScript = '<% const test = undefinedVariable %>'
      const previousPhaseErrors = []

      // Create renderData with frontmatter that disables AI
      const renderData = {
        frontmatter: {
          disableAIErrorAnalysis: true,
          title: 'Test Template',
        },
        otherData: 'some value',
      }

      const result = await analyzeErrorWithAI(originalError, templateData, renderData, originalScript, previousPhaseErrors)

      // Verify NotePlan.AI was not called
      expect(global.NotePlan.ai).not.toHaveBeenCalled()

      // Verify the result contains basic error information without AI analysis
      expect(result).toContain('==**Templating Error Found**: Basic Error Information==')
      expect(result).toContain('AI error analysis has been disabled for this template via frontmatter setting')
      expect(result).toContain('disableAIErrorAnalysis: true')
      expect(result).toContain('ReferenceError: undefinedVariable is not defined')
      expect(result).toContain('Review the error message above and check your template syntax')
    })

    it('should include problematic lines when available', async () => {
      const originalError = 'ReferenceError: undefinedVariable is not defined'
      const templateData = 'Template content with error'
      const originalScript = '<% const test = undefinedVariable %>'
      const previousPhaseErrors = []

      const renderData = {
        frontmatter: {
          disableAIErrorAnalysis: true,
        },
      }

      const result = await analyzeErrorWithAI(originalError, templateData, renderData, originalScript, previousPhaseErrors)

      // Should include problematic lines section
      expect(result).toContain('**Problematic Lines from Original Script:**')
      expect(result).toContain('```')
      expect(result).toContain('const test = undefinedVariable')
    })

    it('should include error details for debugging', async () => {
      const originalError = 'ReferenceError: undefinedVariable is not defined'
      const templateData = 'Template content with error'
      const originalScript = '<% const test = undefinedVariable %>'
      const previousPhaseErrors = []

      const renderData = {
        frontmatter: {
          disableAIErrorAnalysis: true,
        },
      }

      const result = await analyzeErrorWithAI(originalError, templateData, renderData, originalScript, previousPhaseErrors)

      // Should include error details section
      expect(result).toContain('**Error Details (for debugging):**')
      expect(result).toContain('Original Error: ReferenceError: undefinedVariable is not defined')
      expect(result).toContain('Template Data: Template content with error')
    })

    it('should still call AI analysis when disableAIErrorAnalysis is not set', async () => {
      // Mock NotePlan.AI to return a response
      global.NotePlan.ai = jest.fn().mockResolvedValue('AI Analysis: The variable "undefinedVariable" is not defined.')

      const originalError = 'ReferenceError: undefinedVariable is not defined'
      const templateData = 'Template content with error'
      const originalScript = '<% const test = undefinedVariable %>'
      const previousPhaseErrors = []

      // Create renderData without the disable flag
      const renderData = {
        frontmatter: {
          title: 'Test Template',
        },
        otherData: 'some value',
      }

      const result = await analyzeErrorWithAI(originalError, templateData, renderData, originalScript, previousPhaseErrors)

      // Verify NotePlan.AI was called
      expect(global.NotePlan.ai).toHaveBeenCalledWith(expect.stringContaining('You are now an expert in EJS Templates'), [], false, 'gpt-4')

      // Verify the result contains AI analysis
      expect(result).toContain('==**Templating Error Found**: AI Analysis and Recommendations==')
    })

    it('should still call AI analysis when frontmatter is not present', async () => {
      // Mock NotePlan.AI to return a response
      global.NotePlan.ai = jest.fn().mockResolvedValue('AI Analysis: The variable "undefinedVariable" is not defined.')

      const originalError = 'ReferenceError: undefinedVariable is not defined'
      const templateData = 'Template content with error'
      const originalScript = '<% const test = undefinedVariable %>'
      const previousPhaseErrors = []

      // Create renderData without frontmatter
      const renderData = {
        otherData: 'some value',
      }

      const result = await analyzeErrorWithAI(originalError, templateData, renderData, originalScript, previousPhaseErrors)

      // Verify NotePlan.AI was called
      expect(global.NotePlan.ai).toHaveBeenCalled()

      // Verify the result contains AI analysis
      expect(result).toContain('==**Templating Error Found**: AI Analysis and Recommendations==')
    })

    it('should handle different frontmatter field names correctly', async () => {
      const originalError = 'ReferenceError: undefinedVariable is not defined'
      const templateData = 'Template content with error'
      const originalScript = '<% const test = undefinedVariable %>'
      const previousPhaseErrors = []

      // Test with different field names and their expected behaviors
      const testCases = [
        {
          frontmatter: { disableAI: true },
          shouldCallAI: false,
          description: 'disableAI: true should disable AI analysis',
        },
        {
          frontmatter: { noAI: true },
          shouldCallAI: false,
          description: 'noAI: true should disable AI analysis',
        },
        {
          frontmatter: { skipAI: true },
          shouldCallAI: false,
          description: 'skipAI: true should disable AI analysis',
        },
        {
          frontmatter: { disableAIErrorAnalysis: false },
          shouldCallAI: true,
          description: 'disableAIErrorAnalysis: false should allow AI analysis',
        },
        {
          frontmatter: { disableAIErrorAnalysis: 'true' },
          shouldCallAI: false,
          description: 'disableAIErrorAnalysis: "true" (string) should disable AI analysis',
        },
      ]

      for (const testCase of testCases) {
        // Mock NotePlan.AI to return a response
        global.NotePlan.ai = jest.fn().mockResolvedValue('AI Analysis Result')

        const result = await analyzeErrorWithAI(originalError, templateData, testCase, originalScript, previousPhaseErrors)

        if (testCase.shouldCallAI) {
          // Verify NotePlan.AI was called when it should be
          expect(global.NotePlan.ai).toHaveBeenCalled()
          // Verify the result contains AI analysis
          expect(result).toContain('==**Templating Error Found**: AI Analysis and Recommendations==')
        } else {
          // Verify NotePlan.AI was NOT called when it should be disabled
          expect(global.NotePlan.ai).not.toHaveBeenCalled()
          // Verify the result does NOT contain AI analysis
          expect(result).not.toContain('==**Templating Error Found**: AI Analysis and Recommendations==')
        }

        // Reset mock for next iteration
        jest.clearAllMocks()
      }
    })
  })
})
