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

describe('Regex tests for matching specific term "example"', () => {
  const note = "example";
  const regex = buildRegex(note);

  test('Simple Match', () => {
    const input = "This is an example of regex.";
    expect(input.match(regex)).not.toBeNull();
  });

  test('Match at Start of String', () => {
    const input = "example starts the sentence.";
    expect(input.match(regex)).not.toBeNull();
  });

  test('Match at End of String', () => {
    const input = "The sentence ends with example";
    expect(input.match(regex)).not.toBeNull();
  });

  test('Match with Punctuation', () => {
    const input = "Here is an example; it's clearly marked.";
    expect(input.match(regex)).not.toBeNull();
  });

  test('No Match Due to Hashtag', () => {
    const input = "This is a #example hashtag.";
    expect(input.match(regex)).toBeNull();
  });

  test('No Match Inside Markdown Links', () => {
    const input = "Check this [[example]] link.";
    expect(input.match(regex)).toBeNull();
  });

  test('Match Surrounded by Special Characters', () => {
    const input = "Here is an (example).";
    expect(input.match(regex)).toBeNull();
  });

  test('No Match Due to Adjacency to Non-Specified Characters', () => {
    const input = "Anexample text here.";
    expect(input.match(regex)).toBeNull();
  });

  test('Multiple Matches', () => {
    const input = "An example with another example in it.";
    const matches = input.match(regex);
    expect(matches).toHaveLength(2);
  });

  test('Match With Mixed Case', () => {
    const input = "Example is at the beginning.";
    expect(input.match(regex)).not.toBeNull();
  });
});
