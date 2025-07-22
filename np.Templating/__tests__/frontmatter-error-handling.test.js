/* eslint-disable */
import { CustomConsole } from '@jest/console' // see note below
import { simpleFormatter, DataStore, NotePlan } from '@mocks/index'

import colors from 'chalk'

global.NotePlan = new NotePlan() // because Mike calls NotePlan in a const declaration in NPTemplating, we need to set it first
globalThis.NotePlan = global.NotePlan // because Mike calls NotePlan in a const declaration in NPTemplating, we need to set it first

import TemplatingEngine from '../lib/TemplatingEngine'

const DEFAULT_TEMPLATE_CONFIG = {
  locale: 'en-US',
  dateFormat: 'YYYY-MM-DD',
  timeFormat: 'h:mm A',
  timestampFormat: 'YYYY-MM-DD h:mm:ss A',
  userFirstName: '',
  userLastName: '',
  userEmail: '',
  userPhone: '',
  services: {},
}

const PLUGIN_NAME = `📙 ${colors.yellow('np.Templating')}`
const section = colors.blue

beforeAll(() => {
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  global.NotePlan = new NotePlan()
  global.DataStore = DataStore
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging (or 'none' for none)
})

describe(`${PLUGIN_NAME} - Frontmatter Error Handling`, () => {
  let templateInstance
  beforeEach(() => {
    templateInstance = new TemplatingEngine(DEFAULT_TEMPLATE_CONFIG, '')
    global.DataStore = DataStore
    DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging (or 'none' for none)
  })

  describe(section('Frontmatter-Only Errors'), () => {
    it(`should show frontmatter errors when body renders successfully`, async () => {
      const originalScript = `Valid body content`
      const templateEngine = new TemplatingEngine(DEFAULT_TEMPLATE_CONFIG, originalScript, [
        {
          phase: 'Frontmatter Processing',
          error: 'Invalid YAML syntax in frontmatter',
          context: 'Missing quotes around template tag value',
        },
      ])

      let renderedData = await templateEngine.render(originalScript)

      // Body should render successfully AND frontmatter errors should be shown
      expect(renderedData).toContain('Valid body content')
      expect(renderedData).toContain('Issues occurred during frontmatter processing')
      expect(renderedData).toContain('Frontmatter Processing')
      expect(renderedData).toContain('Invalid YAML syntax in frontmatter')
      expect(renderedData).toContain('Missing quotes around template tag value')
    })

    it(`should show frontmatter errors with successful template rendering`, async () => {
      const originalScript = `Hello <%- user.first %>!`
      const templateEngine = new TemplatingEngine(DEFAULT_TEMPLATE_CONFIG, originalScript, [
        {
          phase: 'Frontmatter Processing',
          error: 'Template tag failed to render in frontmatter attribute "title"',
          context: 'ReferenceError: invalidVariable is not defined',
        },
      ])

      let renderedData = await templateEngine.render(originalScript, { user: { first: 'John' } })

      // Template should render successfully AND show frontmatter errors
      expect(renderedData).toContain('Hello John!')
      expect(renderedData).toContain('Issues occurred during frontmatter processing')
      expect(renderedData).toContain('Template tag failed to render in frontmatter attribute')
      expect(renderedData).toContain('ReferenceError: invalidVariable is not defined')
    })
  })

  describe(section('Body-Only Errors'), () => {
    it(`should show template body errors without frontmatter errors`, async () => {
      const originalScript = `<% const test = undefinedVariable %>`
      const templateEngine = new TemplatingEngine(DEFAULT_TEMPLATE_CONFIG, originalScript)

      let renderedData = await templateEngine.render(originalScript)

      expect(renderedData).toContain('Template Rendering Error')
      expect(renderedData).toContain('undefinedVariable')
      expect(renderedData).not.toContain('Frontmatter Processing')
    })
  })

  describe(section('Combined Errors'), () => {
    it(`should show both frontmatter and body errors when both fail`, async () => {
      // Mock NotePlan.AI to fail so we see basic error handling
      const originalNotePlan = global.NotePlan
      global.NotePlan = {
        ...originalNotePlan,
        ai: jest.fn().mockRejectedValue(new Error('AI service unavailable')),
      }

      const originalScript = `<% const test = undefinedVariable %>`
      const templateEngine = new TemplatingEngine(DEFAULT_TEMPLATE_CONFIG, originalScript, [
        {
          phase: 'Frontmatter Processing',
          error: 'YAML parsing failed',
          context: 'Invalid syntax in frontmatter block',
        },
      ])

      let renderedData = await templateEngine.render(originalScript)

      expect(renderedData).toContain('Template Rendering Error')
      expect(renderedData).toContain('undefinedVariable')
      expect(renderedData).toContain('Errors from previous rendering phases:')
      expect(renderedData).toContain('Frontmatter Processing')
      expect(renderedData).toContain('YAML parsing failed')

      // Restore original NotePlan
      global.NotePlan = originalNotePlan
    })

    it(`should show frontmatter errors in AI analysis when body fails`, async () => {
      // Mock successful AI analysis
      const originalNotePlan = global.NotePlan
      global.NotePlan = {
        ...originalNotePlan,
        ai: jest.fn().mockResolvedValue('AI Analysis: The variable "undefinedVariable" is not defined.'),
      }

      const originalScript = `<% const test = undefinedVariable %>`
      const templateEngine = new TemplatingEngine(DEFAULT_TEMPLATE_CONFIG, originalScript, [
        {
          phase: 'Frontmatter Processing',
          error: 'Template rendering failed in frontmatter',
          context: 'Error in title attribute processing',
        },
      ])

      let renderedData = await templateEngine.render(originalScript)

      expect(renderedData).toContain('AI Analysis')
      expect(renderedData).toContain('undefinedVariable')

      // Check if AI analysis includes frontmatter errors (it should)
      expect(global.NotePlan.ai).toHaveBeenCalledWith(expect.stringContaining('Errors from previous rendering phases'), [], false, 'gpt-4')

      // Most importantly: Check that the final output includes the frontmatter errors in a clear section
      expect(renderedData).toContain('Additional Issues from Previous Processing Phases')
      expect(renderedData).toContain('Frontmatter Processing')
      expect(renderedData).toContain('Template rendering failed in frontmatter')
      expect(renderedData).toContain('Error in title attribute processing')

      // Restore original NotePlan
      global.NotePlan = originalNotePlan
    })
  })

  describe(section('Error Detection and Reporting'), () => {
    it(`should show frontmatter errors even when template body has no issues`, async () => {
      const originalScript = `This is valid content with no template tags.`
      const templateEngine = new TemplatingEngine(DEFAULT_TEMPLATE_CONFIG, originalScript, [
        {
          phase: 'Frontmatter Processing',
          error: 'Critical frontmatter error occurred',
          context: 'User needs to know about this error',
        },
      ])

      let renderedData = await templateEngine.render(originalScript)

      // Content should render successfully AND frontmatter errors should be visible
      expect(renderedData).toContain('This is valid content with no template tags.')
      expect(renderedData).toContain('Issues occurred during frontmatter processing')
      expect(renderedData).toContain('Critical frontmatter error occurred')
      expect(renderedData).toContain('User needs to know about this error')
    })

    it(`should clearly show both frontmatter and body errors like real-world scenario`, async () => {
      // Mock successful AI analysis like in the real scenario
      const originalNotePlan = global.NotePlan
      global.NotePlan = {
        ...originalNotePlan,
        ai: jest.fn().mockResolvedValue('AI Analysis: The variable "dne" is not defined in the template body.'),
      }

      // Simulate the exact scenario from the logs: frontmatter has foo error, body has dne error
      const originalScript = `
<%- dne %>
---`

      const templateEngine = new TemplatingEngine(DEFAULT_TEMPLATE_CONFIG, originalScript, [
        {
          phase: 'Frontmatter Processing',
          error:
            'Variable "isError" contains error: ==**Templating Error Found**: AI Analysis and Recommendations==\n### Error Description:\n- The template tries to use a variable or function named `foo` (`<% foo %>`), but there is no such variable, method, or function available.',
          context: 'This error occurred while processing frontmatter in the original template.',
        },
      ])

      let renderedData = await templateEngine.render(originalScript)

      // Should have AI analysis for the body error
      expect(renderedData).toContain('AI Analysis')
      expect(renderedData).toContain('dne')

      // Should ALSO clearly show the frontmatter error information
      expect(renderedData).toContain('Additional Issues from Previous Processing Phases')
      expect(renderedData).toContain('Frontmatter Processing')
      expect(renderedData).toContain('Variable "isError" contains error')
      expect(renderedData).toContain('foo')

      // Restore original NotePlan
      global.NotePlan = originalNotePlan
    })

    it(`should show frontmatter error even if the body has nothing but text to process & takes the 'fast path'`, async () => {
      // Mock successful AI analysis like in the real scenario
      const originalNotePlan = global.NotePlan
      global.NotePlan = {
        ...originalNotePlan,
        ai: jest.fn().mockResolvedValue('AI Analysis: The variable "dne" is not defined in the template body.'),
      }

      // Simulate the exact scenario from the logs: frontmatter has foo error, body has dne error
      const bodyOnly = `nothing to see here`
      const fullScript = `---
        isError: <%- dne %>
        ---
        ${bodyOnly}`

      const templateEngine = new TemplatingEngine(DEFAULT_TEMPLATE_CONFIG, fullScript, [
        {
          phase: 'Frontmatter Processing',
          error:
            'Variable "isError" contains error: ==**Templating Error Found**: AI Analysis and Recommendations==\n### Error Description:\n- The template tries to use a variable or function named `foo` (`<% foo %>`), but there is no such variable, method, or function available.',
          context: 'This error occurred while processing frontmatter in the original template.',
        },
      ])

      let renderedData = await templateEngine.render(bodyOnly)

      // Should ALSO clearly show the frontmatter error information
      expect(renderedData).toContain('Issues occurred during frontmatter processing')
      expect(renderedData).toContain('Frontmatter Processing')
      expect(renderedData).toContain('Variable "isError" contains error')
      expect(renderedData).toContain('nothing to see here')

      // Restore original NotePlan
      global.NotePlan = originalNotePlan
    })
  })
})
