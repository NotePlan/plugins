// @flow
/* eslint-disable */
/* globals describe, expect, test */

import { createRunPluginCallbackUrl } from '@helpers/general'
import {
  HIDE_EMPTY_FOLDERS_PARAM,
  SHOW_EMPTY_FOLDERS_PARAM,
  TOGGLE_EMPTY_FOLDERS_PARAM,
  applyShowEmptyFoldersParamToConfig,
  getFirstWeeklyProjectProgressParam,
  getWeeklyProjectProgressViewParam,
  isToggleEmptyFoldersParam,
  normalizeWeeklyProjectProgressParam,
  parseWeekLabelParam,
  resolveShowEmptyFoldersFromParam,
  resolveWeekLabelFromArgs,
  toggleWeeklyProjectProgressShowEmptyFoldersOnConfig,
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

  test('legacy hideEmptyFolders and showEmptyFolders tokens still work', () => {
    expect(resolveShowEmptyFoldersFromParam('hideEmptyFolders', baseConfig)).toBe(false)
    expect(resolveShowEmptyFoldersFromParam('showEmptyFolders', baseConfig)).toBe(true)
  })

  test('URL-encoded hide token resolves correctly', () => {
    const encoded = encodeURIComponent(HIDE_EMPTY_FOLDERS_PARAM)
    expect(resolveShowEmptyFoldersFromParam(encoded, baseConfig)).toBe(false)
  })

  test('legacy toggle token flips from default true', () => {
    expect(resolveShowEmptyFoldersFromParam(TOGGLE_EMPTY_FOLDERS_PARAM, baseConfig)).toBe(false)
  })

  test('legacy JSON toggle payload still works', () => {
    const json = JSON.stringify({ toggleWeeklyProjectProgressShowEmptyFolders: true })
    expect(resolveShowEmptyFoldersFromParam(encodeURIComponent(json), baseConfig)).toBe(false)
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

describe('isToggleEmptyFoldersParam', () => {
  test('recognises legacy toggle token', () => {
    expect(isToggleEmptyFoldersParam(TOGGLE_EMPTY_FOLDERS_PARAM)).toBe(true)
  })

  test('does not treat hide/show tokens as legacy toggle', () => {
    expect(isToggleEmptyFoldersParam(HIDE_EMPTY_FOLDERS_PARAM)).toBe(false)
    expect(isToggleEmptyFoldersParam(SHOW_EMPTY_FOLDERS_PARAM)).toBe(false)
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

describe('toggleWeeklyProjectProgressShowEmptyFoldersOnConfig', () => {
  test('defaults to true then toggles to false and back', () => {
    const hidden = toggleWeeklyProjectProgressShowEmptyFoldersOnConfig(baseConfig)
    expect(hidden.weeklyProjectProgressShowEmptyFolders).toBe(false)
    const shown = toggleWeeklyProjectProgressShowEmptyFoldersOnConfig(hidden)
    expect(shown.weeklyProjectProgressShowEmptyFolders).toBe(true)
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
