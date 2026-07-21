/* global describe, expect, test, beforeAll */

import colors from 'chalk'
import * as h from '../HTMLView'
import * as n from '../NPThemeToCSS'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan /*Note, Paragraph*/ } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging or 'none' to turn off
})

// import { clo, logDebug, logError, logWarn } from '@helpers/dev'

const FILE = `${colors.yellow('helpers/NPSyncedCopies')}`

describe(`${FILE}`, () => {
  /*
   * generateScriptTags()
   */
  describe('generateScriptTags()' /* function */, () => {
    test('should return empty if scripts is undefined', () => {
      const result = h.generateScriptTags(undefined)
      expect(result).toEqual(``)
    })
    test('should return empty if scripts is null', () => {
      const result = h.generateScriptTags(null)
      expect(result).toEqual(``)
    })
    test('should return empty if scripts is empty string', () => {
      const result = h.generateScriptTags('')
      expect(result).toEqual(``)
    })
    test('should not add <script> tag if STRING already has it', () => {
      const input = '<script>foo</script>'
      const result = h.generateScriptTags(input)
      expect(result).toEqual(`${input}\n`)
    })
    test('should add <script> tag if STRING does not have it', () => {
      const input = 'foo'
      const result = h.generateScriptTags(input)
      expect(result).toEqual(`<script type="text/javascript">\n${input}\n</script>\n`)
    })
    test('should add <script> tag if OBJ does not have it', () => {
      const input = { code: 'foo' }
      const result = h.generateScriptTags(input)
      expect(result).toEqual(`<script type="text/javascript">\nfoo\n</script>\n`)
    })
    test('should not add <script> tag if OBJ does have it', () => {
      const input = { code: '<script>foo</script>' }
      const result = h.generateScriptTags(input)
      expect(result).toEqual('<script>foo</script>\n')
    })
    test('should add <script type="xxx"> tag if OBJ does have it', () => {
      const input = { code: 'foo', type: 'bar' }
      const result = h.generateScriptTags(input)
      expect(result).toEqual('<script type="bar">\nfoo\n</script>\n')
    })
    test('should add multiple mixed types', () => {
      const input = [{ code: 'foo', type: 'bar' }, 'foo']
      const result = h.generateScriptTags(input)
      expect(result).toEqual(`<script type="bar">\nfoo\n</script>\n\n<script type="text/javascript">\nfoo\n</script>\n`)
    })
  })

  /*
   * pruneTheme()
   */
  describe('pruneTheme()' /* function */, () => {
    test('should do nothing if nothing to trim (empty)', () => {
      const orig = {}
      const expected = null
      const result = h.pruneTheme(orig)
      expect(result).toEqual(expected)
    })
    test('should do nothing if nothing to trim 2', () => {
      const orig = { foo: 'bar' }
      // const expected = {}
      const result = h.pruneTheme(orig)
      expect(result).toEqual(orig)
    })
    test('should trim a top level item', () => {
      const orig = { __orderedStyles: ['title-mark1', 'title-mark2'] }
      const expected = null
      const result = h.pruneTheme(orig)
      expect(result).toEqual(expected)
    })
    test('should trim a top level item but leave others', () => {
      const orig = { __orderedStyles: ['title-mark1', 'title-mark2'], name: 'foo' }
      const expected = { name: 'foo' }
      const result = h.pruneTheme(orig)
      expect(result).toEqual(expected)
    })
    test('should remove properties inside of a style', () => {
      const orig = {
        styles: {
          'NoteLinks-main-cancelled': {
            font: 'noteplanstate',
            isRevealOnCursorRange: true,
            isMarkdownCharacter: true,
            matchPosition: 1,
            regex: '\\h(-\\[\\[)(.*?)(\\]\\])',
            color: '#C5487A',
          },
        },
      }
      const expected = {
        styles: {
          'NoteLinks-main-cancelled': {
            font: 'noteplanstate',
            color: '#C5487A',
          },
        },
      }
      const result = h.pruneTheme(orig)
      expect(result).toEqual(expected)
    })
    test('should remove property that has empty value', () => {
      const orig = {
        styles: {
          'NoteLinks-main-cancelled': {
            foo: '',
            font: 'noteplanstate',
            isRevealOnCursorRange: true,
            isMarkdownCharacter: true,
            matchPosition: 1,
            regex: '\\h(-\\[\\[)(.*?)(\\]\\])',
            color: '#C5487A',
          },
        },
      }
      const expected = {
        styles: {
          'NoteLinks-main-cancelled': {
            font: 'noteplanstate',
            color: '#C5487A',
          },
        },
      }
      const result = h.pruneTheme(orig)
      expect(result).toEqual(expected)
    })
    test('should remove properties inside of a style', () => {
      const orig = {
        __orderedStyles: ['title-mark1', 'title-mark2'],
        styles: {
          'NoteLinks-main-cancelled': {
            font: 'noteplanstate',
            isRevealOnCursorRange: true,
            isMarkdownCharacter: true,
            matchPosition: 1,
            regex: '\\h(-\\[\\[)(.*?)(\\]\\])',
            color: '#C5487A',
          },
        },
      }
      const expected = {
        styles: {
          'NoteLinks-main-cancelled': {
            font: 'noteplanstate',
            color: '#C5487A',
          },
        },
      }
      const result = h.pruneTheme(orig)
      expect(result).toEqual(expected)
    })
    test('should remove empty objects after removing all props', () => {
      const orig = {
        styles: {
          'NoteLinks-main-cancelled': {
            isRevealOnCursorRange: true,
            isMarkdownCharacter: true,
            matchPosition: 1,
            regex: '\\h(-\\[\\[)(.*?)(\\]\\])',
          },
        },
      }
      const expected = null
      const result = h.pruneTheme(orig)
      expect(result).toEqual(expected)
    })
  })
})

