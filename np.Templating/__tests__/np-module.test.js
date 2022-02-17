/* eslint-disable */

import colors from 'chalk'
// import NPTemplating from 'NPTemplating'
import Editor from './__mocks__/Editor'

const PLUGIN_NAME = `📙 ${colors.yellow('np.Templating')}`
const section = colors.blue
const method = colors.magenta.bold

describe(`${PLUGIN_NAME}`, () => {
  describe(section('Templating Editor Module'), () => {
    it.only(`should execute ${method('.insertTextAtCursor')} method`, async () => {
      const spy = jest.spyOn(Editor, 'insertTextAtCursor')
      let result = await Editor.insertTextAtCursor('hello world')

      expect(spy).toHaveBeenCalled()
      expect(result).toEqual('hello world')

      spy.mockRestore()
    })

    it.skip(`should insert template`, async () => {
      expect(true).toBe(true)
    })

    it.skip(`should append template`, async () => {
      expect(true).toBe(true)
    })

    it.skip(`should create new note from template`, async () => {
      expect(true).toBe(true)
    })

    // it('should determine if tag is templating module', async () => {
    //   const result = new NPTemplating().isTemplateModule('date.now()')

    //   expect(result).toBe(true)
    // })
  })
})
