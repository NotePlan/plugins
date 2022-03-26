/* eslint-disable */

import colors from 'chalk'
import FrontmatterModule from '../lib/support/modules/FrontmatterModule'
import { getAttributes, getBody } from '../lib/support/modules/FrontmatterModule'

import { factory } from './testUtils'

export const DEFAULT_TEMPLATE_CONFIG = {
  locale: 'en-US',
  dateFormat: 'YYYY-MM-DD',
  timeFormat: 'h:mm A',
  timestampFormat: 'YYYY-MM-DD h:mm:ss A',
  userFirstName: '',
  userLastName: '',
  userPhone: '',
  userEmail: '',
  // $FlowFixMe
  services: {},
}

const PLUGIN_NAME = `📙 ${colors.yellow('np.Templating')}`
const section = colors.blue
const method = colors.magenta.bold

describe(`${PLUGIN_NAME}`, () => {
  describe(section('FrontmatterModule'), () => {
    it(`should return true when frontmatter template supplied`, async () => {
      const data = await factory('frontmatter-minimal.ejs')

      let result = new FrontmatterModule().isFrontmatterTemplate(data)

      expect(result).toEqual(true)
    })

    it(`should extract frontmatter block`, async () => {
      const data = await factory('frontmatter-minimal.ejs')

      let frontmatterBlock = new FrontmatterModule().getFrontmatterBlock(data)

      expect(frontmatterBlock).not.toContain('# Template name')
    })

    it(`should return false when frontmatter template supplied`, async () => {
      const data = `@Templates\nHello World`

      let result = new FrontmatterModule().isFrontmatterTemplate(data)

      expect(result).toEqual(false)
    })

    it(`should extract frontmatter block`, async () => {
      const data = await factory('frontmatter-minimal.ejs')

      let frontmatterBlock = new FrontmatterModule().getFrontmatterBlock(data)

      expect(frontmatterBlock).not.toContain('# Template name')
    })

    it(`should be valid frontmatter object`, async () => {
      const data = await factory('frontmatter-minimal.ejs')

      const result = new FrontmatterModule().render(data)

      expect(result.hasOwnProperty('attributes')).toEqual(true)
      expect(result.hasOwnProperty('body')).toEqual(true)
      expect(result.hasOwnProperty('bodyBegin')).toEqual(true)
    })

    it(`should be valid frontmatter have supplied attributes`, async () => {
      const data = await factory('frontmatter-minimal.ejs')

      const result = new FrontmatterModule().render(data)

      expect(result.attributes.hasOwnProperty('name')).toEqual(true)
      expect(result.attributes.name).toEqual('Mike Erickson')
    })

    it(`should contain template in 'body' property`, async () => {
      const data = await factory('frontmatter-extended.ejs')

      const result = new FrontmatterModule().render(data)

      expect(result.hasOwnProperty('body')).toEqual(true)
      expect(result.body).toContain('<%= name %>')
      expect(result.body).toContain('<%= phone %>')
      expect(result.body).toContain('<%= modified %>')
    })

    it(`should contain frontmatter attributes`, async () => {
      const data = await factory('frontmatter-extended.ejs')

      const result = new FrontmatterModule().attributes(data)

      expect(typeof result).toEqual('object')
      expect(result.title).toEqual('Test Sample')
    })

    it(`should contain frontmatter body`, async () => {
      const data = await factory('frontmatter-extended.ejs')

      const result = new FrontmatterModule().body(data)

      expect(typeof result).toEqual('string')
      expect(result).toContain('<%= name %>')
    })
  })

  describe(section('FrontmatterModule Helpers'), () => {
    it(`should return attributes using ${method('attributes')}`, async () => {
      const data = await factory('frontmatter-extended.ejs')

      const result = getAttributes(data)

      expect(typeof result).toEqual('object')
      expect(result?.title).toEqual('Test Sample')
      expect(result?.name).toEqual('Mike Erickson')
    })

    it(`should return attributes using ${method('body')}`, async () => {
      const data = await factory('frontmatter-extended.ejs')

      const result = getBody(data)

      expect(typeof result).toEqual('string')
      expect(result).toContain('<%= name %>')
      expect(result).not.toContain('title: Test Sample')
    })
  })
})
