/* eslint-disable */

import colors from 'chalk'
import FrontmatterModule from '../lib/support/modules/FrontmatterModule'

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

describe(`${PLUGIN_NAME}`, () => {
  describe(section('FrontmatterModule'), () => {
    it(`should return true when frontmatter template supplied`, async () => {
      const data = `# Template name
--
name: Mike Erickson
--
Hello World`

      let result = new FrontmatterModule().isFrontmatterTemplate(data)
      expect(result).toEqual(true)
    })
    it(`should extract frontmatter block`, async () => {
      const data = `# Template name
--
name: Mike Erickson
--
Hello World`

      let frontmatterBlock = new FrontmatterModule().getFrontmatterBlock(data)
      expect(frontmatterBlock).not.toContain('# Template name')
    })

    it(`should return false when frontmatter template supplied`, async () => {
      const data = `# Template name\nHello World`

      let result = new FrontmatterModule().isFrontmatterTemplate(data)
      expect(result).toEqual(false)
    })

    it(`should extract frontmatter block`, async () => {
      const data = `# Template name
--
name: Mike Erickson
--
Hello World`

      let frontmatterBlock = new FrontmatterModule().getFrontmatterBlock(data)
      expect(frontmatterBlock).not.toContain('# Template name')
    })

    it(`should be valid frontmatter object`, async () => {
      const data = `--
name: Mike Erickson
--`.replace(/--/g, '---')

      const result = new FrontmatterModule().render(data)

      expect(result.hasOwnProperty('attributes')).toEqual(true)
      expect(result.hasOwnProperty('body')).toEqual(true)
      expect(result.hasOwnProperty('bodyBegin')).toEqual(true)
    })

    it(`should be valid frontmatter have supplied attributes`, async () => {
      const data = `--
name: Mike Erickson
--`.replace(/--/g, '---')

      const result = new FrontmatterModule().render(data)

      expect(result.attributes.hasOwnProperty('name')).toEqual(true)
      expect(result.attributes.name).toEqual('Mike Erickson')
    })

    it(`should contain template in 'body' property`, async () => {
      const data = `--
name: Mike Erickson
phone: 714.454.4236
modified: 2021-10-22 11:50:43 AM
--
<%= name %>
<%= phone %>
<%= modified %>`.replace(/--/g, '---')

      const result = new FrontmatterModule().render(data)

      expect(result.hasOwnProperty('body')).toEqual(true)
      expect(result.body).toContain('<%= name %>')
      expect(result.body).toContain('<%= phone %>')
      expect(result.body).toContain('<%= modified %>')
    })
  })
})
