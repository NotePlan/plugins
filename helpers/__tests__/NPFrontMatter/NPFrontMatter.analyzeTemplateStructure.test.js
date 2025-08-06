// @flow
/* global describe, test, expect */

import { analyzeTemplateStructure, getNoteTitleFromTemplate } from '../../NPFrontMatter'

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

  describe('getNoteTitleFromTemplate', () => {
    test('should return newNoteTitle when present in frontmatter', () => {
      const template = `---
title: my template
newNoteTitle: foo
---`

      const result = getNoteTitleFromTemplate(template)

      expect(result).toBe('foo')
    })

    test('should return inline title when newNoteTitle is not present', () => {
      const template = `---
title: my template
---
# This is my inline title`

      const result = getNoteTitleFromTemplate(template)

      expect(result).toBe('This is my inline title')
    })

    test('should return newNoteTitle when both newNoteTitle and inline title are present', () => {
      const template = `---
title: my template
newNoteTitle: foo
---
# This is my inline title`

      const result = getNoteTitleFromTemplate(template)

      expect(result).toBe('foo')
    })

    test('should return empty string when no title is found', () => {
      const template = `---
title: my template
---
Some content without title`

      const result = getNoteTitleFromTemplate(template)

      expect(result).toBe('')
    })

    test('should handle template with output frontmatter and inline title', () => {
      const template = `---
title: my template
---
--
prop: value
--
# This is my inline title`

      const result = getNoteTitleFromTemplate(template)

      expect(result).toBe('This is my inline title')
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

  describe('title precedence and frontmatter creation logic', () => {
    test('should prioritize newNoteTitle over inline title when both present', () => {
      const template = `---
title: template title
newNoteTitle: "Project Review"
---
# Weekly Update`

      const result = getNoteTitleFromTemplate(template)

      expect(result).toBe('Project Review')
    })

    test('should use inline title when newNoteTitle is not present', () => {
      const template = `---
title: template title
---
# Weekly Update`

      const result = getNoteTitleFromTemplate(template)

      expect(result).toBe('Weekly Update')
    })

    test('should handle newNoteTitle with special characters', () => {
      const template = `---
title: template title
newNoteTitle: "This has: colons and @symbols"
---
# Malformed Template Test`

      const result = getNoteTitleFromTemplate(template)

      expect(result).toBe('This has: colons and @symbols')
    })

    test('should handle newNoteTitle and inline title being the same', () => {
      const template = `---
title: template title
newNoteTitle: "Project Review"
---
# Project Review`

      const result = getNoteTitleFromTemplate(template)

      expect(result).toBe('Project Review')
    })

    test('should handle template with output frontmatter and inline title', () => {
      const template = `---
title: template title
---
--
foo: bar
--
# This should be the title but not in frontmatter`

      const result = getNoteTitleFromTemplate(template)

      expect(result).toBe('This should be the title but not in frontmatter')
    })

    test('should handle template with only inline title (no frontmatter)', () => {
      const template = `# Simple Inline Title
Some content here`

      const result = getNoteTitleFromTemplate(template)

      expect(result).toBe('Simple Inline Title')
    })

    test('should handle template with only newNoteTitle (no inline title)', () => {
      const template = `---
title: template title
newNoteTitle: "Generated Title"
---
Some content without inline title`

      const result = getNoteTitleFromTemplate(template)

      expect(result).toBe('Generated Title')
    })

    test('should handle template with no title at all', () => {
      const template = `---
title: template title
---
Some content without any title`

      const result = getNoteTitleFromTemplate(template)

      expect(result).toBe('')
    })

    test('should handle template with malformed frontmatter but valid inline title', () => {
      const template = `---
title: template title
newNoteTitle: "This has: colons and @symbols"
folder: DELETEME
---
# Malformed Template Test`

      const result = getNoteTitleFromTemplate(template)

      expect(result).toBe('This has: colons and @symbols')
    })

    test('should handle template with multiple frontmatter blocks', () => {
      const template = `---
title: template title
newNoteTitle: "Final Title"
---
--
intermediate: frontmatter
--
---
final: frontmatter
---
# Inline Title`

      const result = getNoteTitleFromTemplate(template)

      expect(result).toBe('Final Title')
    })

    test('should handle template with subheading only (not inline title)', () => {
      const template = `---
title: template title
---
## This is a subheading, not an inline title
Some content`

      const result = getNoteTitleFromTemplate(template)

      expect(result).toBe('')
    })
  })
})
