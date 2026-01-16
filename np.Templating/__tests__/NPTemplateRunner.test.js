// @flow

import { describe, expect, test, beforeAll, beforeEach, jest } from '@jest/globals'
import { DataStore, Editor, CommandBar, NotePlan } from '@mocks/index'

// Make DataStore and Editor available globally for the source code
global.DataStore = DataStore
global.Editor = Editor
global.CommandBar = CommandBar
global.NotePlan = NotePlan

// Flow type for mock note
type MockNote = {
  title: string,
  filename: string,
  content: string,
  paragraphs: Array<{
    lineIndex: number,
    type: string,
    content: string,
    rawContent: string,
  }>,
  frontmatterAttributes: { [key: string]: any },
  insertParagraph: any,
  appendParagraph: any,
  prependParagraph: any,
  removeParagraph: any,
  addParagraphBelowHeadingTitle: any,
}

// Mock NotePlan environment - using imported mocks from @mocks/index
// Add additional methods to the imported mocks as needed
DataStore.projectNoteByTitle = jest.fn()
DataStore.calendarNoteByDate = jest.fn()
DataStore.calendarNoteByDateString = jest.fn()
DataStore.newNote = jest.fn()
DataStore.invokePluginCommandByName = jest.fn()
DataStore.updateCache = jest.fn()
DataStore.preference = jest.fn((key: string) => {
  // Return default values for common preferences
  if (key === 'templateFolder') return '@Templates'
  if (key === 'formsFolder') return '@Forms'
  return null
})

Editor.type = 'Notes'
Editor.openNoteByDate = jest.fn()
Editor.openNoteByTitle = jest.fn()
Editor.openWeeklyNote = jest.fn()
Editor.openNoteByFilename = jest.fn()
Editor.selectedParagraphs = []
Editor.insertParagraphAtCursor = jest.fn()
Editor.addParagraphBelowHeadingTitle = jest.fn()

CommandBar.prompt = jest.fn()

NotePlan.environment = {
  templateFolder: '@Templates',
}

// Mock helper functions
jest.mock('@helpers/dev', () => ({
  logError: jest.fn(),
  logDebug: jest.fn(),
  JSP: jest.fn((obj) => JSON.stringify(obj)),
  clo: jest.fn(),
  overrideSettingsWithStringArgs: jest.fn((defaults, args) => {
    if (typeof args === 'string') {
      const result = { ...defaults }
      args.split(',').forEach((arg) => {
        const [key, value] = arg.split('=')
        if (key && value) result[key.trim()] = value.trim()
      })
      return result
    }
    return { ...defaults, ...args }
  }),
  timer: jest.fn(() => '0.001s'),
  logTimer: jest.fn(),
}))

jest.mock('@helpers/NPParagraph', () => ({
  replaceContentUnderHeading: jest.fn().mockResolvedValue(undefined),
  findHeading: jest.fn(),
}))

jest.mock('@helpers/paragraph', () => ({
  findStartOfActivePartOfNote: jest.fn(() => 1),
  findEndOfActivePartOfNote: jest.fn(() => 10),
}))

jest.mock('@helpers/userInput', () => ({
  chooseHeading: jest.fn(),
  showMessage: jest.fn().mockResolvedValue('OK'),
}))

jest.mock('@helpers/NPnote', () => ({
  chooseNoteV2: jest.fn(),
  getNoteFromIdentifier: jest.fn(),
  getOrMakeRegularNoteInFolder: jest.fn(),
  getOrMakeCalendarNote: jest.fn(),
  selectFirstNonTitleLineInEditor: jest.fn(),
}))

jest.mock('@helpers/note', () => ({
  getNote: jest.fn(),
}))

jest.mock('@helpers/dateTime', () => ({
  hyphenatedDate: jest.fn(() => '2024-01-15'),
  getISOWeekAndYear: jest.fn(),
  getISOWeekString: jest.fn(),
  isValidCalendarNoteTitleStr: jest.fn(),
}))

jest.mock('@helpers/NPdateTime', () => ({
  getNPWeekData: jest.fn(),
}))

