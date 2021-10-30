/* eslint-disable */

import colors from 'chalk'
import UtilsModule from '../lib/support/modules/UtilsModule'
import moment from 'moment'

const PLUGIN_NAME = `📙 ${colors.yellow('np.Templating')}`
const section = colors.blue

const isNode = process.release.name === 'node'

describe(`${PLUGIN_NAME}`, () => {
  describe(section('UtilsModule'), () => {
    it(`should format string using sprintf`, async () => {
      const result = new UtilsModule().format('%2$s %3$s a %1$s', 'cracker', 'Polly', 'wants')

      expect(result).toEqual('Polly wants a cracker')
    })

    it(`should concat string`, async () => {
      const result = new UtilsModule().concat('Michael', 'Joseph', 'Erickson')

      expect(result).toEqual('Michael Joseph Erickson')
    })

    it(`should lowercase string`, async () => {
      const result = new UtilsModule().lowercase('TEST')

      expect(result).toEqual('test')
    })

    it(`should uppercase string`, async () => {
      const result = new UtilsModule().uppercase('test')

      expect(result).toEqual('TEST')
    })

    it(`should titleCase string`, async () => {
      const result = new UtilsModule().titleCase('mike erickson')

      expect(result).toEqual('Mike Erickson')
    })

    it(`should camelCase string`, async () => {
      const result = new UtilsModule().camelize('hello world')

      expect(result).toEqual('helloWorld')
    })

    it(`should slug string`, async () => {
      const result = new UtilsModule().slug('hello world')

      expect(result).toEqual('hello-world')
    })

    it(`should slugify string`, async () => {
      const result = new UtilsModule().slugify('hello world')

      expect(result).toEqual('hello-world')
    })
  })
})