/*
 * replaceMarkdownLinkWithHTMLLink()
 */
describe('replaceMarkdownLinkWithHTMLLink()' /* function */, () => {
  test('should not do anything if no url', () => {
    const orig = 'foo bar'
    const result = h.replaceMarkdownLinkWithHTMLLink(orig)
    expect(result).toEqual(orig)
  })
  test('should replace a url', () => {
    const orig = 'foo [link](http://) bar'
    const result = h.replaceMarkdownLinkWithHTMLLink(orig)
    const expected = 'foo <a href="http://">link</a> bar'
    expect(result).toEqual(expected)
  })
  test('should replace > 1 url', () => {
    const orig = 'foo [link](http://) bar [link2](http://) baz [link3](noteplan://)'
    const result = h.replaceMarkdownLinkWithHTMLLink(orig)
    const expected = 'foo <a href="http://">link</a> bar <a href="http://">link2</a> baz <a href="noteplan://">link3</a>'
    expect(result).toEqual(expected)
  })
})

/*
 * convertBoldAndItalicToHTML()
 */
describe('convertBoldAndItalicToHTML()' /* function */, () => {
  test('with no url or bold/italic', () => {
    const orig = 'foo bar and nothing else'
    const result = h.convertBoldAndItalicToHTML(orig)
    expect(result).toEqual(orig)
  })
  test('with url', () => {
    const orig = 'Has a URL [NP Help](http://help.noteplan.co/) and nothing else'
    const result = h.convertBoldAndItalicToHTML(orig)
    expect(result).toEqual(orig)
  })
  test('with bold-italic and bold', () => {
    const orig = 'foo **bar** and ***nothing else*** ok?'
    const result = h.convertBoldAndItalicToHTML(orig)
    const expected = 'foo <b>bar</b> and <b><em>nothing else</em></b> ok?'
    expect(result).toEqual(expected)
  })
  test('with bold', () => {
    const orig = 'foo **bar** and __nothing else__ ok?'
    const result = h.convertBoldAndItalicToHTML(orig)
    const expected = 'foo <b>bar</b> and <b>nothing else</b> ok?'
    expect(result).toEqual(expected)
  })
  test('with bold and some in a URL', () => {
    const orig = 'foo **bar** and http://help.noteplan.co/something/this__and__that a more complex URL'
    const result = h.convertBoldAndItalicToHTML(orig)
    const expected = 'foo <b>bar</b> and http://help.noteplan.co/something/this__and__that a more complex URL'
    expect(result).toEqual(expected)
  })
  test('with bold and some in a URL', () => {
    const orig = 'foo **bar** and http://help.noteplan.co/something/this__end with a later__ to ignore'
    const result = h.convertBoldAndItalicToHTML(orig)
    const expected = 'foo <b>bar</b> and http://help.noteplan.co/something/this__end with a later__ to ignore'
    expect(result).toEqual(expected)
  })

  test('with italic', () => {
    const orig = 'foo *bar* and _nothing else_ ok?'
    const result = h.convertBoldAndItalicToHTML(orig)
    const expected = 'foo <em>bar</em> and <em>nothing else</em> ok?'
    expect(result).toEqual(expected)
  })
  test('with italic and some in a URL', () => {
    const orig = 'foo *bar* and http://help.noteplan.co/something/this_and_that a more complex URL'
    const result = h.convertBoldAndItalicToHTML(orig)
    const expected = 'foo <em>bar</em> and http://help.noteplan.co/something/this_and_that a more complex URL'
    expect(result).toEqual(expected)
  })
  test('with italic and some in a URL', () => {
    const orig = 'foo *bar* and http://help.noteplan.co/something/this_end with a later_ to ignore'
    const result = h.convertBoldAndItalicToHTML(orig)
    const expected = 'foo <em>bar</em> and http://help.noteplan.co/something/this_end with a later_ to ignore'
    expect(result).toEqual(expected)
  })
})

  describe('convertUnderlinedToHTML()' /* function */, () => {
    test('with no url or underlined', () => {
      const orig = 'foo bar and nothing else'
      const result = h.convertUnderlinedToHTML(orig)
      expect(result).toEqual(orig)
    })
    test('with url', () => {
      const orig = 'Has a URL [NP Help](http://help.noteplan.co/) and nothing else'
      const result = h.convertUnderlinedToHTML(orig)
      expect(result).toEqual(orig)
    })
    test('with underlined', () => {
      const orig = 'foo ~bar~ and nothing else'
      const result = h.convertUnderlinedToHTML(orig)
      expect(result).toEqual('foo <span class="underlined">bar</span> and nothing else')
    })
    test('with more underlined', () => {
      const orig = 'foo ~bar and baz~ and nothing else'
      const result = h.convertUnderlinedToHTML(orig)
      expect(result).toEqual('foo <span class="underlined">bar and baz</span> and nothing else')
    })
    test('with underlined and some in a URL', () => {
      const orig = 'Listen to [Test Markdown URL](https://clicks.test.com/some/with~underlined~pair-ok/ending)'
      const result = h.convertUnderlinedToHTML(orig)
      expect(result).toEqual(orig)
    })
    test('with long zoe link', () => {
      const orig = 'Listen to <a class="externalLink" href="https:\/\/clicks\.zoe\.com\/f\/a\/ZUR-0srQ-voOYivE4-3Cbg~~\/AAAHahA~\/fH9o0ZGdoctxiA8NAti-k_kpEV5DfcBrJIeeam2Wljd6UlF32coJF72IbaXEqXuz2Rc3802HgSB89r9AF3WTETv_oTnTmiMO1PJUB6L0lyl4zgV0wIeqN-cN7UCKE-w9ae9gwDezk5Le3Ki1PnFnKakfEhdrxfgAgdX28SS8PyM~"><i class="fa-regular fa-globe externalLinkIcon"><\/i>Protein on a plant-based diet | Prof. Tim Spector and Dr. Rupy Aujla ~ ZOE</a>$'
      const result = h.convertUnderlinedToHTML(orig)
      expect(result).toEqual(orig)
    })
  })

  describe('convertStrikethroughToHTML()' /* function */, () => {
    test('with no url or strikethrough', () => {
      const orig = 'foo bar and nothing else'
      const result = h.convertStrikethroughToHTML(orig)
      expect(result).toEqual(orig)
    })
    test('with url', () => {
      const orig = 'Has a URL [NP Help](http://help.noteplan.co/) and nothing else'
      const result = h.convertStrikethroughToHTML(orig)
      expect(result).toEqual(orig)
    })
    test('with strikethrough', () => {
      const orig = 'foo ~~bar~~ and nothing else'
      const result = h.convertStrikethroughToHTML(orig)
      expect(result).toEqual('foo <span class="strikethrough">bar</span> and nothing else')
    })
    test('with strikethrough and some in a URL', () => {
      const orig = 'Listen to [Low-carb diets and sugar spikes | Prof. Tim Spector ~ ZOE](https://clicks.zoe.com/f/a/dAgKh6AB8eEXtAsfVZAruQ~~/AAAHahA~/fH9o0ZGdoctxiA8NAti-k_kpEV5DfcBrJIeeam2Wljfzbxj0fcKOfK3AYKbmVevONgJ47zckYA_4vS_pNxs7JgRkrShVwPCAhgMGMHCRYPhB_HHOjoSolH6GF-1WvM08xMcWon8sQI9tDzxayAenpO0u1CJCyUeKVsDziwbA6RY~)'
      const result = h.convertStrikethroughToHTML(orig)
      expect(result).toEqual(orig)
    })
  })

