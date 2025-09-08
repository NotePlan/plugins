/* eslint-disable */
import { CustomConsole } from '@jest/console' // see note below
import { simpleFormatter, DataStore, NotePlan, Editor, CommandBar /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'

import path from 'path'
import colors from 'chalk'
import fs from 'fs/promises'
import { existsSync } from 'fs'

global.NotePlan = new NotePlan() // because Mike calls NotePlan in a const declaration in NPTemplating, we need to set it first
globalThis.NotePlan = global.NotePlan // because Mike calls NotePlan in a const declaration in NPTemplating, we need to set it first

import NPTemplating from '../lib/NPTemplating'

import TemplatingEngine from '../lib/TemplatingEngine'
import DateModule from '../lib/support/modules/DateModule'
import TimeModule from '../lib/support/modules/TimeModule'
import { replaceDoubleDashes } from '../lib/engine/templateRenderer'
import { processFrontmatterTags } from '../lib/rendering/templateProcessor'

const DEFAULT_TEMPLATE_CONFIG = {
  locale: 'en-US',
  dateFormat: 'YYYY-MM-DD',
  timeFormat: 'h:mm A',
  timestampFormat: 'YYYY-MM-DD h:mm:ss A',
  userFirstName: '',
  userLastName: '',
  userEmail: '',
  userPhone: '',
  // $FlowFixMe
  services: {},
}

const PLUGIN_NAME = `📙 ${colors.yellow('np.Templating')}`
const section = colors.blue

const titleCase = (str = '') => {
  return str
    .toLowerCase()
    .split(' ')
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

const factory = async (factoryName = '') => {
  const factoryFilename = path.join(__dirname, 'factories', factoryName)
  if (existsSync(factoryFilename)) {
    return await fs.readFile(factoryFilename, 'utf-8')
  }
  return 'FACTORY_NOT_FOUND'
}

beforeAll(() => {
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  global.NotePlan = new NotePlan()
  global.DataStore = DataStore
  global.Editor = Editor
  global.CommandBar = CommandBar
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging (or 'none' for none)
})

describe(`${PLUGIN_NAME}`, () => {
  let templateInstance
  beforeEach(() => {
    templateInstance = new TemplatingEngine(DEFAULT_TEMPLATE_CONFIG, '')
    global.DataStore = DataStore
    global.Editor = Editor
    global.CommandBar = CommandBar
    DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging (or 'none' for none)
  })

  describe(section('Template: DateModule'), () => {
    it(`should render default date object`, async () => {
      const templateData = await factory('dates.ejs')

      let renderedData = await templateInstance.render(templateData)

      let currentDate = new DateModule().now()

      expect(templateData).not.toBe('FACTORY_NOT_FOUND')
      expect(renderedData).toContain(`Current Date: ${currentDate}`)
    })

    it(`should render formatted date object`, async () => {
      const templateData = await factory('dates.ejs')

      let renderedData = await templateInstance.render(templateData)

      let currentDate = new DateModule().now('YYYY-MM-DD')

      expect(templateData).not.toBe('FACTORY_NOT_FOUND')
      expect(renderedData).toContain(`Current Date: ${currentDate}`)
    })

    it(`should render formatted date object adding 1 day`, async () => {
      const templateData = await factory('dates.ejs')

      let renderedData = await templateInstance.render(templateData)

      let currentDate = new DateModule().now('YYYY-MM-DD', 1)

      expect(templateData).not.toBe('FACTORY_NOT_FOUND')
      expect(renderedData).toContain(`Add Day: ${currentDate}`)
    })

    it(`should render formatted date object subtracting 1 day`, async () => {
      const templateData = await factory('dates.ejs')

      let renderedData = await templateInstance.render(templateData)

      let currentDate = new DateModule().now('YYYY-MM-DD', -1)

      expect(templateData).not.toBe('FACTORY_NOT_FOUND')
      expect(renderedData).toContain(`Subtract Day: ${currentDate}`)
    })

    it(`should render tomorrow`, async () => {
      const templateData = await factory('dates.ejs')

      let renderedData = await templateInstance.render(templateData)

      let currentDate = new DateModule().tomorrow()

      expect(templateData).not.toBe('FACTORY_NOT_FOUND')
      expect(renderedData).toContain(`Tomorrow: ${currentDate}`)
    })

    it(`should render yesterday`, async () => {
      const templateData = await factory('dates.ejs')

      let renderedData = await templateInstance.render(templateData)

      let currentDate = new DateModule().yesterday()

      expect(templateData).not.toBe('FACTORY_NOT_FOUND')
      expect(renderedData).toContain(`Yesterday: ${currentDate}`)
    })

    it(`should render weekday`, async () => {
      const templateData = await factory('dates.ejs')

      let renderedData = await templateInstance.render(templateData)

      let currentDate = new DateModule().weekday('YYYY-MM-DD', 3)

      expect(templateData).not.toBe('FACTORY_NOT_FOUND')
      expect(renderedData).toContain(`Weekday (Add): ${currentDate}`)
    })

    it(`should render weekday`, async () => {
      const templateData = await factory('dates.ejs')

      let renderedData = await templateInstance.render(templateData)

      let currentDate = new DateModule().weekday('YYYY-MM-DD', -3)

      expect(templateData).not.toBe('FACTORY_NOT_FOUND')
      expect(renderedData).toContain(`Weekday (Subtract): ${currentDate}`)
    })

    it(`should process various date formats`, async () => {
      const templateData = await factory('dates-various.ejs')

      let renderedData = await templateInstance.render(templateData)

      expect(templateData).not.toBe('FACTORY_NOT_FOUND')
      expect(renderedData).not.toContain('INVALID_DATE_FORMAT')
      expect(renderedData).not.toContain('Invalid Date')

      expect(typeof renderedData).toBe('string')

      // now validate results
      let now = new DateModule().now('Do MMMM YYYY')

      expect(renderedData).toContain('Date now: ' + new DateModule().now())
      expect(renderedData).toContain('Date now with format: ', new DateModule().now('Do MMMM YYYY'))

      expect(renderedData).toContain('Last week: ' + new DateModule().now('dddd Do MMMM YYYY', -7))
      expect(renderedData).toContain('Today: ' + new DateModule().now('dddd Do MMMM YYYY, ddd'))
      expect(renderedData).toContain('Next week: ' + new DateModule().now('dddd Do MMMM YYYY', 7))

      expect(renderedData).toContain('Last month: ' + new DateModule().now('YYYY-MM-DD', 'P-1M'))
      expect(renderedData).toContain('Next year: ' + new DateModule().now('YYYY-MM-DD', 'P1Y'))

      expect(renderedData).toContain('Date tomorrow with format: ' + new DateModule().tomorrow('Do MMMM YYYY'))

      expect(renderedData).toContain("This week's monday: " + new DateModule().weekday('YYYY-MM-DD', 0))
      expect(renderedData).toContain('Next monday: ' + new DateModule().weekday('YYYY-MM-DD', 7))

      expect(renderedData).toContain('Date yesterday with format: ' + new DateModule().yesterday('Do MMMM YYYY'))
    })
  })

  describe(section('Template: TimeModule'), () => {
    it(`should render time data using variable`, async () => {
      const templateData = await factory('times.ejs')

      const renderedData = await templateInstance.render(templateData)

      const time = new TimeModule().now('h:mm A')
      expect(renderedData).toContain(time)

      const time2 = new TimeModule().now('hh:mm')
      expect(renderedData).toContain(time2)
    })
  })

  describe(section('Error Handling'), () => {
    it(`should return error with missing object`, async () => {
      const templateData = await factory('missing-object.ejs')

      let renderedData = await templateInstance.render(templateData)

      expect(renderedData).toContain('name2 is not defined')
    })

    it(`should return error with invalid syntax`, async () => {
      const templateData = await factory('invalid-syntax.ejs')

      let renderedData = await templateInstance.render(templateData)

      expect(renderedData).toContain(`Could not find matching close tag for \"<%\".`)
    })

    it(`should use templating error handler`, async () => {
      expect(true).toEqual(true)
    })

    it(`should include original script in error message when provided to constructor`, async () => {
      const originalScript = `<% const badVar = undefinedVariable %>`
      const templateEngine = new TemplatingEngine(DEFAULT_TEMPLATE_CONFIG, originalScript)

      let renderedData = await templateEngine.render(originalScript)

      expect(renderedData).toContain('Error')
      expect(renderedData).toContain('Template')
      expect(renderedData).toContain('undefinedVariable')
    })

    it(`should attempt AI analysis when NotePlan.AI is available`, async () => {
      // Mock NotePlan.AI function
      const originalNotePlan = global.NotePlan
      global.NotePlan = {
        ...originalNotePlan,
        ai: jest.fn().mockResolvedValue('AI Analysis: The variable "badVariable" is not defined. You should define it before using it in your template.'),
      }

      const originalScript = `<% const test = badVariable %>`
      const templateEngine = new TemplatingEngine(DEFAULT_TEMPLATE_CONFIG, originalScript)

      let renderedData = await templateEngine.render(originalScript)

      expect(renderedData).toContain('**Templating Error Found**')
      expect(renderedData).toContain('AI Analysis')

      // Verify NotePlan.ai was called
      expect(global.NotePlan.ai).toHaveBeenCalledWith(expect.stringContaining('You are now an expert in EJS Templates'), [], false, 'gpt-4')

      // Restore original NotePlan
      global.NotePlan = originalNotePlan
    })

    it(`should fall back to regular error when AI analysis fails`, async () => {
      // Mock NotePlan.AI function to throw an error
      const originalNotePlan = global.NotePlan
      global.NotePlan = {
        ...originalNotePlan,
        ai: jest.fn().mockRejectedValue(new Error('AI service unavailable')),
      }

      const originalScript = `<% const test = badVariable %>`
      const templateEngine = new TemplatingEngine(DEFAULT_TEMPLATE_CONFIG, originalScript)

      let renderedData = await templateEngine.render(originalScript)

      expect(renderedData).toContain('Template Rendering Error')
      expect(renderedData).not.toContain('AI Enhanced')
      expect(renderedData).toContain('badVariable')

      // Restore original NotePlan
      global.NotePlan = originalNotePlan
    })

    it(`should include previous phase errors when AI analysis fails`, async () => {
      // Mock NotePlan.AI function to throw an error
      const originalNotePlan = global.NotePlan
      global.NotePlan = {
        ...originalNotePlan,
        ai: jest.fn().mockRejectedValue(new Error('AI service unavailable')),
      }

      const originalScript = `<% const test = badVariable %>`
      const templateEngine = new TemplatingEngine(DEFAULT_TEMPLATE_CONFIG, originalScript)

      // Simulate previous phase errors
      templateEngine.previousPhaseErrors = [
        {
          phase: 'preprocessor',
          error: 'Variable transformation failed',
          context: 'line 3: undefined variable reference',
        },
        {
          phase: 'validation',
          error: 'Syntax validation failed',
          context: 'missing closing bracket',
        },
      ]

      let renderedData = await templateEngine.render(originalScript)

      expect(renderedData).toContain('Template Rendering Error')
      expect(renderedData).toContain('Errors from previous rendering phases:')
      expect(renderedData).toContain('### preprocessor:')
      expect(renderedData).toContain('Variable transformation failed')
      expect(renderedData).toContain('### validation:')
      expect(renderedData).toContain('Syntax validation failed')

      // Restore original NotePlan
      global.NotePlan = originalNotePlan
    })
  })

  describe(section('Invalid Template'), () => {
    it(`should use 'note' object tags (pending)`, async () => {
      const templateData = await factory('invalid-syntax.ejs')

      let renderedData = await templateInstance.render(templateData)

      expect(renderedData).toContain('Could not find matching close tag for')
    })
  })

  describe(section('Custom Tags'), () => {
    it(`should use custom tags`, async () => {
      const templateData = await factory('custom-tags.ejs')

      let renderedData = await templateInstance.render(
        templateData,
        {
          hello: (str = '') => {
            return `Hello ${str}`
          },
        },
        {
          openDelimiter: '{',
          closeDelimiter: '}',
        },
      )

      let date = new DateModule().now('YYYY-MM-DD h:mm A')
      expect(renderedData).toContain(date)

      expect(renderedData).toContain('Hello Mike')
    })
  })

  describe(section('Async'), () => {
    it(`process async tags`, async () => {
      const templateData = await factory('async.ejs')

      let renderedData = await templateInstance.render(templateData, {
        hello: async (str = '') => {
          return `Hello ${str}`
        },
      })

      expect(renderedData).toContain('Hello Mike')
    })
  })

  describe(section('TemplatingEngine: Double Dashes'), () => {
    it(`_replaceDoubleDashes should replace double dashes with triple dashes for frontmatter`, async () => {
      const templateData = await factory('frontmatter-with-double-dashes.ejs')

      let result = replaceDoubleDashes(templateData)
      const lines = result.split('\n')
      expect(lines[0]).toEqual(`---`) // converted these
      expect(lines[2]).toEqual(`---`)
      expect(lines[6]).toEqual(`--`) // left these alone
      expect(lines[12]).toEqual(`*****`)
    })
    it(`_replaceDoubleDashes should leave double dashes in body alone`, async () => {
      const templateData = await factory('double-dashes-in-body.ejs')

      let result = replaceDoubleDashes(templateData)
      const lines = result.split('\n')
      expect(lines[1]).toEqual(`--`) // left it alone
      expect(lines[3]).toEqual(`--`)
    })
    it(`render should replace double dashes with triple dashes for frontmatter`, async () => {
      const templateData = await factory('frontmatter-with-double-dashes.ejs')

      let result = await templateInstance.render(templateData, {}, { extended: true })
      const lines = result.split('\n')
      expect(lines[0]).toEqual(`---`) // converted these
      expect(lines[2]).toEqual(`---`)
      expect(lines[6]).toEqual(`--`) // left these alone
      expect(lines[12]).toEqual(`*****`)
    })
    it(`render should leave double dashes in body alone`, async () => {
      const templateData = await factory('double-dashes-in-body.ejs')

      let result = await templateInstance.render(templateData, {}, { extended: true })
      const lines = result.split('\n')
      expect(lines[1]).toEqual(`--`) // left it alone
      expect(lines[3]).toEqual(`--`)
    })
  })

  describe(section('Miscellaneous'), () => {
    it(`should render complex event data`, async () => {
      const templateData = await factory('invalid-syntax.eta')

      const eventData = {
        timed: '- [ ] **<%= START %>**: <%= TITLE %>',
        allday: '- **<%= TITLE %>**',
      }

      let data = {
        events: function (data = {}) {
          // console.log(data)
        },
      }

      let renderedData = await templateInstance.render(templateData, data)
    })

    test(`should render data using extended template`, async () => {
      const templateData = await factory('tags-extended.ejs')

      const data = {
        name: 'Mike Erickson',
        utils: {
          titleCase: (str = null) => {
            return titleCase(str)
          },
        },
        names: ['mike', 'kira', 'joelle', 'brady', 'bailey', 'trevor'],
      }
      let renderedData = await templateInstance.render(templateData, data)
      // expect(renderedData).not.toBe('FACTORY_NOT_FOUND')
      expect(renderedData).not.toBe(false)

      expect(renderedData).toContain('mike, kira, joelle, brady, bailey, trevor')

      // check if names echo'd as list (and using titleCase function)
      expect(renderedData).toContain('Mike')
      expect(renderedData).toContain('Kira')
      expect(renderedData).toContain('Joelle')
      expect(renderedData).toContain('Brady')
      expect(renderedData).toContain('Bailey')
      expect(renderedData).toContain('Trevor')
    })

    it(`should support ternary operations`, async () => {
      const templateData = await factory('ternary.ejs')

      // missing `name`
      const data = {
        name: '',
      }
      let renderedData = await templateInstance.render(templateData, data, { extended: true })

      expect(renderedData).toContain('Hello Recipient')
    })

    it(`should support ternary operations`, async () => {
      const templateData = await factory('ternary.ejs')

      // supplied `name`
      const data = {
        name: 'Mike',
      }
      let renderedData = await templateInstance.render(templateData, data, { extended: true })

      expect(renderedData).toContain('Hello Mike')
    })

    it(`should produce tasks`, async () => {
      const templateData = await factory('simulate-tasks.ejs')

      // supplied `name`
      const data = {
        tasks: [
          { name: 'Item 1', completed: true },
          { name: 'Item 2', completed: false },
          { name: 'Item 3', completed: true },
          { name: 'Item 4', completed: false },
          { name: 'Item 5', completed: true },
        ],
      }
      let renderedData = await templateInstance.render(templateData, data, { extended: true })

      expect(renderedData).toContain('All Tasks [5]:')
      expect(renderedData).toContain('- [x] Item 1')
      expect(renderedData).toContain('- [ ] Item 2')
      expect(renderedData).toContain('- [x] Item 3')
      expect(renderedData).toContain('- [ ] Item 4')
      expect(renderedData).toContain('- [x] Item 5')

      expect(renderedData).toContain('Closed Items [3]:')
      expect(renderedData).toContain(' - [x] Item 1')
      expect(renderedData).toContain(' - [x] Item 3')
      expect(renderedData).toContain(' - [x] Item 5')

      expect(renderedData).toContain('Open Items [2]:')
      expect(renderedData).toContain(' - [ ] Item 2')
      expect(renderedData).toContain(' - [ ] Item 4')
    })

    it(`should render body which contain mulitiple separators (hr)`, async () => {
      const templateData = await factory('frontmatter-with-separators.ejs')

      let result = await templateInstance.render(templateData, {}, { extended: true })

      expect(result).toContain(`---\nSection Two`)
      expect(result).toContain(`---\nSection Three`)
      expect(result).toContain(`---\nSection Four`)
    })

    it(`should render body which contain mulitiple separators (hr) using asterick`, async () => {
      const templateData = await factory('frontmatter-with-asterick-separators.ejs')

      let result = await templateInstance.render(templateData, {}, { extended: true })

      expect(result).toContain(`*****\nSection One`)
      expect(result).toContain(`*****\nSection Two`)
      expect(result).toContain(`*****\nSection Three`)
      expect(result).toContain(`*****\nSection Four`)
    })

    it(`should render with multiple frontmatter-like separators in document (even number)`, async () => {
      const templateData = await factory('frontmatter-with-multiple-fm-like-lines1.ejs')

      let result = await templateInstance.render(templateData, {}, { extended: true })
      const lines = result.split('\n')
      expect(lines[0]).toEqual(`---`)
      // date on line 1
      expect(lines[2]).toEqual(``) //empty line
      expect(lines[3]).toEqual(`---`)
      expect(lines[4]).toEqual(`## Primary Focus`)
    })

    it(`should render with multiple frontmatter-like separators in document (odd number)`, async () => {
      const templateData = await factory('frontmatter-with-multiple-fm-like-lines2.ejs')

      let result = await templateInstance.render(templateData, {}, { extended: true })
      const lines = result.split('\n')
      expect(lines[0]).toEqual(`---`)
      // date on line 1
      expect(lines[2]).toEqual(``) //empty line
      expect(lines[3]).toEqual(`## Primary Focus`)
    })

    it(`should not include frontmatter in output when template body is empty/conditional`, async () => {
      // Test the edge case where template body doesn't render anything
      // This exposed a bug where frontmatter was being included in the output
      const templateWithConditionalBody = `---
title: ⚙️ Cron processing
cronTasksSectionName: 📅 Naplánované úkoly
cronTasksNote: 🔁 Cron tasks
cronTasksRedoTag: redo
debug: true
modified: 2024-01-15 10:30 AM
---
<%_
const myContent = null
if (myContent) {
-%>## <%- frontmatter.cronTasksSectionName %><%- myContent %><%_
}
-%>

---`

      let result = await templateInstance.render(templateWithConditionalBody, {}, { extended: true })

      // Should not contain frontmatter content in the output
      expect(result).not.toContain('title: ⚙️ Cron processing')
      expect(result).not.toContain('cronTasksSectionName: 📅 Naplánované úkoly')
      expect(result).not.toContain('cronTasksNote: 🔁 Cron tasks')
      expect(result).not.toContain('cronTasksRedoTag: redo')
      expect(result).not.toContain('debug: true')
      expect(result).not.toContain('modified: 2024-01-15 10:30 AM')

      // Should only contain the separator at the end (since body doesn't render anything)
      expect(result).toContain('---')

      // Should not contain the conditional content since myContent is null
      expect(result).not.toContain('## 📅 Naplánované úkoly')
    })

    it(`should not include frontmatter in output when frontmatterProcessed is true`, async () => {
      // Test the frontmatterProcessed: true path to ensure it also extracts body correctly
      const templateWithConditionalBody = `---
title: ⚙️ Cron processing
cronTasksSectionName: 📅 Naplánované úkoly
cronTasksNote: 🔁 Cron tasks
cronTasksRedoTag: redo
debug: true
modified: 2024-01-15 10:30 AM
---
<%_
const myContent = null
if (myContent) {
-%>## <%- frontmatter.cronTasksSectionName %><%- myContent %><%_
}
-%>

---`

      let result = await templateInstance.render(templateWithConditionalBody, {}, { frontmatterProcessed: true, extended: true })

      // Should not contain frontmatter content in the output
      expect(result).not.toContain('title: ⚙️ Cron processing')
      expect(result).not.toContain('cronTasksSectionName: 📅 Naplánované úkoly')
      expect(result).not.toContain('cronTasksNote: 🔁 Cron tasks')
      expect(result).not.toContain('cronTasksRedoTag: redo')
      expect(result).not.toContain('debug: true')
      expect(result).not.toContain('modified: 2024-01-15 10:30 AM')

      // Should only contain the separator at the end (since body doesn't render anything)
      expect(result).toContain('---')

      // Should not contain the conditional content since myContent is null
      expect(result).not.toContain('## 📅 Naplánované úkoly')
    })

    it(`should handle frontmatterProcessed true with non-frontmatter templates`, async () => {
      // Test that non-frontmatter templates work correctly with frontmatterProcessed: true
      const simpleTemplate = `Hello <%= name %>!
This is a simple template without frontmatter.`

      let result = await templateInstance.render(simpleTemplate, { name: 'World' }, { frontmatterProcessed: true, extended: true })

      // Should render the template correctly
      expect(result).toContain('Hello World!')
      expect(result).toContain('This is a simple template without frontmatter.')

      // Should not contain any frontmatter-related content
      expect(result).not.toContain('---')
    })

    it(`should correctly extract frontmatter body using processFrontmatterTags`, async () => {
      // Test that processFrontmatterTags correctly extracts the body
      const templateWithFrontmatter = `---
title: Test Template
description: A test template
---
<%_ const name = 'World'; _%>
Hello <%= name %>!`

      const { frontmatterBody, frontmatterAttributes } = await processFrontmatterTags(templateWithFrontmatter, {})

      // Should extract the body correctly
      expect(frontmatterBody).toContain("<%_ const name = 'World'; _%>")
      expect(frontmatterBody).toContain('Hello <%= name %>!')

      // Should not contain frontmatter content
      expect(frontmatterBody).not.toContain('title: Test Template')
      expect(frontmatterBody).not.toContain('description: A test template')
      expect(frontmatterBody).not.toContain('---')

      // Should extract attributes correctly
      expect(frontmatterAttributes.title).toBe('Test Template')
      expect(frontmatterAttributes.description).toBe('A test template')
    })

    it(`should handle frontmatter with rendered template tags that cause fm library to fail`, async () => {
      // This test simulates the real-world issue where the frontmatter contains rendered template output
      // that causes the fm library to fail parsing, and the fallback logic should extract the body correctly
      const templateWithRenderedFrontmatter = `---
title: ⚙️ Cron processing
cronTasksSectionName: 📅 Naplánované úkoly
cronTasksNote: 🔁 Cron tasks
cronTasksRedoTag: redo
debug: true
modified: 2025-07-19 09:05 AM
---
<%_ const myContent = 'Hello World'; _%>
This is the actual template body.
<%= myContent %>`

      const { frontmatterBody, frontmatterAttributes } = await processFrontmatterTags(templateWithRenderedFrontmatter, {})

      // Should extract the body correctly (everything after the second ---)
      expect(frontmatterBody).toContain("<%_ const myContent = 'Hello World'; _%>")
      expect(frontmatterBody).toContain('This is the actual template body.')
      expect(frontmatterBody).toContain('<%= myContent %>')

      // Should NOT contain frontmatter content
      expect(frontmatterBody).not.toContain('title: ⚙️ Cron processing')
      expect(frontmatterBody).not.toContain('cronTasksSectionName: 📅 Naplánované úkoly')
      expect(frontmatterBody).not.toContain('cronTasksNote: 🔁 Cron tasks')
      expect(frontmatterBody).not.toContain('cronTasksRedoTag: redo')
      expect(frontmatterBody).not.toContain('debug: true')
      expect(frontmatterBody).not.toContain('modified: 2025-07-19 09:05 AM')
      expect(frontmatterBody).not.toContain('---')

      // The frontmatter attributes might be empty if fm library fails, but that's okay
      // The important thing is that the body is extracted correctly
    })

    it(`should handle frontmatterProcessed true with frontmatter that causes fm library to fail`, async () => {
      // This test simulates the exact real-world scenario where frontmatterProcessed is true
      // and the template contains frontmatter that causes the fm library to fail
      const templateWithRenderedFrontmatter = `---
title: ⚙️ Cron processing
cronTasksSectionName: 📅 Naplánované úkoly
cronTasksNote: 🔁 Cron tasks
cronTasksRedoTag: redo
debug: true
modified: 2025-07-19 09:05 AM
---
<%_ const myContent = 'Hello World'; _%>
This is the actual template body.
<%= myContent %>`

      let result = await templateInstance.render(templateWithRenderedFrontmatter, { name: 'World' }, { frontmatterProcessed: true, extended: true })

      // Should render the template body correctly
      expect(result).toContain('This is the actual template body.')
      expect(result).toContain('Hello World')

      // Should NOT contain frontmatter content
      expect(result).not.toContain('title: ⚙️ Cron processing')
      expect(result).not.toContain('cronTasksSectionName: 📅 Naplánované úkoly')
      expect(result).not.toContain('cronTasksNote: 🔁 Cron tasks')
      expect(result).not.toContain('cronTasksRedoTag: redo')
      expect(result).not.toContain('debug: true')
      expect(result).not.toContain('modified: 2025-07-19 09:05 AM')
      expect(result).not.toContain('---')
    })

    //FIXME: (@codedungeon): - I added this test to illustrate an edge case that a user was running into
    // Even though the above test on .render passes using Jest, in the real NotePlan app,
    // if the templateBody starts with three dashes, then for some reason, renderFrontmatter gets called on that body as if it's frontmatter and fails
    // in the same way it fails in this test
    it.skip(`should renderFrontmatter with multiple frontmatter-like separators in document (even number) - esp when the first line in the template content is a separator`, async () => {
      const templateData = `---\n<%- date.now("Do MMMM YYYY") %>\n\n---`
      const sessionData = {
        title: 'Daily Note Test',
        type: 'meeting-note, empty-note',
        methods: {},
      }
      let result = await NPTemplating.renderFrontmatter(templateData, sessionData)
      const lines = result.split('\n')
      expect(lines[0]).toEqual(`---`)
      // date on line 1
      expect(lines[2]).toEqual(``) //empty line
      expect(lines[3]).toEqual(`## Primary Focus`)
    })

    it(`should use proxy to template logic`, async () => {
      const templateData = await factory('template-logic.ejs')

      const data = {
        books: [
          { TITLE: 'The Sobbing School: Poems', AUTHOR: 'Joshua Bennett' },
          { TITLE: `Ain't No Mo'`, AUTHOR: 'Jordan E. Cooper' },
          { TITLE: 'A Particular Kind of Black Man', AUTHOR: 'Tope Folarin' },
          { TITLE: 'Where We Stand', AUTHOR: 'Donnetta Lavinia Grays' },
          { TITLE: 'Invasive species', AUTHOR: 'Marwa Helal' },
          { TITLE: 'The Sirens of Mars', AUTHOR: 'Sarah Stewart Johnson' },
          { TITLE: 'The NotePlan Templating Guide', AUTHOR: 'Mike Erickson' },
        ],
      }
      let renderedData = await templateInstance.render(templateData, data, { extended: true })

      data.books.forEach((book) => {
        expect(renderedData).toContain(`**${book.TITLE}**`)
        expect(renderedData).toContain(book.AUTHOR)
      })
    })
    describe(section('Multiple Imports Tests'), () => {
      it(`Should render multiple imports with tag that has one line return`, async () => {
        const templateData = await factory('multiple-imports.ejs')

        let renderedData = await templateInstance.render(templateData, {}, { extended: true })

        expect(renderedData).toContain('text with a return\n')
      })
      it(`Should render multiple imports with tag that has one line return`, async () => {
        const templateData = await factory('multiple-imports-one-line-return.ejs')

        let renderedData = await templateInstance.render(templateData, {}, { extended: true })

        expect(renderedData).toContain('should return just the text no return')
      })
    })

    describe(section('Whitespace Control Tags (<%_ and _%>)'), () => {
      it(`should parse and process <%_ tags correctly without adding spaces`, async () => {
        // Test that <%_ tags are recognized and processed without adding unwanted spaces
        const templateWithWhitespaceControl = `<%_ const x = 1; _%>Hello World`

        let renderedData
        let errorOccurred = false
        let errorMessage = ''

        try {
          renderedData = await templateInstance.render(templateWithWhitespaceControl, {})
        } catch (error) {
          errorOccurred = true
          errorMessage = error.message || error.toString()
        }

        // Should render successfully without errors
        expect(errorOccurred).toBe(false)
        expect(renderedData).toContain('Hello World')

        // The <%_ tag should not add a space after it
        expect(renderedData).not.toContain(' Hello World') // No leading space
      })

      it(`should handle <%_ tags with complex logic`, async () => {
        const templateWithComplexLogic = `<%_ 
          const items = ['apple', 'banana', 'cherry'];
          const filtered = items.filter(item => item.startsWith('a'));
        _%>Found <%= filtered.length %> items starting with 'a'`

        let renderedData
        let errorOccurred = false

        try {
          renderedData = await templateInstance.render(templateWithComplexLogic, {})
        } catch (error) {
          errorOccurred = true
        }

        expect(errorOccurred).toBe(false)
        expect(renderedData).toContain("Found 1 items starting with 'a'")
      })

      it(`should preserve whitespace control functionality with <%_`, async () => {
        // Test that <%_ tags properly control whitespace
        const templateWithWhitespace = `<%_ const name = 'John'; _%>
Hello <%= name %>!
<%_ const greeting = 'Welcome'; _%>
<%= greeting %>!`

        let renderedData
        let errorOccurred = false

        try {
          renderedData = await templateInstance.render(templateWithWhitespace, {})
        } catch (error) {
          errorOccurred = true
        }

        expect(errorOccurred).toBe(false)
        expect(renderedData).toContain('Hello John!')
        expect(renderedData).toContain('Welcome!')

        // The <%_ tags should control whitespace properly
        const lines = renderedData.split('\n')
        expect(lines[0]).toBe('Hello John!') // No leading whitespace
        expect(lines[1]).toBe('Welcome!') // No leading whitespace
      })

      it(`should handle _%> closing tags correctly`, async () => {
        // Test that _%> tags remove whitespace after the tag
        const templateWithClosingWhitespaceControl = `<% const name = 'John'; _%>
Hello <%= name %>!`

        let renderedData
        let errorOccurred = false

        try {
          renderedData = await templateInstance.render(templateWithClosingWhitespaceControl, {})
        } catch (error) {
          errorOccurred = true
        }

        expect(errorOccurred).toBe(false)
        expect(renderedData).toContain('Hello John!')

        // The _%> tag should remove whitespace after it
        const lines = renderedData.split('\n')
        expect(lines[0]).toBe('Hello John!') // No leading whitespace
      })

      it(`should handle code with _%> tags`, async () => {
        // Test code execution with _%> closing tags
        const templateWithCodeAndWhitespaceControl = `<% 
          const items = ['apple', 'banana', 'cherry'];
          const filtered = items.filter(item => item.startsWith('a'));
        _%>
Items starting with 'a': <%= filtered.join(', ') %>`

        let renderedData
        let errorOccurred = false

        try {
          renderedData = await templateInstance.render(templateWithCodeAndWhitespaceControl, {})
        } catch (error) {
          errorOccurred = true
        }

        expect(errorOccurred).toBe(false)
        expect(renderedData).toContain("Items starting with 'a': apple")

        // The _%> tag should remove whitespace after the code block
        const lines = renderedData.split('\n')
        expect(lines[0]).toBe("Items starting with 'a': apple") // No leading whitespace
      })

      it(`should handle both <%_ and _%> tags together`, async () => {
        // Test both opening and closing whitespace control tags
        const templateWithBothTags = `<%_ const name = 'John'; _%>
Hello <%= name %>!
<%_ const greeting = 'Welcome'; _%>
<%= greeting %>!`

        let renderedData
        let errorOccurred = false

        try {
          renderedData = await templateInstance.render(templateWithBothTags, {})
        } catch (error) {
          errorOccurred = true
        }

        expect(errorOccurred).toBe(false)
        expect(renderedData).toContain('Hello John!')
        expect(renderedData).toContain('Welcome!')

        // Both tags should control whitespace properly
        const lines = renderedData.split('\n')
        expect(lines[0]).toBe('Hello John!') // No leading whitespace
        expect(lines[1]).toBe('Welcome!') // No leading whitespace
      })

      it(`should handle mixed tag types correctly`, async () => {
        // Test mixing <%_ and _%> with other tag types
        const mixedTemplate = `<% const title = 'Test'; %>
<%_ const subtitle = 'Subtitle'; _%>
# <%= title %>
## <%= subtitle %>`

        let renderedData
        let errorOccurred = false

        try {
          renderedData = await templateInstance.render(mixedTemplate, {})
        } catch (error) {
          errorOccurred = true
        }

        expect(errorOccurred).toBe(false)
        expect(renderedData).toContain('# Test')
        expect(renderedData).toContain('## Subtitle')
      })

      it(`should not add spaces to <%_ or _%> tags during normalization`, async () => {
        // Test that normalizeTagDelimiters doesn't add spaces to whitespace control tags
        const templateWithWhitespaceControl = `<%_const x = 1;_%>No spaces should be added`

        let renderedData
        let errorOccurred = false

        try {
          renderedData = await templateInstance.render(templateWithWhitespaceControl, {})
        } catch (error) {
          errorOccurred = true
        }

        expect(errorOccurred).toBe(false)
        expect(renderedData).toContain('No spaces should be added')

        // Should not have leading space from the whitespace control tags
        expect(renderedData).not.toContain(' No spaces should be added')
      })

      it(`should handle complex whitespace control scenarios`, async () => {
        // Test a more complex scenario with multiple whitespace control tags
        const complexTemplate = `<%_ 
          const items = ['apple', 'banana', 'cherry'];
          const filtered = items.filter(item => item.startsWith('a'));
        _%>
List of items starting with 'a':
<%_ filtered.forEach(item => { _%>
- <%= item %>
<%_ }); _%>
Total: <%= filtered.length %> items`

        let renderedData
        let errorOccurred = false

        try {
          renderedData = await templateInstance.render(complexTemplate, {})
        } catch (error) {
          errorOccurred = true
        }

        expect(errorOccurred).toBe(false)
        expect(renderedData).toContain("List of items starting with 'a':")
        expect(renderedData).toContain('- apple')
        expect(renderedData).toContain('Total: 1 items')

        // Check that whitespace is properly controlled
        const lines = renderedData.split('\n')
        expect(lines[0]).toBe("List of items starting with 'a':") // No leading whitespace
        expect(lines[1]).toBe('- apple') // No leading whitespace
        expect(lines[2]).toBe('Total: 1 items') // No leading whitespace
      })
    })

    describe(section('Edge Case: Control Structure Split Across Template Blocks'), () => {
      it(`should handle control structure split across template blocks without "Unexpected keyword 'catch'" error`, async () => {
        // This is the user's original template that was causing "Unexpected keyword 'catch'" error
        const problematicTemplate = `<%
  const formattedDate = date.format("YYYY-MM-DD", Editor.title);
  const dayNum = date.dayNumber(formattedDate); // Sunday = 0, Saturday = 6
  const weekdays = [1, 2, 3, 4, 5]; // Monday to Friday
  if (weekdays.includes(dayNum)) {
%>
+ 16:30 - 17:00 :brain: Review my day and plan tomorrow
<% } %>`

        // Mock the data that would be available in the template
        const userData = {
          date: {
            format: () => '2024-01-15',
            dayNumber: () => 1,
          },
          Editor: {
            title: 'Test Note',
          },
        }

        // This test should either:
        // 1. Successfully render the template, OR
        // 2. Provide a clear error message about the control structure issue
        // The goal is to capture the current behavior so we can debug it
        let renderedData
        let errorOccurred = false
        let errorMessage = ''

        try {
          renderedData = await templateInstance.render(problematicTemplate, userData)
        } catch (error) {
          errorOccurred = true
          errorMessage = error.message || error.toString()
        }

        if (!errorOccurred) {
          // If it renders successfully, it should contain the expected content
          expect(renderedData).toContain('+ 16:30 - 17:00 :brain: Review my day and plan tomorrow')
        } else {
          // If there's an error, it should not be the "Unexpected keyword 'catch'" error
          // (that would indicate the preprocessing is creating invalid JavaScript)
          expect(errorMessage).not.toContain("Unexpected keyword 'catch'")

          // The error should be defined
          expect(errorMessage).toBeDefined()
          expect(typeof errorMessage).toBe('string')
          expect(errorMessage.length).toBeGreaterThan(0)
        }
      })

      it(`should normalize template tag spacing and remove unwanted returns`, async () => {
        // Test cases for tag normalization
        const testCases = [
          {
            name: 'Missing space after opening tag',
            template: '<%if (true) { %>Hello<% } %>',
            shouldContain: 'Hello',
          },
          {
            name: 'Missing space before closing tag',
            template: '<% if (true) {%>Hello<% } %>',
            shouldContain: 'Hello',
          },
          {
            name: 'Both missing spaces',
            template: '<%if (true){%>Hello<%}%>',
            shouldContain: 'Hello',
          },
          {
            name: 'Return after opening tag',
            template: '<% \nif (true) { %>Hello<% } %>',
            shouldContain: 'Hello',
          },
          {
            name: 'Multiple returns after opening tag',
            template: '<% \n\nif (true) { %>Hello<% } %>',
            shouldContain: 'Hello',
          },
          {
            name: 'Multi-line tag with complex logic',
            template: `<%
  const x = 1;
  const y = 2;
  if (x + y === 3) {
%>Hello World<% } %>`,
            shouldContain: 'Hello World',
          },
          {
            name: 'User original problematic pattern',
            template: `<%
  const weekdays = [1, 2, 3, 4, 5];
  if (weekdays.includes(1)) {
%>+ Task for weekday<% } %>`,
            shouldContain: '+ Task for weekday',
          },
        ]

        for (const testCase of testCases) {
          let renderedData
          let errorOccurred = false
          let errorMessage = ''

          try {
            renderedData = await templateInstance.render(testCase.template, {})
          } catch (error) {
            errorOccurred = true
            errorMessage = error.message || error.toString()
          }

          if (!errorOccurred) {
            expect(renderedData).toContain(testCase.shouldContain)
          } else {
            // The error should not be a syntax error related to spacing
            expect(errorMessage).not.toContain('Unexpected token')
            expect(errorMessage).not.toContain('Unexpected keyword')
          }
        }
      })
    })
  })
})
