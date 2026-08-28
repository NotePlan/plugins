// @flow
/* eslint-disable */
/* globals describe, expect, test */

import { createRunPluginCallbackUrl } from '@helpers/general'
import {
  HIDE_EMPTY_FOLDERS_PARAM,
  SHOW_EMPTY_FOLDERS_PARAM,
  applyShowEmptyFoldersParamToConfig,
  buildWeeklyProgressBulletSummary,
  buildWeeklyProgressByFolderSummaryLines,
  buildWeeklyProgressBySubFolderSummaryLines,
  buildWeeklyProgressTagSummaryLines,
  buildWeeklyProgressTagCountSummary,
  formatFolderTagSummaryLabel,
  formatProjectTypeTagCountLabel,
  getFirstWeeklyProjectProgressParam,
  getTopLevelFolderPath,
  getWeeklyProjectProgressViewParam,
  normalizeWeeklyProjectProgressParam,
  parseWeekLabelParam,
  resolveShowEmptyFoldersFromParam,
  resolveWeekLabelFromArgs,
  resolveWeeklyProjectProgressOutputStyle,
  tagNamePresentInFolderName,
  WEEKLY_PROJECT_PROGRESS_OUTPUT_LIST_BY_SUBFOLDER,
  WEEKLY_PROJECT_PROGRESS_OUTPUT_TABLE_BY_SUBFOLDER,
} from '../projectsWeeklyProgress'

const baseConfig = { projectTypeTags: ['#project'] }

describe('normalizeWeeklyProjectProgressParam', () => {
  test('returns empty string for null/undefined/empty', () => {
    expect(normalizeWeeklyProjectProgressParam(null)).toBe('')
    expect(normalizeWeeklyProjectProgressParam(undefined)).toBe('')
    expect(normalizeWeeklyProjectProgressParam('')).toBe('')
  })

  test('stringifies object params', () => {
    expect(normalizeWeeklyProjectProgressParam({ weeklyProjectProgressShowEmptyFolders: false }))
      .toBe('{"weeklyProjectProgressShowEmptyFolders":false}')
  })

  test('trims string params', () => {
    expect(normalizeWeeklyProjectProgressParam('  hide  ')).toBe('hide')
  })
})

describe('getFirstWeeklyProjectProgressParam', () => {
  test('uses first non-empty argument', () => {
    expect(getFirstWeeklyProjectProgressParam(['', 'hide', 'ignored'])).toBe('hide')
  })

  test('returns empty when no args', () => {
    expect(getFirstWeeklyProjectProgressParam([])).toBe('')
  })
})

describe('resolveShowEmptyFoldersFromParam', () => {
  test('hide resolves to false regardless of current setting', () => {
    expect(resolveShowEmptyFoldersFromParam(HIDE_EMPTY_FOLDERS_PARAM, baseConfig)).toBe(false)
    expect(resolveShowEmptyFoldersFromParam(HIDE_EMPTY_FOLDERS_PARAM, {
      ...baseConfig,
      weeklyProjectProgressShowEmptyFolders: true,
    })).toBe(false)
  })

  test('show resolves to true regardless of current setting', () => {
    expect(resolveShowEmptyFoldersFromParam(SHOW_EMPTY_FOLDERS_PARAM, {
      ...baseConfig,
      weeklyProjectProgressShowEmptyFolders: false,
    })).toBe(true)
  })

  test('URL-encoded hide token resolves correctly', () => {
    const encoded = encodeURIComponent(HIDE_EMPTY_FOLDERS_PARAM)
    expect(resolveShowEmptyFoldersFromParam(encoded, baseConfig)).toBe(false)
  })

  test('explicit JSON setting value is honoured', () => {
    expect(resolveShowEmptyFoldersFromParam(
      encodeURIComponent('{"weeklyProjectProgressShowEmptyFolders":false}'),
      baseConfig,
    )).toBe(false)
  })

  test('returns null for refresh (empty) param', () => {
    expect(resolveShowEmptyFoldersFromParam('', baseConfig)).toBe(null)
  })
})

describe('applyShowEmptyFoldersParamToConfig', () => {
  test('hide param forces false even when settings say true', () => {
    const config = { ...baseConfig, weeklyProjectProgressShowEmptyFolders: true }
    const result = applyShowEmptyFoldersParamToConfig(config, HIDE_EMPTY_FOLDERS_PARAM)
    expect(result.weeklyProjectProgressShowEmptyFolders).toBe(false)
  })

  test('show param forces true even when settings say false', () => {
    const config = { ...baseConfig, weeklyProjectProgressShowEmptyFolders: false }
    const result = applyShowEmptyFoldersParamToConfig(config, SHOW_EMPTY_FOLDERS_PARAM)
    expect(result.weeklyProjectProgressShowEmptyFolders).toBe(true)
  })
})

