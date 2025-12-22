/* eslint-disable */
import { CustomConsole } from '@jest/console'
import { simpleFormatter } from '@mocks/index'

import { getTags } from '../lib/core'
import {
  isCommentTag,
  codeBlockHasComment,
  blockIsJavaScript,
  getCodeBlocks,
  getIgnoredCodeBlocks,
  convertTemplateJSBlocksToControlTags,
  isCode,
  isTemplateModule,
  isVariableTag,
  isMethod,
  CODE_BLOCK_COMMENT_TAGS,
  TEMPLATE_MODULES,
} from '../lib/core/tagUtils'
import { tempSaveIgnoredCodeBlocks } from '../lib/rendering/templateProcessor'

beforeAll(() => {
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
  global.DataStore = { settings: { _logLevel: 'none' } }
})

describe('tagUtils', () => {
  describe('getTags', () => {
    it('should find single-line tags', async () => {
      const template = '<% if (true) { %>Hello<% } %>'
      const tags = await getTags(template)

      expect(tags).toHaveLength(2)
      expect(tags[0]).toBe('<% if (true) { %>')
      expect(tags[1]).toBe('<% } %>')
    })

    it('should find multi-line tags', async () => {
      const template = `<%
  const x = 1;
  if (x === 1) {
%>Hello<% } %>`
      const tags = await getTags(template)

      expect(tags).toHaveLength(2)
      expect(tags[0]).toContain('const x = 1')
      expect(tags[0]).toContain('if (x === 1)')
      expect(tags[1]).toBe('<% } %>')
    })

    it('should find user original problematic template tags', async () => {
      const template = `<%
  const formattedDate = date.format("YYYY-MM-DD", Editor.title);
  const dayNum = date.dayNumber(formattedDate); // Sunday = 0, Saturday = 6
  const weekdays = [1, 2, 3, 4, 5]; // Monday to Friday
  if (weekdays.includes(dayNum)) {
%>
+ 16:30 - 17:00 :brain: Review my day and plan tomorrow
<% } %>`
      const tags = await getTags(template)

      expect(tags).toHaveLength(2)
      expect(tags[0]).toContain('const formattedDate')
      expect(tags[0]).toContain('const dayNum')
      expect(tags[0]).toContain('const weekdays')
      expect(tags[0]).toContain('if (weekdays.includes(dayNum))')
      expect(tags[1]).toBe('<% } %>')
    })

    it('should find output tags', async () => {
      const template = '<%- variable %> and <%= expression %>'
      const tags = await getTags(template)

      expect(tags).toHaveLength(2)
      expect(tags[0]).toBe('<%- variable %>')
      expect(tags[1]).toBe('<%= expression %>')
    })

    it('should find comment tags', async () => {
      const template = '<%# This is a comment %><% code %>'
      const tags = await getTags(template)

      expect(tags).toHaveLength(2)
      expect(tags[0]).toBe('<%# This is a comment %>')
      expect(tags[1]).toBe('<% code %>')
    })

    it('should return empty array for template with no tags', async () => {
      const template = 'Just plain text with no tags'
      const tags = await getTags(template)

      expect(tags).toHaveLength(0)
    })

    it('should return empty array for empty template', async () => {
      const tags = await getTags('')
      expect(tags).toHaveLength(0)
    })
  })

  describe('isCommentTag', () => {
    it('should identify comment tags', () => {
      expect(isCommentTag('<%# This is a comment %>')).toBe(true)
      expect(isCommentTag('<%# Another comment %>')).toBe(true)
    })

    it('should not identify non-comment tags as comments', () => {
      expect(isCommentTag('<% code %>')).toBe(false)
      expect(isCommentTag('<%- output %>')).toBe(false)
      expect(isCommentTag('<%= expression %>')).toBe(false)
    })

    it('should handle empty string', () => {
      expect(isCommentTag('')).toBe(false)
    })
  })

  describe('codeBlockHasComment', () => {
    it('should detect ignore comments', () => {
      expect(codeBlockHasComment('/* template: ignore */')).toBe(true)
      expect(codeBlockHasComment('// template: ignore')).toBe(true)
      expect(codeBlockHasComment('some code\n// template: ignore\nmore code')).toBe(true)
      expect(codeBlockHasComment('template:ignore')).toBe(true)
    })

    it('should not detect regular comments', () => {
      expect(codeBlockHasComment('/* regular comment */')).toBe(false)
      expect(codeBlockHasComment('// regular comment')).toBe(false)
      expect(codeBlockHasComment('some code without ignore')).toBe(false)
    })

    it('should handle empty string', () => {
      expect(codeBlockHasComment('')).toBe(false)
    })
  })

  describe('blockIsJavaScript', () => {
    it('should identify templatejs blocks', () => {
      expect(blockIsJavaScript('```templatejs\ncode here\n```')).toBe(true)
      expect(blockIsJavaScript('```templatejs')).toBe(true)
    })

    it('should not identify other code blocks', () => {
      expect(blockIsJavaScript('```javascript\ncode here\n```')).toBe(false)
      expect(blockIsJavaScript('```js\ncode here\n```')).toBe(false)
      expect(blockIsJavaScript('```python\ncode here\n```')).toBe(false)
    })

    it('should handle empty string', () => {
      expect(blockIsJavaScript('')).toBe(false)
    })
  })

  describe('getCodeBlocks', () => {
    it('should extract single code block', () => {
      const template = 'Text before\n```javascript\ncode here\n```\nText after'
      const blocks = getCodeBlocks(template)

      expect(blocks).toHaveLength(1)
      expect(blocks[0]).toBe('```javascript\ncode here\n```')
    })

    it('should extract multiple code blocks', () => {
      const template = '```js\ncode1\n```\ntext\n```python\ncode2\n```'
      const blocks = getCodeBlocks(template)

      expect(blocks).toHaveLength(2)
      expect(blocks[0]).toBe('```js\ncode1\n```')
      expect(blocks[1]).toBe('```python\ncode2\n```')
    })

    it('should handle unclosed code block', () => {
      const template = 'Text\n```javascript\ncode here'
      const blocks = getCodeBlocks(template)

      expect(blocks).toHaveLength(1)
      expect(blocks[0]).toBe('```javascript\ncode here')
    })

    it('should return empty array for no code blocks', () => {
      const template = 'Just plain text'
      const blocks = getCodeBlocks(template)

      expect(blocks).toHaveLength(0)
    })
  })

  describe('getIgnoredCodeBlocks', () => {
    it('should extract only ignored code blocks', () => {
      const template = `
\`\`\`javascript
// template: ignore
ignored code
\`\`\`

\`\`\`python
regular code
\`\`\`

\`\`\`templatejs
/* template: ignore */
also ignored
\`\`\`
`
      const ignoredBlocks = getIgnoredCodeBlocks(template)

      expect(ignoredBlocks).toHaveLength(2)
      expect(ignoredBlocks[0]).toContain('ignored code')
      expect(ignoredBlocks[1]).toContain('also ignored')
    })

    it('should return empty array when no ignored blocks', () => {
      const template = '```javascript\nregular code\n```'
      const ignoredBlocks = getIgnoredCodeBlocks(template)

      expect(ignoredBlocks).toHaveLength(0)
    })

    it('should extract code blocks starting with template: ignore in first line', () => {
      const template = `
\`\`\`template: ignore
This entire block should be ignored
with multiple lines
\`\`\`

\`\`\`javascript
regular code
\`\`\`
`
      const ignoredBlocks = getIgnoredCodeBlocks(template)

      expect(ignoredBlocks).toHaveLength(1)
      expect(ignoredBlocks[0]).toContain('This entire block should be ignored')
      expect(ignoredBlocks[0]).toContain('with multiple lines')
    })

    it('should extract code blocks with space before template: ignore', () => {
      const template = `
\`\`\` template: ignore
Block with space before template
\`\`\`
`
      const ignoredBlocks = getIgnoredCodeBlocks(template)

      expect(ignoredBlocks).toHaveLength(1)
      expect(ignoredBlocks[0]).toContain('Block with space before template')
    })

    it('should extract code blocks with template:ignore (no space after colon)', () => {
      const template = `
\`\`\`template:ignore
Block without space after colon
\`\`\`
`
      const ignoredBlocks = getIgnoredCodeBlocks(template)

      expect(ignoredBlocks).toHaveLength(1)
      expect(ignoredBlocks[0]).toContain('Block without space after colon')
    })

    it('should extract code blocks with multiple spaces around template: ignore', () => {
      const template = `
\`\`\`  template:  ignore
Block with multiple spaces
\`\`\`
`
      const ignoredBlocks = getIgnoredCodeBlocks(template)

      expect(ignoredBlocks).toHaveLength(1)
      expect(ignoredBlocks[0]).toContain('Block with multiple spaces')
    })

    it('should not extract code blocks where template: ignore is not in first line', () => {
      const template = `
\`\`\`javascript
some code
template: ignore
more code
\`\`\`
`
      const ignoredBlocks = getIgnoredCodeBlocks(template)

      // This should not match because template: ignore is not in the first line
      expect(ignoredBlocks).toHaveLength(0)
    })

    it('should handle mixed ignored code blocks (comments and template: ignore)', () => {
      const template = `
\`\`\`javascript
// template: ignore
ignored with comment
\`\`\`

\`\`\`template: ignore
ignored with template directive
\`\`\`

\`\`\`templatejs
/* template: ignore */
also ignored
\`\`\`
`
      const ignoredBlocks = getIgnoredCodeBlocks(template)

      expect(ignoredBlocks).toHaveLength(3)
      expect(ignoredBlocks[0]).toContain('ignored with comment')
      expect(ignoredBlocks[1]).toContain('ignored with template directive')
      expect(ignoredBlocks[2]).toContain('also ignored')
    })
  })

  describe('tempSaveIgnoredCodeBlocks', () => {
    it('should completely remove code blocks starting with template: ignore', () => {
      const template = `Text before
\`\`\`template: ignore
This block should be completely removed
with multiple lines
\`\`\`
Text after`
      const result = tempSaveIgnoredCodeBlocks(template)

      expect(result.templateData).not.toContain('template: ignore')
      expect(result.templateData).not.toContain('This block should be completely removed')
      expect(result.templateData).toContain('Text before')
      expect(result.templateData).toContain('Text after')
      expect(result.codeBlocks).toHaveLength(0) // Should not be stored
    })

    it('should remove code blocks with space before template: ignore', () => {
      const template = `Before
\`\`\` template: ignore
Block with space
\`\`\`
After`
      const result = tempSaveIgnoredCodeBlocks(template)

      expect(result.templateData).not.toContain('template: ignore')
      expect(result.templateData).not.toContain('Block with space')
      expect(result.codeBlocks).toHaveLength(0)
    })

    it('should remove code blocks with template:ignore (no space after colon)', () => {
      const template = `Before
\`\`\`template:ignore
No space after colon
\`\`\`
After`
      const result = tempSaveIgnoredCodeBlocks(template)

      expect(result.templateData).not.toContain('template:ignore')
      expect(result.templateData).not.toContain('No space after colon')
      expect(result.codeBlocks).toHaveLength(0)
    })

    it('should remove code blocks with multiple spaces around template: ignore', () => {
      const template = `Before
\`\`\`  template:  ignore
Multiple spaces
\`\`\`
After`
      const result = tempSaveIgnoredCodeBlocks(template)

      expect(result.templateData).not.toContain('template:')
      expect(result.templateData).not.toContain('Multiple spaces')
      expect(result.codeBlocks).toHaveLength(0)
    })

    it('should keep code blocks with comment-style ignore (// template: ignore)', () => {
      const template = `Before
\`\`\`javascript
// template: ignore
This should be kept and protected
\`\`\`
After`
      const result = tempSaveIgnoredCodeBlocks(template)

      expect(result.templateData).toContain('__codeblock:0__')
      expect(result.templateData).not.toContain('This should be kept and protected')
      expect(result.codeBlocks).toHaveLength(1)
      expect(result.codeBlocks[0]).toContain('This should be kept and protected')
    })

    it('should keep code blocks with comment-style ignore (/* template: ignore */)', () => {
      const template = `Before
\`\`\`javascript
/* template: ignore */
This should also be kept
\`\`\`
After`
      const result = tempSaveIgnoredCodeBlocks(template)

      expect(result.templateData).toContain('__codeblock:0__')
      expect(result.codeBlocks).toHaveLength(1)
      expect(result.codeBlocks[0]).toContain('This should also be kept')
    })

    it('should handle mixed blocks - remove template: ignore but keep comment-style ignores', () => {
      const template = `Start
\`\`\`template: ignore
Remove this
\`\`\`

\`\`\`javascript
// template: ignore
Keep this
\`\`\`

\`\`\`template: ignore
Remove this too
\`\`\`
End`
      const result = tempSaveIgnoredCodeBlocks(template)

      expect(result.templateData).not.toContain('Remove this')
      expect(result.templateData).not.toContain('Remove this too')
      expect(result.templateData).toContain('__codeblock:0__') // The comment-style ignore block
      expect(result.templateData).toContain('Start')
      expect(result.templateData).toContain('End')
      expect(result.codeBlocks).toHaveLength(1) // Only the comment-style ignore block
      expect(result.codeBlocks[0]).toContain('Keep this')
    })

    it('should remove newline following template: ignore code blocks', () => {
      const template = `Line 1
\`\`\`template: ignore
Content
\`\`\`
Line 2`
      const result = tempSaveIgnoredCodeBlocks(template)

      // Should not have double newlines where the block was removed
      expect(result.templateData).toMatch(/Line 1\s+Line 2/)
      expect(result.codeBlocks).toHaveLength(0)
    })
  })

  describe('convertTemplateJSBlocksToControlTags', () => {
    it('should convert templatejs blocks to EJS tags', () => {
      const template = '```templatejs\nconst x = 1;\nconsole.log(x);\n```'
      const result = convertTemplateJSBlocksToControlTags(template)

      expect(result).toContain('<%\nconst x = 1;\nconsole.log(x);\n-%>')
      expect(result).not.toContain('```templatejs')
    })

    it('should not convert blocks with ignore comments', () => {
      const template = '```templatejs\n// template: ignore\nconst x = 1;\n```'
      const result = convertTemplateJSBlocksToControlTags(template)

      expect(result).toBe(template) // Should remain unchanged
    })

    it('should not convert blocks that already have EJS tags', () => {
      const template = '```templatejs\nconst x = 1;\n<% code %>\n```'
      const result = convertTemplateJSBlocksToControlTags(template)

      expect(result).toBe(template) // Should remain unchanged
    })

    it('should not convert non-templatejs blocks', () => {
      const template = '```javascript\nconst x = 1;\n```'
      const result = convertTemplateJSBlocksToControlTags(template)

      expect(result).toBe(template) // Should remain unchanged
    })
  })

  describe('isCode', () => {
    it('should identify function calls as code', () => {
      expect(isCode('<% someFunction() %>')).toBe(true)
      expect(isCode('<% obj.method() %>')).toBe(true)
      expect(isCode('<% func(arg1, arg2) %>')).toBe(true)
    })

    it('should identify variable declarations as code', () => {
      expect(isCode('<% const x = 1 %>')).toBe(true)
      expect(isCode('<% let y = 2 %>')).toBe(true)
      expect(isCode('<% var z = 3 %>')).toBe(true)
    })

    it('should identify properly spaced tags as code', () => {
      expect(isCode('<% expression %>')).toBe(true)
      expect(isCode('<%- output %>')).toBe(false)
      expect(isCode('<%= value %>')).toBe(false)
    })

    it('should not identify empty or whitespace-only tags as code', () => {
      expect(isCode('<% %>')).toBe(false)
      expect(isCode('<%  %>')).toBe(false)
      expect(isCode('<%-%>')).toBe(false)
    })

    it('should not identify very short tags as code', () => {
      expect(isCode('<%')).toBe(false)
      expect(isCode('%>')).toBe(false)
      expect(isCode('')).toBe(false)
    })

    it('should handle template-specific syntax', () => {
      expect(isCode('<%~ trimmed %>')).toBe(true)
    })
  })

  describe('isTemplateModule', () => {
    it('should identify template module calls', () => {
      expect(isTemplateModule('<%- date.now() %>')).toBe(true)
      expect(isTemplateModule('<%= time.format() %>')).toBe(true)
      expect(isTemplateModule('<% user.name %>')).toBe(true)
    })

    it('should not identify non-module calls', () => {
      expect(isTemplateModule('<% someFunction() %>')).toBe(false)
      expect(isTemplateModule('<% variable %>')).toBe(false)
      expect(isTemplateModule('<% obj.prop %>')).toBe(false) // obj is not a template module
    })

    it('should handle empty string', () => {
      expect(isTemplateModule('')).toBe(false)
    })
  })

  describe('isVariableTag', () => {
    it('should identify variable declaration tags', () => {
      expect(isVariableTag('<% const x = 1 %>')).toBe(true)
      expect(isVariableTag('<% let y = 2 %>')).toBe(true)
      expect(isVariableTag('<% var z = 3 %>')).toBe(true)
    })

    it('should identify tags with braces', () => {
      expect(isVariableTag('<% { key: value } %>')).toBe(true)
      expect(isVariableTag('<% } %>')).toBe(true)
    })

    it('should not identify regular expression tags', () => {
      expect(isVariableTag('<% someFunction() %>')).toBe(false)
      expect(isVariableTag('<% variable %>')).toBe(false)
    })

    it('should handle empty string', () => {
      expect(isVariableTag('')).toBe(false)
    })
  })

  describe('isMethod', () => {
    it('should identify method calls', () => {
      expect(isMethod('<% func() %>')).toBe(true)
      expect(isMethod('<% obj.method() %>')).toBe(true)
      expect(isMethod('<% prompt() %>')).toBe(true)
    })

    it('should identify @ syntax', () => {
      expect(isMethod('<% @helper %>')).toBe(true)
    })

    it('should identify methods from userData', () => {
      const userData = {
        methods: {
          customMethod: () => {},
          anotherMethod: () => {},
        },
      }
      expect(isMethod('<% customMethod() %>', userData)).toBe(true)
    })

    it('should not identify non-method tags', () => {
      expect(isMethod('<% variable %>')).toBe(false)
      expect(isMethod('<% const x = 1 %>')).toBe(false)
    })

    it('should handle empty string', () => {
      expect(isMethod('')).toBe(false)
    })
  })

  describe('constants', () => {
    it('should have correct CODE_BLOCK_COMMENT_TAGS', () => {
      expect(CODE_BLOCK_COMMENT_TAGS).toContain('/* template: ignore */')
      expect(CODE_BLOCK_COMMENT_TAGS).toContain('// template: ignore')
    })

    it('should have correct TEMPLATE_MODULES', () => {
      expect(TEMPLATE_MODULES).toContain('date')
      expect(TEMPLATE_MODULES).toContain('time')
      expect(TEMPLATE_MODULES).toContain('user')
      expect(TEMPLATE_MODULES).toContain('calendar')
      expect(TEMPLATE_MODULES).toContain('note')
      expect(TEMPLATE_MODULES).toContain('system')
      expect(TEMPLATE_MODULES).toContain('frontmatter')
      expect(TEMPLATE_MODULES).toContain('utility')
      expect(TEMPLATE_MODULES).toContain('tasks')
    })
  })
})
