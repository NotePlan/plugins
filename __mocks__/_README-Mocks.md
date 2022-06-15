# Mocking NotePlan objects in your Jest testing files:

As stated elsewhere, the best/fastest/easiest thing to do when writing plugins is to minimize the amount of code in the plugin entrypoint functions and rely on pure-JS support functions to do the heavy lifting. This is preferable, because those pure functions can be easily tested using Jest without relying on NotePlan's APIs.

That said, we have a goal of fully mocking the NotePlan APIs so that plugins can not only can have functional unit tests, but can also have integration tests which confirm that your plugin code is working end-to-end (and remains working as the codebase changes). The API-mocking is a work in progress and will take some time. However, the bones are beginning to take shape. Here's essentially how the testing of NotePlan APIs in your plugin will work:
## Steps:
**In your test file:**
1. Import the mocks
2. Hoist the relevant mocks up to global scope in the beforeAll() method of your test file
3. Create sub-object content mocks (if necessary) to populate top level objects with Notes, Paragraphs, etc.
  

## Basic example:
```js
/* global describe, test, it, jest, expect */
import* as NPfile from '../src/NPPluginMain'
import { DataStore } from '@mocks/index'

beforeAll(() => {
  global.Editor = Editor
})

describe('dwertheimer.JestHelpers' /*my plugin id*/, () => {
  describe('NPPluginMain' /* file */, () => {
    describe('sayHello' /* function */, () => {
      test('should insert text if called with a string param', async () => {
        const spy = jest.spyOn(Editor, 'insertTextAtCursor') // assuming my plugin calls this one NP command
        const result = await NPfile.sayHello('myText')
        expect(spy).toHaveBeenCalled()
        expect(spy).toHaveBeenNthCalledWith(
          1,
          `myText`,
        )
        // So we know that Editor.insertTextAtCursor was called with `myText` which was passed to the plugin entry point (e.g. from an xcallbackurl)
        spy.mockRestore()
      })
    })
  })
})
```

## Mocking sub-objects
The top-level NP objects: `Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan` all have sub-objects that will likely need to be mocked as well,depending on what your plugin is doing. For example, `Editor` has a property called `note`. You can create that mock note using the `NoteMock` factory:
```js
        Editor.note = new NoteMock({ filename: 'testingFile' })
```
Editor.note now has some basic fields, but a Note has paragraphs. You can mock the paragraphs with the `ParagraphMock` factory:
```js
        Editor.note.paragraphs = [new ParagraphMock({ content: 'testingParagraph' })]
```

## A Full Example (from the "plugin:create" skeleton)

```js
// Jest testing docs: https://jestjs.io/docs/using-matchers
/* global describe, test, jest, expect */

import * as mainFile from '../src/NPPluginMain'
import { copyObject } from '@helpers/dev'

import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, NoteMock, ParagraphMock } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
})

describe('{{pluginId}}' /* pluginID */, () => {
  describe('NPPluginMain' /* file */, () => {
    describe('sayHello' /* function */, () => {
      test('should insert text if called with a string param', async () => {
        // tests start with "should" to describe the expected behavior
        const spy = jest.spyOn(Editor, 'insertTextAtCursor')
        const result = await mainFile.sayHello('Testing...')
        expect(spy).toHaveBeenCalled()
        expect(spy).toHaveBeenNthCalledWith(
          1,
          `***You clicked the link!*** The message at the end of the link is "Testing...". Now the rest of the plugin will run just as before...\n\n`,
        )
        spy.mockRestore()
      })
      test('should write result to console', async () => {
        // tests start with "should" to describe the expected behavior
        const spy = jest.spyOn(console, 'log')
        const result = await mainFile.sayHello()
        expect(spy).toHaveBeenCalled()
        expect(spy).toHaveBeenNthCalledWith(1, expect.stringMatching(/The plugin says: HELLO WORLD FROM TEST PLUGIN!/))
        spy.mockRestore()
      })
      test('should call DataStore.settings', async () => {
        // tests start with "should" to describe the expected behavior
        const oldValue = DataStore.settings
        DataStore.settings = { settingsString: 'settingTest' }
        const spy = jest.spyOn(Editor, 'insertTextAtCursor')
        const _ = await mainFile.sayHello()
        expect(spy).toHaveBeenCalled()
        expect(spy).toHaveBeenNthCalledWith(1, expect.stringMatching(/settingTest/))
        DataStore.settings = oldValue
        spy.mockRestore()
      })
      test('should call DataStore.settings if no value set', async () => {
        // tests start with "should" to describe the expected behavior
        const oldValue = DataStore.settings
        DataStore.settings = { settingsString: undefined }
        const spy = jest.spyOn(Editor, 'insertTextAtCursor')
        const _ = await mainFile.sayHello()
        expect(spy).toHaveBeenCalled()
        expect(spy).toHaveBeenNthCalledWith(1, expect.stringMatching(/\*\*\"\"\*\*/))
        DataStore.settings = oldValue
        spy.mockRestore()
      })
      test('should CLO write note.paragraphs to console', async () => {
        // tests start with "should" to describe the expected behavior
        const prevEditorNoteValue = copyObject(Editor.note || {})
        Editor.note = new NoteMock({ filename: 'testingFile' })
        Editor.note.paragraphs = [new ParagraphMock({ content: 'testingParagraph' })]
        const spy = jest.spyOn(console, 'log')
        const result = await mainFile.sayHello()
        expect(spy).toHaveBeenCalled()
        expect(spy).toHaveBeenNthCalledWith(2, expect.stringMatching(/\"content\": \"testingParagraph\"/))
        Editor.note = prevEditorNoteValue
        spy.mockRestore()
      })
      test('should insert a link if not called with a string param', async () => {
        // tests start with "should" to describe the expected behavior
        const spy = jest.spyOn(Editor, 'insertTextAtCursor')
        const result = await mainFile.sayHello('')
        expect(spy).toHaveBeenCalled()
        expect(spy).toHaveBeenLastCalledWith(expect.stringMatching(/noteplan:\/\/x-callback-url\/runPlugin/))
        spy.mockRestore()
      })
      test('should write an error to console on throw', async () => {
        // tests start with "should" to describe the expected behavior
        const spy = jest.spyOn(console, 'log')
        const oldValue = Editor.insertTextAtCursor
        delete Editor.insertTextAtCursor
        const result = await mainFile.sayHello()
        expect(spy).toHaveBeenCalled()
        expect(spy).toHaveBeenNthCalledWith(2, expect.stringMatching(/ERROR/))
        Editor.insertTextAtCursor = oldValue
        spy.mockRestore()
      })
    })
  })
})
```
