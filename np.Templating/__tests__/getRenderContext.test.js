/**
 * @jest-environment jsdom
 */
/* eslint-disable */

/**
 * Tests for getRenderContext function
 * Tests that the function returns the expected templating context structure
 */

// @flow
import { CustomConsole } from '@jest/console'
import { simpleFormatter, DataStore, NotePlan, Editor, CommandBar } from '@mocks/index'

global.NotePlan = new NotePlan()
// $FlowIgnore[prop-missing]
globalThis.NotePlan = global.NotePlan
global.DataStore = DataStore
global.Editor = Editor
global.CommandBar = CommandBar

// Mock helpers before importing
jest.mock('@helpers/dev', () => ({
  logDebug: jest.fn(),
  logError: jest.fn(),
  clo: jest.fn(),
  log: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  timer: jest.fn(),
  JSP: jest.fn(),
}))

jest.mock('@helpers/codeBlocks', () => ({
  getCodeBlocksOfType: jest.fn(),
}))

jest.mock('@helpers/stringTransforms', () => ({
  parseObjectString: jest.fn(),
  validateObjectString: jest.fn(),
}))

jest.mock('@helpers/note', () => ({
  getNote: jest.fn(),
}))

jest.mock('@helpers/userInput', () => ({
  showMessage: jest.fn(),
}))

jest.mock('@helpers/paragraph', () => ({
  smartPrependPara: jest.fn(),
  smartAppendPara: jest.fn(),
}))

jest.mock('@helpers/content', () => ({
  getContentWithLinks: jest.fn(),
}))

jest.mock('@helpers/NPConfiguration', () => ({
  initConfiguration: jest.fn(),
  updateSettingData: jest.fn(),
  pluginUpdated: jest.fn(),
  getSetting: jest.fn(),
}))

jest.mock('@helpers/NPnote', () => ({
  selectFirstNonTitleLineInEditor: jest.fn(),
}))

jest.mock('@helpers/NPFrontMatter', () => ({
  hasFrontMatter: jest.fn(),
  updateFrontMatterVars: jest.fn(),
  getNoteTitleFromTemplate: jest.fn(),
  getNoteTitleFromRenderedContent: jest.fn(),
  analyzeTemplateStructure: jest.fn(),
}))

jest.mock('@helpers/NPEditor', () => ({
  checkAndProcessFolderAndNewNoteTitle: jest.fn(),
}))

// Mock NPTemplating as a global module alias
// $FlowIgnore[underconstrained-implicit-instantiation]
jest.mock(
  'NPTemplating',
  () => {
    // $FlowIgnore[underconstrained-implicit-instantiation]
    return jest.requireActual('../lib/NPTemplating').default
  },
  { virtual: true },
)

import { getRenderContext } from '../src/Templating'
import NPTemplating from '../lib/NPTemplating'

const DEFAULT_TEMPLATE_CONFIG = {
  locale: 'en-US',
  dateFormat: 'YYYY-MM-DD',
  timeFormat: 'h:mm A',
  timestampFormat: 'YYYY-MM-DD h:mm:ss A',
  userFirstName: 'Test',
  userLastName: 'User',
  userEmail: 'test@example.com',
  userPhone: '555-1234',
  services: {},
  clipboard: '',
}

beforeAll(() => {
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
  global.NotePlan = new NotePlan()
  global.DataStore = DataStore
  global.Editor = Editor
  global.CommandBar = CommandBar
  DataStore.settings['_logLevel'] = 'none'
})

