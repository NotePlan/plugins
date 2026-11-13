// @flow
/* eslint-disable no-unused-vars */
/* global jest, describe, test, expect, beforeAll */
import { CustomConsole } from '@jest/console'
import { archiveNote, unarchiveNote } from '../src/archive'
import { CommandBar, DataStore, Editor, Note, simpleFormatter } from '@mocks/index'
import { archiveNoteUsingFolder, isNoteAlreadyUnderArchiveRoot } from '@helpers/NPnote'

beforeAll(() => {
  global.DataStore = DataStore
  global.Editor = Editor
  global.CommandBar = CommandBar
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
  DataStore.settings['_logLevel'] = 'none' // DEBUG or none
})

function projectNote(filename: string, title: string): any {
  return new Note({ filename, type: 'Notes', title, content: `# ${title}` })
}

describe('jgclark.Filer archive', () => {
  describe('isNoteAlreadyUnderArchiveRoot()', () => {
    test('matches the default @Archive folder and a custom archive root', () => {
      expect(isNoteAlreadyUnderArchiveRoot('@Archive/Projects/Plan.md')).toBe(true)
      expect(isNoteAlreadyUnderArchiveRoot('@Archive/Plan.md')).toBe(true)
      expect(isNoteAlreadyUnderArchiveRoot('Projects/Plan.md')).toBe(false)
      expect(isNoteAlreadyUnderArchiveRoot('Completed/Plan.md', 'Completed')).toBe(true)
      expect(isNoteAlreadyUnderArchiveRoot('Projects/Plan.md', 'Completed')).toBe(false)
      expect(isNoteAlreadyUnderArchiveRoot('Completed/Plan.md', 'Completed/')).toBe(true)
    })
  })

  describe('archiveNoteUsingFolder()', () => {
    test('does not move a note that is already in the archive', () => {
      const moveNote = jest.fn<$ReadOnlyArray<any>, any>(() => '@Archive/Projects/Plan.md')
      ;(DataStore: any).moveNote = moveNote

      expect(archiveNoteUsingFolder(projectNote('@Archive/Projects/Plan.md', 'Plan'))).toBeUndefined()
      expect(archiveNoteUsingFolder(projectNote('Completed/Plan.md', 'Plan'), 'Completed')).toBeUndefined()
      expect(moveNote).not.toHaveBeenCalled()
    })

    test('moves a project note under @Archive and keeps its folder', () => {
      const moveNote = jest.fn<$ReadOnlyArray<any>, any>(() => '@Archive/Projects/Plan.md')
      ;(DataStore: any).moveNote = moveNote
      const note = projectNote('Projects/Plan.md', 'Plan')

      expect(archiveNoteUsingFolder(note)).toBe('@Archive/Projects/Plan.md')
      expect(moveNote).toHaveBeenCalledWith('Projects/Plan.md', '@Archive/Projects')
    })
  })

  describe('archive and unarchive commands', () => {
    test('archive tells you the note is already archived and does not move it', async () => {
      const moveNote = jest.fn<$ReadOnlyArray<any>, any>()
      const prompt = jest.fn<$ReadOnlyArray<any>, Promise<string>>(async () => 'OK')
      ;(DataStore: any).moveNote = moveNote
      ;(CommandBar: any).prompt = prompt
      const note = projectNote('@Archive/Projects/Plan.md', 'Plan')

      expect(await archiveNote(note)).toBeNull()
      expect(moveNote).not.toHaveBeenCalled()
      expect(prompt).toHaveBeenCalledWith('Archive Note', expect.stringContaining('already in the Archive'), ['OK, thanks'])
    })

    test('unarchive tells you when the move fails', async () => {
      const prompt = jest.fn<$ReadOnlyArray<any>, Promise<string>>(async () => 'OK')
      ;(DataStore: any).moveNote = jest.fn<$ReadOnlyArray<any>, any>(() => null)
      ;(CommandBar: any).prompt = prompt
      const note = projectNote('@Archive/Projects/Plan.md', 'Plan')

      expect(await unarchiveNote(note)).toBeNull()
      expect(prompt).toHaveBeenCalledWith('Unarchive Note', expect.stringContaining('Failed to move'), ['OK, thanks'])
    })

    test('x-callback archive of the open note does not prompt', async () => {
      const moveNote = jest.fn<$ReadOnlyArray<any>, any>(() => '@Archive/Projects/Plan.md')
      const prompt = jest.fn<$ReadOnlyArray<any>, Promise<string>>(async () => 'OK')
      ;(DataStore: any).moveNote = moveNote
      ;(CommandBar: any).prompt = prompt
      const note = projectNote('Projects/Plan.md', 'Plan')
      Editor.note = note

      expect(await archiveNote('', '')).toBe('@Archive/Projects/Plan.md')
      expect(moveNote).toHaveBeenCalledWith('Projects/Plan.md', '@Archive/Projects')
      expect(prompt).not.toHaveBeenCalled()
    })

    test('x-callback archive by filename uses the archive folder and does not prompt', async () => {
      const note = projectNote('Projects/Plan.md', 'Plan')
      const moveNote = jest.fn<$ReadOnlyArray<any>, any>(() => 'Completed/Projects/Plan.md')
      const prompt = jest.fn<$ReadOnlyArray<any>, Promise<string>>(async () => 'OK')
      ;(DataStore: any).moveNote = moveNote
      ;(DataStore: any).noteByFilename = jest.fn<$ReadOnlyArray<any>, any>(() => note)
      ;(CommandBar: any).prompt = prompt

      expect(await archiveNote('Projects/Plan.md', 'Completed')).toBe('Completed/Projects/Plan.md')
      expect(moveNote).toHaveBeenCalledWith('Projects/Plan.md', 'Completed/Projects')
      expect(prompt).not.toHaveBeenCalled()
    })

    test('x-callback archive does not prompt when the note is already archived', async () => {
      const moveNote = jest.fn<$ReadOnlyArray<any>, any>()
      const prompt = jest.fn<$ReadOnlyArray<any>, Promise<string>>(async () => 'OK')
      ;(DataStore: any).moveNote = moveNote
      ;(CommandBar: any).prompt = prompt
      Editor.note = projectNote('@Archive/Projects/Plan.md', 'Plan')

      expect(await archiveNote('', '@Archive')).toBeNull()
      expect(moveNote).not.toHaveBeenCalled()
      expect(prompt).not.toHaveBeenCalled()
    })

    test('x-callback unarchive does not prompt when the move fails', async () => {
      const prompt = jest.fn<$ReadOnlyArray<any>, Promise<string>>(async () => 'OK')
      ;(DataStore: any).moveNote = jest.fn<$ReadOnlyArray<any>, any>(() => null)
      ;(CommandBar: any).prompt = prompt
      Editor.note = projectNote('@Archive/Projects/Plan.md', 'Plan')

      expect(await unarchiveNote('')).toBeNull()
      expect(prompt).not.toHaveBeenCalled()
    })
  })
})
