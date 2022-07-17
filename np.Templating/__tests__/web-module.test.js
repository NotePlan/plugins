/* eslint-disable */

import colors from 'chalk'
import WebModule from '../lib/support/modules/WebModule'

const PLUGIN_NAME = `📙 ${colors.yellow('np.Templating')}`
const section = colors.blue

describe(`${PLUGIN_NAME}`, () => {
  let moduleInstance
  beforeEach(() => {
    moduleInstance = new WebModule()
  })
  describe(section('WebModule'), () => {
    it(`should fetch advice`, async () => {
      const advice = jest.spyOn(moduleInstance, 'advice')
      await moduleInstance.advice()
      expect(advice).toBeCalled()
    })

    it(`should fetch affirmation`, async () => {
      const affirmation = jest.spyOn(moduleInstance, 'affirmation')
      await moduleInstance.affirmation()
      expect(affirmation).toBeCalled()
    })

    it(`should fetch weather`, async () => {
      const advice = jest.spyOn(moduleInstance, 'weather')
      await moduleInstance.weather()
      expect(advice).toBeCalled()
    })

    it(`should fetch word`, async () => {
      const word = jest.spyOn(moduleInstance, 'wotd')
      await moduleInstance.wotd()
      expect(word).toBeCalled()
    })

    it(`should fetch verse`, async () => {
      const service = jest.spyOn(moduleInstance, 'verse')
      await moduleInstance.verse()
      expect(service).toBeCalled()
    })

    it(`should fetch service`, async () => {
      const service = jest.spyOn(moduleInstance, 'service')
      await moduleInstance.service()
      expect(service).toBeCalled()
    })
  })
})
