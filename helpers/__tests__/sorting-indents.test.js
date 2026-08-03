/* global describe, test, expect, beforeAll */
// @flow
// Tests for multi-level (indented) task sorting.
//
// Background: getTasksByType() used to track a single `lastParent` that was only reassigned when a
// TOP-LEVEL task was seen. Anything indented more than one level therefore compared its indent against
// the top-level task and got pushed onto *that* task's children array -- so a grandchild became a
// sibling of its own parent, and every level below the first collapsed into one. Children were also
// never sorted. These tests pin down the corrected behaviour.

import * as s from '../sorting'
import { DataStore } from '@mocks/index'

beforeAll(() => {
  global.DataStore = DataStore // for logging
})

/**
 * Build a minimal paragraph the way NotePlan reports one: `rawContent` carries BOTH the marker and the
 * leading tabs, while `content` is the bare text and `indents` is the depth. This distinction is the
 * whole reason indentation survives a delete/re-insert round trip.
 */
function para(content: string, indents: number = 0, type: string = 'open'): any {
  const marker = type === 'checklist' ? '+' : '*'
  return {
    type,
    content,
    rawContent: `${'\t'.repeat(indents)}${marker} ${content}`,
    indents,
    lineIndex: 0,
    heading: '',
    filename: 'test.md',
    date: null,
  }
}

