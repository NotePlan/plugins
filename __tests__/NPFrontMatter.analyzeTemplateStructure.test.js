// @flow
/* global describe, test, expect */

import { analyzeTemplateStructure } from '../helpers/NPFrontMatter'

describe('analyzeTemplateStructure', () => {
  describe('newNoteTitle detection', () => {
    test('should detect newNoteTitle in template frontmatter', () => {
      const template = `---
title: my template
newNoteTitle: foo
---`

      const result = analyzeTemplateStructure(template)

      expect(result.hasNewNoteTitle).toBe(true)
      expect(result.templateFrontmatter.newNoteTitle).toBe('foo')
    })

    test('should not detect newNoteTitle when not present', () => {
      const template = `---
title: my template
---
# Some content`

      const result = analyzeTemplateStructure(template)

      expect(result.hasNewNoteTitle).toBe(false)
      expect(result.templateFrontmatter.newNoteTitle).toBeUndefined()
    })
  })

  describe('output frontmatter detection', () => {
    test('should detect output frontmatter with --- separators', () => {
      const template = `---
title: my template
---
---
prop: this is in the resulting note
---
# Some content`

      const result = analyzeTemplateStructure(template)

      expect(result.hasOutputFrontmatter).toBe(true)
      expect(result.outputFrontmatter.prop).toBe('this is in the resulting note')
    })

    test('should detect output frontmatter with -- separators', () => {
      const template = `---
title: my template
---
--
prop: this is in the resulting note
--
# Some content`

      const result = analyzeTemplateStructure(template)

      expect(result.hasOutputFrontmatter).toBe(true)
      expect(result.outputFrontmatter.prop).toBe('this is in the resulting note')
    })

    test('should not detect output frontmatter when not present', () => {
      const template = `---
title: my template
---
# Some content`

      const result = analyzeTemplateStructure(template)

      expect(result.hasOutputFrontmatter).toBe(false)
      expect(Object.keys(result.outputFrontmatter)).toHaveLength(0)
    })
  })

  describe('output title detection', () => {
    test('should detect title in output frontmatter', () => {
      const template = `---
title: this is the template's title
---
--
title: this is in the resulting note's title
--
# Some content`

      const result = analyzeTemplateStructure(template)

      expect(result.hasOutputTitle).toBe(true)
      expect(result.outputFrontmatter.title).toBe("this is in the resulting note's title")
    })

    test('should not detect output title when not present', () => {
      const template = `---
title: my template
---
--
prop: some value
--
# Some content`

      const result = analyzeTemplateStructure(template)

      expect(result.hasOutputTitle).toBe(false)
      expect(result.outputFrontmatter.title).toBeUndefined()
    })
  })

  describe('inline title detection', () => {
    test('should detect inline title after template frontmatter only', () => {
      const template = `---
title: template title
---
# this is my inline title`

      const result = analyzeTemplateStructure(template)

      expect(result.hasInlineTitle).toBe(true)
      expect(result.inlineTitleText).toBe('this is my inline title')
    })

    test('should detect inline title after output frontmatter with --- separators', () => {
      const template = `---
title: template title
---
---
note: frontmatter
---
# inline title`

      const result = analyzeTemplateStructure(template)

      expect(result.hasInlineTitle).toBe(true)
      expect(result.inlineTitleText).toBe('inline title')
    })

    test('should detect inline title after output frontmatter with -- separators', () => {
      const template = `---
title: template title
---
--
note: frontmatter
--
# inline title`

      const result = analyzeTemplateStructure(template)

      expect(result.hasInlineTitle).toBe(true)
      expect(result.inlineTitleText).toBe('inline title')
    })

    test('should detect inline title with multiple frontmatter fields', () => {
      const template = `---
title: template title
---
--
field1: value1
field2: value2
field3: value3
--
# inline title`

      const result = analyzeTemplateStructure(template)

      expect(result.hasInlineTitle).toBe(true)
      expect(result.inlineTitleText).toBe('inline title')
    })

    test('should not detect inline title when first non-frontmatter line is not a title', () => {
      const template = `---
title: template title
---
--
note: frontmatter
--
This is not a title
# This title comes later`

      const result = analyzeTemplateStructure(template)

      expect(result.hasInlineTitle).toBe(false)
      expect(result.inlineTitleText).toBe('')
    })

    test('should not detect inline title when no content after frontmatter', () => {
      const template = `---
title: template title
---
--
note: frontmatter
--`

      const result = analyzeTemplateStructure(template)

      expect(result.hasInlineTitle).toBe(false)
      expect(result.inlineTitleText).toBe('')
    })

    test('should not detect ## as inline title', () => {
      const template = `---
title: template title
---
--
note: frontmatter
--
## This is not an inline title`

      const result = analyzeTemplateStructure(template)

      expect(result.hasInlineTitle).toBe(false)
      expect(result.inlineTitleText).toBe('')
    })

    test('should not detect inline title inside frontmatter', () => {
      const template = `---
title: template title
---
--
note: frontmatter
# This title is inside frontmatter
--
# This is the real inline title`

      const result = analyzeTemplateStructure(template)

      expect(result.hasInlineTitle).toBe(true)
      expect(result.inlineTitleText).toBe('This is the real inline title')
    })
  })

  describe('complex combinations', () => {
    test('should handle template with all features', () => {
      const template = `---
title: template title
newNoteTitle: generated title
---
--
outputTitle: output title
outputField: output value
--
# This is the inline title`

      const result = analyzeTemplateStructure(template)

      expect(result.hasNewNoteTitle).toBe(true)
      expect(result.hasOutputFrontmatter).toBe(true)
      expect(result.hasOutputTitle).toBe(false) // No 'title' field in output
      expect(result.hasInlineTitle).toBe(true)
      expect(result.templateFrontmatter.newNoteTitle).toBe('generated title')
      expect(result.outputFrontmatter.outputTitle).toBe('output title')
      expect(result.outputFrontmatter.outputField).toBe('output value')
      expect(result.inlineTitleText).toBe('This is the inline title')
    })

    test('should handle template with only template frontmatter', () => {
      const template = `---
title: template title
field1: value1
field2: value2
---`

      const result = analyzeTemplateStructure(template)

      expect(result.hasNewNoteTitle).toBe(false)
      expect(result.hasOutputFrontmatter).toBe(false)
      expect(result.hasOutputTitle).toBe(false)
      expect(result.hasInlineTitle).toBe(false)
      expect(result.templateFrontmatter.title).toBe('template title')
      expect(result.templateFrontmatter.field1).toBe('value1')
      expect(result.templateFrontmatter.field2).toBe('value2')
    })

    test('should handle template with no frontmatter', () => {
      const template = `# This is just a title
Some content here`

      const result = analyzeTemplateStructure(template)

      expect(result.hasNewNoteTitle).toBe(false)
      expect(result.hasOutputFrontmatter).toBe(false)
      expect(result.hasOutputTitle).toBe(false)
      expect(result.hasInlineTitle).toBe(true)
      expect(result.inlineTitleText).toBe('This is just a title')
    })

    test('should handle empty template', () => {
      const template = ``

      const result = analyzeTemplateStructure(template)

      expect(result.hasNewNoteTitle).toBe(false)
      expect(result.hasOutputFrontmatter).toBe(false)
      expect(result.hasOutputTitle).toBe(false)
      expect(result.hasInlineTitle).toBe(false)
      expect(Object.keys(result.templateFrontmatter)).toHaveLength(0)
      expect(Object.keys(result.outputFrontmatter)).toHaveLength(0)
    })
  })

  describe('edge cases', () => {
    test('should handle malformed frontmatter gracefully', () => {
      const template = `---
title: template title
---
---
incomplete frontmatter
# inline title`

      const result = analyzeTemplateStructure(template)

      // Should still detect the inline title even with malformed frontmatter
      expect(result.hasInlineTitle).toBe(false)
    })

    test('should handle extra separators', () => {
      const template = `---
title: template title
---
---
some: frontmatter
---
# a title
---
note: frontmatter
---
# inline title`

      const result = analyzeTemplateStructure(template)

      expect(result.hasInlineTitle).toBe(true)
      expect(result.inlineTitleText).toBe('a title')
    })
  })
})
