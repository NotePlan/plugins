/* eslint-disable */

import colors from 'chalk'
// import NPTemplating from 'NPTemplating' // not ready yet, need to resolve use of aliases imports
import Editor from './__mocks__/Editor'
import DataStore from './__mocks__/DataStore'
import CommandBar from './__mocks__/CommandBar'

const PLUGIN_NAME = `📙 ${colors.yellow('np.Templating')}`
const section = colors.blue
const method = colors.magenta.bold

describe(`${PLUGIN_NAME}`, () => {
  describe(section('Templating Editor Module'), () => {
    it(`should execute ${method('.insertTextAtCursor')} method`, async () => {
      const spy = jest.spyOn(Editor, 'insertTextAtCursor')
      let result = await Editor.insertTextAtCursor('hello world')

      expect(spy).toHaveBeenCalled()
      expect(result).toEqual('hello world')

      spy.mockRestore()
    })

    it(`should insert template`, async () => {
      const spy = jest.spyOn(Editor, 'insertTextAtCursor')
      let result = await Editor.insertTextAtCursor('hello world')

      expect(spy).toHaveBeenCalled()
      expect(result).toEqual('hello world')

      spy.mockRestore()
    })

    it(`should append template`, async () => {
      const spy = jest.spyOn(Editor, 'insertTextAtCharacterIndex')
      let result = await Editor.insertTextAtCharacterIndex('hello world', 0)

      expect(spy).toHaveBeenCalled()
      expect(spy).toHaveBeenCalledWith('hello world', 0)
      expect(result).toEqual('hello world')

      spy.mockRestore()
    })

    it(`should create new note from template`, async () => {
      const spy = jest.spyOn(DataStore, 'newNote')
      let result = await DataStore.newNote('title', 'folder')

      expect(spy).toHaveBeenCalled()
      expect(spy).toHaveBeenCalledWith('title', 'folder')
      expect(result).toEqual('# title')

      spy.mockRestore()
    })
  })
})