describe('convertHashtagsToHTML()' /* function */, () => {
  test('with no hashtag', () => {
    const orig = 'foo bar and nothing else'
    const result = h.convertHashtagsToHTML(orig)
    expect(result).toEqual(orig)
  })
  test('with hashtag', () => {
    const orig = 'foo #bar and nothing else'
    const expected = 'foo <span class="hashtag">#bar</span> and nothing else'
    const result = h.convertHashtagsToHTML(orig)
    expect(result).toEqual(expected)
  })
  test.skip('with emoji hashtag', () => {
    const orig = 'foo #🇺🇸 and nothing else'
    const expected = 'foo <span class="hashtag">#🇺🇸</span> and nothing else'
    const result = h.convertHashtagsToHTML(orig)
    expect(result).toEqual(expected)
  })
  test('with unicode hashtag', () => {
    const orig = 'foo #КЛМНОПРСТУФ and nothing else'
    const expected = 'foo <span class="hashtag">#КЛМНОПРСТУФ</span> and nothing else'
    const result = h.convertHashtagsToHTML(orig)
    expect(result).toEqual(expected)
  })
  test('with multi-part hashtag', () => {
    const orig = 'foo #company/team/project bar'
    const expected = 'foo <span class="hashtag">#company/team/project</span> bar'
    const result = h.convertHashtagsToHTML(orig)
    expect(result).toEqual(expected)
  })
  test('with multiple hashtags', () => {
    const orig = 'foo #bar #baz and #nothing else'
    const expected = 'foo <span class="hashtag">#bar</span> <span class="hashtag">#baz</span> and <span class="hashtag">#nothing</span> else'
    const result = h.convertHashtagsToHTML(orig)
    expect(result).toEqual(expected)
  })
})

