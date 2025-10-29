/* global describe, expect, test, beforeAll */
import { CustomConsole } from '@jest/console' // see note below
import * as s from '../search'

import { simpleFormatter, DataStore /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'

beforeAll(() => {
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  global.DataStore = DataStore
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging (or 'none' for none)
})

describe('search.js tests', () => {
  describe('caseInsensitiveIncludes()', () => {
    test('should not match empty searchTerm to empty array', () => {
      const result = s.caseInsensitiveIncludes('', [])
      expect(result).toEqual(false)
    })
    test('should not match empty searchTerm to array', () => {
      const result = s.caseInsensitiveIncludes('', ['ABC', 'DEF'])
      expect(result).toEqual(false)
    })
    test('should match "AbC" to array ["abc"]', () => {
      const result = s.caseInsensitiveIncludes('AbC', ['one', 'abc', 'two'])
      expect(result).toEqual(true)
    })
    test('should match "AbC" to array ["ABC"]', () => {
      const result = s.caseInsensitiveIncludes('AbC', ['one', 'ABC', 'two'])
      expect(result).toEqual(true)
    })
    test('should match "AbC" to array ["aBc"]', () => {
      const result = s.caseInsensitiveIncludes('AbC', ['one', 'aBc', 'two'])
      expect(result).toEqual(true)
    })
    test("should not match ABC to ['']", () => {
      const result = s.caseInsensitiveIncludes('ABC', [''])
      expect(result).toEqual(false)
    })
    test('should not match ABC to "oneABCtwo"', () => {
      const result = s.caseInsensitiveIncludes('ABC', ['oneABCtwo'])
      expect(result).toEqual(false)
    })
    test('should not match #project to #project/company', () => {
      const result = s.caseInsensitiveIncludes('#project', ['#project/company'])
      expect(result).toEqual(false)
    })
    test("should not match #project to ['The other #proj']", () => {
      const result = s.caseInsensitiveSubstringIncludes('The other #proj', ['#project'])
      expect(result).toEqual(false)
    })
    test('should not match "Can do Simply Health claim for hospital nights" to array ["@Home","Hospital"]', () => {
      const result = s.caseInsensitiveIncludes('Can do Simply Health claim for hospital nights', ['@Home', 'Hospital'])
      expect(result).toEqual(false)
    })
  })

  describe('caseInsensitiveSubstringIncludes()', () => {
    test('should not match empty searchTerm to empty array', () => {
      const result = s.caseInsensitiveSubstringIncludes('', [])
      expect(result).toEqual(false)
    })
    test('should not match empty searchTerm to array', () => {
      const result = s.caseInsensitiveSubstringIncludes('', ['ABC', 'DEF'])
      expect(result).toEqual(false)
    })
    test('should match "AbC" to array ["abc"]', () => {
      const result = s.caseInsensitiveSubstringIncludes('AbC', ['one', 'abc', 'two'])
      expect(result).toEqual(true)
    })
    test('should match "AbC" to array ["ABC"]', () => {
      const result = s.caseInsensitiveSubstringIncludes('AbC', ['one', 'ABC', 'two'])
      expect(result).toEqual(true)
    })
    test('should match "AbC" to array ["aBc"]', () => {
      const result = s.caseInsensitiveSubstringIncludes('AbC', ['one', 'aBc', 'two'])
      expect(result).toEqual(true)
    })
    test("should not match ABC to ['']", () => {
      const result = s.caseInsensitiveSubstringIncludes('ABC', [''])
      expect(result).toEqual(false)
    })
    test("should not match ABC to ['oneABCtwo']", () => {
      const result = s.caseInsensitiveSubstringIncludes('ABC', ['oneABCtwo'])
      expect(result).toEqual(false)
    })
    test("should not match #project to ['#project/company']", () => {
      const result = s.caseInsensitiveSubstringIncludes('#project', ['#project/company'])
      expect(result).toEqual(false)
    })
    test("should not match #project to ['The other #proj']", () => {
      const result = s.caseInsensitiveSubstringIncludes('The other #proj', ['#project'])
      expect(result).toEqual(false)
    })
    // Note: Different outcome from above function
    test('should match "Can do Simply Health claim for hospital nights" to array ["@Home","Hospital"]', () => {
      const result = s.caseInsensitiveSubstringIncludes('Can do Simply Health claim for hospital nights', ['@Home', 'Hospital'])
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

  describe('caseSensitiveSubstringLocaleMatch', () => {
    test('should not match empty array to ABCDEFG', () => {
      const result = s.caseSensitiveSubstringLocaleMatch([], 'ABCDEFG', 'en-GB')
      expect(result).toEqual(false)
    })
    test('should not match empty string to ABCDEFG', () => {
      const result = s.caseSensitiveSubstringLocaleMatch([''], 'ABCDEFG', 'en-GB')
      expect(result).toEqual(false)
    })
    test('should match ABC to ABCDEFG', () => {
      const result = s.caseSensitiveSubstringLocaleMatch(['ABC'], 'ABCDEFG', 'en-GB')
      expect(result).toEqual(true)
    })
    test('should match EFG to ABCDEFG', () => {
      const result = s.caseSensitiveSubstringLocaleMatch(['EFG'], 'ABCDEFG', 'en-GB')
      expect(result).toEqual(true)
    })
    test('should match CDE to ABCDEFG', () => {
      const result = s.caseSensitiveSubstringLocaleMatch(['CDE'], 'ABCDEFG', 'en-GB')
      expect(result).toEqual(true)
    })
    test('should not match Abc to ABCDEFG', () => {
      const result = s.caseSensitiveSubstringLocaleMatch(['Abc'], 'ABCDEFG', 'en-GB')
      expect(result).toEqual(false)
    })
    test('should match DÉF to ABCDEFG', () => {
      const result = s.caseSensitiveSubstringLocaleMatch(['DÉF'], 'ABCDEFG', 'en-GB')
      expect(result).toEqual(true)
    })
    test('should match DEF to ABCDÉFG', () => {
      const result = s.caseSensitiveSubstringLocaleMatch(['DEF'], 'ABCDÉFG', 'en-GB')
      expect(result).toEqual(true)
    })
    test('should match [BOB, CAT, DÉF] to ABCDEFG', () => {
      const result = s.caseSensitiveSubstringLocaleMatch(['BOB', 'CAT', 'DEF'], 'ABCDEFG', 'en-GB')
      expect(result).toEqual(true)
    })
    test('should not match [BOB, CAT, FRED] to ABCDEFG', () => {
      const result = s.caseSensitiveSubstringLocaleMatch(['BOB', 'CAT', 'FRED'], 'ABCDÉFG', 'en-GB')
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

  describe('getDedupedHashtagsFromList', () => {
    test('should want "#project/management/theory from longer set', () => {
      const result = s.getDedupedHashtagsFromList(['#project', '#project/management', '#project/management/theory'])
      expect(result).toEqual(['#project/management/theory'])
    })
    test('should want "#project/management/theory from longer set', () => {
      const result = s.getDedupedHashtagsFromList(['#project', '#project/management', '#project/startup', '#society', '#society/problems'])
      expect(result).toEqual(['#project/management', '#project/startup', '#society/problems'])
    })
    test('should not subset match "#project/management" from "#project/man" as break is in wrong place', () => {
      const result = s.getDedupedHashtagsFromList(['#project/man', '#project/management'])
      expect(result).toEqual(['#project/man', '#project/management'])
    })
    test('should not subset match "#project/man" from "#project/management" as break is in wrong place', () => {
      const result = s.getDedupedHashtagsFromList(['#project/management', '#project/man'])
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

  // Identical logic is found in isMentionWanted

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

  describe('isSearchOperator', () => {
    test('should return false from empty input', () => {
      const result = s.isSearchOperator('')
      expect(result).toEqual(false)
    })
    test('should return false from input preceded by a backslash', () => {
      const result = s.isSearchOperator('\\term1:xxx')
      expect(result).toEqual(false)
    })
    test('should return true from input with a quoted value', () => {
      const result = s.isSearchOperator('term1:"Holy Spirit"')
      expect(result).toEqual(true)
    })
    test('should return false from input with an unquoted value', () => {
      const result = s.isSearchOperator('term1:Holy Spirit')
      expect(result).toEqual(false)
    })
    test('should return true from input with a quoted value', () => {
      const result = s.isSearchOperator('term1:"Holy Spirit"')
      expect(result).toEqual(true)
    })
    test('should return false from input with a dash in key', () => {
      const result = s.isSearchOperator('key-1:this-and-that')
      expect(result).toEqual(false)
    })
    test('should return false from input with a space in key', () => {
      const result = s.isSearchOperator('key 1:this-and-that')
      expect(result).toEqual(false)
    })
    test('should return true from input with a dash in value', () => {
      const result = s.isSearchOperator('term1:this-and-that')
      expect(result).toEqual(true)
    })
    test('should return true for underscore in key', () => {
      const result = s.isSearchOperator('key_one:value')
      expect(result).toEqual(true)
    })
    test('should return true for numeric value', () => {
      const result = s.isSearchOperator('k1:2')
      expect(result).toEqual(true)
    })
    test('should return false for unclosed quoted value', () => {
      const result = s.isSearchOperator('term1:"Holy')
      expect(result).toEqual(false)
    })
  })

  
  describe('getSearchOperators', () => {
    test('should return empty array from empty input', () => {
      const result = s.getSearchOperators('')
      expect(result).toEqual([])
    })
    test('should return a single hyphenated operator', () => {
      const result = s.getSearchOperators('date:2025-09-01-2025-09-30 term1')
      expect(result).toEqual(['date:2025-09-01-2025-09-30'])
    })
    test('should return array of search operators from input', () => {
      const result = s.getSearchOperators('term1:xxx term2:yyy')
      expect(result).toEqual(['term1:xxx', 'term2:yyy'])
    })
    test('should return array of search operators from input ignoring the search terms', () => {
      const result = s.getSearchOperators('term1:xxx term2:yyy term3:zzz term1 term2 OR term3 -term4')
      expect(result).toEqual(['term1:xxx', 'term2:yyy', 'term3:zzz'])
    })
    test('ignore search operators preceded by a backslash', () => {
      const result = s.getSearchOperators('term1:xxx \\term2:yyy')
      expect(result).toEqual(['term1:xxx'])
    })
    test('should return array of search operators from input with double quotes', () => {
      const result = s.getSearchOperators('term1:xxx term2:"Holy Spirit" term3:zzz')
      expect(result).toEqual(['term1:xxx', 'term2:Holy Spirit', 'term3:zzz'])
    })
    test('should include operator with underscore in key', () => {
      const result = s.getSearchOperators('key_one:val term')
      expect(result).toEqual(['key_one:val'])
    })
    test('should handle quoted operator and normal operator order', () => {
      const result = s.getSearchOperators('heading:"Project A" is:open')
      expect(result).toEqual(['heading:Project A', 'is:open'])
    })
    test('should ignore escaped operator', () => {
      const result = s.getSearchOperators('term1:xxx \\term2:yyy')
      expect(result).toEqual(['term1:xxx'])
    })
    test('should handle multiple spaces between tokens', () => {
      const result = s.getSearchOperators('term1:xxx   term2:yyy')
      expect(result).toEqual(['term1:xxx', 'term2:yyy'])
    })
    test('should ignore valid-looking operators after non-operators', () => {
      const result = s.getSearchOperators('term1:xxx (alpha OR beta) -gamma term2:"Holy Spirit"')
      expect(result).toEqual(['term1:xxx'])
    })
  })

  describe('removeSearchOperators', () => {
    test('should return empty string from empty input', () => {
      const result = s.removeSearchOperators('')
      expect(result).toEqual('')
    })
    test('should return input string from single term', () => {
      const result = s.removeSearchOperators('term1')
      expect(result).toEqual('term1')
    })
    test('for multiple (AND) terms', () => {
      const result = s.removeSearchOperators('term1 term2')
      expect(result).toEqual('term1 term2')
    })
    test('should remove single leading search operator leaving search terms after it', () => {
      const result = s.removeSearchOperators('operatorA:xxx term2 term3')
      expect(result).toEqual('term2 term3')
    })
    test('should remove multiple leading search operators but leave one that is preceded by a backslash', () => {
      const result = s.removeSearchOperators('operatorA:2025-09-01 is:not-task \\operatorC:zzz term4')
      expect(result).toEqual('\\operatorC:zzz term4')
    })
    test('should remove single leading search operator and leave others after search terms', () => {
      const result = s.removeSearchOperators('operatorA:xxx term2 operatorB:yyy operatorC:zzz')
      expect(result).toEqual('term2 operatorB:yyy operatorC:zzz')
    })
    test('should leave escaped colon in operator at start untouched', () => {
      const result = s.removeSearchOperators('\\term1:xxx term2')
      expect(result).toEqual('\\term1:xxx term2')
    })
    test('should remove quoted operator at start', () => {
      const result = s.removeSearchOperators('heading:"Project A" term')
      expect(result).toEqual('term')
    })
    test('should not remove when first token is not operator', () => {
      const result = s.removeSearchOperators('term operatorA:xxx')
      expect(result).toEqual('term operatorA:xxx')
    })
  })
  
  describe('quoteTermsInSearchString', () => {
    test('should return empty string from empty input', () => {
      const result = s.quoteTermsInSearchString('')
      expect(result).toEqual('')
    })
    test('should return input string from single term', () => {
      const result = s.quoteTermsInSearchString('term1')
      expect(result).toEqual('"term1"')
    })
    test('for multiple (AND) terms', () => {
      const result = s.quoteTermsInSearchString('term1 term2')
      expect(result).toEqual('"term1" "term2"')
    })
    test('For OR-d terms', () => {
      const result = s.quoteTermsInSearchString('term1 OR term2')
      expect(result).toEqual('"term1" OR "term2"')
    })
    test('for negated terms', () => {
      const result = s.quoteTermsInSearchString('-term1 -term2')
      expect(result).toEqual('"-term1" "-term2"')
    })
    test('for negated terms in parentheses', () => {
      const result = s.quoteTermsInSearchString('-(term1 OR term2)')
      expect(result).toEqual('-("term1" OR "term2")')
    })
    test('for quoted single-word terms, return as is', () => {
      const result = s.quoteTermsInSearchString('"term1" "term2"')
      expect(result).toEqual('"term1" "term2"')
    })
    test('for quoted multi-word terms, return as is', () => {
      const result = s.quoteTermsInSearchString('"Holy Spirit"')
      expect(result).toEqual('"Holy Spirit"')
    })
    test('For complex mix of terms', () => {
      const result = s.quoteTermsInSearchString('term1 (term2 OR term3) -term4')
      expect(result).toEqual('"term1" ("term2" OR "term3") "-term4"')
    })
  })
})
