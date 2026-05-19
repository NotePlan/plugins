/* globals describe, expect, test, beforeAll */
// @flow

import { Project } from '../projectClass'
import { Note, Paragraph } from '@mocks/index'

const preferenceValues: { [string]: any } = {}

beforeAll(() => {
  global.DataStore = {
    preference: (key: string): any => preferenceValues[key] ?? '',
    updateCache: jest.fn(),
  }
  preferenceValues['projectMetadataFrontmatterKey'] = 'project'
})

/**
 * @param {string} content
 * @param {string=} rawContent
 * @returns {Paragraph}
 */
function makeOpenPara(content: string, rawContent?: string): Paragraph {
  const raw = rawContent ?? content
  return new Paragraph({ type: 'open', content, rawContent: raw })
}

/**
 * Call gatherAnyNextActionContent on a minimal Project instance.
 * @param {Note} note
 * @param {Array<Paragraph>} paras
 * @param {Array<string>} nextActionTags
 * @param {string} sequentialTag
 * @param {Array<string>} hashtags
 * @param {string} metadataLine
 * @returns {Array<string>}
 */
function gatherNextActions(
  note: Note,
  paras: Array<Paragraph>,
  nextActionTags: Array<string> = [],
  sequentialTag: string = '',
  hashtags: Array<string> = [],
  metadataLine: string = '',
): Array<string> {
  const project = Object.create(Project.prototype)
  project.nextActionsRawContent = []
  project.note = note
  project.gatherAnyNextActionContent(nextActionTags, paras, sequentialTag, hashtags, metadataLine)
  return project.nextActionsRawContent
}

describe('Project.gatherAnyNextActionContent', () => {
  const farFutureSchedule = '>2122-06-01'
  const note = new Note({
    title: 'Test project',
    filename: 'test-project.md',
    content: '# Test project\n',
  })

  test('tagged #na: skips only future-scheduled match and leaves nextActionsRawContent empty', () => {
    const paras = [makeOpenPara(`Waiting #na ${farFutureSchedule}`, `- Waiting #na ${farFutureSchedule}`)]
    const result = gatherNextActions(note, paras, ['#na'])
    expect(result).toHaveLength(0)
  })

  test('tagged #na: picks first non-future when an earlier tagged line is future-scheduled', () => {
    const paras = [
      makeOpenPara(`Later #na ${farFutureSchedule}`, `- Later #na ${farFutureSchedule}`),
      makeOpenPara('Do now #na', '- Do now #na'),
    ]
    const result = gatherNextActions(note, paras, ['#na'])
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('Do now #na')
    expect(result[0]).not.toContain('2122')
  })

  test('sequential: picks first open task that is not future-scheduled', () => {
    const paras = [
      makeOpenPara(`Future step ${farFutureSchedule}`, `- Future step ${farFutureSchedule}`),
      makeOpenPara('Current step', '- Current step'),
    ]
    const result = gatherNextActions(note, paras, [], '#sequential', ['#sequential'], '#project #sequential')
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('Current step')
  })

  test('sequential: no next action when every open task is future-scheduled', () => {
    const paras = [makeOpenPara(`Only future ${farFutureSchedule}`, `- Only future ${farFutureSchedule}`)]
    const result = gatherNextActions(note, paras, [], '#sequential', ['#sequential'], '#project #sequential')
    expect(result).toHaveLength(0)
  })
})
