// @flow
/* global describe, test, expect, beforeAll */
import { CustomConsole } from '@jest/console'
import * as m from '../NPEmbeddedMedia'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
  DataStore.settings['_logLevel'] = 'none'
})

describe('NPEmbeddedMedia', () => {
  test('findLocalMediaTargets reads attachment links and skips remote images', () => {
    const text = [
      '![image](Source%20Note_attachments/Shot%202.png)',
      '![image](https://example.com/a.png)',
      '![file](<Source Note_attachments/doc.pdf>)',
      '![image](pic.png)',
    ].join('\n')
    const found = m.findLocalMediaTargets(text)
    expect(found.map((item) => item.decodedPath)).toEqual([
      'Source Note_attachments/Shot 2.png',
      'Source Note_attachments/doc.pdf',
      'pic.png',
    ])
    expect(found[1].kind).toBe('file')
  })

  test('encodeAttachmentPath percent-encodes spaces but keeps the slash', () => {
    expect(m.encodeAttachmentPath('Dest Note_attachments/Shot 2.png')).toBe('Dest%20Note_attachments/Shot%202.png')
  })

  test('chooseDestAttachmentPath adds a numeric suffix when the name exists', () => {
    const taken: Array<string> = []
    const existing = ['Dest_attachments/pic.png']
    const chosen = m.chooseDestAttachmentPath('Folder/Dest.md', 'Source_attachments/pic.png', taken, (rel) => existing.includes(rel))
    expect(chosen).toBe('Dest_attachments/pic 2.png')
  })

  test('rewriteMediaLinks retargets image and file links', () => {
    const input = 'see ![image](Source_attachments/pic.png) and ![file](<Source_attachments/doc.pdf>)'
    const output = m.rewriteMediaLinks(input, [
      { rawTarget: 'Source_attachments/pic.png', encodedDest: 'Dest_attachments/pic.png' },
      { rawTarget: 'Source_attachments/doc.pdf', encodedDest: 'Dest_attachments/doc.pdf' },
    ])
    expect(output).toBe('see ![image](Dest_attachments/pic.png) and ![file](Dest_attachments/doc.pdf)')
  })

  test('pluginDataPathForNote points at Notes or Calendar beside the note', () => {
    expect(m.pluginDataPathForNote('Notes', 'Projects/Source.md', 'Source_attachments/pic.png')).toBe('../../../Notes/Projects/Source_attachments/pic.png')
    expect(m.pluginDataPathForNote('Notes', 'Source.md', 'Source_attachments/pic.png')).toBe('../../../Notes/Source_attachments/pic.png')
    expect(m.pluginDataPathForNote('Calendar', '20261102.md', '20261102_attachments/pic.png')).toBe('../../../Calendar/20261102_attachments/pic.png')
  })

  describe('prepareEmbeddedMediaMove', () => {
    let files: { [string]: string }
    let trashed: Array<string>

    beforeAll(() => {
      files = {}
      trashed = []
    })

    function installStore() {
      files = {
        '../../../Notes/Projects/Source_attachments/pic.png': 'IMGDATA',
        '../../../Notes/Projects/Source_attachments/bare.png': 'BARE',
      }
      trashed = []
      // $FlowFixMe[cannot-write] test double
      DataStore.fileExists = (p: string) => files[p] != null
      // $FlowFixMe[cannot-write]
      DataStore.loadData = (p: string) => files[p]
      // $FlowFixMe[cannot-write]
      DataStore.saveData = (data: string, p: string) => {
        files[p] = data
        return true
      }
      // $FlowFixMe[cannot-write]
      DataStore.trashNote = (p: string) => {
        trashed.push(p)
        delete files[`../../../Notes/${p}`]
        return true
      }
    }

    test('copies the file into the destination attachment folder and rewrites the link', () => {
      installStore()
      const source = {
        filename: 'Projects/Source.md',
        type: 'Notes',
        content: 'keep ![image](Source_attachments/pic.png)\n![image](Source_attachments/pic.png)',
        paragraphs: [],
      }
      const dest = { filename: 'Archive/Dest.md', type: 'Notes', content: '', paragraphs: [] }
      const paras = [
        { rawContent: 'line ![image](Source_attachments/pic.png)', content: 'line ![image](Source_attachments/pic.png)' },
        { rawContent: '\t![image](pic-missing.png)', content: '![image](pic-missing.png)' },
      ]
      const move = m.prepareEmbeddedMediaMove(source, dest, paras)
      expect(move).not.toBeNull()
      if (!move) return
      expect(move.rewrite('line ![image](Source_attachments/pic.png)\n\t![image](pic-missing.png)')).toBe(
        'line ![image](Dest_attachments/pic.png)\n\t![image](pic-missing.png)',
      )
      expect(files['../../../Notes/Archive/Dest_attachments/pic.png']).toBe('IMGDATA')
      expect(move.copied.length).toBe(1)
      expect(move.copied[0].sourceTrashPath).toBe('Projects/Source_attachments/pic.png')

      m.removeSourceEmbeddedMediaIfUnused(source, move.copied)
      expect(trashed).toEqual([])

      source.content = 'no image left'
      m.removeSourceEmbeddedMediaIfUnused(source, move.copied)
      expect(trashed).toEqual(['Projects/Source_attachments/pic.png'])
    })

    test('finds a bare filename inside the source attachment folder', () => {
      installStore()
      const source = { filename: 'Projects/Source.md', type: 'Notes', content: '', paragraphs: [] }
      const dest = { filename: 'Archive/Dest.md', type: 'Notes', content: '', paragraphs: [] }
      const paras = [{ rawContent: '![image](bare.png)', content: '![image](bare.png)' }]
      const move = m.prepareEmbeddedMediaMove(source, dest, paras)
      expect(move).not.toBeNull()
      if (!move) return
      expect(move.rewrite('![image](bare.png)')).toBe('![image](Dest_attachments/bare.png)')
      expect(files['../../../Notes/Archive/Dest_attachments/bare.png']).toBe('BARE')
    })

    test('does not trash a calendar attachment', () => {
      files = { '../../../Calendar/20261102_attachments/pic.png': 'IMGDATA' }
      trashed = []
      // $FlowFixMe[cannot-write]
      DataStore.fileExists = (p: string) => files[p] != null
      // $FlowFixMe[cannot-write]
      DataStore.loadData = (p: string) => files[p]
      // $FlowFixMe[cannot-write]
      DataStore.saveData = (data: string, p: string) => {
        files[p] = data
        return true
      }
      // $FlowFixMe[cannot-write]
      DataStore.trashNote = (p: string) => {
        trashed.push(p)
        return true
      }
      const source = { filename: '20261102.md', type: 'Calendar', content: '', paragraphs: [] }
      const dest = { filename: 'Archive/Dest.md', type: 'Notes', content: '', paragraphs: [] }
      const paras = [{ rawContent: '![image](20261102_attachments/pic.png)', content: '![image](20261102_attachments/pic.png)' }]
      const move = m.prepareEmbeddedMediaMove(source, dest, paras)
      expect(move).not.toBeNull()
      if (!move) return
      expect(files['../../../Notes/Archive/Dest_attachments/pic.png']).toBe('IMGDATA')
      m.removeSourceEmbeddedMediaIfUnused(source, move.copied)
      expect(trashed).toEqual([])
      expect(files['../../../Calendar/20261102_attachments/pic.png']).toBe('IMGDATA')
    })
  })
})
