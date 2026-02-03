/* global describe, test, expect, jest, beforeEach */
/**
 * Tests for np.CallbackURLs wizard functions: selectTag, installPlugin, toggleSidebar
 * Mocks userInput (getInput, chooseOption) to test URL output
 */
import { DataStore, Editor, CommandBar, NotePlan } from '@mocks/index'

global.DataStore = DataStore
global.Editor = Editor
global.CommandBar = CommandBar
global.NotePlan = NotePlan

const mockGetInput = jest.fn()
const mockChooseOption = jest.fn()

jest.mock('@helpers/userInput', () => ({
  getInput: (...args) => mockGetInput(...args),
  chooseOption: (...args) => mockChooseOption(...args),
  showMessage: jest.fn(),
  showMessageYesNo: jest.fn(),
  chooseFolder: jest.fn(),
  chooseNote: jest.fn(),
  getInputTrimmed: jest.fn(),
}))

jest.mock('@helpers/dev', () => ({
  log: jest.fn(),
  logError: jest.fn(),
  logDebug: jest.fn(),
  JSP: (x) => x,
  clo: jest.fn(),
  timer: jest.fn(),
}))

jest.mock('@helpers/NPParagraph', () => ({
  getSelectedParagraph: jest.fn(),
  getParagraphContainingPosition: jest.fn(),
}))

jest.mock('../src/NPTemplateRunner', () => ({
  getXcallbackForTemplate: jest.fn(),
}))

jest.mock('../src/NPOpenFolders', () => ({
  openFolderView: jest.fn(),
}))

jest.mock('@helpers/NPdev', () => ({
  chooseRunPluginXCallbackURL: jest.fn(),
}))

describe('np.CallbackURLs NPXCallbackWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('selectTag', () => {
    test('should return selectTag URL with # when user enters tag without #', async () => {
      const { selectTag } = require('../src/NPXCallbackWizard')
      mockGetInput.mockResolvedValue('noteplan')
      const url = await selectTag()
      expect(url).toContain('noteplan://x-callback-url/selectTag')
      expect(url).toContain('name=%23noteplan')
    })
    test('should return selectTag URL with user tag when user enters #tag', async () => {
      const { selectTag } = require('../src/NPXCallbackWizard')
      mockGetInput.mockResolvedValue('#noteplan')
      const url = await selectTag()
      expect(url).toContain('selectTag')
      expect(url).toContain('name=%23noteplan')
    })
    test('should return empty string when user cancels', async () => {
      const { selectTag } = require('../src/NPXCallbackWizard')
      mockGetInput.mockResolvedValue(false)
      const url = await selectTag()
      expect(url).toEqual('')
    })
  })

  describe('installPlugin', () => {
    test('should return installPlugin URL with pluginID', async () => {
      const { installPlugin } = require('../src/NPXCallbackWizard')
      mockGetInput.mockResolvedValue('dwertheimer.Favorites')
      const url = await installPlugin()
      expect(url).toContain('noteplan://x-callback-url/installPlugin')
      expect(url).toContain('pluginID=dwertheimer.Favorites')
    })
    test('should return empty string when user cancels', async () => {
      const { installPlugin } = require('../src/NPXCallbackWizard')
      mockGetInput.mockResolvedValue(false)
      const url = await installPlugin()
      expect(url).toEqual('')
    })
    test('should return empty string when user enters empty string', async () => {
      const { installPlugin } = require('../src/NPXCallbackWizard')
      mockGetInput.mockResolvedValue('')
      const url = await installPlugin()
      expect(url).toEqual('')
    })
  })

  describe('toggleSidebar', () => {
    test('should return toggleSidebar URL with no params when all defaults', async () => {
      const { toggleSidebar } = require('../src/NPXCallbackWizard')
      mockChooseOption.mockResolvedValueOnce('no').mockResolvedValueOnce('no').mockResolvedValueOnce('yes')
      const url = await toggleSidebar()
      expect(url).toEqual('noteplan://x-callback-url/toggleSidebar')
    })
    test('should return toggleSidebar URL with forceCollapse=yes', async () => {
      const { toggleSidebar } = require('../src/NPXCallbackWizard')
      mockChooseOption.mockResolvedValueOnce('yes').mockResolvedValueOnce('no').mockResolvedValueOnce('yes')
      const url = await toggleSidebar()
      expect(url).toContain('toggleSidebar')
      expect(url).toContain('forceCollapse=yes')
    })
    test('should return toggleSidebar URL with forceOpen=yes', async () => {
      const { toggleSidebar } = require('../src/NPXCallbackWizard')
      mockChooseOption.mockResolvedValueOnce('no').mockResolvedValueOnce('yes').mockResolvedValueOnce('yes')
      const url = await toggleSidebar()
      expect(url).toContain('forceOpen=yes')
    })
    test('should return empty string when user cancels first prompt', async () => {
      const { toggleSidebar } = require('../src/NPXCallbackWizard')
      mockChooseOption.mockResolvedValue(false)
      const url = await toggleSidebar()
      expect(url).toEqual('')
    })
  })
})
