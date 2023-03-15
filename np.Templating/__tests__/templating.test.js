/* eslint-disable */
import { CustomConsole } from '@jest/console' // see note below
import { simpleFormatter, DataStore /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'

import path from 'path'
import colors from 'chalk'
import fs from 'fs/promises'
import { existsSync } from 'fs'

import TemplatingEngine from '../lib/TemplatingEngine'
import DateModule from '../lib/support/modules/DateModule'
import TimeModule from '../lib/support/modules/TimeModule'

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
  global.DataStore = DataStore
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging (or 'none' for none)
})

describe(`${PLUGIN_NAME}`, () => {
  let templateInstance
  beforeEach(() => {
    templateInstance = new TemplatingEngine(DEFAULT_TEMPLATE_CONFIG)
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

      let result = await templateInstance._replaceDoubleDashes(templateData, {}, { extended: true })
      const lines = result.split('\n')
      expect(lines[0]).toEqual(`---`) // converted these
      expect(lines[2]).toEqual(`---`)
      expect(lines[6]).toEqual(`--`) // left these alone
      expect(lines[12]).toEqual(`*****`)
    })
    it(`_replaceDoubleDashes should leave double dashes in body alone`, async () => {
      const templateData = await factory('double-dashes-in-body.ejs')

      let result = await templateInstance._replaceDoubleDashes(templateData, {}, { extended: true })
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

      expect(result).toContain(`---\nSection One`)
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
  })
})
