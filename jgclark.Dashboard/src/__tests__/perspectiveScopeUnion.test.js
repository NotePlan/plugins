// @flow
/* eslint-disable */
/* globals describe, expect, test, beforeAll, afterAll */

import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan } from '@mocks/index'
import {
  buildPerspectiveScopeUnion,
  fingerprintOfScopes,
  foldersToScanForChangedScopes,
  noteMatchesAnyScope,
  parsePerspectiveScopeUnion,
  perspectiveFolderTeamspaceDefsChanged,
  resolvePerspectiveFolders,
  withDestinationScopeFolders,
} from '../perspectiveScopeUnion'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = new NotePlan()
  DataStore.settings['_logLevel'] = 'none'
  DataStore.folders = [
    '/',
    '@Archive',
    '@Templates',
    '@Trash',
    'Home',
    'Personal',
    'Work',
    'Work/Clients',
    'Work/Secret',
  ]
})

afterAll(() => {
  delete global.DataStore
})

function def(name: string, includedFolders: string, excludedFolders: string, teamspaces: Array<string> = ['private']): any {
  return {
    name,
    isActive: false,
    dashboardSettings: { includedFolders, excludedFolders, includedTeamspaces: teamspaces },
  }
}

describe('resolvePerspectiveFolders', () => {
  test('empty includes use every folder except always-excluded specials and user excludes', () => {
    const folders = resolvePerspectiveFolders('', 'Personal')
    expect(folders).toContain('Work')
    expect(folders).toContain('Home')
    expect(folders).not.toContain('Personal')
    expect(folders).not.toContain('@Archive')
    expect(folders).not.toContain('@Templates')
    expect(folders).not.toContain('@Trash')
  })

  test('an include keeps matching folders and still applies excludes', () => {
    const folders = resolvePerspectiveFolders('Work', 'Secret')
    expect(folders).toContain('Work')
    expect(folders).toContain('Work/Clients')
    expect(folders).not.toContain('Work/Secret')
    expect(folders).not.toContain('Home')
  })
})

describe('buildPerspectiveScopeUnion', () => {
  test('keeps changedAt when folders and teamspaces are unchanged, and updates it when they change', () => {
    const previous = buildPerspectiveScopeUnion(
      [def('Work', 'Work', ''), def('Home', 'Home', '')],
      null,
      100,
    )
    const next = buildPerspectiveScopeUnion(
      [def('Work', 'Work', ''), def('Home', 'Home, Personal', '')],
      previous,
      200,
    )
    const work = next.scopes.find((scope) => scope.name === 'Work')
    const home = next.scopes.find((scope) => scope.name === 'Home')
    expect(work?.changedAt).toBe(100)
    expect(home?.changedAt).toBe(200)
    expect(next.fingerprint).toBe(fingerprintOfScopes(next.scopes))
  })

  test('fingerprint ignores changedAt and which perspective is active', () => {
    const first = buildPerspectiveScopeUnion([def('Home', 'Home', ''), def('Work', 'Work', '')], null, 1)
    const second = buildPerspectiveScopeUnion([def('Work', 'Work', ''), def('Home', 'Home', '')], null, 99)
    expect(first.fingerprint).toBe(second.fingerprint)
  })

  test('omits the default "-" perspective, which usually includes every folder', () => {
    const union = buildPerspectiveScopeUnion(
      [def('-', '', ''), def('Home', 'Home', '')],
      null,
      10,
    )
    expect(union.scopes.map((scope) => scope.name)).toEqual(['Home'])
    const homeOnly = buildPerspectiveScopeUnion([def('Home', 'Home', '')], null, 99)
    expect(union.fingerprint).toBe(homeOnly.fingerprint)
  })
})

