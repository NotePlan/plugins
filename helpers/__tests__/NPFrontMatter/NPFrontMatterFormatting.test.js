/* global describe, test, expect, beforeAll */

import { CustomConsole } from '@jest/console'
import * as f from '../../NPFrontMatter'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'

const PLUGIN_NAME = `helpers`
const FILENAME = `NPFrontMatterFormatting`

beforeAll(() => {
  // global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging (or 'none' for none)
})

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    describe('quoteText()', () => {
      test('should pass through text that should not be quoted', () => {
        const result = f.quoteText('foo')
        expect(result).toEqual('foo')
      })

      test('should pass through colons without spaces (e.g. url)', () => {
        const result = f.quoteText('http://www.google.com')
        expect(result).toEqual('http://www.google.com')
      })

      test('should pass through text already quoted', () => {
        const result = f.quoteText('"foo bar"')
        expect(result).toEqual('"foo bar"')
      })

      test('should quote text with colon+space', () => {
        const result = f.quoteText('foo: bar')
        expect(result).toEqual('"foo: bar"')
      })

      test('should quote text with leading hashtag', () => {
        const result = f.quoteText('#foo')
        expect(result).toEqual('#foo')
      })

      test('should not quote text with hashtag in the middle', () => {
        const result = f.quoteText('bar #foo')
        expect(result).toEqual('bar #foo')
      })

      test('should not quote hash with whitespace following (e.g. a comment that will get wiped out)', () => {
        const result = f.quoteText('# comment')
        expect(result).toEqual('# comment')
      })

      test('should escape internal double quotes when wrapping with quotes', () => {
        const result = f.quoteText('foo "bar" baz')
        expect(result).toEqual('"foo \\"bar\\" baz"')
      })

      test('should escape internal double quotes when already wrapped in quotes', () => {
        const result = f.quoteText('"foo "bar" baz"')
        expect(result).toEqual('"foo \\"bar\\" baz"')
      })

      test('should escape internal double quotes and quote the text when required', () => {
        const result = f.quoteText('foo: "bar"')
        expect(result).toEqual('"foo: \\"bar\\""')
      })

      test('should preserve single quotes within the text', () => {
        const result = f.quoteText("Don't worry")
        expect(result).toEqual("Don't worry")
      })

      test('should preserve single quotes even if quoted with double quotes', () => {
        const result = f.quoteText('"Don\'t worry"')
        expect(result).toEqual('"Don\'t worry"')
      })

      test('should quote text with a trailing colon', () => {
        const result = f.quoteText('foo:')
        expect(result).toEqual('"foo:"')
      })

      test('should quote text starting with @', () => {
        const result = f.quoteText('@foo')
        expect(result).toEqual('@foo')
      })

      test('should quote text containing >', () => {
        const result = f.quoteText('foo > bar')
        expect(result).toEqual('"foo > bar"')
      })

      test('should escape internal double quotes and quote special character-containing text', () => {
        const result = f.quoteText('foo "bar: baz"')
        expect(result).toEqual('"foo \\"bar: baz\\""')
      })

      test('should return empty string for null input', () => {
        const result = f.quoteText(null)
        expect(result).toEqual('')
      })

      test('should return empty string for undefined input', () => {
        const result = f.quoteText(undefined)
        expect(result).toEqual('')
      })

      test('should return string representation for number input', () => {
        const result = f.quoteText(123)
        expect(result).toEqual('123')
      })

      test('should return string representation for boolean input (true)', () => {
        const result = f.quoteText(true)
        expect(result).toEqual('true')
      })

      test('should return string representation for boolean input (false)', () => {
        const result = f.quoteText(false)
        expect(result).toEqual('false')
      })

      test('should return empty string for non-string input (object)', () => {
        const result = f.quoteText({ key: 'value' })
        expect(result).toEqual('')
      })

      test('should return empty string for non-string input (array)', () => {
        const result = f.quoteText(['foo', 'bar'])
        expect(result).toEqual('')
      })

      test('should quote text with leading hashtag when forcing special characters', () => {
        const result = f.quoteText('#foo', true)
        expect(result).toEqual('"#foo"')
      })

      test('should quote text starting with @ when forcing special characters', () => {
        const result = f.quoteText('@foo', true)
        expect(result).toEqual('"@foo"')
      })
    })

    describe('_getFMText()', () => {
      test('should return blank string if blank note', () => {
        const result = f._getFMText('')
        expect(result).toEqual('')
      })
      test('should return blank string if no frontmatter', () => {
        const result = f._getFMText('this\nis\na test')
        expect(result).toEqual('')
      })
      test('should return blank string if incomplete frontmatter', () => {
        const result = f._getFMText('---\nis\na test')
        expect(result).toEqual('')
      })
      test('should return blank string if incomplete frontmatter2', () => {
        const result = f._getFMText('--\nis\na test\n--')
        expect(result).toEqual('')
      })
      test('should return frontmatter text even if blank', () => {
        const result = f._getFMText('---\n---\n')
        expect(result).toEqual('---\n---\n')
      })
      test('should return frontmatter text', () => {
        const result = f._getFMText('---\nfoo: bar\n---\n')
        expect(result).toEqual('---\nfoo: bar\n---\n')
      })
    })

    describe('_fixFrontmatter()', () => {
      test('should not change text with no issues', () => {
        const before = `---\nfoo: bar\n---\n`
        const result = f._fixFrontmatter(before)
        expect(result).toEqual(before)
      })
      test('should change text with colon at end', () => {
        const before = `---\nfoo: bar:\n---\n`
        const result = f._fixFrontmatter(before)
        expect(result).toEqual(`---\nfoo: "bar:"\n---\n`)
      })
      test('should change text with colon space', () => {
        const before = `---\nfoo: bar: baz\n---\n`
        const result = f._fixFrontmatter(before)
        expect(result).toEqual(`---\nfoo: "bar: baz"\n---\n`)
      })
      test('should change text with hashtag', () => {
        const before = `---\nfoo: #bar\n---\n`
        const result = f._fixFrontmatter(before)
        expect(result).toEqual(`---\nfoo: #bar\n---\n`)
      })
      test('should change text with hashtag and more text', () => {
        const before = `---\nfoo: #bar followed by text\n---\n`
        const result = f._fixFrontmatter(before)
        expect(result).toEqual(`---\nfoo: #bar followed by text\n---\n`)
      })
      test('should change text with mention', () => {
        const before = `---\nfoo: @bar\n---\n`
        const result = f._fixFrontmatter(before)
        expect(result).toEqual(`---\nfoo: @bar\n---\n`)
      })
      test('should not change text with simple URL', () => {
        const before = `---\nfoo: https://noteplan.co/\n---\n`
        const result = f._fixFrontmatter(before)
        expect(result).toEqual(before)
      })
      test('should change text with markdown link', () => {
        const before = `---\nfoo: [NotePlan homepage](https://noteplan.co/)\n---\n`
        const result = f._fixFrontmatter(before)
        expect(result).toEqual(`---\nfoo: "[NotePlan homepage](https://noteplan.co/)"\n---\n`)
      })
      test('should not touch indented text', () => {
        const indented = `---\ntitle: indented\nkey:\n - value1\n - value2\n---\n`
        const before = indented
        const result = f._fixFrontmatter(before)
        expect(result).toEqual(before)
      })
    })

    describe('_sanitizeFrontmatterText()', () => {
      test('should do nothing if no frontmatter', () => {
        const result = f._sanitizeFrontmatterText('')
        expect(result).toEqual('')
      })
      test('should change text with colon at end', () => {
        const before = `---\nfoo: bar:\n---\n`
        const result = f._sanitizeFrontmatterText(before)
        expect(result).toEqual(`---\nfoo: "bar:"\n---\n`)
      })
      test('should change text with colon in middle of value', () => {
        const before = `---\nfoo: bar: bizzle\n---\n`
        const result = f._sanitizeFrontmatterText(before)
        expect(result).toEqual(`---\nfoo: "bar: bizzle"\n---\n`)
      })
      test('should change text with attag', () => {
        const before = `---\nfoo: @bar\n---\n`
        const result = f._sanitizeFrontmatterText(before)
        expect(result).toEqual(`---\nfoo: @bar\n---\n`)
      })
      test('should change text with hashtag', () => {
        const before = `---\nfoo: #bar\n---\n`
        const result = f._sanitizeFrontmatterText(before)
        expect(result).toEqual(`---\nfoo: #bar\n---\n`)
      })
      test('should not change comments (space after #) which will be wiped out later by fm()', () => {
        const before = `---\nfoo: # bar\n---\n`
        const result = f._sanitizeFrontmatterText(before)
        expect(result).toEqual(`---\nfoo: # bar\n---\n`)
      })
      // all other tests are done in _fixFrontmatter()
    })

    describe('getSanitizedFmParts()', () => {
      test('should make no changes if none are necessary', () => {
        const before = `---\nfoo: bar\n---\nbaz`
        const result = f.getSanitizedFmParts(before)
        const expected = { attributes: { foo: 'bar' }, body: 'baz', bodyBegin: 4, frontmatter: 'foo: bar' }
        expect(result).toEqual(expected)
      })
      // skipping this test for now because I think Eduard is actually allowing @text and #text in frontmatter
      test.skip('should make change to sanitized @text and return legal value', () => {
        const before = `---\nfoo: @bar\n---\nbaz`
        const result = f.getSanitizedFmParts(before)
        const expected = { attributes: { foo: '@bar' }, body: 'baz', bodyBegin: 4, frontmatter: 'foo: @bar' }
        expect(result).toEqual(expected)
      })
      // skipping this test for now because I think Eduard is actually allowing @text and #text in frontmatter
      test.skip('should make change to sanitized #text and return legal value', () => {
        const before = `---\nfoo: #bar\n---\nbaz`
        const result = f.getSanitizedFmParts(before)
        const expected = { attributes: { foo: '#bar' }, body: 'baz', bodyBegin: 4, frontmatter: 'foo: #bar' }
        expect(result).toEqual(expected)
      })
      test('should make change to MD links (which are illegal in YAML) but return legal value', () => {})
      const before = `---\nGitHub: [/add trigger command duplicates content · Issue #540 · NotePlan/plugins · GitHub](https://github.com/NotePlan/plugins/issues/540)\n---\nbaz`
      const result = f.getSanitizedFmParts(before)
      expect(Object.keys(result.attributes).length).toEqual(1)
      const expected = {
        attributes: { GitHub: '[/add trigger command duplicates content · Issue #540 · NotePlan/plugins · GitHub](https://github.com/NotePlan/plugins/issues/540)' },
        body: 'baz',
        bodyBegin: 4,
        frontmatter: 'GitHub: "[/add trigger command duplicates content · Issue #540 · NotePlan/plugins · GitHub](https://github.com/NotePlan/plugins/issues/540)"',
      }
      expect(result).toEqual(expected)
    })

    test('should not treat invalid YAML content as frontmatter', () => {
      const before = `---
**Event:** <%- calendarItemLink %>
**Links:** <%- eventLink %>
**Attendees:** <%- eventAttendees %>
**Location:** <%- eventLocation %>
---
### Agenda
+ 

### Notes
- 

### Actions
* `
      const result = f.getSanitizedFmParts(before)
      // Should treat the entire content as body since the content between --- is not valid YAML
      expect(result.attributes).toEqual({})
      expect(result.body).toEqual(before)
      expect(result.frontmatter).toEqual('')
    })

    test('should treat content with template tags as frontmatter', () => {
      const before = `---
title: <%- eventTitle %>
date: <%- eventDate() %>
type: meeting-note
---
# Meeting Notes

Some content here.`
      const result = f.getSanitizedFmParts(before)
      // Should extract the frontmatter correctly even with template tags
      expect(result.attributes).toEqual({
        title: '<%- eventTitle %>',
        date: '<%- eventDate() %>',
        type: 'meeting-note',
      })
      expect(result.body).toEqual('# Meeting Notes\n\nSome content here.')
      // The frontmatter field should contain the actual frontmatter content when fm library succeeds
      expect(result.frontmatter).toContain('title:')
      expect(result.frontmatter).toContain('date:')
      expect(result.frontmatter).toContain('type:')
    })

    test('should treat valid YAML content as frontmatter even when fm library fails', () => {
      const before = `---
title: Valid YAML
date: 2024-01-15
type: note
invalid_yaml: [unclosed array
---
# Valid Content

This is the body.`
      const result = f.getSanitizedFmParts(before)
      // Should extract the frontmatter correctly using fallback logic
      expect(result.attributes).toEqual({
        title: 'Valid YAML',
        date: '2024-01-15',
        type: 'note',
        invalid_yaml: '[unclosed array',
      })
      expect(result.body).toEqual('# Valid Content\n\nThis is the body.')
      expect(result.frontmatter).toEqual('')
    })

    describe('sanitizeFrontmatterInNote()', () => {
      test.skip('should do nothing if none are necesary', () => {
        const note = new Note({ content: 'baz' })
        const result = f.getSanitizedFrontmatterInNote(note)
        expect(result).toEqual(true)
      })
      test.skip('should do nothing if none are necesary', () => {
        const note = new Note({ content: '---\nfoo: bar\n---\nbaz' })
        const result = f.getSanitizedFrontmatterInNote(note)
        expect(result).toEqual(true)
      })
    })
  })
})