describe('parseWeekLabelParam', () => {
  test('parses ISO week labels', () => {
    expect(parseWeekLabelParam('2026-W35')).toBe('2026-W35')
    expect(parseWeekLabelParam('2026-w5')).toBe('2026-W05')
  })

  test('returns null for non-view tokens', () => {
    expect(parseWeekLabelParam('hide')).toBe(null)
    expect(parseWeekLabelParam('')).toBe(null)
  })
})

describe('resolveWeekLabelFromArgs', () => {
  test('finds week label among multiple args', () => {
    expect(resolveWeekLabelFromArgs(['hide', '2026-W34'])).toBe('2026-W34')
    expect(resolveWeekLabelFromArgs(['2026-W34', 'hide'])).toBe('2026-W34')
  })
})

describe('formatProjectTypeTagCountLabel', () => {
  test('singular for one note, plural otherwise, without hash', () => {
    expect(formatProjectTypeTagCountLabel('#goal', 1)).toBe('goal')
    expect(formatProjectTypeTagCountLabel('#goal', 2)).toBe('goals')
    expect(formatProjectTypeTagCountLabel('#project', 4)).toBe('projects')
    expect(formatProjectTypeTagCountLabel('#area', 3)).toBe('areas')
  })
})

describe('resolveWeeklyProjectProgressOutputStyle', () => {
  test('maps user-facing list styles to bullet modes', () => {
    expect(resolveWeeklyProjectProgressOutputStyle({ weeklyProjectProgressBulletSummary: 'List by tag' }))
      .toEqual({ showTable: false, bulletMode: 'byTag' })
    expect(resolveWeeklyProjectProgressOutputStyle({ weeklyProjectProgressBulletSummary: 'List by folder' }))
      .toEqual({ showTable: false, bulletMode: 'byFolder' })
    expect(resolveWeeklyProjectProgressOutputStyle({ weeklyProjectProgressBulletSummary: 'List by sub-folder' }))
      .toEqual({ showTable: false, bulletMode: 'bySubFolder' })
  })

  test('table by sub-folder shows table only', () => {
    expect(resolveWeeklyProjectProgressOutputStyle({ weeklyProjectProgressBulletSummary: WEEKLY_PROJECT_PROGRESS_OUTPUT_TABLE_BY_SUBFOLDER }))
      .toEqual({ showTable: true, bulletMode: 'none' })
  })

  test('defaults to list by sub-folder', () => {
    expect(resolveWeeklyProjectProgressOutputStyle({}))
      .toEqual({ showTable: false, bulletMode: 'bySubFolder' })
  })

  test('still accepts legacy internal tokens', () => {
    expect(resolveWeeklyProjectProgressOutputStyle({ weeklyProjectProgressBulletSummary: 'byTag' }))
      .toEqual({ showTable: false, bulletMode: 'byTag' })
  })
})

describe('buildWeeklyProgressTagCountSummary', () => {
  test('formats tag counts with commas and final and', () => {
    const notesByTag = new Map([
      ['#goal', ['G1', 'G2', 'G3']],
      ['#project', ['P1', 'P2', 'P3', 'P4']],
    ])
    expect(buildWeeklyProgressTagCountSummary(['#goal', '#project', '#area'], notesByTag))
      .toBe('3 goals, 4 projects and 0 areas')
  })

  test('handles two tags with and', () => {
    expect(buildWeeklyProgressTagCountSummary(['#goal', '#project'], new Map([['#goal', ['G1']]])))
      .toBe('1 goal and 0 projects')
  })
})

describe('buildWeeklyProgressTagSummaryLines', () => {
  test('builds bullet lines in tag order, skipping empty tags', () => {
    const notesByTag = new Map([
      ['#project', ['Beta note', 'Alpha note']],
      ['#goal', ['Goal note']],
    ])
    const result = buildWeeklyProgressTagSummaryLines(['#goal', '#project', '#area'], notesByTag)
    expect(result).toBe('- **1 goal**: Goal note\n- **2 projects**: Alpha note・Beta note')
  })

  test('returns empty string when no progressed notes', () => {
    expect(buildWeeklyProgressTagSummaryLines(['#goal'], new Map())).toBe('')
  })
})

describe('tagNamePresentInFolderName', () => {
  test('detects tag name in folder name case-insensitively', () => {
    expect(tagNamePresentInFolderName('Projects/Project Alpha', '#project')).toBe(true)
    expect(tagNamePresentInFolderName('Areas/Health', '#goal')).toBe(false)
    expect(tagNamePresentInFolderName('My PROJECT folder', '#project')).toBe(true)
  })
})

describe('formatFolderTagSummaryLabel', () => {
  test('omits tag label when tag name appears in folder name', () => {
    expect(formatFolderTagSummaryLabel('Project Alpha', '#project', 3)).toBe('**3 Project Alpha**')
  })

  test('includes plural tag label when tag name not in folder name', () => {
    expect(formatFolderTagSummaryLabel('Health', '#area', 2)).toBe('**2 Health** areas')
    expect(formatFolderTagSummaryLabel('Health', '#area', 1)).toBe('**1 Health** area')
  })
})