describe('withDestinationScopeFolders', () => {
  test('writes nothing when the destination folder list is unchanged', () => {
    const union = buildPerspectiveScopeUnion([def('Work', 'Work', ''), def('Home', 'Home', '')], null, 10)
    const work = union.scopes.find((scope) => scope.name === 'Work')
    const result = withDestinationScopeFolders(union, 'Work', work?.folders ?? [], ['private'], 50)
    expect(result.changed).toBe(false)
    expect(result.union).toBe(union)
  })

  test('updates only the destination scope when a folder appears', () => {
    const union = buildPerspectiveScopeUnion([def('Work', 'Work/Clients', ''), def('Home', 'Home', '')], null, 10)
    const result = withDestinationScopeFolders(union, 'Work', ['Work', 'Work/Clients'], ['private'], 80)
    expect(result.changed).toBe(true)
    const work = result.union.scopes.find((scope) => scope.name === 'Work')
    const home = result.union.scopes.find((scope) => scope.name === 'Home')
    expect(work?.folders).toEqual(['Work', 'Work/Clients'])
    expect(work?.changedAt).toBe(80)
    expect(home?.changedAt).toBe(10)
    expect(home?.folders).toEqual(union.scopes.find((scope) => scope.name === 'Home')?.folders)
  })

  test('does not add the default "-" perspective, and drops it when it is already stored', () => {
    const union = buildPerspectiveScopeUnion([def('Home', 'Home', '')], null, 10)
    const withDash = {
      ...union,
      scopes: union.scopes.concat([{ name: '-', folders: ['/'], teamspaces: ['private'], changedAt: 1 }]),
    }
    const dropped = withDestinationScopeFolders(withDash, '-', ['/'], ['private'], 50)
    expect(dropped.changed).toBe(true)
    expect(dropped.union.scopes.map((scope) => scope.name)).toEqual(['Home'])
    const again = withDestinationScopeFolders(dropped.union, '-', ['/'], ['private'], 60)
    expect(again.changed).toBe(false)
    expect(again.union).toBe(dropped.union)
  })
})

describe('perspectiveFolderTeamspaceDefsChanged', () => {
  test('ignores which perspective is active', () => {
    const previous = [def('Work', 'Work', '')]
    previous[0].isActive = false
    const next = [def('Work', 'Work', '')]
    next[0].isActive = true
    expect(perspectiveFolderTeamspaceDefsChanged(previous, next)).toBe(false)
  })

  test('ignores folder changes on the default "-" perspective', () => {
    expect(perspectiveFolderTeamspaceDefsChanged(
      [def('Home', 'Home', ''), def('-', '', '')],
      [def('Home', 'Home', ''), def('-', 'Work', '')],
    )).toBe(false)
  })

  test('detects a folder definition change on a non-active perspective', () => {
    expect(perspectiveFolderTeamspaceDefsChanged(
      [def('Work', 'Work', ''), def('Home', 'Home', '')],
      [def('Work', 'Work', 'Secret'), def('Home', 'Home', '')],
    )).toBe(true)
  })
})

describe('parsePerspectiveScopeUnion', () => {
  test('drops a stored "-" scope and recomputes the fingerprint without it', () => {
    const home = buildPerspectiveScopeUnion([def('Home', 'Home', '')], null, 10)
    const raw = {
      version: 1,
      fingerprint: 'includes-dash',
      scopes: home.scopes.concat([{ name: '-', folders: ['/'], teamspaces: ['private'], changedAt: 1 }]),
    }
    const parsed = parsePerspectiveScopeUnion(JSON.stringify(raw))
    expect(parsed?.scopes.map((scope) => scope.name)).toEqual(['Home'])
    expect(parsed?.fingerprint).toBe(home.fingerprint)
  })
})

describe('foldersToScanForChangedScopes', () => {
  test('skips a folder that an unchanged scope already covers', () => {
    const scopes = [
      { name: 'Work', folders: ['Work', 'Work/Clients'], teamspaces: ['private'], changedAt: 20 },
      { name: 'Home', folders: ['Home', 'Work/Clients'], teamspaces: ['private'], changedAt: 5 },
    ]
    expect(foldersToScanForChangedScopes(scopes, { Work: 5, Home: 5 })).toEqual(['Work'])
  })

  test('does not treat a teamspace cross product as one shared folder list', () => {
    const scopes = [
      { name: 'Work', folders: ['Work'], teamspaces: ['teamA'], changedAt: 1 },
      { name: 'Personal', folders: ['Personal'], teamspaces: ['teamB'], changedAt: 1 },
    ]
    expect(noteMatchesAnyScope('Work/note.md', true, 'teamB', scopes)).toBe(false)
    expect(noteMatchesAnyScope('Work/note.md', true, 'teamA', scopes)).toBe(true)
  })
})