jest.mock('@helpers/NPFrontMatter', () => ({
  getNoteTitleFromTemplate: jest.fn(),
  hasFrontMatter: jest.fn(),
  getAttributes: jest.fn(),
}))

jest.mock('../../helpers/note', () => ({
  getNoteByFilename: jest.fn(),
}))

jest.mock('../../helpers/NPParagraph', () => ({
  findHeading: jest.fn(),
}))

jest.mock('../lib/NPTemplating', () => ({
  renderFrontmatter: jest.fn(),
  render: jest.fn(),
}))

jest.mock('@templatingModules/FrontmatterModule', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    isFrontmatterTemplate: jest.fn(() => true),
  })),
}))

jest.mock('../lib/rendering', () => ({
  render: jest.fn(),
}))

jest.mock('../lib/helpers', () => ({
  helpInfo: jest.fn(() => 'Help information'),
}))

describe('NPTemplateRunner', () => {
  let NPTemplateRunner: any
  let mockNote: MockNote

  beforeAll(() => {
    NPTemplateRunner = require('../src/NPTemplateRunner')
  })

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup mock note
    mockNote = {
      title: 'Test Note',
      filename: 'test-note.md',
      content: '# Test Note\n\nContent here',
      paragraphs: [
        { lineIndex: 0, type: 'title', content: '# Test Note', rawContent: '# Test Note' },
        { lineIndex: 1, type: 'text', content: '', rawContent: '' },
        { lineIndex: 2, type: 'text', content: 'Content here', rawContent: 'Content here' },
      ],
      frontmatterAttributes: {},
      insertParagraph: jest.fn(),
      appendParagraph: jest.fn(),
      prependParagraph: jest.fn(),
      removeParagraph: jest.fn(),
      addParagraphBelowHeadingTitle: jest.fn(),
    }

    // Setup default mocks
    DataStore.projectNoteByTitle.mockResolvedValue([mockNote])
    DataStore.calendarNoteByDate.mockReturnValue(mockNote)

    // Setup @helpers/note mock
    const noteHelpers = require('@helpers/note')
    // $FlowFixMe - Mock function
    noteHelpers.getNote = jest.fn()
    DataStore.calendarNoteByDateString.mockReturnValue(mockNote)
    Editor.note = mockNote
    // Ensure Editor.note has the addParagraphBelowHeadingTitle method
    Editor.note.addParagraphBelowHeadingTitle = jest.fn()

    // Setup NPTemplating mocks
    const NPTemplating = require('../lib/NPTemplating')
    // $FlowFixMe - Mock functions
    NPTemplating.renderFrontmatter.mockResolvedValue({
      frontmatterBody: 'template body',
      frontmatterAttributes: { key1: 'value1' },
    })
    // $FlowFixMe - Mock functions
    NPTemplating.render.mockResolvedValue('rendered content')

    // Setup helper mocks
    const NPnote = require('@helpers/NPnote')
    // $FlowFixMe - Mock functions
    NPnote.getNoteFromIdentifier.mockResolvedValue(mockNote)
    // $FlowFixMe - Mock functions
    NPnote.getOrMakeRegularNoteInFolder.mockResolvedValue(mockNote)
    // $FlowFixMe - Mock functions
    NPnote.getOrMakeCalendarNote.mockResolvedValue(mockNote)
    // $FlowFixMe - Mock functions
    NPnote.chooseNoteV2.mockResolvedValue({ title: 'Chosen Note' })
    // $FlowFixMe - Mock functions
    const userInput = require('@helpers/userInput')
    // $FlowFixMe[prop-missing] - Mock function
    ;(userInput.chooseHeading: any).mockResolvedValue('Test Heading')

    const NPdateTime = require('@helpers/NPdateTime')
    // $FlowFixMe - Mock functions
    NPdateTime.getNPWeekData.mockReturnValue({ weekYear: 2024, weekNumber: 3, weekString: '2024-W03' })

    const dateTime = require('@helpers/dateTime')
    // $FlowFixMe - Mock functions
    dateTime.isValidCalendarNoteTitleStr.mockReturnValue(false)

    const NPParagraph = require('@helpers/NPParagraph')
    // $FlowFixMe - Mock functions
    NPParagraph.findHeading.mockReturnValue({
      lineIndex: 0,
      type: 'title',
      content: '## Test Heading',
    })
  })

  describe('processTemplateArguments', () => {
    test('should process string arguments correctly', () => {
      const result = NPTemplateRunner.processTemplateArguments('template1', 'key1=value1,key2=value2')

      expect(result.isRunFromCode).toBe(false)
      expect(result.passedTemplateBody).toBeNull()
      expect(result.argObj).toEqual({ key1: 'value1', key2: 'value2' })
    })

    test('should process object arguments correctly', () => {
      const args = { templateBody: 'test', getNoteTitled: 'note1' }
      const result = NPTemplateRunner.processTemplateArguments('', args)

      expect(result.isRunFromCode).toBe(true)
      expect(result.passedTemplateBody).toBe('test')
      expect(result.argObj).toEqual(args)
    })

    test('should handle JSON string arguments', () => {
      const jsonArgs = '__isJSON__{"key": "value"}'
      const result = NPTemplateRunner.processTemplateArguments('template1', jsonArgs)

      expect(result.argObj).toEqual({ key: 'value' })
    })

    test('should handle null arguments', () => {
      const result = NPTemplateRunner.processTemplateArguments('template1', null)

      expect(result.isRunFromCode).toBe(false)
      expect(result.passedTemplateBody).toBeNull()
      expect(result.argObj).toEqual({})
    })
  })

  describe('getTemplateData', () => {
    test('should get template data when template exists', async () => {
      const mockTemplateNote = { content: 'template content', title: 'Template 1' }
      // $FlowFixMe - Mock functions
      require('@helpers/NPnote').getNoteFromIdentifier.mockResolvedValue(mockTemplateNote)

      const result = await NPTemplateRunner.getTemplateData('template1', false)

      expect(result.templateData).toBe('template content')
      expect(result.trTemplateNote).toBe(mockTemplateNote)
      expect(result.failed).toBe(false)
    })

    test('should handle missing template', async () => {
      // $FlowFixMe - Mock functions
      require('@helpers/NPnote').getNoteFromIdentifier.mockResolvedValue(null)

      const result = await NPTemplateRunner.getTemplateData('template1', false)

      expect(result.templateData).toBe('')
      expect(result.trTemplateNote).toBeNull()
      expect(result.failed).toBe(true)
    })

    test('should handle empty template name when running from code', async () => {
      const result = await NPTemplateRunner.getTemplateData('', true)

      expect(result.templateData).toBe('')
      expect(result.trTemplateNote).toBeNull()
      expect(result.failed).toBe(false)
    })
  })

  describe('processFrontmatter', () => {
    test('should process frontmatter for regular template', async () => {
      const mockFrontmatterResult = {
        frontmatterBody: 'template body',
        frontmatterAttributes: { key1: 'value1' },
      }
      const NPTemplating = require('../lib/NPTemplating')
      // $FlowFixMe - Mock functions
      NPTemplating.renderFrontmatter.mockResolvedValue(mockFrontmatterResult)

      const result = await NPTemplateRunner.processFrontmatter('template content', { arg1: 'value1' }, false, null, { frontmatterAttributes: { originalKey: 'originalValue' } })

      expect(result.frontmatterBody).toBe('template body')
      expect(result.frontmatterAttributes).toEqual({ key1: 'value1', originalKey: 'originalValue' })
      expect(result.data).toHaveProperty('frontmatter')
    })

    test('should process frontmatter for code-run template', async () => {
      const result = await NPTemplateRunner.processFrontmatter('template content', { templateBody: 'passed body', key1: 'value1' }, true, 'passed body', null)

      expect(result.frontmatterBody).toBe('passed body')
      expect(result.frontmatterAttributes).toEqual({ templateBody: 'passed body', key1: 'value1' })
    })
  })

  describe('handleNewNoteCreation', () => {
    test('should create new note when newNoteTitle is specified', async () => {
      const data = { newNoteTitle: 'New Note', folder: 'TestFolder' }
      const argObj = { key1: 'value1' }

      await NPTemplateRunner.handleNewNoteCreation('template1', data, argObj)

      expect(DataStore.invokePluginCommandByName).toHaveBeenCalledWith('templateNew', 'np.Templating', ['template1', 'TestFolder', 'New Note', argObj])
    })

    test('should not create new note when newNoteTitle is not specified', async () => {
      const data = { key1: 'value1' }
      const argObj = { key2: 'value2' }

      const result = await NPTemplateRunner.handleNewNoteCreation('template1', data, argObj)

      expect(result).toBe(false)
      expect(DataStore.invokePluginCommandByName).not.toHaveBeenCalled()
    })
  })

  describe('renderTemplate', () => {
    test('should render template successfully', async () => {
      const NPTemplating = require('../lib/NPTemplating')
      // $FlowFixMe - Mock functions
      NPTemplating.render.mockResolvedValue('rendered content')

      const result = await NPTemplateRunner.renderTemplate('template body', { key1: 'value1' })

      expect(result).toBe('rendered content')
    })

    test('should throw error when template rendering fails', async () => {
      const NPTemplating = require('../lib/NPTemplating')
      // $FlowFixMe - Mock functions
      NPTemplating.render.mockRejectedValue(new Error('Template Rendering Error: Something went wrong'))

      await expect(NPTemplateRunner.renderTemplate('template body', { key1: 'value1' })).rejects.toThrow('Template Rendering Error: Something went wrong')
    })
  })

  describe('handleNoteSelection', () => {
    test('should return original title when no choose/select placeholders', async () => {
      const result = await NPTemplateRunner.handleNoteSelection('Regular Title')

      expect(result).toBe('Regular Title')
    })

    test('should handle choose placeholder', async () => {
      const mockChosenNote = { title: 'Chosen Note' }
      // $FlowFixMe - Mock functions
      require('@helpers/NPnote').chooseNoteV2.mockResolvedValue(mockChosenNote)

      const result = await NPTemplateRunner.handleNoteSelection('<choose>')

      expect(result).toBe('Chosen Note')
    })

    test('should handle select placeholder', async () => {
      const mockChosenNote = { title: 'Selected Note' }
      // $FlowFixMe - Mock functions
      require('@helpers/NPnote').chooseNoteV2.mockResolvedValue(mockChosenNote)

      const result = await NPTemplateRunner.handleNoteSelection('<select>')

      expect(result).toBe('Selected Note')
    })

    test('should throw error when chosen note has no title', async () => {
      // $FlowFixMe - Mock functions
      require('@helpers/NPnote').chooseNoteV2.mockResolvedValue({ title: '' })

      await expect(NPTemplateRunner.handleNoteSelection('<choose>')).rejects.toThrow("Selected note has no title and can't be used")
    })
  })

  describe('createTemplateWriteOptions', () => {
    test('should create write options with all attributes', () => {
      const frontmatterAttributes = {
        location: 'append',
        writeUnderHeading: 'Test Heading',
        replaceNoteContents: true,
        headingLevel: 3,
        addHeadingLocation: 'prepend',
        replaceHeading: false,
      }

      const result = NPTemplateRunner.createTemplateWriteOptions(frontmatterAttributes, true)

      expect(result.shouldOpenInEditor).toBe(true)
      expect(result.createMissingHeading).toBe(true)
      expect(result.replaceNoteContents).toBe(true)
      expect(result.headingLevel).toBe(3)
      expect(result.addHeadingLocation).toBe('prepend')
      expect(result.location).toBe('append')
      expect(result.writeUnderHeading).toBe('Test Heading')
      expect(result.replaceHeading).toBe(false)
    })

    test('should handle missing attributes with defaults', () => {
      const frontmatterAttributes = {}

      const result = NPTemplateRunner.createTemplateWriteOptions(frontmatterAttributes, false)

      expect(result.shouldOpenInEditor).toBe(false)
      expect(result.createMissingHeading).toBe(true)
      expect(result.replaceNoteContents).toBe(false)
      expect(result.headingLevel).toBeUndefined()
      expect(result.addHeadingLocation).toBeUndefined()
    })
  })

  describe('determineNoteType', () => {
    test('should identify today note', () => {
      const result = NPTemplateRunner.determineNoteType('<today>')

      expect(result.isTodayNote).toBe(true)
      expect(result.isThisWeek).toBe(false)
      expect(result.isNextWeek).toBe(false)
    })

    test('should identify this week note', () => {
      const result = NPTemplateRunner.determineNoteType('<thisweek>')

      expect(result.isTodayNote).toBe(false)
      expect(result.isThisWeek).toBe(true)
      expect(result.isNextWeek).toBe(false)
    })

    test('should identify next week note', () => {
      const result = NPTemplateRunner.determineNoteType('<nextweek>')

      expect(result.isTodayNote).toBe(false)
      expect(result.isThisWeek).toBe(false)
      expect(result.isNextWeek).toBe(true)
    })

    test('should identify regular note', () => {
      const result = NPTemplateRunner.determineNoteType('Regular Note Title')

      expect(result.isTodayNote).toBe(false)
      expect(result.isThisWeek).toBe(false)
      expect(result.isNextWeek).toBe(false)
    })
  })

  describe('handleTodayNote', () => {
    test('should open note in editor when requested', async () => {
      const writeOptions = {
        shouldOpenInEditor: true,
        writeUnderHeading: 'Test Heading',
        location: 'append',
        createMissingHeading: true,
      }

      await NPTemplateRunner.handleTodayNote('rendered content', writeOptions)

      expect(Editor.openNoteByDate).toHaveBeenCalled()
    })

    test('should write to calendar note when not opening in editor', async () => {
      const writeOptions = {
        shouldOpenInEditor: false,
        writeUnderHeading: 'Test Heading',
        location: 'append',
        createMissingHeading: true,
      }

      await NPTemplateRunner.handleTodayNote('rendered content', writeOptions)

      expect(DataStore.calendarNoteByDate).toHaveBeenCalled()
    })
  })

  describe('handleWeeklyNote', () => {
    test('should handle this week note', async () => {
      const mockWeekData = { weekYear: 2024, weekNumber: 3, weekString: '2024-W03' }
      // $FlowFixMe - Mock functions
      require('@helpers/NPdateTime').getNPWeekData.mockReturnValue(mockWeekData)

      const writeOptions = {
        shouldOpenInEditor: false,
        writeUnderHeading: 'Test Heading',
        location: 'append',
        createMissingHeading: true,
      }

      await NPTemplateRunner.handleWeeklyNote(true, false, 'rendered content', writeOptions)

      expect(DataStore.calendarNoteByDateString).toHaveBeenCalledWith('2024-W03')
    })

    test('should handle next week note', async () => {
      const mockWeekData = { weekYear: 2024, weekNumber: 4, weekString: '2024-W04' }
      // $FlowFixMe - Mock functions
      require('@helpers/NPdateTime').getNPWeekData.mockReturnValue(mockWeekData)

      const writeOptions = {
        shouldOpenInEditor: true,
        writeUnderHeading: 'Test Heading',
        location: 'append',
        createMissingHeading: true,
      }

      await NPTemplateRunner.handleWeeklyNote(false, true, 'rendered content', writeOptions)

      expect(Editor.openWeeklyNote).toHaveBeenCalledWith(2024, 4)
    })
  })

  describe('handleCurrentNote', () => {
    test('should write to current note when editor type is Notes', async () => {
      Editor.type = 'Notes'

      const writeOptions = {
        writeUnderHeading: 'Test Heading',
        location: 'append',
        createMissingHeading: true,
      }

      await NPTemplateRunner.handleCurrentNote('rendered content', writeOptions)

      // Should not throw error and should complete successfully
      expect(true).toBe(true)
    })

    test('should write to current note when editor type is Calendar', async () => {
      Editor.type = 'Calendar'

      const writeOptions = {
        writeUnderHeading: 'Test Heading',
        location: 'append',
        createMissingHeading: true,
      }

      await NPTemplateRunner.handleCurrentNote('rendered content', writeOptions)

      // Should not throw error and should complete successfully
      expect(true).toBe(true)
    })

    test('should prompt error when editor type is not Notes or Calendar', async () => {
      Editor.type = 'Tasks'

      const writeOptions = {
        writeUnderHeading: 'Test Heading',
        location: 'append',
        createMissingHeading: true,
      }

      await NPTemplateRunner.handleCurrentNote('rendered content', writeOptions)

      expect(CommandBar.prompt).toHaveBeenCalledWith('You must have either Project Note or Calendar Note open when using "<current>".', '')
    })
  })

  describe('handleRegularNote', () => {
    test('should handle regular note with folder path', async () => {
      // $FlowFixMe - Mock functions
      require('@helpers/NPnote').getOrMakeRegularNoteInFolder.mockResolvedValue(mockNote)

      const writeOptions = {
        shouldOpenInEditor: false,
        writeUnderHeading: 'Test Heading',
        location: 'append',
        createMissingHeading: true,
      }

      await NPTemplateRunner.handleRegularNote('Folder/Note Title', 'template1', { folder: 'CustomFolder' }, 'rendered content', writeOptions)

      expect(require('@helpers/NPnote').getOrMakeRegularNoteInFolder).toHaveBeenCalledWith('Note Title', 'Folder')
    })

    test('should handle calendar note title', async () => {
      // $FlowFixMe - Mock functions
      require('@helpers/dateTime').isValidCalendarNoteTitleStr.mockReturnValue(true)
      // $FlowFixMe - Mock functions
      require('@helpers/NPnote').getOrMakeCalendarNote.mockResolvedValue(mockNote)

      const writeOptions = {
        shouldOpenInEditor: false,
        writeUnderHeading: 'Test Heading',
        location: 'append',
        createMissingHeading: true,
      }

      await NPTemplateRunner.handleRegularNote('Calendar Note', 'template1', {}, 'rendered content', writeOptions)

      expect(require('@helpers/NPnote').getOrMakeCalendarNote).toHaveBeenCalledWith('template1')
    })

    test('should open note in editor when requested', async () => {
      // $FlowFixMe - Mock functions
      require('@helpers/NPnote').getOrMakeRegularNoteInFolder.mockResolvedValue(mockNote)
      Editor.openNoteByTitle.mockResolvedValue(mockNote)

      const writeOptions = {
        shouldOpenInEditor: true,
        writeUnderHeading: 'Test Heading',
        location: 'append',
        createMissingHeading: true,
      }

      await NPTemplateRunner.handleRegularNote('Note Title', 'template1', {}, 'rendered content', writeOptions)

      expect(Editor.openNoteByTitle).toHaveBeenCalledWith('Note Title')
    })
  })

  describe('writeNoteContents', () => {
    test('should handle empty rendered template', async () => {
      await NPTemplateRunner.writeNoteContents(mockNote, '', 'Test Heading', 'append', { createMissingHeading: true })

      // Should return early without writing anything
      expect(mockNote.insertParagraph).not.toHaveBeenCalled()
    })

    test('should replace note contents when requested', async () => {
      await NPTemplateRunner.writeNoteContents(mockNote, 'New content', 'Test Heading', 'append', { replaceNoteContents: true })

      expect(mockNote.content).toContain('New content')
    })

    test('should handle replaceHeading option', async () => {
      // $FlowFixMe - Mock functions
      const NPParagraph = require('@helpers/NPParagraph')
      // $FlowFixMe - Mock function
      NPParagraph.findHeading.mockReturnValue({
        lineIndex: 0,
        type: 'title',
        content: '## Test Heading',
        note: mockNote, // Add the note property so removeParagraph can be called
      })

      // Ensure the mock function exists
      if (!NPParagraph.replaceContentUnderHeading) {
        NPParagraph.replaceContentUnderHeading = jest.fn()
      }
      // $FlowFixMe - Mock function
      NPParagraph.replaceContentUnderHeading.mockResolvedValue(undefined)

      await NPTemplateRunner.writeNoteContents(mockNote, 'New heading content', '## Test Heading', 'replace', { replaceHeading: true })

      expect(NPParagraph.replaceContentUnderHeading).toHaveBeenCalled()
      expect(mockNote.removeParagraph).toHaveBeenCalled()
      // Note: insertParagraph is not called in the current implementation when replaceHeading is true
      // The content is replaced by replaceContentUnderHeading, then the heading is removed
    })

    // Tests for the new helper functions
    describe('isTemplateEmpty', () => {
      test('should return true for empty template', () => {
        const result = NPTemplateRunner.isTemplateEmpty('')
        expect(result).toBe(true)
      })

      test('should return true for whitespace-only template', () => {
        const result = NPTemplateRunner.isTemplateEmpty('   \n\t  ')
        expect(result).toBe(true)
      })

      test('should return false for non-empty template', () => {
        const result = NPTemplateRunner.isTemplateEmpty('Some content')
        expect(result).toBe(false)
      })
    })

    describe('replaceNoteContents', () => {
      test('should replace note contents correctly', async () => {
        const mockNoteWithParagraphs = {
          ...mockNote,
          paragraphs: [
            { lineIndex: 0, type: 'title', content: '# Title', rawContent: '# Title' },
            { lineIndex: 1, type: 'text', content: 'Old content', rawContent: 'Old content' },
            { lineIndex: 2, type: 'text', content: 'More old content', rawContent: 'More old content' },
          ],
        }

        // $FlowFixMe - Mock function
        require('@helpers/paragraph').findStartOfActivePartOfNote.mockReturnValue(1)

        await NPTemplateRunner.replaceNoteContents(mockNoteWithParagraphs, 'New content')

        expect(mockNoteWithParagraphs.content).toBe('# Title\nNew content')
      })
    })

    describe('handleHeadingSelection', () => {
      test('should return original heading for non-interactive templates', async () => {
        const result = await NPTemplateRunner.handleHeadingSelection(mockNote, 'Test Heading')
        expect(result).toBe('Test Heading')
      })

      test('should call chooseHeading for interactive templates', async () => {
        const userInput = require('@helpers/userInput')
        // $FlowFixMe - Mock function
        userInput.chooseHeading.mockResolvedValue('Selected Heading')

        const result = await NPTemplateRunner.handleHeadingSelection(mockNote, '<choose>')

        expect(userInput.chooseHeading).toHaveBeenCalledWith(mockNote, true)
        expect(result).toBe('Selected Heading')
      })

      test('should handle select tag for interactive templates', async () => {
        const userInput = require('@helpers/userInput')
        // $FlowFixMe - Mock function
        userInput.chooseHeading.mockResolvedValue('Selected Heading')

        const result = await NPTemplateRunner.handleHeadingSelection(mockNote, '<select>')

        expect(userInput.chooseHeading).toHaveBeenCalledWith(mockNote, true)
        expect(result).toBe('Selected Heading')
      })
    })

    describe('replaceHeading', () => {
      test('should replace heading and contents correctly', async () => {
        const mockNoteWithHeadings = {
          ...mockNote,
          paragraphs: [
            { lineIndex: 0, type: 'title', content: '# Main Heading', rawContent: '# Main Heading' },
            { lineIndex: 1, type: 'title', content: '## Test Heading', rawContent: '## Test Heading' },
            { lineIndex: 2, type: 'text', content: 'Content under test heading', rawContent: 'Content under test heading' },
            { lineIndex: 3, type: 'title', content: '## Another Heading', rawContent: '## Another Heading' },
            { lineIndex: 4, type: 'text', content: 'Content under another heading', rawContent: 'Content under another heading' },
          ],
        }

        const headingParagraph = { lineIndex: 1, type: 'title', content: '## Test Heading' }

        await NPTemplateRunner.replaceHeading(mockNoteWithHeadings, '## Test Heading', 'New content', headingParagraph)

        expect(mockNoteWithHeadings.removeParagraph).toHaveBeenCalled()
        expect(mockNoteWithHeadings.insertParagraph).toHaveBeenCalledWith('## ## Test Heading\nNew content', 1, 'text')
      })

      test('should handle heading level detection', async () => {
        const mockNoteWithHeadings = {
          ...mockNote,
          paragraphs: [
            { lineIndex: 0, type: 'title', content: '# Main Heading', rawContent: '# Main Heading' },
            { lineIndex: 1, type: 'title', content: '### Test Heading', rawContent: '### Test Heading' },
            { lineIndex: 2, type: 'text', content: 'Content under test heading', rawContent: 'Content under test heading' },
          ],
        }

        const headingParagraph = { lineIndex: 1, type: 'title', content: '### Test Heading' }

        await NPTemplateRunner.replaceHeading(mockNoteWithHeadings, '### Test Heading', 'New content', headingParagraph)

        expect(mockNoteWithHeadings.insertParagraph).toHaveBeenCalledWith('### ### Test Heading\nNew content', 1, 'text')
      })
    })

    // Note: prependHeadingWithContent function doesn't exist in NPTemplateRunner

    describe('writeUnderExistingHeading', () => {
      test('should write content under existing heading', async () => {
        await NPTemplateRunner.writeUnderExistingHeading(mockNote, 'Test Heading', 'New content', 'append', { shouldOpenInEditor: false })

        expect(mockNote.addParagraphBelowHeadingTitle).toHaveBeenCalledWith('New content', 'text', 'Test Heading', true, true)
      })

      test('should open note in editor when requested', async () => {
        await NPTemplateRunner.writeUnderExistingHeading(mockNote, 'Test Heading', 'New content', 'append', { shouldOpenInEditor: true })

        expect(Editor.openNoteByFilename).toHaveBeenCalledWith('test-note.md')
        expect(require('@helpers/NPnote').selectFirstNonTitleLineInEditor).toHaveBeenCalled()
      })
    })

    describe('writeWithoutHeading', () => {
      test('should append content when location is append', async () => {
        // $FlowFixMe - Mock function
        require('@helpers/paragraph').findStartOfActivePartOfNote.mockReturnValue(1)

        await NPTemplateRunner.writeWithoutHeading(mockNote, 'New content', 'append', false)

        expect(mockNote.appendParagraph).toHaveBeenCalledWith('New content', 'text')
      })

      test('should insert at cursor when location is cursor and in editor', async () => {
        Editor.selectedParagraphs = [{ indents: 2 }]

        await NPTemplateRunner.writeWithoutHeading(mockNote, 'New content', 'cursor', true)

        expect(Editor.insertParagraphAtCursor).toHaveBeenCalledWith('New content', 'text', 2)
      })

      test('should prepend content when location is not append or cursor', async () => {
        // $FlowFixMe - Mock function
        require('@helpers/paragraph').findStartOfActivePartOfNote.mockReturnValue(1)

        await NPTemplateRunner.writeWithoutHeading(mockNote, 'New content', 'prepend', false)

        expect(mockNote.insertParagraph).toHaveBeenCalledWith('New content', 1, 'text')
      })
    })
  })

  describe('addFrontmatterToTemplate', () => {
    test('should add frontmatter to template', async () => {
      const mockTemplateNote = {
        ...mockNote,
        paragraphs: [
          { lineIndex: 0, type: 'title', content: 'Template Title', rawContent: 'Template Title' },
          { lineIndex: 1, type: 'text', content: 'Template content', rawContent: 'Template content' },
        ],
      }

      const noteHelpers = require('@helpers/note')
      // $FlowFixMe - Mock function
      noteHelpers.getNote.mockResolvedValue(mockTemplateNote)

      await NPTemplateRunner.addFrontmatterToTemplate('template1', false)

      expect(mockTemplateNote.insertParagraph).toHaveBeenCalledWith(
        '--\nNOTE_PROPERTIES: Properties in this section will be in the frontmatter of the generated note\n--',
        1,
        'text',
      )
    })

    test('should open template in editor when requested', async () => {
      const mockTemplateNote = {
        ...mockNote,
        paragraphs: [
          { lineIndex: 0, type: 'title', content: 'Template Title', rawContent: 'Template Title' },
          { lineIndex: 1, type: 'text', content: 'Template content', rawContent: 'Template content' },
        ],
      }

      const noteHelpers = require('@helpers/note')
      // $FlowFixMe - Mock function
      noteHelpers.getNote.mockResolvedValue(mockTemplateNote)

      await NPTemplateRunner.addFrontmatterToTemplate('template1', true)

      expect(Editor.openNoteByFilename).toHaveBeenCalledWith('test-note.md')
    })
  })
})
