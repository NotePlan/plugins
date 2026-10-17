// @flow
/* eslint-disable no-unused-vars */
/* global jest, it, describe, test, expect, beforeAll, beforeEach */
import { CustomConsole, simpleFormatter } from '@jest/console'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan } from '@mocks/index'
import {
  fencedBlock,
  findProblemsInNote,
  firstFileLines,
  frontmatterTitleText,
  h1HasTemplateTag,
  h1TextOnBodyLine0,
  mismatchBulletLines,
  quoteTitleForBullet,
  contentWithPipesReplaced,
  replaceBodyLine0,
  replacePipesInTitle,
} from '../src/titleProblems'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = new NotePlan()
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
  DataStore.settings['_logLevel'] = 'none'
})

const validNote = `---
title: Hello
---
# Hello
body
`

describe('frontmatterTitleText', () => {
  test('returns null when the field is missing or blank', () => {
    expect(frontmatterTitleText(null)).toBeNull()
    expect(frontmatterTitleText({})).toBeNull()
    expect(frontmatterTitleText({ title: '   ' })).toBeNull()
  })

  test('strips one layer of YAML quotes', () => {
    expect(frontmatterTitleText({ title: '"Hello"' })).toBe('Hello')
    expect(frontmatterTitleText({ title: "'Hello'" })).toBe('Hello')
  })
})

describe('h1TextOnBodyLine0', () => {
  test('reads the H1 on the first body line after frontmatter', () => {
    expect(h1TextOnBodyLine0(validNote)).toBe('Hello')
  })

  test('returns null when body line 0 is not an H1', () => {
    const content = `---
title: Hello
---

# Hello
`
    expect(h1TextOnBodyLine0(content)).toBeNull()
  })

  test('does not treat a deeper heading as an H1', () => {
    expect(h1TextOnBodyLine0('## Not the title\n')).toBeNull()
  })

  test('returns null when the frontmatter fence never closes', () => {
    expect(h1TextOnBodyLine0('---\ntitle: Hello\n# Hello\n')).toBeNull()
  })
})

describe('findProblemsInNote', () => {
  test('warns when the note title is --- and includes the first 12 file lines', () => {
    const lines = ['---', 'title: [broken', 'still frontmatter']
    for (let n = 3; n < 15; n++) lines.push(`line ${n}`)
    const content = lines.join('\n')
    const problems = findProblemsInNote('---', content, {})
    expect(problems.map((p) => p.kind)).toEqual(['dash-title'])
    const preview = problems[0].preview ?? ''
    expect(preview).toBe(firstFileLines(content, 12))
    expect(preview.split('\n')).toHaveLength(12)
    expect(preview.startsWith('---\ntitle: [broken')).toBe(true)
  })

  test('warns when the frontmatter title does not match the H1 on body line 0', () => {
    const content = `---
title: From frontmatter
---
# From the heading
`
    const problems = findProblemsInNote('From frontmatter', content, { title: 'From frontmatter' })
    expect(problems).toEqual([
      {
        kind: 'title-mismatch',
        frontmatterTitle: 'From frontmatter',
        h1Title: 'From the heading',
        preview: null,
      },
    ])
  })

  test('ignores a mismatch when the H1 contains a template tag', () => {
    const h1 = "✈️🚅🛤🛳️ <%- prompt('Where are we going?') %> Holiday/Travel plans"
    expect(h1HasTemplateTag(h1)).toBe(true)
    const content = `---
title: Holiday/Travel plans
---
# ${h1}
`
    expect(findProblemsInNote('Holiday/Travel plans', content, { title: 'Holiday/Travel plans' })).toEqual([])
  })

  test('warns when the note title contains a pipe', () => {
    const content = `---
title: Move tag | Shared
---
# Move tag | Shared
`
    const problems = findProblemsInNote('Move tag | Shared', content, { title: 'Move tag | Shared' })
    expect(problems.map((p) => p.kind)).toEqual(['pipe-title'])
  })

  test('stays quiet when the frontmatter title matches the H1', () => {
    expect(findProblemsInNote('Hello', validNote, { title: 'Hello' })).toEqual([])
  })

  test('stays quiet when there is a frontmatter title but no H1 on body line 0', () => {
    const content = `---
title: Hello
---
Just text
`
    expect(findProblemsInNote('Hello', content, { title: 'Hello' })).toEqual([])
  })
})

describe('mismatch bullets', () => {
  test('puts each value on a bullet with its use button', () => {
    const rows = mismatchBulletLines('Move tagMentionCache to Shared', 'Move tagMentionCache to np.Shared', '[Use title](title-url)', '[Use H1](h1-url)')
    expect(rows).toEqual([
      '\t- title: "Move tagMentionCache to Shared" [Use title](title-url)',
      '\t- H1 "Move tagMentionCache to np.Shared" [Use H1](h1-url)',
    ])
  })

  test('escapes double quotes inside a title', () => {
    expect(quoteTitleForBullet('Say "hi"')).toBe('"Say \\"hi\\""')
  })
})

describe('replacePipesInTitle', () => {
  test('replaces every pipe with a hyphen', () => {
    expect(replacePipesInTitle('Move tag | Shared | notes')).toBe('Move tag - Shared - notes')
  })
})

describe('contentWithPipesReplaced', () => {
  test('replaces pipes in the frontmatter title and the H1 in one write', () => {
    const content = `---
title: "Defeating Daily Anxiety | Desiring God"
---
# Defeating Daily Anxiety | Desiring God
body
`
    expect(contentWithPipesReplaced(content)).toBe(`---
title: "Defeating Daily Anxiety - Desiring God"
---
# Defeating Daily Anxiety - Desiring God
body
`)
  })

  test('replaces a pipe in an H1 that has no frontmatter', () => {
    expect(contentWithPipesReplaced('# How to erase | AppleInsider---\nnext\n')).toBe('# How to erase - AppleInsider---\nnext\n')
  })

  test('replaces a pipe in the first H1 when it is not the first body line', () => {
    const content = `---
title: Foo | Bar
---
intro line

# Foo | Bar
# Later | heading
`
    expect(contentWithPipesReplaced(content)).toBe(`---
title: Foo - Bar
---
intro line

# Foo - Bar
# Later | heading
`)
  })

  test('returns null when neither title field contains a pipe', () => {
    expect(contentWithPipesReplaced('---\ntitle: Hello\n---\n# Hello\n')).toBeNull()
  })
})

describe('replaceBodyLine0', () => {
  test('replaces the H1 after frontmatter and leaves the title field alone', () => {
    const content = `---
title: From frontmatter
---
# From the heading
body
`
    expect(replaceBodyLine0(content, 'From frontmatter')).toBe(`---
title: From frontmatter
---
# From frontmatter
body
`)
  })

  test('returns null when body line 0 is not an H1', () => {
    expect(replaceBodyLine0('---\ntitle: Hello\n---\n\n# Hello\n', 'Hello')).toBeNull()
  })
})

describe('fencedBlock', () => {
  test('uses a longer fence when the preview itself starts a code fence', () => {
    expect(fencedBlock('```\ncode\n```')).toBe('````\n```\ncode\n```\n````')
  })
})