describe('getTopLevelFolderPath', () => {
  test('returns first path segment', () => {
    expect(getTopLevelFolderPath('Projects/Project Alpha')).toBe('Projects')
    expect(getTopLevelFolderPath('Areas')).toBe('Areas')
  })
})

describe('buildWeeklyProgressByFolderSummaryLines', () => {
  test('aggregates notes under top-level folder per tag', () => {
    const notesByFolderAndTag = new Map([
      ['Projects/Project Alpha', new Map([['#project', ['Alpha note']]])],
      ['Projects/Project Beta', new Map([['#project', ['Beta note']]])],
      ['Areas/Health', new Map([['#area', ['Health note']]])],
    ])
    const result = buildWeeklyProgressByFolderSummaryLines(['#project', '#area'], notesByFolderAndTag)
    expect(result).toBe('- **1 Areas**: Health note\n- **2 Projects**: Alpha note ・ Beta note')
  })

  test('omits tag label when top-level folder name contains tag', () => {
    const notesByFolderAndTag = new Map([
      ['Projects/SubA', new Map([['#project', ['Note A', 'Note B', 'Note C']]])],
    ])
    const result = buildWeeklyProgressByFolderSummaryLines(['#project'], notesByFolderAndTag)
    expect(result).toBe('- **3 Projects**: Note A ・ Note B ・ Note C')
  })
})

describe('buildWeeklyProgressBySubFolderSummaryLines', () => {
  test('groups subfolder lines under top-level folder bullets', () => {
    const notesByFolderAndTag = new Map([
      ['Projects/Project Alpha', new Map([['#project', ['Alpha note']]])],
      ['Projects/Project Beta', new Map([['#project', ['Beta note']]])],
      ['Areas/Health', new Map([['#area', ['Health note']]])],
    ])
    const result = buildWeeklyProgressBySubFolderSummaryLines(['#project', '#area'], notesByFolderAndTag)
    expect(result).toBe(
      '- Areas\n'
      + '\t- **1 Areas/Health**: Health note\n'
      + '- Projects\n'
      + '\t- **1 Projects/Project Alpha**: Alpha note\n'
      + '\t- **1 Projects/Project Beta**: Beta note',
    )
  })
})

describe('buildWeeklyProgressBulletSummary', () => {
  const notesByTag = new Map([['#goal', ['Goal note']]])
  const notesByFolderAndTag = new Map([
    ['Goals/Goal A', new Map([['#goal', ['Goal note']]])],
  ])

  test('returns empty string for none or blank mode', () => {
    expect(buildWeeklyProgressBulletSummary('none', ['#goal'], notesByTag, notesByFolderAndTag)).toBe('')
    expect(buildWeeklyProgressBulletSummary('', ['#goal'], notesByTag, notesByFolderAndTag)).toBe('')
  })

  test('delegates to byTag mode', () => {
    expect(buildWeeklyProgressBulletSummary('byTag', ['#goal'], notesByTag, notesByFolderAndTag))
      .toBe('- **1 goal**: Goal note')
  })
})

describe('hide/show x-callback URL roundtrip', () => {
  test('hide link encodes arg0 correctly', () => {
    const url = createRunPluginCallbackUrl('jgclark.Reviews', 'weeklyProjectsProgress', [HIDE_EMPTY_FOLDERS_PARAM])
    expect(url).toContain('arg0=hide')
    const arg0 = decodeURIComponent(url.split('arg0=')[1]?.split('&')[0] ?? '')
    expect(resolveShowEmptyFoldersFromParam(arg0, baseConfig)).toBe(false)
  })

  test('show link encodes arg0 correctly', () => {
    const url = createRunPluginCallbackUrl('jgclark.Reviews', 'weeklyProjectsProgress', [SHOW_EMPTY_FOLDERS_PARAM])
    const arg0 = decodeURIComponent(url.split('arg0=')[1]?.split('&')[0] ?? '')
    expect(resolveShowEmptyFoldersFromParam(arg0, { ...baseConfig, weeklyProjectProgressShowEmptyFolders: false })).toBe(true)
  })

  test('refresh view param matches current show/hide mode', () => {
    expect(getWeeklyProjectProgressViewParam(true)).toBe(SHOW_EMPTY_FOLDERS_PARAM)
    expect(getWeeklyProjectProgressViewParam(false)).toBe(HIDE_EMPTY_FOLDERS_PARAM)
  })

  test('refresh link encodes view mode and week label', () => {
    const url = createRunPluginCallbackUrl('jgclark.Reviews', 'weeklyProjectsProgress', [HIDE_EMPTY_FOLDERS_PARAM, '2026-W34'])
    expect(url).toContain('arg0=hide')
    expect(url).toContain('arg1=2026-W34')
    expect(resolveWeekLabelFromArgs(['hide', '2026-W34'])).toBe('2026-W34')
  })
})
