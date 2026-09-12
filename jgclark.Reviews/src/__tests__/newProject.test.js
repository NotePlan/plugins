// @flow
/* eslint-disable */
/* globals describe, expect, test, beforeAll */

import { DataStore, NotePlan } from '@mocks/index'
import {
  getDefaultFolderForNewProject,
  getFolderChoicesForNewProject,
  parseCreateNewProjectFormValues,
  resolveFolderPathFromChoice,
} from '../newProject'

// Examples for 'Dashboard' Teamspace
const TEAMSPACE_ROOT = '%%NotePlanCloud%%/1b91b194-4c76-4a48-8d4d-4c499d64a919'
const TEAMSPACE_DASHBOARD = `${TEAMSPACE_ROOT}/Dashboard`

beforeAll(() => {
  global.NotePlan = new NotePlan()
  global.DataStore = DataStore
  DataStore.settings['_logLevel'] = 'none'
  DataStore.folders = [
    '/',
    '@Archive/old',
    '@Templates',
    '@Trash/gone',
    '@Demo',
    'Projects',
    'Projects/Work',
    'Home',
    TEAMSPACE_ROOT,
    TEAMSPACE_DASHBOARD,
  ]
  DataStore.teamspaces = [
    {
      filename: TEAMSPACE_ROOT,
      title: 'Dashboard Plugin',
    },
  ]
})

/**
 * @param {any} overrides
 * @returns {any}
 */
function makeSubmittedForm(overrides: any = {}): any {
  return {
    submitted: true,
    values: {
      title: 'Secret Undertaking',
      folder: 'Projects/Work',
      projectTag: '#project',
      startDate: '2026-09-11',
      dueDate: '',
      reviewedDate: '2026-09-11',
      reviewInterval: '1w',
      aim: '',
      startingProgressNumber: '',
      startingProgressComment: '',
      ...overrides,
    },
  }
}

describe('getFolderChoicesForNewProject', () => {
  test('includes regular folders and root, excludes Archive/Templates/Trash', () => {
    const folders = getFolderChoicesForNewProject()
    const paths = folders.map((choice) => choice.path)
    expect(paths).toContain('/')
    expect(paths).toContain('Projects')
    expect(paths).toContain('Projects/Work')
    expect(paths).toContain('Home')
    expect(paths).toContain('@Demo')
    expect(paths).not.toContain('@Archive/old')
    expect(paths).not.toContain('@Templates')
    expect(paths).not.toContain('@Trash/gone')
  })

  test('shows Teamspace folders with the space title instead of a UUID', () => {
    const folders = getFolderChoicesForNewProject()
    const teamspaceRoot = folders.find((choice) => choice.path === TEAMSPACE_ROOT)
    const teamspaceChild = folders.find((choice) => choice.path === TEAMSPACE_DASHBOARD)
    expect(teamspaceRoot?.label).toBe('[👥 Dashboard Plugin] /')
    expect(teamspaceChild?.label).toBe('[👥 Dashboard Plugin] Dashboard')
    expect(teamspaceChild?.label.includes('1b91b194')).toBe(false)
  })
})

describe('getDefaultFolderForNewProject', () => {
  const choices = [
    { path: '/', label: '/' },
    { path: 'Home', label: 'Home' },
    { path: 'Projects', label: 'Projects' },
    { path: 'Projects/Work', label: 'Projects/Work' },
    { path: TEAMSPACE_DASHBOARD, label: '[👥 Dashboard Plugin] Dashboard' },
  ]

  test('uses the current Editor note folder when it is in the list', () => {
    const editorNote = { type: 'Notes', filename: 'Projects/Work/Bond.md' }
    expect(getDefaultFolderForNewProject(choices, (editorNote: any)).path).toBe('Projects/Work')
  })

  test('falls back to root when no Editor note is open', () => {
    expect(getDefaultFolderForNewProject(choices, null).path).toBe('/')
  })

  test('falls back to root for a calendar note', () => {
    const editorNote = { type: 'Calendar', filename: '20260911.md' }
    expect(getDefaultFolderForNewProject(choices, (editorNote: any)).path).toBe('/')
  })

  test('falls back to root when the current folder is not in the choices', () => {
    const editorNote = { type: 'Notes', filename: '@Archive/old/Shelved.md' }
    expect(getDefaultFolderForNewProject(choices, (editorNote: any)).path).toBe('/')
  })

  test('uses a Teamspace folder when that is the current Editor note folder', () => {
    const editorNote = { type: 'Notes', filename: `${TEAMSPACE_DASHBOARD}/Note.md` }
    expect(getDefaultFolderForNewProject(choices, (editorNote: any)).label).toBe('[👥 Dashboard Plugin] Dashboard')
  })
})

describe('resolveFolderPathFromChoice', () => {
  const choices = [
    { path: 'Projects/Work', label: 'Projects/Work' },
    { path: TEAMSPACE_DASHBOARD, label: '[👥 Dashboard Plugin] Dashboard' },
  ]

  test('resolves a Teamspace display label back to the raw folder path', () => {
    expect(resolveFolderPathFromChoice(choices, '[👥 Dashboard Plugin] Dashboard')).toBe(TEAMSPACE_DASHBOARD)
  })

  test('accepts a raw folder path as well', () => {
    expect(resolveFolderPathFromChoice(choices, 'Projects/Work')).toBe('Projects/Work')
  })
})

describe('parseCreateNewProjectFormValues', () => {
  test('returns title and folder plus convert-to-project fields', () => {
    const parsed = parseCreateNewProjectFormValues(makeSubmittedForm(), false)
    expect(parsed).not.toBeNull()
    expect(parsed?.title).toBe('Secret Undertaking')
    expect(parsed?.folder).toBe('Projects/Work')
    expect(parsed?.projectTag).toBe('#project')
    expect(parsed?.reviewInterval).toBe('1w')
  })

  test('trims title and folder', () => {
    const parsed = parseCreateNewProjectFormValues(
      makeSubmittedForm({ title: '  Moonraker  ', folder: '  Home  ' }),
      false,
    )
    expect(parsed?.title).toBe('Moonraker')
    expect(parsed?.folder).toBe('Home')
  })

  test('returns null when title is empty', () => {
    expect(parseCreateNewProjectFormValues(makeSubmittedForm({ title: '   ' }), false)).toBeNull()
  })

  test('returns null when folder is empty', () => {
    expect(parseCreateNewProjectFormValues(makeSubmittedForm({ folder: '' }), false)).toBeNull()
  })

  test('returns null when the form was cancelled', () => {
    expect(parseCreateNewProjectFormValues({ submitted: false, values: {} }, false)).toBeNull()
  })
})
