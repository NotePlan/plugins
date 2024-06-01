/* global jest, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach */
// Jest testing docs: https://jestjs.io/docs/using-matchers
/* eslint-disable */

import { CustomConsole, LogType, LogMessage } from '@jest/console' // see note below
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'
import { buildRegex } from '../src/unlinkedNoteFinder'

const PLUGIN_NAME = `{{pluginID}}`
const FILENAME = `NPPluginMain`

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  DataStore.settings['_logLevel'] = 'DEBUG' //change this to DEBUG to get more logging (or 'none' for none)
})

describe('Regex tests for various specific terms', () => {
  const testCases = [
    {
      description: 'matching specific term "example"',
      note: 'example',
      tests: [
        { desc: 'Simple Match', input: 'This is an example of regex.', expected: true },
        { desc: 'Match at Start of String', input: 'example starts the sentence.', expected: true },
        { desc: 'Match at End of String', input: 'The sentence ends with example', expected: true },
        { desc: 'Match with Punctuation', input: 'Here is an example; it\'s clearly marked.', expected: true },
        { desc: 'No Match Due to Hashtag', input: 'This is a #example hashtag.', expected: false },
        { desc: 'No Match Inside Markdown Links', input: 'Check this [[example]] link.', expected: false },
        { desc: 'No Match Inside Markdown Links starting with [[', input: 'Check this [[example]] link.', expected: false },
        { desc: 'No Match Inside Markdown Links with a single ]', input: 'Check this [[example] link.', expected: false },
        { desc: 'Match Inside Markdown Link ending with ]]', input: 'Check this example]] link.', expected: true },
        { desc: 'No match Surrounded by Special Characters', input: 'Here is an (example).', expected: false },
        { desc: 'No Match Due to Adjacency to Non-Specified Characters', input: 'Anexample text here.', expected: false },
        { desc: 'Multiple Matches', input: 'An example with another example in it.', expectedLength: 2 },
        { desc: 'Match With Mixed Case', input: 'Example is uppercase at the beginning.', expected: true },
      ]
    },
    {
      description: 'matching specific term "example sentence"',
      note: 'example sentence',
      tests: [
        { desc: 'Simple Match', input: 'This is an example sentence of regex.', expected: true },
        { desc: 'Match at Start of String', input: 'example sentence starts the sentence.', expected: true },
        { desc: 'Match at End of String', input: 'The sentence ends with example sentence', expected: true },
        { desc: 'Match with Punctuation', input: 'Here is an example sentence; it\'s clearly marked.', expected: true },
        { desc: 'No Match Inside Markdown Links', input: 'Check this [[example sentence]] link.', expected: false },
        { desc: 'No match Surrounded by Special Characters', input: 'Here is an (example sentence).', expected: false },
        { desc: 'Multiple Matches', input: 'An example sentence with another example sentence in it.', expectedLength: 2 },
        { desc: 'Match With Mixed Case initial letter', input: 'Example sentence is uppercase at the beginning.', expected: true },
        { desc: 'Match With Mixed Case all letters', input: 'Example Sentence is uppercase at the beginning.', expected: true },
        { desc: 'Match With Mixed Case last letter', input: 'example Sentence is uppercase at the beginning.', expected: true },
      ]
    },
    {
      description: 'matching specific term "✅example" that starts with a unicode character',
      note: '✅example',
      tests: [
        { desc: 'Simple Match', input: 'This is an ✅example of regex.', expected: true },
        { desc: 'Match at Start of String', input: '✅example starts the sentence.', expected: true },
        { desc: 'Match at End of String', input: 'The sentence ends with ✅example', expected: true },
        { desc: 'Match with Punctuation', input: 'Here is an ✅example; it\'s clearly marked.', expected: true },
        { desc: 'No Match Due to Hashtag', input: 'This is a #✅example hashtag.', expected: false },
        { desc: 'No Match Inside Markdown Links', input: 'Check this [[✅example]] link.', expected: false },
        { desc: 'No match Surrounded by Special Characters', input: 'Here is an (✅example).', expected: false },
        { desc: 'No Match Due to Adjacency to Non-Specified Characters', input: 'An✅example text here.', expected: false },
        { desc: 'Multiple Matches', input: 'An ✅example with another ✅example in it.', expectedLength: 2 },
        { desc: 'Match With Mixed Case', input: '✅Example is uppercase at the beginning.', expected: true },
      ]
    },
    {
      description: 'matching specific term "example✅" that ends with a unicode character',
      note: 'example✅',
      tests: [
        { desc: 'Simple Match', input: 'This is an example✅ of regex.', expected: true },
        { desc: 'Match at Start of String', input: 'example✅ starts the sentence.', expected: true },
        { desc: 'Match at End of String', input: 'The example✅ ends with example', expected: true },
        { desc: 'Match with Punctuation', input: 'Here is an example✅; it\'s clearly marked.', expected: true },
        { desc: 'No Match Due to Hashtag', input: 'This is a #example✅ hashtag.', expected: false },
        { desc: 'No Match Inside Markdown Links', input: 'Check this [[example✅]] link.', expected: false },
        { desc: 'No match Surrounded by Special Characters', input: 'Here is an (example✅).', expected: false },
        { desc: 'No Match Due to Adjacency to Non-Specified Characters', input: 'Anexample✅ text here.', expected: false },
        { desc: 'Multiple Matches', input: 'An example✅ with another example✅ in it.', expectedLength: 2 },
        { desc: 'Match With Mixed Case', input: 'Example✅ is uppercase at the beginning.', expected: true },
      ]
    },
  ];

  testCases.forEach(({ description, note, tests }) => {
    describe(description, () => {
      const regex = buildRegex(note);

      tests.forEach(({ desc, input, expected, expectedLength }) => {
        test(desc, () => {
          const matches = input.match(regex);
          if (expected !== undefined) {
            expect(!!matches).toBe(expected);
          }
          if (expectedLength !== undefined) {
            expect(matches).toHaveLength(expectedLength);
          }
        });
      });
    });
  });
});
