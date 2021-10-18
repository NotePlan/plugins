/* eslint-disable */

import path from 'path'
import colors from 'chalk'
import fs from 'fs/promises'
import { existsSync } from 'fs'

import Templating from '../src/Templating'
import { DEFAULT_TEMPLATE_CONFIG } from '../src/Templating'
import helpers from '../custom/template-helpers'

const PLUGIN_NAME = `${colors.yellow('np.Templating')}`
const section = colors.cyan

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

describe(`${PLUGIN_NAME}`, () => {
  let templateInstance
  beforeEach(() => {
    templateInstance = new Templating(DEFAULT_TEMPLATE_CONFIG)
  })

  describe(section('DateModule'), () => {
    test(`should render data using variable`, async () => {
      const templateData = await factory('simple.ejs')

      let renderedData = await templateInstance.render(templateData, { name: 'Mike' })
      expect(templateData).not.toBe('FACTORY_NOT_FOUND')
      expect(renderedData).not.toBe(false)
      expect(renderedData).toContain(`console.log('Hello Mike')\n`)
    })

    test(`should render data using inline function`, async () => {
      const templateData = await factory('simple-function.ejs')

      const data = {
        helloWorld: (param = '') => {
          return param
        },
      }

      let renderedData = await templateInstance.render(templateData, data)

      expect(templateData).not.toBe('FACTORY_NOT_FOUND')
      expect(renderedData).not.toBe(false)
      expect(renderedData).toContain('Hello via function call: test')
    })

    test(`should render data using extended template`, async () => {
      const templateData = await factory('extended.ejs')

      const data = {
        name: 'Mike Erickson',
        titleCase: (str = null) => {
          return titleCase(str)
        },
        names: ['mike', 'kira', 'joelle', 'brady', 'bailey', 'trevor'],
      }
      let renderedData = await templateInstance.render(templateData, data)

      expect(templateData).not.toBe('FACTORY_NOT_FOUND')
      expect(renderedData).not.toBe(false)

      expect(renderedData).toContain('mike, kira, joelle, brady, bailey, trevor')

      // check if names echo'd as list (and using titleCase function)
      expect(renderedData).toContain('Mike\n')
      expect(renderedData).toContain('Kira\n')
      expect(renderedData).toContain('Joelle\n')
      expect(renderedData).toContain('Brady\n')
      expect(renderedData).toContain('Bailey\n')
      expect(renderedData).toContain('Trevor')
    })

    test(`should render default date object`, async () => {
      const templateData = await factory('dates.ejs')

      let renderedData = await templateInstance.render(templateData)

      let currentDate = helpers().date.now()

      expect(templateData).not.toBe('FACTORY_NOT_FOUND')
      expect(renderedData).toContain(`Current Date: ${currentDate}`)
    })

    test(`should render formatted date object`, async () => {
      const templateData = await factory('dates.ejs')

      let renderedData = await templateInstance.render(templateData)

      let currentDate = helpers().date.now('YYYY-MM-DD')

      expect(templateData).not.toBe('FACTORY_NOT_FOUND')
      expect(renderedData).toContain(`Current Date: ${currentDate}`)
    })

    test(`should render formatted date object adding 1 day`, async () => {
      const templateData = await factory('dates.ejs')

      let renderedData = await templateInstance.render(templateData)

      let currentDate = helpers().date.now('YYYY-MM-DD', 1)

      expect(templateData).not.toBe('FACTORY_NOT_FOUND')
      expect(renderedData).toContain(`Add Day: ${currentDate}`)
    })

    test(`should render formatted date object subtracting 1 day`, async () => {
      const templateData = await factory('dates.ejs')

      let renderedData = await templateInstance.render(templateData)

      let currentDate = helpers().date.now('YYYY-MM-DD', -1)

      expect(templateData).not.toBe('FACTORY_NOT_FOUND')
      expect(renderedData).toContain(`Subtract Day: ${currentDate}`)
    })

    test(`should render tomorrow`, async () => {
      const templateData = await factory('dates.ejs')

      let renderedData = await templateInstance.render(templateData)

      let currentDate = helpers().date.tomorrow()

      expect(templateData).not.toBe('FACTORY_NOT_FOUND')
      expect(renderedData).toContain(`Tomorrow: ${currentDate}`)
    })

    test(`should render yesterday`, async () => {
      const templateData = await factory('dates.ejs')

      let renderedData = await templateInstance.render(templateData)

      let currentDate = helpers().date.yesterday()

      expect(templateData).not.toBe('FACTORY_NOT_FOUND')
      expect(renderedData).toContain(`Yesterday: ${currentDate}`)
    })

    test(`should render weekday`, async () => {
      const templateData = await factory('dates.ejs')

      let renderedData = await templateInstance.render(templateData)

      let currentDate = helpers().date.weekday('YYYY-MM-DD', 3)

      expect(templateData).not.toBe('FACTORY_NOT_FOUND')
      expect(renderedData).toContain(`Weekday (Add): ${currentDate}`)
    })

    test(`should render weekday`, async () => {
      const templateData = await factory('dates.ejs')

      let renderedData = await templateInstance.render(templateData)

      let currentDate = helpers().date.weekday('YYYY-MM-DD', -3)

      expect(templateData).not.toBe('FACTORY_NOT_FOUND')
      expect(renderedData).toContain(`Weekday (Subtract): ${currentDate}`)
    })

    test(`should process various date formats`, async () => {
      const templateData = await factory('dates-various.ejs')

      let renderedData = await templateInstance.render(templateData)

      expect(templateData).not.toBe('FACTORY_NOT_FOUND')
      expect(renderedData).not.toContain('INVALID_DATE_FORMAT')
      expect(renderedData).not.toContain('Invalid Date')

      expect(typeof renderedData).toBe('string')

      // now validate results
      let now = helpers().date.now('Do MMMM YYYY')

      expect(renderedData).toContain('Date now: ' + helpers().date.now())
      expect(renderedData).toContain('Date now with format: ', helpers().date.now('Do MMMM YYYY'))

      expect(renderedData).toContain('Last week: ' + helpers().date.now('dddd Do MMMM YYYY', -7))
      expect(renderedData).toContain('Today: ' + helpers().date.now('dddd Do MMMM YYYY, ddd'))
      expect(renderedData).toContain('Next week: ' + helpers().date.now('dddd Do MMMM YYYY', 7))

      expect(renderedData).toContain('Last month: ' + helpers().date.now('YYYY-MM-DD', 'P-1M'))
      expect(renderedData).toContain('Next year: ' + helpers().date.now('YYYY-MM-DD', 'P1Y'))

      expect(renderedData).toContain('Date tomorrow with format: ' + helpers().date.tomorrow('Do MMMM YYYY'))

      expect(renderedData).toContain("This week's monday: " + helpers().date.weekday('YYYY-MM-DD', 0))
      expect(renderedData).toContain('Next monday: ' + helpers().date.weekday('YYYY-MM-DD', 7))

      expect(renderedData).toContain('Date yesterday with format: ' + helpers().date.yesterday('Do MMMM YYYY'))
    })

    test.skip('should use date format from configuration', () => {})
  })

  describe(section('TimeModule'), () => {
    test.skip('should use time format from configuration', () => {})
  })

  describe(section('UserModule'), () => {
    test.skip('should display user information (from configuration)', () => {})
  })

  describe(section('UtilsModule'), () => {})

  describe(section('WebModule'), () => {
    test.skip('should return quote', () => {})

    test.skip('should return affirmation', () => {})

    test.skip('should return advice', () => {})

    test.skip('should return weather', () => {})

    test('should return service item', () => {})
  })

  describe(section('Error Handling'), () => {
    test(`should return error with missing object`, async () => {
      const templateData = await factory('missing-object.ejs')

      let renderedData = await templateInstance.render(templateData)

      // expect(renderedData.status).toEqual('fail')
      expect(renderedData.message).toContain('name2 is not defined')
    })

    test(`should return error with invalid syntax`, async () => {
      const templateData = await factory('invalid-syntax.ejs')

      let renderedData = await templateInstance.render(templateData)

      expect(renderedData.message).toContain(`Could not find matching close tag for \"<%\".`)
    })

    test(`should use templating error handler`, async () => {
      expect(true).toEqual(true)
    })
  })

  describe(section('Custom Tags'), () => {
    test(`should use 'note' object tags (pending)`, async () => {
      const templateData = await factory('invalid-syntax.ejs')

      let renderedData = await templateInstance.render(templateData)

      expect(renderedData.message).toContain('Could not find matching close tag for')
    })

    test.skip(`should use custom tags (pending)`, async () => {
      const templateData = await factory('tags.ejs')

      let renderedData = await templateInstance.render(templateData, { name: 'Mike' }, { tags: ['{{', '}}'] })

      expect(renderedData).toContain('Mike')
    })

    test.skip(`should use custom tags with function`, async () => {
      const templateData = await factory('tags-function.ejs')

      let data = {
        helloWorld: () => {
          return 'hello world'
        },
        titleCase: (str = null) => {
          return titleCase(str)
        },
      }
      let renderedData = await template.render(templateData, data, { tags: ['{{', '}}'] })

      expect(renderedData).toContain('hello world')

      expect(renderedData).toContain('Hello World')
    })
  })

  describe(section('Miscellaneous'), () => {
    test(`should render complex event data`, async () => {
      const templateData = await factory('invalid-syntax.eta')

      const eventData = {
        timed: '- [ ] **<%= START %>**: <%= TITLE %>',
        allday: '- **<%= TITLE %>**',
      }

      let data = {
        events: function (data = {}) {
          console.log(data)
        },
      }

      let renderedData = await templateInstance.render(templateData, data)

      console.log(renderedData)
    })

    test.skip(`should render data using extended template`, async () => {
      const templateData = await factory('tags-extended.eta')

      const data = {
        name: 'Mike Erickson',
        titleCase: (str = null) => {
          return titleCase(str)
        },
        names: ['mike', 'kira', 'joelle', 'brady', 'bailey', 'trevor'],
      }
      let renderedData = await templateInstance.render(templateData, data, { extended: true, tags: ['{{', '}}'] })

      expect(templateData).not.toBe('FACTORY_NOT_FOUND')
      expect(renderedData).not.toBe(false)

      expect(renderedData).toContain('mike, kira, joelle, brady, bailey, trevor')

      // check if names echo'd as list (and using titleCase function)
      expect(renderedData).toContain('Mike\n')
      expect(renderedData).toContain('Kira\n')
      expect(renderedData).toContain('Joelle\n')
      expect(renderedData).toContain('Brady\n')
      expect(renderedData).toContain('Bailey\n')
      expect(renderedData).toContain('Trevor')
    })

    test(`should support ternary operations`, async () => {
      const templateData = await factory('ternary.ejs')

      // missing `name`
      const data = {
        name: '',
      }
      let renderedData = await templateInstance.render(templateData, data, { extended: true })

      expect(renderedData).toContain('Hello Recipient')
    })

    test(`should support ternary operations`, async () => {
      const templateData = await factory('ternary.ejs')

      // supplied `name`
      const data = {
        name: 'Mike',
      }
      let renderedData = await templateInstance.render(templateData, data, { extended: true })

      expect(renderedData).toContain('Hello Mike')
    })

    test(`should produce tasks`, async () => {
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

    test(`should use proxy to template logic`, async () => {
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
