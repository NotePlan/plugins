/* eslint-disable */
// @flow

import colors from 'chalk'
import FrontmatterModule from '../lib/support/modules/FrontmatterModule'
import { getAttributes, getBody, getSanitizedFmParts } from '@helpers/NPFrontMatter'

import { factory } from './testUtils'

const PLUGIN_NAME = `📙 ${colors.yellow('np.Templating')}`
const section = colors.blue
const block = colors.magenta.green
const method = colors.magenta.bold

describe(`${PLUGIN_NAME}`, () => {
  describe(section('FrontmatterModule'), () => {
    it(`should return true using ${method('.isFrontmatterTemplate')}`, async () => {
      const data = await factory('frontmatter-minimal.ejs')

      let result = new FrontmatterModule().isFrontmatterTemplate(data)

      expect(result).toEqual(true)
    })

    it(`should return false using ${method('.isFrontmatterTemplate')}`, async () => {
      const data = `@Templates\nHello World`

      let result = new FrontmatterModule().isFrontmatterTemplate(data)

      expect(result).toEqual(false)
    })

    it(`should extract frontmatter attributes using ${method('.attributes')}`, async () => {
      const data = await factory('frontmatter-minimal.ejs')

      let frontmatterAttributes = new FrontmatterModule().attributes(data)

      const keys = Object.keys(frontmatterAttributes)

      expect(keys).toContain('title')
      expect(frontmatterAttributes?.title).toContain('Test template')

      expect(keys).toContain('name')
      expect(frontmatterAttributes?.name).toContain('Mike Erickson')
    })

    it(`should extract frontmatter body using ${method('.body')}`, async () => {
      const data = await factory('frontmatter-minimal.ejs')

      let frontmatterBlock = new FrontmatterModule().body(data)

      expect(frontmatterBlock).toContain('Hello World')
    })

    it(`should ${method('.parse')} template`, async () => {
      const data = await factory('frontmatter-minimal.ejs')

      const result = new FrontmatterModule().parse(data)

      expect(result.hasOwnProperty('attributes')).toEqual(true)
      expect(result.hasOwnProperty('body')).toEqual(true)
      expect(result.hasOwnProperty('bodyBegin')).toEqual(true)
    })

    it(`should be valid frontmatter have supplied attributes`, async () => {
      const data = await factory('frontmatter-minimal.ejs')

      const result = new FrontmatterModule().parse(data)

      expect(result.attributes.hasOwnProperty('name')).toEqual(true)
      expect(result.attributes.name).toEqual('Mike Erickson')
    })

    it(`should contain template in 'body' property when using ${method('.parse')} method`, async () => {
      const data = await factory('frontmatter-extended.ejs')

      const result = new FrontmatterModule().parse(data)

      expect(result.hasOwnProperty('body')).toEqual(true)
      expect(result.body).toContain('<%= name %>')
      expect(result.body).toContain('<%= phone %>')
      expect(result.body).toContain('<%= modified %>')
    })

    it(`should extract template attributes using ${method('.attributes')}`, async () => {
      const data = await factory('frontmatter-extended.ejs')

      const result = new FrontmatterModule().attributes(data)

      expect(typeof result).toEqual('object')
      expect(result.title).toEqual('Test Sample')
    })

    it(`should extract template attributes using ${method('.body')}`, async () => {
      const data = await factory('frontmatter-extended.ejs')

      const result = new FrontmatterModule().body(data)

      expect(typeof result).toEqual('string')
      expect(result).toContain('<%= name %>')
    })

    it(`should extract quick note properties`, async () => {
      const data = await factory('frontmatter-quick-note.ejs')

      const body = new FrontmatterModule().body(data)
      const attrs = new FrontmatterModule().attributes(data)

      expect(body.length).toBeGreaterThan(0)
      expect(Object.keys(attrs).length).toBeGreaterThan(0)

      expect(attrs?.newNoteTitle).toEqual('Javolin <%- meetingName %> <%- date8601() %>')
    })

    it(`should not parse attributes with illegal characters`, async () => {
      const data = await factory('frontmatter-illegal-attribute.ejs')

      const attrs = new FrontmatterModule().attributes(data)
      const keys = Object.keys(attrs)

      expect(keys.length).toEqual(0)
    })

    it(`should return body which contain mulitiple separators (hr)`, async () => {
      const data = await factory('frontmatter-with-separators.ejs')

      const result = new FrontmatterModule().body(data)

      expect(result).toContain(`---\nSection One`)
      expect(result).toContain(`---\nSection Two`)
      expect(result).toContain(`---\nSection Three`)
      expect(result).toContain(`---\nSection Four`)
    })

    it(`should return body which contain mulitiple separators (hr) using asterick`, async () => {
      const data = await factory('frontmatter-with-asterick-separators.ejs')

      const result = new FrontmatterModule().body(data)

      expect(result).toContain(`*****\nSection One`)
      expect(result).toContain(`*****\nSection Two`)
      expect(result).toContain(`*****\nSection Three`)
      expect(result).toContain(`*****\nSection Four`)
    })

    it(`should get frontmatter text`, async () => {
      const data = await factory('frontmatter-minimal.ejs')
      const testFrontmatterBlock = '---\ntitle: Test template\nname: Mike Erickson\n---\n'

      const frontmatterBlock = new FrontmatterModule().getFrontmatterText(data)

      expect(frontmatterBlock).toEqual(testFrontmatterBlock)
    })

    it(`should should parse YML formatted with indented attributes`, async () => {
      const data = await factory('frontmatter-indented.ejs')

      const frontmatterAttributes = new FrontmatterModule().attributes(data)

      const result = {
        title: 'indented',
        key: ['value1', 'value2'],
      }

      expect(result).toEqual(frontmatterAttributes)
    })

    it(`should should parse YML formatted with nested attributes`, async () => {
      const data = await factory('frontmatter-yml.ejs')

      const frontmatterAttributes = new FrontmatterModule().attributes(data)

      const result = {
        title: 'myTitle',
        key: {
          subKey: ['subValue1', 'subValue2', 'codedungeon.np.Templating'],
        },
      }

      expect(result).toEqual(frontmatterAttributes)
    })

    it(`should should parse YML using practical example`, async () => {
      const data = await factory('frontmatter-practical.ejs')

      const frontmatterAttributes = new FrontmatterModule().attributes(data)

      const result = {
        title: 'practical',
        triggers: {
          onEdit: ['jgclark.RepeatExtensions.generateRepeats', 'codedungeon.np.Templating'],
          onOpen: ['jgclark.DailyThing.tidyUp'],
        },
      }

      expect(result).toEqual(frontmatterAttributes)
    })

    describe(`${block('.convertProjectNoteToFrontmatter')}`, () => {
      it('should return -1', async () => {
        const result = new FrontmatterModule().convertProjectNoteToFrontmatter('')

        expect(result).toEqual(-1)
      })

      it('should return -2', async () => {
        const result = new FrontmatterModule().convertProjectNoteToFrontmatter('Test')

        expect(result).toEqual(-2)
      })

      it('should return -2', async () => {
        const note = await factory('frontmatter-convert-success.md')

        const result = new FrontmatterModule().convertProjectNoteToFrontmatter(note)

        expect(result).toEqual(-3)
      })

      it(`should convert project note to frontmatter format`, async () => {
        const note = await factory('frontmatter-convert-project-note.md')

        const newNote = await factory('frontmatter-convert-success.md')

        const result = new FrontmatterModule().convertProjectNoteToFrontmatter(note)

        expect(result).toEqual(newNote)
      })
    })
  })
})
