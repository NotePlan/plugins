/* eslint-disable */
// @flow

import colors from 'chalk'
import FrontmatterModule from '../lib/support/modules/FrontmatterModule'
import { getAttributes, getBody } from '@helpers/NPFrontMatter'

import { factory } from './testUtils'

const PLUGIN_NAME = `📙 ${colors.yellow('np.Templating')}`
const section = colors.blue
const block = colors.magenta.green
const method = colors.magenta.bold

describe(`${PLUGIN_NAME}`, () => {
  beforeEach(() => {
    global.DataStore = {
      settings: { _logLevel: 'none' },
    }
  })
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

    describe(`${block('.getValuesForKey')}`, () => {
      it('should return JSON string of values for a given tag', async () => {
        // Mock getValuesForFrontmatterTag using jest.spyOn
        const NPFrontMatter = require('@helpers/NPFrontMatter')
        const mockGetValues = jest.spyOn(NPFrontMatter, 'getValuesForFrontmatterTag')
        mockGetValues.mockResolvedValue(['value1', 'value2', 'value3'])

        const frontmatterModule = new FrontmatterModule()
        const result = await frontmatterModule.getValuesForKey('testTag')

        expect(result).toEqual('["value1","value2","value3"]')

        // Restore the mock
        mockGetValues.mockRestore()
      })

      it('should return empty string on error', async () => {
        // Mock getValuesForFrontmatterTag to throw an error
        const NPFrontMatter = require('@helpers/NPFrontMatter')
        const mockGetValues = jest.spyOn(NPFrontMatter, 'getValuesForFrontmatterTag')
        mockGetValues.mockRejectedValue(new Error('Test error'))

        const frontmatterModule = new FrontmatterModule()
        const result = await frontmatterModule.getValuesForKey('testTag')

        expect(result).toEqual('')

        // Restore the mock
        mockGetValues.mockRestore()
      })
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

    describe(`${block('.getFrontMatterAttributes')}`, () => {
      it('should return frontmatter attributes from a note', () => {
        const mockNote = {
          frontmatterAttributes: {
            title: 'Test Note',
            status: 'active',
          },
        }

        const frontmatterModule = new FrontmatterModule()
        const result = frontmatterModule.getFrontMatterAttributes(mockNote)

        expect(result).toEqual({
          title: 'Test Note',
          status: 'active',
        })
      })

      it('should return empty object when note has no frontmatter attributes', () => {
        const mockNote = {
          frontmatterAttributes: null,
        }

        const frontmatterModule = new FrontmatterModule()
        const result = frontmatterModule.getFrontMatterAttributes(mockNote)

        expect(result).toEqual({})
      })
    })

    describe(`${block('.updateFrontMatterVars')}`, () => {
      it('should call the NPFrontMatter updateFrontMatterVars function', () => {
        // Mock updateFrontMatterVars
        const NPFrontMatter = require('@helpers/NPFrontMatter')
        const mockUpdate = jest.spyOn(NPFrontMatter, 'updateFrontMatterVars')
        mockUpdate.mockReturnValue(true)

        const mockNote = { filename: 'test.md' }
        const mockAttributes = { status: 'completed' }

        const frontmatterModule = new FrontmatterModule()
        const result = frontmatterModule.updateFrontMatterVars(mockNote, mockAttributes, false)

        expect(mockUpdate).toHaveBeenCalledWith(mockNote, mockAttributes, false)
        expect(result).toBe(true)

        // Restore the mock
        mockUpdate.mockRestore()
      })
    })

    describe(`${block('.updateFrontmatterAttributes')}`, () => {
      it('should be an alias for updateFrontMatterVars', () => {
        const mockNote = { frontmatterAttributes: {} }
        const mockAttributes = { title: 'Test', status: 'active' }

        const frontmatterModule = new FrontmatterModule()
        const updateSpy = jest.spyOn(frontmatterModule, 'updateFrontMatterVars').mockReturnValue(true)

        const result = frontmatterModule.updateFrontmatterAttributes(mockNote, mockAttributes)

        expect(updateSpy).toHaveBeenCalledWith(mockNote, mockAttributes, false)
        expect(result).toBe(true)

        updateSpy.mockRestore()
      })
    })

    describe(`${block('.properties')}`, () => {
      it('should return all frontmatter properties from a note', () => {
        const mockNote: any = {
          frontmatterAttributes: {
            title: 'Test Note',
            status: 'active',
            priority: 'high',
          },
        }

        const frontmatterModule = new FrontmatterModule()
        const result = frontmatterModule.properties(mockNote)

        expect(result).toEqual({
          title: 'Test Note',
          status: 'active',
          priority: 'high',
        })
      })

      it('should return empty object when note has no frontmatter', () => {
        const mockNote: any = {
          frontmatterAttributes: {},
        }

        const frontmatterModule = new FrontmatterModule()
        const result = frontmatterModule.properties(mockNote)

        expect(result).toEqual({})
      })

      it('should handle null note gracefully', () => {
        const frontmatterModule = new FrontmatterModule()
        const result = frontmatterModule.properties(null)

        expect(result).toEqual({})
      })

      it('should use Editor.note as default when no note provided', () => {
        // Mock Editor.note
        global.Editor = {
          note: {
            frontmatterAttributes: {
              title: 'Editor Note',
              status: 'current',
            },
          },
        }

        const frontmatterModule = new FrontmatterModule()
        const result = frontmatterModule.properties()

        expect(result).toEqual({
          title: 'Editor Note',
          status: 'current',
        })

        // Clean up
        delete global.Editor
      })
    })

    describe(`${block('Integration: Template with frontmatter methods')}`, () => {
      it('should preserve frontmatter methods when template has frontmatter', () => {
        // Test the real-world issue: when a template has frontmatter AND uses frontmatter.* methods,
        // the frontmatter object should retain its methods while also having the attributes

        // Mock the integrateFrontmatterData function behavior
        const { integrateFrontmatterData } = require('../lib/engine/frontmatterProcessor')

        // Simulate the render data that would be created by TemplatingEngine
        const renderData = {
          frontmatter: new FrontmatterModule(), // This is what TemplatingEngine creates
        }

        // Check initial state
        console.log('DEBUG: Initial frontmatter type:', typeof renderData.frontmatter)
        console.log('DEBUG: Initial frontmatter.getValuesForKey:', typeof renderData.frontmatter.getValuesForKey)
        console.log('DEBUG: Initial frontmatter.updateFrontmatterAttributes:', typeof renderData.frontmatter.updateFrontmatterAttributes)

        // Simulate frontmatter attributes extracted from template
        const frontmatterData = {
          title: 'Template title',
          status: 'in progress',
          priority: 'high',
        }

        // This is what happens during template processing
        const result = integrateFrontmatterData(renderData, frontmatterData)

        console.log('DEBUG: After integration frontmatter type:', typeof result.frontmatter)
        console.log('DEBUG: After integration frontmatter.getValuesForKey:', typeof result.frontmatter.getValuesForKey)
        console.log('DEBUG: After integration frontmatter.updateFrontmatterAttributes:', typeof result.frontmatter.updateFrontmatterAttributes)
        console.log('DEBUG: After integration frontmatter.title:', result.frontmatter.title)

        // The frontmatter object should still have methods
        expect(typeof result.frontmatter.updateFrontmatterAttributes).toBe('function')
        expect(typeof result.frontmatter.getFrontMatterAttributes).toBe('function')
        expect(typeof result.frontmatter.getValuesForKey).toBe('function')
        expect(typeof result.frontmatter.properties).toBe('function')

        // AND it should also have the attributes
        expect(result.frontmatter.title).toBe('Template title')
        expect(result.frontmatter.status).toBe('in progress')
        expect(result.frontmatter.priority).toBe('high')
      })

      it('should handle case where no frontmatter module exists initially', () => {
        const { integrateFrontmatterData } = require('../lib/engine/frontmatterProcessor')

        // Simulate render data without existing frontmatter module
        const renderData = {}

        // Simulate frontmatter attributes extracted from template
        const frontmatterData = {
          title: 'Template title',
          status: 'active',
        }

        // This should fall back to just setting the attributes
        const result = integrateFrontmatterData(renderData, frontmatterData)

        // Should have the attributes but no methods (fallback behavior)
        expect(result.frontmatter.title).toBe('Template title')
        expect(result.frontmatter.status).toBe('active')
        expect(result.frontmatter.updateFrontmatterAttributes).toBeUndefined()
      })
    })
  })
})
