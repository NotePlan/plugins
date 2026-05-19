/* global describe, expect, test, beforeAll */
import * as ed from '../NPEditor'
import { Paragraph } from '@mocks/index'

beforeAll(() => {
  global.Paragraph = Paragraph
})

describe('highlightParagraphInEditorPane()', () => {
  test('should highlight in the given Editor pane by rawContent', () => {
    const targetPara = new Paragraph({ rawContent: '* next action', content: 'next action', lineIndex: 1 })
    const targetEditor = {
      filename: 'project.md',
      note: { filename: 'project.md' },
      paragraphs: [new Paragraph({ rawContent: '* other task', content: 'other task', lineIndex: 0 }), targetPara],
      highlight: jest.fn(),
      highlightByIndex: jest.fn(),
      focus: jest.fn(),
    }

    const result = ed.highlightParagraphInEditorPane(targetEditor, '* next action', true, true)

    expect(result).toBe(true)
    expect(targetEditor.highlight).toHaveBeenCalledWith(targetPara)
    expect(targetEditor.focus).toHaveBeenCalled()

    const result2 = ed.highlightParagraphInEditorPane(targetEditor, 'next action', true, true)

    expect(result2).toBe(true)
  })
})