describe('getRenderContext', () => {
  beforeEach(() => {
    // Reset NPTemplating setup state
    // $FlowIgnore[prop-missing]
    NPTemplating.templateConfig = null
    DataStore.settings['_logLevel'] = 'none'
  })

  describe('Basic functionality', () => {
    it('should return an object with templating modules', async () => {
      const context = await getRenderContext()

      expect(context).toBeDefined()
      expect(typeof context).toBe('object')
      expect(context).not.toBeNull()

      // Check for templating modules
      expect(context.date).toBeDefined()
      expect(context.time).toBeDefined()
      expect(context.note).toBeDefined()
      expect(context.tasks).toBeDefined()
      expect(context.frontmatter).toBeDefined()
      expect(context.helpers).toBeDefined()
      expect(context.utility).toBeDefined()
      expect(context.system).toBeDefined()
      expect(context.web).toBeDefined()
      expect(context.user).toBeDefined()
    })

    it('should return an object with templating globals', async () => {
      const context = await getRenderContext()

      // Check for key globals
      expect(context.moment).toBeDefined()
      expect(typeof context.moment).toBe('function') // moment is a constructor

      // Check for global functions (these are async, so we check they exist)
      expect(context.affirmation).toBeDefined()
      expect(context.advice).toBeDefined()
      expect(context.quote).toBeDefined()
      expect(context.verse).toBeDefined()
      expect(context.weather).toBeDefined()
      expect(context.format).toBeDefined()
      expect(context.now).toBeDefined()
      expect(context.timestamp).toBeDefined()
    })

    it('should include np property with full context', async () => {
      const context = await getRenderContext()

      expect(context.np).toBeDefined()
      expect(typeof context.np).toBe('object')
      // np should be a copy of the context
      expect(context.np.date).toBeDefined()
      // np should have the same modules and globals
      expect(context.np).toHaveProperty('date')
      expect(context.np).toHaveProperty('time')
    })

    it('should include user info object', async () => {
      const context = await getRenderContext()

      expect(context.user).toBeDefined()
      expect(typeof context.user).toBe('object')
      expect(context.user).toHaveProperty('first')
      expect(context.user).toHaveProperty('last')
      expect(context.user).toHaveProperty('email')
      expect(context.user).toHaveProperty('phone')
    })
  })

  describe('userData parameter', () => {
    it('should merge flat userData into context', async () => {
      const userData = {
        company: 'Acme Corp',
        topic: 'Meeting Notes',
        count: 42,
      }

      const context = await getRenderContext(userData)

      expect(context.company).toBe('Acme Corp')
      expect(context.topic).toBe('Meeting Notes')
      expect(context.count).toBe(42)

      // Should still have templating modules
      expect(context.date).toBeDefined()
      expect(context.moment).toBeDefined()
    })

    it('should merge structured userData with data property', async () => {
      const userData = {
        data: {
          projectName: 'My Project',
          status: 'active',
        },
      }

      const context = await getRenderContext(userData)

      expect(context.projectName).toBe('My Project')
      expect(context.status).toBe('active')

      // Should still have templating modules
      expect(context.date).toBeDefined()
    })

    it('should merge structured userData with methods property', async () => {
      // $FlowIgnore[underconstrained-implicit-instantiation]
      const customMethod = jest.fn().mockReturnValue('test result')
      const userData = {
        methods: {
          // $FlowIgnore[missing-local-annot]
          calculateTotal: (a: number, b: number) => a + b,
          customMethod,
        },
      }

      const context = await getRenderContext(userData)

      expect(context.calculateTotal).toBeDefined()
      expect(typeof context.calculateTotal).toBe('function')
      expect(context.calculateTotal(5, 3)).toBe(8)

      expect(context.customMethod).toBeDefined()
      expect(context.customMethod()).toBe('test result')
    })

    it('should merge both data and methods from structured userData', async () => {
      const userData = {
        data: {
          value: 100,
        },
        methods: {
          // $FlowIgnore[missing-local-annot]
          double: (x: number) => x * 2,
        },
      }

      const context = await getRenderContext(userData)

      expect(context.value).toBe(100)
      expect(context.double).toBeDefined()
      expect(context.double(50)).toBe(100)
    })

    it('should handle empty userData', async () => {
      const context = await getRenderContext({})

      // Should still have all templating modules and globals
      expect(context.date).toBeDefined()
      expect(context.moment).toBeDefined()
      expect(context.np).toBeDefined()
    })

    it('should handle userData with conflicting keys (userData overrides modules, globals override userData)', async () => {
      const userData = {
        date: 'custom date string',
        moment: 'custom moment string',
      }

      const context = await getRenderContext(userData)

      // userData overrides modules (date is a module, so userData.date wins)
      expect(context.date).toBe('custom date string')

      // But globals are loaded after userData, so they override userData
      // moment is a global, so it overrides userData.moment
      expect(context.moment).not.toBe('custom moment string')
      expect(typeof context.moment).toBe('function') // Should be moment constructor
    })
  })

  describe('Context structure validation', () => {
    it('should have all expected module properties', async () => {
      const context = await getRenderContext()

      const expectedModules = ['date', 'time', 'note', 'tasks', 'frontmatter', 'helpers', 'utility', 'system', 'web', 'user']
      expectedModules.forEach((moduleName) => {
        expect(context).toHaveProperty(moduleName)
        expect(context[moduleName]).toBeDefined()
      })
    })

    it('should have date module with expected methods', async () => {
      const context = await getRenderContext()

      expect(context.date).toBeDefined()
      expect(typeof context.date.format).toBe('function')
      expect(typeof context.date.now).toBe('function')
      expect(typeof context.date.timestamp).toBe('function')
    })

    it('should have web module with expected methods', async () => {
      const context = await getRenderContext()

      expect(context.web).toBeDefined()
      expect(typeof context.web.advice).toBe('function')
      expect(typeof context.web.affirmation).toBe('function')
      expect(typeof context.web.quote).toBe('function')
      expect(typeof context.web.weather).toBe('function')
    })

    it('should have note module with expected methods', async () => {
      const context = await getRenderContext()

      expect(context.note).toBeDefined()
      // NoteModule has various methods - check that it's an object with methods
      expect(typeof context.note).toBe('object')
      expect(context.note).not.toBeNull()
    })
  })

  describe('Performance and timing', () => {
    it('should complete in reasonable time', async () => {
      const startTime = Date.now()
      const context = await getRenderContext()
      const endTime = Date.now()

      const duration = endTime - startTime

      // Should complete in under 1 second (most should be much faster)
      expect(duration).toBeLessThan(1000)
      expect(context).toBeDefined()
    })

    it('should complete subsequent calls successfully', async () => {
      // First call
      const context1 = await getRenderContext()
      expect(context1).toBeDefined()

      // Second call (should also work)
      const context2 = await getRenderContext()
      expect(context2).toBeDefined()

      // Both should have the same structure
      expect(context1.date).toBeDefined()
      expect(context2.date).toBeDefined()
      expect(context1.moment).toBeDefined()
      expect(context2.moment).toBeDefined()
    })
  })

  describe('Integration with Forms plugin use case', () => {
    it('should return context usable for templatejs block execution', async () => {
      const formValues = {
        company: 'Test Company',
        topic: 'Test Topic',
        mainAttendees: '@John, @Jane',
      }

      const context = await getRenderContext(formValues)

      // Form values should be available
      expect(context.company).toBe('Test Company')
      expect(context.topic).toBe('Test Topic')
      expect(context.mainAttendees).toBe('@John, @Jane')

      // Templating functions should be available
      expect(context.moment).toBeDefined()
      expect(context.date).toBeDefined()
      expect(context.date.format).toBeDefined()

      // Should be usable in Function constructor
      // Note: We don't pass moment as a separate parameter since it's already in context
      const testCode = `
        const formattedDate = moment().format('YYYY-MM-DD');
        return { formattedDate, company, topic };
      `
      // Only include valid identifiers, and exclude 'moment' from contextVars since we'll access it from params
      const contextVars = Object.keys(context)
        .filter((key) => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) && key !== 'moment')
        .map((key) => `const ${key} = params.${key};`)
        .join('\n')
      const functionBody = `${contextVars}\nconst moment = params.moment;\n${testCode}`

      // $FlowIgnore[prop-missing]
      const fn = Function.apply(null, ['params', functionBody])
      const result = fn(context)

      expect(result).toBeDefined()
      expect(result.formattedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/) // YYYY-MM-DD format
      expect(result.company).toBe('Test Company')
      expect(result.topic).toBe('Test Topic')
    })

    it('should allow using date module in templatejs blocks', async () => {
      const context = await getRenderContext({ value: 100 })

      const testCode = `
        const dateStr = date.format('YYYY-MM-DD');
        return { dateStr, value };
      `

      // Simulate how Forms would use this
      const contextVars = `const date = params.date; const value = params.value;`
      const functionBody = `${contextVars}\n${testCode}`

      // $FlowIgnore[prop-missing]
      const fn = Function.apply(null, ['params', functionBody])
      const result = fn(context)

      expect(result).toBeDefined()
      expect(result.dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(result.value).toBe(100)
    })
  })

  describe('Error handling', () => {
    it('should handle errors gracefully', async () => {
      // Mock NPTemplating.setup to throw an error
      // $FlowIgnore[cannot-write]
      const originalSetup = NPTemplating.setup
      // $FlowIgnore[cannot-write,underconstrained-implicit-instantiation]
      NPTemplating.setup = jest.fn().mockRejectedValue(new Error('Setup failed'))

      await expect(getRenderContext()).rejects.toThrow('Setup failed')

      // Restore original
      // $FlowIgnore[cannot-write]
      NPTemplating.setup = originalSetup
    })
  })
})