describe('convertMentionsToHTML()' /* function */, () => {
  test('with no mention', () => {
    const orig = 'foo bar and nothing else'
    const result = h.convertMentionsToHTML(orig)
    expect(result).toEqual(orig)
  })
  test('with mention', () => {
    const orig = 'foo @bar and nothing else'
    const expected = 'foo <span class="attag">@bar</span> and nothing else'
    const result = h.convertMentionsToHTML(orig)
    expect(result).toEqual(expected)
  })
  test('with mention with (...)', () => {
    const orig = 'foo @bar(+2w) and nothing else'
    const expected = 'foo <span class="attag">@bar(+2w)</span> and nothing else'
    const result = h.convertMentionsToHTML(orig)
    expect(result).toEqual(expected)
  })
  test.skip('with emoji mention', () => {
    const orig = 'foo @🇺🇸 and nothing else'
    const expected = 'foo <span class="attag">@🇺🇸</span> and nothing else'
    const result = h.convertMentionsToHTML(orig)
    expect(result).toEqual(expected)
  })
  test('with unicode mention', () => {
    const orig = 'foo @КЛМНОПРСТУФ and nothing else'
    const expected = 'foo <span class="attag">@КЛМНОПРСТУФ</span> and nothing else'
    const result = h.convertMentionsToHTML(orig)
    expect(result).toEqual(expected)
  })
  test('with multi-part mention', () => {
    const orig = 'foo @company/team/project bar'
    const expected = 'foo <span class="attag">@company/team/project</span> bar'
    const result = h.convertMentionsToHTML(orig)
    expect(result).toEqual(expected)
  })
  test('with multiple mentions', () => {
    const orig = 'foo @bar @baz and @nothing else'
    const expected = 'foo <span class="attag">@bar</span> <span class="attag">@baz</span> and <span class="attag">@nothing</span> else'
    const result = h.convertMentionsToHTML(orig)
    expect(result).toEqual(expected)
  })
})