describe('multi-level indented task sorting', () => {
  describe('getTasksByType() tree building', () => {
    test('nests a child under its immediately preceding parent', () => {
      const paragraphs = [para('parent', 0), para('child', 1)]
      const result = s.getTasksByType(paragraphs)
      expect(result.open).toHaveLength(1)
      expect(result.open[0].content).toEqual('parent')
      expect(result.open[0].children).toHaveLength(1)
      expect(result.open[0].children[0].content).toEqual('child')
    })

    test('nests a grandchild under the CHILD, not the top-level task', () => {
      // This is the regression: previously `grandchild` landed in parent.children alongside `child`.
      const paragraphs = [para('parent', 0), para('child', 1), para('grandchild', 2)]
      const result = s.getTasksByType(paragraphs)
      expect(result.open).toHaveLength(1)
      const parent = result.open[0]
      expect(parent.children).toHaveLength(1)
      expect(parent.children[0].content).toEqual('child')
      expect(parent.children[0].children).toHaveLength(1)
      expect(parent.children[0].children[0].content).toEqual('grandchild')
    })

    test('handles four levels of nesting', () => {
      const paragraphs = [para('L0', 0), para('L1', 1), para('L2', 2), para('L3', 3)]
      const result = s.getTasksByType(paragraphs)
      const l0 = result.open[0]
      expect(l0.content).toEqual('L0')
      expect(l0.children[0].content).toEqual('L1')
      expect(l0.children[0].children[0].content).toEqual('L2')
      expect(l0.children[0].children[0].children[0].content).toEqual('L3')
    })

    test('dedents correctly back to a shallower level', () => {
      const paragraphs = [para('a', 0), para('a1', 1), para('a1a', 2), para('a2', 1), para('b', 0)]
      const result = s.getTasksByType(paragraphs)
      expect(result.open.map((t) => t.content)).toEqual(['a', 'b'])
      const a = result.open[0]
      expect(a.children.map((c) => c.content)).toEqual(['a1', 'a2'])
      expect(a.children[0].children.map((c) => c.content)).toEqual(['a1a'])
      expect(a.children[1].children).toHaveLength(0)
    })

    test('a dedent to level 0 starts a new top-level task', () => {
      const paragraphs = [para('first', 0), para('deep', 1), para('second', 0)]
      const result = s.getTasksByType(paragraphs)
      expect(result.open.map((t) => t.content)).toEqual(['first', 'second'])
      expect(result.open[1].children).toHaveLength(0)
    })

    test('indented NON-task lines are still captured as children', () => {
      const paragraphs = [para('task', 0), para('a note under it', 1, 'text')]
      const result = s.getTasksByType(paragraphs)
      expect(result.open[0].children).toHaveLength(1)
      expect(result.open[0].children[0].content).toEqual('a note under it')
    })

    test('ignoreIndents=true keeps everything flat', () => {
      const paragraphs = [para('parent', 0), para('child', 1), para('grandchild', 2)]
      const result = s.getTasksByType(paragraphs, true)
      expect(result.open).toHaveLength(3)
      expect(result.open.every((t) => t.children.length === 0)).toBe(true)
    })

    test('a child of a different task type nests under its own parent', () => {
      const paragraphs = [para('open parent', 0, 'open'), para('checklist parent', 0, 'checklist'), para('checklist child', 1, 'checklist')]
      const result = s.getTasksByType(paragraphs)
      expect(result.open).toHaveLength(1)
      expect(result.checklist).toHaveLength(1)
      expect(result.open[0].children).toHaveLength(0)
      expect(result.checklist[0].children.map((c) => c.content)).toEqual(['checklist child'])
    })
  })

  describe('getAllDescendants()', () => {
    test('returns the whole subtree depth-first in document order', () => {
      const paragraphs = [para('a', 0), para('a1', 1), para('a1a', 2), para('a2', 1)]
      const a = s.getTasksByType(paragraphs).open[0]
      expect(s.getAllDescendants(a).map((t) => t.content)).toEqual(['a1', 'a1a', 'a2'])
    })

    test('returns [] for a leaf', () => {
      const a = s.getTasksByType([para('lonely', 0)]).open[0]
      expect(s.getAllDescendants(a)).toEqual([])
    })

    test('does not include the task itself', () => {
      const a = s.getTasksByType([para('a', 0), para('a1', 1)]).open[0]
      expect(s.getAllDescendants(a).map((t) => t.content)).not.toContain('a')
    })
  })

  describe('sortTaskTree()', () => {
    test('sorts top level and children independently', () => {
      const paragraphs = [para('zebra', 0), para('apple', 0), para('zChild', 1), para('aChild', 1)]
      const tasks = s.getTasksByType(paragraphs).open
      const sorted = s.sortTaskTree(tasks, ['content'])
      expect(sorted.map((t) => t.content)).toEqual(['apple', 'zebra'])
      // apple's children were listed z-then-a in the source and must come back a-then-z
      expect(sorted[0].children.map((c) => c.content)).toEqual(['aChild', 'zChild'])
    })

    test('sorts at every depth', () => {
      const paragraphs = [para('root', 0), para('mid', 1), para('zLeaf', 2), para('aLeaf', 2)]
      const sorted = s.sortTaskTree(s.getTasksByType(paragraphs).open, ['content'])
      expect(sorted[0].children[0].children.map((c) => c.content)).toEqual(['aLeaf', 'zLeaf'])
    })

    test('children never migrate to another parent', () => {
      const paragraphs = [para('zebra', 0), para('zChild', 1), para('apple', 0), para('aChild', 1)]
      const sorted = s.sortTaskTree(s.getTasksByType(paragraphs).open, ['content'])
      expect(sorted.map((t) => t.content)).toEqual(['apple', 'zebra'])
      expect(sorted[0].children.map((c) => c.content)).toEqual(['aChild'])
      expect(sorted[1].children.map((c) => c.content)).toEqual(['zChild'])
    })

    test('respects a descending sort field', () => {
      const paragraphs = [para('a', 0), para('a1', 1), para('a2', 1)]
      const sorted = s.sortTaskTree(s.getTasksByType(paragraphs).open, ['-content'])
      expect(sorted[0].children.map((c) => c.content)).toEqual(['a2', 'a1'])
    })
  })

  describe('round trip: sorted output preserves indentation', () => {
    // This mirrors what insertTodos() does: emit `raw` for the task, then `raw` for every descendant
    // depth-first. Because rawContent carries the leading tabs, the rendered block keeps its shape.
    function render(tasks: Array<any>): string {
      return tasks
        .map((t) => [t.raw, ...s.getAllDescendants(t).map((d) => d.raw)].join('\n'))
        .join('\n')
    }

    test('nested subtasks come back sorted, still nested, still indented', () => {
      const paragraphs = [para('zebra', 0), para('apple', 0), para('zChild', 1), para('aChild', 1), para('deepZ', 2), para('deepA', 2)]
      const sorted = s.sortTaskTree(s.getTasksByType(paragraphs).open, ['content'])
      expect(render(sorted)).toEqual(['* apple', '\t* aChild', '\t\t* deepA', '\t\t* deepZ', '\t* zChild', '* zebra'].join('\n'))
    })

    test('every source line appears exactly once in the output', () => {
      const paragraphs = [para('a', 0), para('a1', 1), para('a1a', 2), para('b', 0), para('b1', 1)]
      const sorted = s.sortTaskTree(s.getTasksByType(paragraphs).open, ['content'])
      const lines = render(sorted).split('\n')
      expect(lines).toHaveLength(paragraphs.length)
      paragraphs.forEach((p) => expect(lines.filter((l) => l === p.rawContent)).toHaveLength(1))
    })

    test('the deletion set covers every paragraph that will be re-inserted', () => {
      // If these two sets ever diverge, sorting duplicates or drops lines in the real note.
      const paragraphs = [para('a', 0), para('a1', 1), para('a1a', 2), para('b', 0)]
      const tasks = s.getTasksByType(paragraphs).open
      const toDelete = tasks.flatMap((t) => [t, ...s.getAllDescendants(t)])
      expect(toDelete).toHaveLength(paragraphs.length)
      expect(toDelete.map((t) => t.content).sort()).toEqual(['a', 'a1', 'a1a', 'b'])
    })
  })
})
