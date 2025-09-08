/* global describe, it, expect */

import { DataStore, Editor, CommandBar, NotePlan } from '@mocks/index'
import { replaceDoubleDashes, convertToDoubleDashesIfNecessary } from '../lib/engine/templateRenderer'

// Make DataStore and Editor available globally for the source code
global.DataStore = DataStore
global.Editor = Editor
global.CommandBar = CommandBar
global.NotePlan = NotePlan

describe('Template Renderer Functions', () => {
  describe('replaceDoubleDashes', () => {
    it('should convert double dashes to triple dashes at frontmatter boundaries', () => {
      const templateData = `--
title: Test Note
date: 2024-01-01
--

# Test Content
This is the body of the note.`

      const result = replaceDoubleDashes(templateData)

      expect(result).toBe(`---
title: Test Note
date: 2024-01-01
---

# Test Content
This is the body of the note.`)
    })

    it('should not modify content without double dash frontmatter', () => {
      const templateData = `# Test Content
This is the body of the note.

No frontmatter here.`

      const result = replaceDoubleDashes(templateData)

      expect(result).toBe(templateData)
    })

    it('should handle single double dash line', () => {
      const templateData = `--
title: Test Note
--

# Test Content`

      const result = replaceDoubleDashes(templateData)

      expect(result).toBe(`---
title: Test Note
---

# Test Content`)
    })

    it('should not modify content with only one double dash', () => {
      const templateData = `--
title: Test Note

# Test Content`

      const result = replaceDoubleDashes(templateData)

      expect(result).toBe(templateData)
    })

    it('should handle empty frontmatter', () => {
      const templateData = `--

--

# Test Content`

      const result = replaceDoubleDashes(templateData)

      expect(result).toBe(`---

---

# Test Content`)
    })
  })

  describe('convertToDoubleDashesIfNecessary', () => {
    it('should convert triple dashes to double dashes when template starts with "---\\n"', () => {
      const templateData = `---
title: Test Note
date: 2024-01-01
---

# Test Content
This is the body of the note.`

      const result = convertToDoubleDashesIfNecessary(templateData)

      expect(result).toBe(`--
title: Test Note
date: 2024-01-01
--

# Test Content
This is the body of the note.`)
    })

    it('should not modify content that does not start with "---\\n"', () => {
      const templateData = `# Test Content
This is the body of the note.

No frontmatter here.`

      const result = convertToDoubleDashesIfNecessary(templateData)

      expect(result).toBe(templateData)
    })

    it('should not modify content that starts with "---" but not "---\\n"', () => {
      const templateData = `--- title: Test Note
date: 2024-01-01
---

# Test Content`

      const result = convertToDoubleDashesIfNecessary(templateData)

      expect(result).toBe(templateData)
    })

    it('should handle frontmatter with only opening triple dashes', () => {
      const templateData = `---
title: Test Note

# Test Content`

      const result = convertToDoubleDashesIfNecessary(templateData)

      // Should not modify since there's no closing "---"
      expect(result).toBe(templateData)
    })

    it('should handle empty frontmatter', () => {
      const templateData = `---

---

# Test Content`

      const result = convertToDoubleDashesIfNecessary(templateData)

      expect(result).toBe(`--

--

# Test Content`)
    })

    it('should handle frontmatter with multiple triple dashes in content', () => {
      const templateData = `---
title: Test Note
description: This has --- in the middle
date: 2024-01-01
---

# Test Content
This is the body of the note.`

      const result = convertToDoubleDashesIfNecessary(templateData)

      expect(result).toBe(`--
title: Test Note
description: This has --- in the middle
date: 2024-01-01
--

# Test Content
This is the body of the note.`)
    })

    it('should handle frontmatter with more than two triple dashes', () => {
      const templateData = `---
title: Test Note
---

# Test Content

---

More content`

      const result = convertToDoubleDashesIfNecessary(templateData)

      // Should only convert the first two occurrences
      expect(result).toBe(`--
title: Test Note
--

# Test Content

---

More content`)
    })
  })

  describe('Round-trip conversion', () => {
    it('should be able to convert back and forth between double and triple dashes', () => {
      const originalWithTriple = `---
title: Test Note
date: 2024-01-01
---

# Test Content`

      // Convert triple to double
      const withDouble = convertToDoubleDashesIfNecessary(originalWithTriple)
      expect(withDouble).toBe(`--
title: Test Note
date: 2024-01-01
--

# Test Content`)

      // Convert double back to triple
      const backToTriple = replaceDoubleDashes(withDouble)
      expect(backToTriple).toBe(originalWithTriple)
    })

    it('should handle complex frontmatter with special characters', () => {
      const originalWithTriple = `---
title: "Complex: Note with 'quotes' and --- dashes"
tags: [tag1, tag2]
date: 2024-01-01
---

# Test Content
This is the body of the note.`

      // Convert triple to double
      const withDouble = convertToDoubleDashesIfNecessary(originalWithTriple)
      expect(withDouble).toContain('--')
      // The delimiters should be converted, but content with --- should remain
      expect(withDouble).toContain('--- dashes') // This is content, should remain
      expect(withDouble).not.toMatch(/^---\n/) // Should not start with ---
      expect(withDouble).not.toMatch(/\n---\n/) // Should not have --- as delimiter

      // Convert double back to triple
      const backToTriple = replaceDoubleDashes(withDouble)
      expect(backToTriple).toBe(originalWithTriple)
    })
  })
})