describe('getNoteLinkDisplayText()', () => {
  test('returns plain title unchanged when short', () => {
    expect(h.getNoteLinkDisplayText('Foo')).toEqual('Foo')
  })
  test('uses alias instead of title', () => {
    expect(h.getNoteLinkDisplayText('Very Long Note Title#Heading', 'short')).toEqual('short')
  })
  test('drops #heading when no alias', () => {
    expect(h.getNoteLinkDisplayText('Acme Project#Timeline')).toEqual('Acme Project')
  })
  test('truncates titles longer than 50 with …', () => {
    const long = 'A'.repeat(60)
    expect(h.getNoteLinkDisplayText(long)).toEqual(`${'A'.repeat(50)}…`)
  })
  test('truncates alias longer than 50 with …', () => {
    const longAlias = 'B'.repeat(55)
    expect(h.getNoteLinkDisplayText('Title#H', longAlias)).toEqual(`${'B'.repeat(50)}…`)
  })
  test('drops heading then truncates', () => {
    const long = `${'C'.repeat(60)}#Heading`
    expect(h.getNoteLinkDisplayText(long)).toEqual(`${'C'.repeat(50)}…`)
  })
})

describe('findNoteLinksForDisplay()', () => {
  test('returns empty array when no note links', () => {
    expect(h.findNoteLinksForDisplay('no links here')).toEqual([])
  })
  test('finds plain note link and strips heading in displayText', () => {
    const results = h.findNoteLinksForDisplay('See [[Acme Project#Timeline]] today')
    expect(results).toHaveLength(1)
    expect(results[0].noteTitleInner).toEqual('Acme Project#Timeline')
    expect(results[0].displayText).toEqual('Acme Project')
    expect(results[0].alias).toEqual('')
  })
  test('finds aliased note link and prefers alias for displayText', () => {
    const results = h.findNoteLinksForDisplay('See [short]([[Very Long Title#Section]]) today')
    expect(results).toHaveLength(1)
    expect(results[0].fullMatch).toEqual('[short]([[Very Long Title#Section]])')
    expect(results[0].noteTitleInner).toEqual('Very Long Title#Section')
    expect(results[0].alias).toEqual('short')
    expect(results[0].displayText).toEqual('short')
  })
  test('does not also return the inner [[...]] of an aliased link', () => {
    const results = h.findNoteLinksForDisplay('[a]([[Title]]) and [[Other]]')
    expect(results).toHaveLength(2)
    const displayTexts = results.map((r) => r.displayText).sort()
    expect(displayTexts).toEqual(['Other', 'a'])
  })
  test('truncates long plain titles', () => {
    const long = 'X'.repeat(60)
    const results = h.findNoteLinksForDisplay(`[[${long}]]`)
    expect(results[0].displayText).toEqual(`${'X'.repeat(50)}…`)
  })
  test('returns matches sorted by startIndex descending', () => {
    const results = h.findNoteLinksForDisplay('[[First]] then [[Second]]')
    expect(results[0].noteTitleInner).toEqual('Second')
    expect(results[1].noteTitleInner).toEqual('First')
    expect(results[0].startIndex).toBeGreaterThan(results[1].startIndex)
  })
})

