// @flow
/* eslint-disable no-unused-vars */
/* global jest, describe, test, expect, beforeAll */
import { CustomConsole } from '@jest/console'
import { CommandBar, DataStore, Editor, Note, simpleFormatter } from '@mocks/index'
import { type FilerConfig } from '../src/filerHelpers'
import { copyRecentNoteLinks, fileNoteLinks, getNoteLinkBlock, lineContainsIgnoreTag, paragraphTypesForFiling } from '../src/noteLinks'

beforeAll(() => {
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
  DataStore.settings['_logLevel'] = 'none' // DEBUG or none
})

function para(lineIndex: number, type: string, content: string, indents: number, headingLevel: number, rawContent?: string): TParagraph {
  return ({
    lineIndex,
    type,
    content,
    rawContent: rawContent ?? content,
    indents,
    headingLevel,
  }: any)
}

function noteFromParas(paragraphs: Array<TParagraph>): CoreNoteFields {
  return ({ paragraphs }: any)
}

function filingConfig(overrides: Partial<FilerConfig> = {}): FilerConfig {
  return {
    addDateBacklink: false,
    dateRefStyle: 'scheduled',
    includeFromStartOfSection: true,
    allowNotePreambleBeforeHeading: true,
    useTightBlockDefinition: false,
    doneSectionHeadingName: 'Done',
    recreateDoneSectionStructure: true,
    skipDoneSubtasksUnderOpenTasks: false,
    whenToMoveCompletedToDone: 'move when any are complete',
    whereToAddInSection: 'end',
    typesToFile: 'all lines',
    useBlocks: true,
    whereToAddInNote: 'end',
    ignoreNoteLinkFilerTag: '',
    copyOrMove: 'move',
    recentDays: 7,
    _logLevel: 'none',
    _logTimer: false,
    ...overrides,
  }
}

function contents(note: any): Array<string> {
  return note.paragraphs.map((p) => p.content)
}

