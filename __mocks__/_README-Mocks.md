# Mocking NotePlan objects in your Jest testing files:

The best/fastest/easiest/most-reliable thing to do when writing plugins is to minimize the amount of code in the plugin entrypoint functions and rely on pure-JS support functions to do the heavy lifting. This is preferable, because those pure functions can be easily tested using Jest without relying on NotePlan's APIs.

That said, we have a goal of fully mocking the NotePlan APIs so that plugins can not only can have functional unit tests, but can also have integration tests which confirm that your plugin code is working end-to-end (and remains working as the codebase changes). 

> **The API-mocking is a work in progress and will take some time to get fully fleshed out. Many of the API functions are stubbed or commented out. You may need to implement a function in the mock you're using along the way (PRs are welcome!).** 

That said, here's how the testing of NotePlan APIs in your plugin works:
## Steps:
**In your test file:**
1. Import the mocks you need
2. Hoist the relevant mocks up to global scope in the beforeAll() method of your test file
3. Create sub-object content mocks (if necessary) to populate top level objects with Notes, Paragraphs, etc.
  

## Testing using mocked-out data
The most basic example is: you have a function with a call to a NotePlan API that retrieves a piece of data. You want to test the function, but the test will fail without that data from NotePlan. In this case, we can use a Mock simply to return a fake piece of data from a simulated NotePlan API.

The following example is an actual example from the code base: tests whether the `isTimeBlockLine()` function returns expected values, using one field of mocked out data from the API (the `DataStore.preference(...)` function). This function cannot be tested without a mock because it contains this one line:
```js
    const mustContainString = checkString(DataStore.preference("timeblockTextMustContainString"))
```
That call to DataStore will make a typical Jest test die. So we can just mock that DataStore function to return a value to our test:

```js
/* globals describe, expect, it, test, beforeAll */
import * as tb from '../timeblocks'
import DataStore from '@mocks/index'

beforeAll(() => {
  global.DataStore = DataStore
})

describe('helpers/timeblocks.js', () => { // file
  describe('isTimeBlockLine SHOULD MATCH', () => { // function
    test('should match: - @done(2021-12-12) 2:30-3:45', () => {
      expect(tb.isTimeBlockLine('- @done(2021-12-12) 2:30-3:45')).toEqual(true)
    })
  })
})
```
This now works because the DataStore mock returns '' for `DataStore.preference("timeblockTextMustContainString")` and thus, our tests can continue.

## Testing a call from your plugin to an NP API
A slightly more complex example: We want to make sure that our plugin is writing the proper value to NotePlan editor. In this case, we need to listen in to writes to the Editor api to ensure the correct value is being passed.

The following example tests whether `Editor.insertTextAtCursor()` is called from the 'JestHelpers' plugin's `sayHello` function:
```js
/* global describe, test, it, jest, expect, beforeAll */
import * as NPfile from '../src/NPPluginMain' // import everything for this plugin
import { DataStore } from '@mocks/index' // import mock(s)

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
The top-level NP objects: `Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan` all have sub-objects that will likely need to be mocked as well,depending on what your plugin is doing. For example, `Editor` has a property called `note`. You can create that mock note using the `Note` factory:
```js
  Editor.note = new Note({ filename: 'testingFile' })
```
Editor.note now has some basic properties, but to look like a real NotePlan `Note` object, a Note needs to have some paragraphs, and those paragraphs have some properties/methods also. You can mock the paragraphs with the `Paragraph` mock factory:
```js
  Editor.note.paragraphs = [new Paragraph({ content: 'paraContent1' }),new Paragraph({ content: 'paraContent2' })]
```

**Note: as you can see, when you instantiate a new factory instance, you can pass through any variables you want to override (e.g. `.content` in the above example)**

## A Full Example (from the "plugin:create" skeleton)

```js
// Jest testing docs: https://jestjs.io/docs/using-matchers
/* global describe, test, jest, expect */

import * as mainFile from '../src/NPPluginMain'
import { copyObject } from '@np/helpers/dev'

import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, Note, Paragraph, Backlink, Range, CalendarItem, PluginObject, PluginCommandObject } from '@mocks/index'

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
        Editor.note = new Note({ filename: 'testingFile' })
        Editor.note.paragraphs = [new Paragraph({ content: 'testingParagraph' })]
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
