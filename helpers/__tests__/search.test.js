/* global describe, expect, test, beforeAll */
import { CustomConsole } from '@jest/console' // see note below
import * as s from '../search'

import { simpleFormatter, DataStore, Note /* mockWasCalledWithString, Paragraph */ } from '@mocks/index'

beforeAll(() => {
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  global.DataStore = DataStore
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging (or 'none' for none)
})

describe('search.js tests', () => {
  describe('caseInsensitiveArrayIncludes()', () => {
    test('should not match empty searchTerm to empty array', () => {
      const result = s.caseInsensitiveArrayIncludes('', [])
      expect(result).toEqual(false)
    })
    test('should not match empty searchTerm to array', () => {
      const result = s.caseInsensitiveArrayIncludes('', ['ABC', 'DEF'])
      expect(result).toEqual(false)
    })
    test('should match "AbC" to array ["abc"]', () => {
      const result = s.caseInsensitiveArrayIncludes('AbC', ['one', 'abc', 'two'])
      expect(result).toEqual(true)
    })
    test('should match "AbC" to array ["ABC"]', () => {
      const result = s.caseInsensitiveArrayIncludes('AbC', ['one', 'ABC', 'two'])
      expect(result).toEqual(true)
    })
    test('should match "AbC" to array ["aBc"]', () => {
      const result = s.caseInsensitiveArrayIncludes('AbC', ['one', 'aBc', 'two'])
      expect(result).toEqual(true)
    })
    test("should not match ABC to ['']", () => {
      const result = s.caseInsensitiveArrayIncludes('ABC', [''])
      expect(result).toEqual(false)
    })
    test('should not match ABC to "oneABCtwo"', () => {
      const result = s.caseInsensitiveArrayIncludes('ABC', ['oneABCtwo'])
      expect(result).toEqual(false)
    })
    test('should not match #project to #project/company', () => {
      const result = s.caseInsensitiveArrayIncludes('#project', ['#project/company'])
      expect(result).toEqual(false)
    })
    test("should not match #project to ['The other #proj']", () => {
      const result = s.caseInsensitiveSubstringArrayIncludes('The other #proj', ['#project'])
      expect(result).toEqual(false)
    })
    test('should not match "Can do Simply Health claim for hospital nights" to array ["@Home","Hospital"]', () => {
      const result = s.caseInsensitiveArrayIncludes('Can do Simply Health claim for hospital nights', ['@Home', 'Hospital'])
      expect(result).toEqual(false)
    })
  })

  describe('caseInsensitiveSubstringArrayIncludes()', () => {
    test('should not match empty searchTerm to empty array', () => {
      const result = s.caseInsensitiveSubstringArrayIncludes('', [])
      expect(result).toEqual(false)
    })
    test('should not match empty searchTerm to array', () => {
      const result = s.caseInsensitiveSubstringArrayIncludes('', ['ABC', 'DEF'])
      expect(result).toEqual(false)
    })
    test('should match "AbC" to array ["abc"]', () => {
      const result = s.caseInsensitiveSubstringArrayIncludes('AbC', ['one', 'abc', 'two'])
      expect(result).toEqual(true)
    })
    test('should match "AbC" to array ["ABC"]', () => {
      const result = s.caseInsensitiveSubstringArrayIncludes('AbC', ['one', 'ABC', 'two'])
      expect(result).toEqual(true)
    })
    test('should match "AbC" to array ["aBc"]', () => {
      const result = s.caseInsensitiveSubstringArrayIncludes('AbC', ['one', 'aBc', 'two'])
      expect(result).toEqual(true)
    })
    test("should not match ABC to ['']", () => {
      const result = s.caseInsensitiveSubstringArrayIncludes('ABC', [''])
      expect(result).toEqual(false)
    })
    test("should not match ABC to ['oneABCtwo']", () => {
      const result = s.caseInsensitiveSubstringArrayIncludes('ABC', ['oneABCtwo'])
      expect(result).toEqual(false)
    })
    test("should not match #project to ['#project/company']", () => {
      const result = s.caseInsensitiveSubstringArrayIncludes('#project', ['#project/company'])
      expect(result).toEqual(false)
    })
    test("should not match #project to ['The other #proj']", () => {
      const result = s.caseInsensitiveSubstringArrayIncludes('The other #proj', ['#project'])
      expect(result).toEqual(false)
    })
    // Note: Different outcome from above function
    test('should match "Can do Simply Health claim for hospital nights" to array ["@Home","Hospital"]', () => {
      const result = s.caseInsensitiveSubstringArrayIncludes('Can do Simply Health claim for hospital nights', ['@Home', 'Hospital'])
      expect(result).toEqual(true)
    })
  })

  describe('caseInsensitiveMatch', () => {
    test('should not match ABC to ABCDEFG', () => {
      const result = s.caseInsensitiveMatch('ABC', 'ABCDEFG')
      expect(result).toEqual(false)
    })
    test('should match ABC to ABC', () => {
      const result = s.caseInsensitiveMatch('ABC', 'ABC')
      expect(result).toEqual(true)
    })
    test('should match ABC to abc', () => {
      const result = s.caseInsensitiveMatch('ABC', 'abc')
      expect(result).toEqual(true)
    })
    test('should match ABC to AbcDefg', () => {
      const result = s.caseInsensitiveMatch('ABC', 'AbcDefg')
      expect(result).toEqual(false)
    })
    test('should not match ABC to AB', () => {
      const result = s.caseInsensitiveMatch('ABC', 'AB')
      expect(result).toEqual(false)
    })
    test('should not match ABC to <blank>', () => {
      const result = s.caseInsensitiveMatch('ABC', '')
      expect(result).toEqual(false)
    })
  })

  describe('caseInsensitiveTagMatch()', () => {
    test('should match #project to #project/management', () => {
      const result = s.caseInsensitiveTagMatch('#project', '#project/management')
      expect(result).toEqual(true)
    })
    test('should match #project to #project/management/theory', () => {
      const result = s.caseInsensitiveTagMatch('#project', '#project/management/theory')
      expect(result).toEqual(true)
    })
    test('should match #project/management to #project/management/theory', () => {
      const result = s.caseInsensitiveTagMatch('#project/management', '#project/management/theory')
      expect(result).toEqual(true)
    })
    test('should be case insensitive - uppercase A', () => {
      const result = s.caseInsensitiveTagMatch('#PROJECT', '#project/management')
      expect(result).toEqual(true)
    })
    test('should be case insensitive - uppercase B', () => {
      const result = s.caseInsensitiveTagMatch('#project', '#PROJECT/MANAGEMENT')
      expect(result).toEqual(true)
    })
    test('should be case insensitive - mixed case', () => {
      const result = s.caseInsensitiveTagMatch('#ProJect', '#proJECT/ManageMENT')
      expect(result).toEqual(true)
    })
    test('should match when A equals B exactly', () => {
      const result = s.caseInsensitiveTagMatch('#project', '#project')
      expect(result).toEqual(true)
    })
    test('should match when A equals B (case insensitive)', () => {
      const result = s.caseInsensitiveTagMatch('#PROJECT', '#project')
      expect(result).toEqual(true)
    })
    test('should not match #project/man to #project/management (wrong break point)', () => {
      const result = s.caseInsensitiveTagMatch('#project/man', '#project/management')
      expect(result).toEqual(false)
    })
    test('should not match #proj to #project/management (wrong break point)', () => {
      const result = s.caseInsensitiveTagMatch('#proj', '#project/management')
      expect(result).toEqual(false)
    })
    test('should not match when B does not start with A', () => {
      const result = s.caseInsensitiveTagMatch('#project', '#other/management')
      expect(result).toEqual(false)
    })
    test('should not match when A is longer than B', () => {
      const result = s.caseInsensitiveTagMatch('#project/management/theory', '#project/management')
      expect(result).toEqual(false)
    })
    test('should not match empty hashtag A', () => {
      const result = s.caseInsensitiveTagMatch('', '#project/management')
      expect(result).toEqual(false)
    })
    test('should not match empty hashtag B', () => {
      const result = s.caseInsensitiveTagMatch('#project', '')
      expect(result).toEqual(false)
    })
    test('should match when both are empty', () => {
      const result = s.caseInsensitiveTagMatch('', '')
      expect(result).toEqual(true)
    })
    test('should handle special characters in hashtag', () => {
      const result = s.caseInsensitiveTagMatch('#project-test', '#project-test/sub')
      expect(result).toEqual(true)
    })
    test('should handle underscores in hashtag', () => {
      const result = s.caseInsensitiveTagMatch('#project_test', '#project_test/sub')
      expect(result).toEqual(true)
    })
    test('should handle numbers in hashtag', () => {
      const result = s.caseInsensitiveTagMatch('#project123', '#project123/sub')
      expect(result).toEqual(true)
    })
    test('should handle number parts in hashtag', () => {
      const result = s.caseInsensitiveTagMatch('#project123/456', '#project123/456/789')
      expect(result).toEqual(true)
    })
    test('should handle integer suffix in mention', () => {
      const result = s.caseInsensitiveTagMatch('@jgclark', '@jgclark(123)')
      expect(result).toEqual(true)
    })
    test('should handle integer suffix in multi-partmention', () => {
      const result = s.caseInsensitiveTagMatch('@jgclark/hours', '@jgclark/hours(123)')
      expect(result).toEqual(true)
    })
    test('should handle float suffix in mention', () => {
      const result = s.caseInsensitiveTagMatch('@jgclark', '@jgclark(123.456)')
      expect(result).toEqual(true)
    })
    test('should handle date suffix in mention', () => {
      const result = s.caseInsensitiveTagMatch('@jgclark', '@jgclark(2026-01-30)')
      expect(result).toEqual(true)
    })
    test('should not match #project to #projectmanagement (no slash)', () => {
      const result = s.caseInsensitiveTagMatch('#project', '#projectmanagement')
      expect(result).toEqual(false)
    })
    test('should handle deeply nested hashtags', () => {
      const result = s.caseInsensitiveTagMatch('#a/b/c', '#a/b/c/d/e/f')
      expect(result).toEqual(true)
    })
    test('should not match when next char after A is not slash', () => {
      const result = s.caseInsensitiveTagMatch('#project', '#project-sub')
      expect(result).toEqual(false)
    })
  })

  describe('caseInsensitiveStartsWith', () => {
    test('should match ABC to ABCDEFG', () => {
      const result = s.caseInsensitiveStartsWith('ABC', 'ABCDEFG')
      expect(result).toEqual(true)
    })
    test('should match ABC to ABC', () => {
      const result = s.caseInsensitiveStartsWith('ABC', 'ABC')
      expect(result).toEqual(false) // there should be more to match
    })
    test('should match ABC to abc', () => {
      const result = s.caseInsensitiveStartsWith('ABC', 'abc')
      expect(result).toEqual(false)
    })
    test('should match ABC to abc', () => {
      const result = s.caseInsensitiveStartsWith('ABC', 'abc/two/three')
      expect(result).toEqual(true)
    })
    test('should match ABC to AbcDefg', () => {
      const result = s.caseInsensitiveStartsWith('ABC', 'AbcDefg')
      expect(result).toEqual(true)
    })
    test('should not match ABC to AB', () => {
      const result = s.caseInsensitiveStartsWith('ABC', 'AB')
      expect(result).toEqual(false)
    })
    test('should not match ABC to <blank>', () => {
      const result = s.caseInsensitiveStartsWith('ABC', '')
      expect(result).toEqual(false)
    })
  })

  describe('fullWordMatch', () => {
    test("should not match 'hell' to 'hello'", () => {
      const result = s.fullWordMatch('hell', 'hello', true)
      expect(result).toEqual(false)
    })
    test("should match 'hell' to 'hell is all too real'", () => {
      const result = s.fullWordMatch('hell', 'hell is all too real', true)
      expect(result).toEqual(true)
    })
    test("should match 'hell' to 'heaven and hell'", () => {
      const result = s.fullWordMatch('hell', 'heaven and hell', true)
      expect(result).toEqual(true)
    })
    test("should match 'hell' to 'heaven, hell and something else'", () => {
      const result = s.fullWordMatch('hell', 'heaven, hell and something else', true)
      expect(result).toEqual(true)
    })
    test("should match 'hell' to 'Hell is all too real' with case sensitive match", () => {
      const result = s.fullWordMatch('hell', 'Hell is all too real', false)
      expect(result).toEqual(true)
    })
    test("should not match 'hell' to 'Hell is all too real' with case sensitive match", () => {
      const result = s.fullWordMatch('hell', 'Hell is all too real', true)
      expect(result).toEqual(false)
    })
    test("should match simple mention '@bob' to 'saw @bob'", () => {
      const result = s.fullWordMatch('@bob', 'saw @bob', true)
      expect(result).toEqual(true)
    })
    test("should match simple hashtag '#dogWalk' to '#dogWalk'", () => {
      const result = s.fullWordMatch('#dogWalk', '#dogWalk', true)
      expect(result).toEqual(true)
    })
    test("should match simple hashtag '#dogWalk' to 'did the #dogWalk today'", () => {
      const result = s.fullWordMatch('#dogWalk', 'did the #dogWalk today', false)
      expect(result).toEqual(true)
    })
    test("should match complex hashtag '#Phil' to 'in #Phil/3/2 it says'", () => {
      const result = s.fullWordMatch('#Phil', 'in #Phil/3/2 it says', false)
      expect(result).toEqual(true)
    })
    test("should match complex mention '@staff/Bob' to 'see @staff/Bob tomorrow'", () => {
      const result = s.fullWordMatch('@staff/Bob', 'see @staff/Bob tomorrow', true)
      expect(result).toEqual(true)
    })
  })

  describe('getFullLengthHashtagsFromList', () => {
    test('should want "#project/management/theory from longer set', () => {
      const result = s.getFullLengthHashtagsFromList(['#project', '#project/management', '#project/management/theory'])
      expect(result).toEqual(['#project/management/theory'])
    })
    test('should want "#project/management/theory from longer set', () => {
      const result = s.getFullLengthHashtagsFromList(['#project', '#project/management', '#project/startup', '#society', '#society/problems'])
      expect(result).toEqual(['#project/management', '#project/startup', '#society/problems'])
    })
    test('should not subset match "#project/management" from "#project/man" as break is in wrong place', () => {
      const result = s.getFullLengthHashtagsFromList(['#project/man', '#project/management'])
      expect(result).toEqual(['#project/man', '#project/management'])
    })
    test('should not subset match "#project/man" from "#project/management" as break is in wrong place', () => {
      const result = s.getFullLengthHashtagsFromList(['#project/management', '#project/man'])
      expect(result).toEqual(['#project/management', '#project/man'])
    })
  })

  describe('isHashtagWanted', () => {
    const wantedSet1 = ['#TeStInG', '#Programming']
    const excludedSet1 = ['#odd']
    test('should want #TESTING from set1', () => {
      const result = s.isHashtagWanted('#TESTING', wantedSet1, excludedSet1)
      expect(result).toEqual(true)
    })
    test('should want #testing from set1', () => {
      const result = s.isHashtagWanted('#testing', wantedSet1, excludedSet1)
      expect(result).toEqual(true)
    })
    test('should want #TeStInG from set1', () => {
      const result = s.isHashtagWanted('#TeStInG', wantedSet1, excludedSet1)
      expect(result).toEqual(true)
    })
    test('should want #Programming from set1', () => {
      const result = s.isHashtagWanted('#Programming', wantedSet1, excludedSet1)
      expect(result).toEqual(true)
    })
    test('should want #programming from set1', () => {
      const result = s.isHashtagWanted('#programming', wantedSet1, excludedSet1)
      expect(result).toEqual(true)
    })
    test('should want #programMING from set1', () => {
      const result = s.isHashtagWanted('#programMING', wantedSet1, excludedSet1)
      expect(result).toEqual(true)
    })
    test('should not want #ODD from set1', () => {
      const result = s.isHashtagWanted('#ODD', wantedSet1, excludedSet1)
      expect(result).toEqual(false)
    })
  })

  // Tests for fullHashtagOrMentionMatch()
  describe('fullHashtagOrMentionMatch()', () => {
    test('should match simple hashtag at start of text', () => {
      const result = s.fullHashtagOrMentionMatch('#project', '#project is important')
      expect(result).toEqual(true)
    })
    test('should match simple hashtag in middle of text', () => {
      const result = s.fullHashtagOrMentionMatch('#project', 'Working on #project today')
      expect(result).toEqual(true)
    })
    test('should match simple hashtag at end of text', () => {
      const result = s.fullHashtagOrMentionMatch('#project', 'This is about #project')
      expect(result).toEqual(true)
    })
    test('should match hashtag with punctuation after', () => {
      const result = s.fullHashtagOrMentionMatch('#project', 'Working on #project, and more')
      expect(result).toEqual(true)
    })
    test('should match hashtag with punctuation before', () => {
      const result = s.fullHashtagOrMentionMatch('#project', 'See (#project) for details')
      expect(result).toEqual(true)
    })
    test('should not match partial hashtag substring', () => {
      const result = s.fullHashtagOrMentionMatch('#proj', 'Working on #project today')
      expect(result).toEqual(false)
    })
    test('should not match hashtag that is substring of another', () => {
      const result = s.fullHashtagOrMentionMatch('#project', 'Working on #projectmanagement today')
      expect(result).toEqual(false)
    })
    test('should match hierarchical hashtag', () => {
      const result = s.fullHashtagOrMentionMatch('#project/management', 'Working on #project/management today')
      expect(result).toEqual(true)
    })
    test('should match hierarchical hashtag with deeper level', () => {
      const result = s.fullHashtagOrMentionMatch('#project/management/theory', 'See #project/management/theory for details')
      expect(result).toEqual(true)
    })
    test('should be case insensitive - uppercase search', () => {
      const result = s.fullHashtagOrMentionMatch('#PROJECT', 'Working on #project today')
      expect(result).toEqual(true)
    })
    test('should be case insensitive - mixed case search', () => {
      const result = s.fullHashtagOrMentionMatch('#Project', 'Working on #PROJECT today')
      expect(result).toEqual(true)
    })
    test('should be case insensitive - lowercase search', () => {
      const result = s.fullHashtagOrMentionMatch('#project', 'Working on #PROJECT today')
      expect(result).toEqual(true)
    })
    test('should not match hashtag in middle of word', () => {
      const result = s.fullHashtagOrMentionMatch('#test', 'This is a #testing example')
      expect(result).toEqual(false)
    })
    test('should match hashtag at start of line', () => {
      const result = s.fullHashtagOrMentionMatch('#project', '#project\nNext line')
      expect(result).toEqual(true)
    })
    test('should match hashtag at end of line', () => {
      const result = s.fullHashtagOrMentionMatch('#project', 'Line with #project\nNext line')
      expect(result).toEqual(true)
    })
    test('should handle special characters in hashtag', () => {
      const result = s.fullHashtagOrMentionMatch('#project-test', 'Working on #project-test today')
      expect(result).toEqual(true)
    })
    test('should handle regex special characters in hashtag', () => {
      const result = s.fullHashtagOrMentionMatch('#project.test', 'Working on #project.test today')
      expect(result).toEqual(true)
    })
    test('should return false for empty text', () => {
      const result = s.fullHashtagOrMentionMatch('#project', '')
      expect(result).toEqual(false)
    })
    test('should match hashtag with space before and after', () => {
      const result = s.fullHashtagOrMentionMatch('#project', 'See #project here')
      expect(result).toEqual(true)
    })
    test('should match hashtag with newline before and after', () => {
      const result = s.fullHashtagOrMentionMatch('#project', '\n#project\n')
      expect(result).toEqual(true)
    })
    test('should not match when hashtag is part of another hashtag', () => {
      const result = s.fullHashtagOrMentionMatch('#pro', 'Working on #project today')
      expect(result).toEqual(false)
    })
    test('should match mention with (...) after a space', () => {
      const result = s.fullHashtagOrMentionMatch('@person', 'Working with @person (details)')
      expect(result).toEqual(true)
    })
    test('should match mention with (...) after a space and a newline', () => {
      const result = s.fullHashtagOrMentionMatch('@person', 'Talking about @person(details)')
      expect(result).toEqual(true)
    })
    test('should match mention followed by numbers in parentheses', () => {
      const result = s.fullHashtagOrMentionMatch('@exercise/run', 'Did @exercise/run(3.5)km today?')
      expect(result).toEqual(true)
    })
  })

  describe('simplifyRawContent()', () => {
    test('empty -> empty', () => {
      const output = s.simplifyRawContent('')
      expect(output).toEqual('')
    })
    test('trim: surrounding whitespace only', () => {
      const output = s.simplifyRawContent('  trim me  ')
      expect(output).toEqual('trim me')
    })
    test('trim: padded * task line', () => {
      const output = s.simplifyRawContent('  * task line')
      expect(output).toEqual('* task line')
    })
    test('trim: - task line', () => {
      const output = s.simplifyRawContent('- task line    ')
      expect(output).toEqual('- task line')
    })
    test('trim: > quotation line', () => {
      const output = s.simplifyRawContent('  > quotation line ')
      expect(output).toEqual('> quotation line')
    })
    test('remove: blockID 1 at end', () => {
      const output = s.simplifyRawContent('  > blockID line ^abc123 ')
      expect(output).toEqual('> blockID line')
    })
    test('remove: blockID 2 at end', () => {
      const output = s.simplifyRawContent('- this is open at root @menty @everse/Kyle ^i0kuo6')
      expect(output).toEqual('- this is open at root @menty @everse/Kyle')
    })
    test('remove: blockID at start', () => {
      const output = s.simplifyRawContent('^abc123 > blockID line ')
      expect(output).toEqual('> blockID line')
    })
    test('remove: several blockIDs', () => {
      const output = s.simplifyRawContent('^abc123 > blockID line ^d4w2g7')
      expect(output).toEqual('> blockID line')
    })
    test("don't remove: invalid blockID", () => {
      const output = s.simplifyRawContent('this is invalid ^abc1234 ok?')
      expect(output).toEqual('this is invalid ^abc1234 ok?')
    })
  })

  describe('getLineMainContentPos()', () => {
    test('empty input)', () => {
      const output = s.getLineMainContentPos('')
      expect(output).toEqual(0)
    })
    test('only whitespace only', () => {
      const output = s.getLineMainContentPos('  trim me  ')
      expect(output).toEqual(0)
    })
    test('line with * [x] in the middle', () => {
      const output = s.getLineMainContentPos('line with * [x] in the middle')
      expect(output).toEqual(0)
    })
    test('#hashtag at start of line', () => {
      const output = s.getLineMainContentPos('#hashtag at start of line')
      expect(output).toEqual(0)
    })
    test('* task line', () => {
      const output = s.getLineMainContentPos('* task line')
      expect(output).toEqual(2)
    })
    test('padded * task line', () => {
      const output = s.getLineMainContentPos('  * task line')
      expect(output).toEqual(4)
    })
    test('- task line', () => {
      const output = s.getLineMainContentPos('- task line')
      expect(output).toEqual(2)
    })
    test('padded - task line', () => {
      const output = s.getLineMainContentPos('  - task line')
      expect(output).toEqual(4)
    })
    test('* [x] task line', () => {
      const output = s.getLineMainContentPos('* [x] task line')
      expect(output).toEqual(6)
    })
    test('padded * [x] task line', () => {
      const output = s.getLineMainContentPos('  * [x] task line')
      expect(output).toEqual(8)
    })
    test('* [-] task line', () => {
      const output = s.getLineMainContentPos('* [-] task line')
      expect(output).toEqual(6)
    })
    test('padded * [-] task line', () => {
      const output = s.getLineMainContentPos('    * [-] task line')
      expect(output).toEqual(10)
    })
    test('* [ ] task line', () => {
      const output = s.getLineMainContentPos('* [ ] task line')
      expect(output).toEqual(6)
    })
    test('padded * [ ] task line', () => {
      const output = s.getLineMainContentPos('  * [ ] task line')
      expect(output).toEqual(8)
    })
    test('- [ ] task line', () => {
      const output = s.getLineMainContentPos('- [ ] task line')
      expect(output).toEqual(6)
    })
    test('- [x] task line', () => {
      const output = s.getLineMainContentPos('- [x] task line')
      expect(output).toEqual(6)
    })
    test('## heading line', () => {
      const output = s.getLineMainContentPos('## heading line')
      expect(output).toEqual(3)
    })
    test('#### heading line', () => {
      const output = s.getLineMainContentPos('#### heading line')
      expect(output).toEqual(5)
    })
    test('> quotation line', () => {
      const output = s.getLineMainContentPos('  > quotation line ')
      expect(output).toEqual(4)
    })
  })

  /**
   * This will be rather fiddly to test fully, but here's some to get started.
   * Will not test inside of URIs or [MD](links) because if present they're not significant.
   */
  describe('trimAndHighlightTermInLine()', () => {
    test('should return same as input (no maxChars)', () => {
      const output = s.trimAndHighlightTermInLine('Something in [tennis title](http://www.random-rubbish.org/)', ['tennis'], false, false, '- ')
      expect(output).toEqual('Something in [tennis title](http://www.random-rubbish.org/)')
    })
    test('should return same as input (maxChars=0)', () => {
      const output = s.trimAndHighlightTermInLine('Something in [tennis title](http://www.random-rubbish.org/)', ['tennis'], false, false, '- ', 0)
      expect(output).toEqual('Something in [tennis title](http://www.random-rubbish.org/)')
    })
    test('should return same as short ', () => {
      const output = s.trimAndHighlightTermInLine('Something in [tennis title](http://www.random-rubbish.org/)', ['tennis'], false, false, '- ', 100)
      expect(output).toEqual('Something in [tennis title](http://www.random-rubbish.org/)')
    })
    test('should return simplified, removing blockID', () => {
      const output = s.trimAndHighlightTermInLine('* [ ] A task that is syncd ^123ABC', ['syncd'], true, false, '- ', 100)
      expect(output).toEqual('- A task that is syncd')
    })
    test('should return list marker + input + highlight', () => {
      const output = s.trimAndHighlightTermInLine('Something in [tennis title](http://www.random-rubbish.org/)', ['tennis'], true, true, '- ', 100)
      expect(output).toEqual('- Something in [==tennis== title](http://www.random-rubbish.org/)')
    })
    test('should return same as input (with empty term)', () => {
      const output = s.trimAndHighlightTermInLine('Something in [link title](http://www.random-rubbish.org/)', [''], false, true, '- ', 100)
      expect(output).toEqual('Something in [link title](http://www.random-rubbish.org/)')
    })
    test('should return same as input (no term mentioned)', () => {
      const output = s.trimAndHighlightTermInLine('Something in [link title](http://www.random-rubbish.org/)', ['cabbage'], false, true, '- ', 100)
      expect(output).toEqual('Something in [link title](http://www.random-rubbish.org/)')
    })
    test('should return 3 highlights; simplified', () => {
      const output = s.trimAndHighlightTermInLine("\t\t* [ ] There's Tennis and tennis.org and unTENNISlike behaviour!  ", ['tennis'], true, true, '- ', 100)
      expect(output).toEqual("- There's ==Tennis== and ==tennis==.org and un==TENNIS==like behaviour!")
    })
    test('should return 3 highlights; simplified (different case)', () => {
      const output = s.trimAndHighlightTermInLine("\t\t* [ ] There's Tennis and tennis.org and unTENNISlike behaviour!  ", ['TENNIS'], true, true, '- ', 100)
      expect(output).toEqual("- There's ==Tennis== and ==tennis==.org and un==TENNIS==like behaviour!")
    })
    test('should return 3 highlights, dealing with padding, simplifying', () => {
      const output = s.trimAndHighlightTermInLine("  * [ ] There's Tennis and tennis.org and unTENNISlike behaviour!  ", ['tennis'], true, true, '- ', 100)
      expect(output).toEqual("- There's ==Tennis== and ==tennis==.org and un==TENNIS==like behaviour!")
    })
    test('should return 3 highlights; simplified; from tab padded', () => {
      const output = s.trimAndHighlightTermInLine("\t\tThere's Tennis and tennis.org and unTENNISlike behaviour!  ", ['tennis'], true, true, '- ', 100)
      expect(output).toEqual("- There's ==Tennis== and ==tennis==.org and un==TENNIS==like behaviour!")
    })
    test('should return highlights from 2 different consecutive terms', () => {
      const output = s.trimAndHighlightTermInLine(
        'Lorem ipsum dolor sit amet, sed consectetur adipisicing elit, sed do eiusmod tempor incididunt',
        ['tempor', 'eiusmod'],
        true,
        true,
        '- ',
        100,
      )
      expect(output).toEqual('- Lorem ipsum dolor sit amet, sed consectetur adipisicing elit, sed do ==eiusmod== ==tempor== incididunt')
    })
    test('should return no highlights and end trimming, as simplifying', () => {
      const output = s.trimAndHighlightTermInLine('Lorem ipsum dolor sit amet, sed consectetur adipisicing elit, sed do eiusmod tempor incididunt', ['sed'], true, false, '- ', 88)
      expect(output).toEqual('- Lorem ipsum dolor sit amet, sed consectetur adipisicing elit, sed do eiusmod ...')
    })
    test('should return no highlights and front and end trimming, as simplifying', () => {
      const output = s.trimAndHighlightTermInLine('Lorem ipsum dolor sit amet, sed consectetur adipisicing elit, sed do eiusmod tempor incididunt', ['sed'], true, false, '- ', 70)
      expect(output).toEqual('- Lorem ipsum dolor sit amet, sed consectetur adipisicing elit, sed ...')
    })
    test('should return no highlights and no shortening (as no simplication)', () => {
      const output = s.trimAndHighlightTermInLine(
        '  * [x] Lorem ipsum dolor sit amet, sed consectetur adipisicing elit, sed do eiusmod tempor incididunt',
        ['sed'],
        false,
        false,
        '- ',
        70,
      )
      expect(output).toEqual('  * [x] Lorem ipsum dolor sit amet, sed consectetur adipisicing elit, sed do eiusmod tempor incididunt')
    })
    test('should return 1 highlight and front and end trimming + simplify to set prefix -', () => {
      const output = s.trimAndHighlightTermInLine(
        '  * [x] Lorem ipsum dolor sit amet, sed consectetur adipisicing elit, sed do eiusmod tempor incididunt',
        ['sed'],
        true,
        false,
        '- ',
        70,
      )
      expect(output).toEqual('- Lorem ipsum dolor sit amet, sed consectetur adipisicing elit, sed ...')
    })
    test('should return 1 new highlight but not add extra to existing highlit term', () => {
      const output = s.trimAndHighlightTermInLine('Should add highlight to tennis, but not to this existing one: ==tennis==', ['tennis'], true, true, '- ')
      expect(output).toEqual('- Should add highlight to ==tennis==, but not to this existing one: ==tennis==')
    })
    test('specific case that was returning just a bullet', () => {
      const output = s.trimAndHighlightTermInLine(
        "- Kate's #picture big tap but dripping one drop at a time. Arrow pointing to tap, showing it’s not turned on far at all. → openness to Holy Spirit",
        ['Holy', 'Spirit'],
        false,
        true,
        '- ',
        200,
      )
      expect(output).toEqual(
        "- Kate's #picture big tap but dripping one drop at a time. Arrow pointing to tap, showing it’s not turned on far at all. → openness to ==Holy== ==Spirit==",
      )
    })
    test('should return line that is all a markdown link', () => {
      const output = s.trimAndHighlightTermInLine(
        '[Jubilee Centre: Letters from Christians in the Workplace](https://static1.squarespace.com/static/62012941199c974967f9c4ad/t/6310c2720d9d1e7e30cf29bf/1662042743991/Dear+Church+Letters+%28Sept+2022%29.pdf)',
        [''],
        true,
        false,
        '- ',
      )
      expect(output).toEqual(
        '- [Jubilee Centre: Letters from Christians in the Workplace](https://static1.squarespace.com/static/62012941199c974967f9c4ad/t/6310c2720d9d1e7e30cf29bf/1662042743991/Dear+Church+Letters+%28Sept+2022%29.pdf)',
      )
    })

    // TODO: Ran out of energy to do the detail on this ...
    test('should return 1 highlight and front and end trimming', () => {
      const output = s.trimAndHighlightTermInLine('Lorem ipsum dolor sit amet, sed consectetur adipisicing elit, sed do eiusmod tempor incididunt', ['sed'], true, true, '- ', 48)
      expect(output).toEqual('- ... ipsum dolor sit amet, ==sed== consectetur adipisicing ... elit, ==sed== do eiusmod tempor incididunt ...')
    })
  })
})