describe('jgclark.Filer note links', () => {
  describe('getNoteLinkBlock()', () => {
    test('includes only more-indented following lines, not siblings or earlier lines', () => {
      const note = noteFromParas([
        para(0, 'text', 'earlier', 0, 0),
        para(1, 'open', 'parent [[Alpha]]', 0, 0, '* [ ] parent [[Alpha]]'),
        para(2, 'text', 'child', 1, 0, '\tchild'),
        para(3, 'text', 'grandchild', 2, 0, '\t\tgrandchild'),
        para(4, 'open', 'sibling [[Beta]]', 0, 0, '* [ ] sibling [[Beta]]'),
      ])
      const block = getNoteLinkBlock(note, 1)
      expect(block.map((p) => p.content)).toEqual(['parent [[Alpha]]', 'child', 'grandchild'])
    })

    test('a top-level line does not take the rest of the section', () => {
      const note = noteFromParas([
        para(0, 'open', 'parent [[Alpha]]', 0, 0),
        para(1, 'text', 'same indent note', 0, 0),
      ])
      expect(getNoteLinkBlock(note, 0).map((p) => p.content)).toEqual(['parent [[Alpha]]'])
    })

    test('stops at a blank line, a heading, and a separator', () => {
      const note = noteFromParas([
        para(0, 'open', 'parent [[Alpha]]', 0, 0),
        para(1, 'text', 'child', 1, 0),
        para(2, 'empty', '', 0, 0),
        para(3, 'text', 'after blank', 1, 0),
        para(4, 'title', 'Next', 0, 2, '## Next'),
        para(5, 'separator', '---', 0, 0, '---'),
      ])
      expect(getNoteLinkBlock(note, 0).map((p) => p.content)).toEqual(['parent [[Alpha]]', 'child'])
    })

    test('a heading block runs until a blank line, a separator, or a same-or-higher heading', () => {
      const untilBlank = noteFromParas([
        para(0, 'title', 'Section [[Alpha]]', 0, 2, '## Section [[Alpha]]'),
        para(1, 'text', 'keep', 0, 0),
        para(2, 'empty', '', 0, 0),
        para(3, 'text', 'after', 0, 0),
      ])
      expect(getNoteLinkBlock(untilBlank, 0).map((p) => p.content)).toEqual(['Section [[Alpha]]', 'keep'])

      const untilHeading = noteFromParas([
        para(0, 'title', 'Section [[Alpha]]', 0, 3, '### Section [[Alpha]]'),
        para(1, 'text', 'keep', 0, 0),
        para(2, 'title', 'Higher', 0, 2, '## Higher'),
      ])
      expect(getNoteLinkBlock(untilHeading, 0).map((p) => p.content)).toEqual(['Section [[Alpha]]', 'keep'])

      const untilSeparator = noteFromParas([
        para(0, 'title', 'Section [[Alpha]]', 0, 2, '## Section [[Alpha]]'),
        para(1, 'text', 'keep', 0, 0),
        para(2, 'separator', '---', 0, 0, '---'),
        para(3, 'text', 'after', 0, 0),
      ])
      expect(getNoteLinkBlock(untilSeparator, 0).map((p) => p.content)).toEqual(['Section [[Alpha]]', 'keep'])
    })
  })

  describe('paragraphTypesForFiling()', () => {
    test('completed items include cancelled tasks and exclude headings', () => {
      const types = paragraphTypesForFiling('only completed task/checklist items')
      expect(types).toEqual(['done', 'cancelled', 'checklistDone', 'checklistCancelled'])
      expect(types).not.toContain('title')
      expect(types).not.toContain('open')
    })

    test('all lines includes headings and open tasks, and rejects an unknown choice', () => {
      expect(paragraphTypesForFiling('all lines')).toContain('title')
      expect(paragraphTypesForFiling('all lines')).toContain('open')
      expect(paragraphTypesForFiling('all but incomplete task/checklist items')).not.toContain('open')
      expect(() => paragraphTypesForFiling('nope')).toThrow(/typesToFile/)
    })
  })

  describe('lineContainsIgnoreTag()', () => {
    test('matches the tag as literal text, not as a regular expression', () => {
      expect(lineContainsIgnoreTag('task [[Note]] #ignore', '#ignore')).toBe(true)
      expect(lineContainsIgnoreTag('#ignore task [[Note]]', '#ignore')).toBe(true)
      expect(lineContainsIgnoreTag('task [[Note]] #ignored', '#ignore')).toBe(false)
      expect(lineContainsIgnoreTag('see a+b here', 'a+b')).toBe(true)
      expect(lineContainsIgnoreTag('see aabb here', 'a+b')).toBe(false)
      expect(lineContainsIgnoreTag('task [[Note]]', '')).toBe(false)
      expect(lineContainsIgnoreTag('', '#ignore')).toBe(false)
    })
  })

  describe('fileNoteLinks()', () => {
    function projectNotesByTitle(notesByTitle: { [string]: Array<any> }): void {
      ;(DataStore: any).projectNoteByTitle = (title: string) => notesByTitle[title] ?? []
    }

    test('move with blocks files indented lines once and then the next sibling', async () => {
      const source = new Note({
        filename: '20261112.md',
        type: 'Calendar',
        title: '2026-11-12',
        content: 'earlier line\n* [ ] parent [[Alpha]]\n\tchild line\n* [ ] next [[Beta]]',
      })
      const alpha = new Note({ filename: 'Alpha.md', title: 'Alpha', content: '# Alpha' })
      const beta = new Note({ filename: 'Beta.md', title: 'Beta', content: '# Beta' })
      projectNotesByTitle({ Alpha: [alpha], Beta: [beta] })

      const result = await fileNoteLinks(source, filingConfig({ includeFromStartOfSection: true, useBlocks: true, copyOrMove: 'move' }), false)

      expect(result).toEqual({ filed: 2, skipped: 0 })
      expect(contents(alpha)).toEqual(['Alpha', 'parent', 'child line'])
      expect(contents(beta)).toEqual(['Beta', 'next'])
      expect(contents(source)).toEqual(['earlier line'])
    })

    test('a link indented under a filed block is not filed again', async () => {
      const source = new Note({
        filename: '20261112.md',
        type: 'Calendar',
        title: '2026-11-12',
        content: '* [ ] parent [[Alpha]]\n\t* [ ] child [[Beta]]\n* [ ] after [[Gamma]]',
      })
      const alpha = new Note({ filename: 'Alpha.md', title: 'Alpha', content: '# Alpha' })
      const beta = new Note({ filename: 'Beta.md', title: 'Beta', content: '# Beta' })
      const gamma = new Note({ filename: 'Gamma.md', title: 'Gamma', content: '# Gamma' })
      projectNotesByTitle({ Alpha: [alpha], Beta: [beta], Gamma: [gamma] })

      const result = await fileNoteLinks(source, filingConfig({ useBlocks: true, copyOrMove: 'copy' }), false)

      expect(result).toEqual({ filed: 2, skipped: 0 })
      expect(contents(alpha)).toEqual(['Alpha', 'parent', 'child [[Beta]]'])
      expect(contents(beta)).toEqual(['Beta'])
      expect(contents(gamma)).toEqual(['Gamma', 'after'])
      expect(contents(source)).toEqual(['parent [[Alpha]]', 'child [[Beta]]', 'after [[Gamma]]'])
    })

    test('a missing destination is skipped and later links are still filed', async () => {
      const source = new Note({
        filename: '20261112.md',
        type: 'Calendar',
        title: '2026-11-12',
        content: '* [ ] gone [[Missing]]\n* [ ] stays [[Beta]]',
      })
      const beta = new Note({ filename: 'Beta.md', title: 'Beta', content: '# Beta' })
      projectNotesByTitle({ Beta: [beta] })

      const result = await fileNoteLinks(source, filingConfig({ useBlocks: false, copyOrMove: 'move' }), false)

      expect(result).toEqual({ filed: 1, skipped: 1 })
      expect(contents(beta)).toEqual(['Beta', 'stays'])
      expect(contents(source)).toEqual(['gone [[Missing]]'])
    })

    test('only completed items do not file a heading that contains a note link', async () => {
      const source = new Note({
        filename: '20261112.md',
        type: 'Calendar',
        title: '2026-11-12',
        content: '## Meet [[Alpha]]\n* [x] shipped [[Beta]]\n* [-] dropped [[Beta]]',
      })
      const alpha = new Note({ filename: 'Alpha.md', title: 'Alpha', content: '# Alpha' })
      const beta = new Note({ filename: 'Beta.md', title: 'Beta', content: '# Beta' })
      projectNotesByTitle({ Alpha: [alpha], Beta: [beta] })

      const result = await fileNoteLinks(
        source,
        filingConfig({ typesToFile: 'only completed task/checklist items', useBlocks: false, copyOrMove: 'move' }),
        false,
      )

      expect(result).toEqual({ filed: 2, skipped: 0 })
      expect(contents(alpha)).toEqual(['Alpha'])
      expect(contents(beta)).toEqual(['Beta', 'shipped', 'dropped'])
      expect(contents(source)).toEqual(['Meet [[Alpha]]'])
    })

    test('an ignore tag skips that link and is matched literally', async () => {
      const source = new Note({
        filename: '20261112.md',
        type: 'Calendar',
        title: '2026-11-12',
        content: '* [ ] keep [[Alpha]]\n* [ ] skip [[Beta]] #ignore\n* [ ] also [[Gamma]] #ignored',
      })
      const alpha = new Note({ filename: 'Alpha.md', title: 'Alpha', content: '# Alpha' })
      const beta = new Note({ filename: 'Beta.md', title: 'Beta', content: '# Beta' })
      const gamma = new Note({ filename: 'Gamma.md', title: 'Gamma', content: '# Gamma' })
      projectNotesByTitle({ Alpha: [alpha], Beta: [beta], Gamma: [gamma] })

      const result = await fileNoteLinks(
        source,
        filingConfig({ useBlocks: false, copyOrMove: 'move', ignoreNoteLinkFilerTag: '#ignore' }),
        false,
      )

      expect(result).toEqual({ filed: 2, skipped: 0 })
      expect(contents(alpha)).toEqual(['Alpha', 'keep'])
      expect(contents(beta)).toEqual(['Beta'])
      expect(contents(gamma)).toEqual(['Gamma', 'also #ignored'])
      expect(contents(source)).toEqual(['skip [[Beta]] #ignore'])
    })

    test('when several notes share a title, the first one receives the line', async () => {
      const source = new Note({
        filename: '20261112.md',
        type: 'Calendar',
        title: '2026-11-12',
        content: '* [ ] item [[Alpha]]',
      })
      const first = new Note({ filename: 'Alpha-first.md', title: 'Alpha', content: '# Alpha' })
      const second = new Note({ filename: 'Alpha-second.md', title: 'Alpha', content: '# Alpha' })
      projectNotesByTitle({ Alpha: [first, second] })

      const result = await fileNoteLinks(source, filingConfig({ useBlocks: false, copyOrMove: 'copy' }), false)

      expect(result).toEqual({ filed: 1, skipped: 0 })
      expect(contents(first)).toEqual(['Alpha', 'item'])
      expect(contents(second)).toEqual(['Alpha'])
    })
  })

  describe('copyRecentNoteLinks()', () => {
    test('an empty x-callback arg0 does not prompt', async () => {
      const prompt = jest.fn<$ReadOnlyArray<any>, Promise<string>>(async () => 'OK')
      ;(CommandBar: any).prompt = prompt
      ;(DataStore: any).loadJSON = jest.fn<$ReadOnlyArray<any>, any>(async () => ({
        recentDays: 0,
        typesToFile: 'all lines',
        useBlocks: false,
        whereToAddInSection: 'end',
        allowNotePreambleBeforeHeading: true,
        whereToAddInNote: 'end',
        ignoreNoteLinkFilerTag: '',
      }))
      ;(DataStore: any).calendarNotes = []

      expect(await copyRecentNoteLinks('')).toBe(0)
      expect(prompt).not.toHaveBeenCalled()
    })
  })
})
