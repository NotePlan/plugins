/**
 * @jest-environment node
 */

import { detectInlineTitle } from '../NPFrontMatter.js'

// Mock the dev helpers
jest.mock('@helpers/dev', () => ({
  logDebug: jest.fn(),
  clo: jest.fn(),
  clof: jest.fn(),
  JSP: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
  timer: jest.fn(),
}))

describe('detectInlineTitle', () => {
  describe('Basic functionality', () => {
    it('should return false for empty content', () => {
      const result = detectInlineTitle('')
      expect(result).toEqual({ hasInlineTitle: false, inlineTitleText: '' })
    })

    it('should return false for null content', () => {
      const result = detectInlineTitle(null)
      expect(result).toEqual({ hasInlineTitle: false, inlineTitleText: '' })
    })

    it('should return false for undefined content', () => {
      const result = detectInlineTitle(undefined)
      expect(result).toEqual({ hasInlineTitle: false, inlineTitleText: '' })
    })
  })

  describe('Simple inline titles without frontmatter', () => {
    it('should find h1 title at the beginning', () => {
      const content = '# My Title\nSome content here'
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: true, inlineTitleText: 'My Title' })
    })

    it('should find h2 title at the beginning', () => {
      const content = '## My Title\nSome content here'
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: true, inlineTitleText: 'My Title' })
    })

    it('should find h6 title at the beginning', () => {
      const content = '###### My Title\nSome content here'
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: true, inlineTitleText: 'My Title' })
    })

    it('should find title after empty lines', () => {
      const content = '\n\n# My Title\nSome content here'
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: true, inlineTitleText: 'My Title' })
    })

    it('should not find title if no heading exists', () => {
      const content = 'Just some text\nMore text here'
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: false, inlineTitleText: '' })
    })

    it('should not find title if heading is not at the beginning', () => {
      const content = 'Some text\n# My Title\nMore text'
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: false, inlineTitleText: '' })
    })
  })

  describe('Single frontmatter block', () => {
    it('should find title after valid frontmatter with -- separators', () => {
      const content = `--
title: Template Title
category: meeting
--
# My Note Title
Content here`
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: true, inlineTitleText: 'My Note Title' })
    })

    it('should find title after valid frontmatter with --- separators', () => {
      const content = `---
title: Template Title
category: meeting
---
# My Note Title
Content here`
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: true, inlineTitleText: 'My Note Title' })
    })

    it('should not find title in invalid frontmatter block', () => {
      const content = `--
# My Note Title
invalid yaml content
--
More content`
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: false, inlineTitleText: '' })
    })

    it('should not find title if no heading after valid frontmatter', () => {
      const content = `---
title: Template Title
---
Just some content without heading`
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: false, inlineTitleText: '' })
    })

    it('should not find title if no heading in invalid frontmatter', () => {
      const content = `--
invalid yaml content
--
Just some content without heading`
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: false, inlineTitleText: '' })
    })
  })

  describe('Complex edge cases', () => {
    it('should handle multiple consecutive separator lines', () => {
      const content = `--
--
--
# Title after multiple separators
Content`
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: false, inlineTitleText: '' })
    })

    it('should handle frontmatter with only separators', () => {
      const content = `--
--
# Title after empty frontmatter
Content`
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: true, inlineTitleText: 'Title after empty frontmatter' })
    })

    it('should handle content with only separators', () => {
      const content = `--
--
--
--
# Title after all separators
Content`
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: false, inlineTitleText: '' })
    })

    it('should handle title with extra whitespace', () => {
      const content = `---
template: data
---
#   My Title with Spaces   
Content`
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: true, inlineTitleText: 'My Title with Spaces' })
    })

    it('should handle title with special characters', () => {
      const content = `---
template: data
---
# My Title: With Special Characters & Symbols!
Content`
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: true, inlineTitleText: 'My Title: With Special Characters & Symbols!' })
    })
  })

  describe('Heading level variations', () => {
    it('should find h1 title', () => {
      const content = `---
template: data
---
# H1 Title
Content`
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: true, inlineTitleText: 'H1 Title' })
    })

    it('should find h2 title', () => {
      const content = `---
template: data
---
## H2 Title
Content`
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: true, inlineTitleText: 'H2 Title' })
    })

    it('should find h3 title', () => {
      const content = `---
template: data
---
### H3 Title
Content`
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: true, inlineTitleText: 'H3 Title' })
    })

    it('should find h4 title', () => {
      const content = `---
template: data
---
#### H4 Title
Content`
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: true, inlineTitleText: 'H4 Title' })
    })

    it('should find h5 title', () => {
      const content = `---
template: data
---
##### H5 Title
Content`
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: true, inlineTitleText: 'H5 Title' })
    })

    it('should find h6 title', () => {
      const content = `---
template: data
---
###### H6 Title
Content`
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: true, inlineTitleText: 'H6 Title' })
    })

    it('should not find title with more than 6 hashes', () => {
      const content = `---
template: data
---
####### Not a valid title
Content`
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: false, inlineTitleText: '' })
    })
  })

  describe('Real-world scenarios', () => {
    it('should handle meeting notes template', () => {
      const content = `---
template: meeting
category: work
---
--
date: 2024-01-15
attendees: John, Jane
--
# Weekly Team Meeting
## Agenda
- Review progress
- Discuss blockers`
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: true, inlineTitleText: 'Weekly Team Meeting' })
    })

    it('should handle daily journal template', () => {
      const content = `---
template: journal
type: daily
---
--
date: 2024-01-15
mood: good
--
# January 15, 2024
## What I accomplished today
- Worked on project X
- Had lunch with colleague`
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: true, inlineTitleText: 'January 15, 2024' })
    })

    it('should handle project notes template', () => {
      const content = `---
template: project
status: active
---
--
project: MyApp
version: 1.0
--
# Project Update: MyApp v1.0
## Recent Changes
- Fixed bug #123
- Added new feature`
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: true, inlineTitleText: 'Project Update: MyApp v1.0' })
    })
  })

  describe('Error handling', () => {
    it('should handle malformed frontmatter gracefully', () => {
      const content = `--
unclosed frontmatter
# Title in malformed block
Content`
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: false, inlineTitleText: '' })
    })

    it('should handle very long content', () => {
      const longContent = `---\ntemplate: data\n---\n${'x'.repeat(10000)}\n# My Title\nContent`
      const result = detectInlineTitle(longContent)
      expect(result).toEqual({ hasInlineTitle: false, inlineTitleText: '' })
    })

    it('should handle content with only newlines', () => {
      const content = '\n\n\n\n\n'
      const result = detectInlineTitle(content)
      expect(result).toEqual({ hasInlineTitle: false, inlineTitleText: '' })
    })
  })
})
