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

  test('decodes parentheses NotePlan stored as %2528 so the folder matches the note name', () => {
    const raw = '%25281%2529%20Myths,%20Heroes%20and%20Hubris%20-%20by%20Graham%20Tomlin_attachments/pic.png'
    const found = m.findLocalMediaTargets(`![image](${raw})`)
    const decoded = '(1) Myths, Heroes and Hubris - by Graham Tomlin_attachments/pic.png'
    expect(found[0].decodedPath).toBe(decoded)
    const exists = (path: string) => path === `../../../Notes/${decoded}`
    expect(m.resolveLocalMediaPath('Notes', '(1) Myths.md', found[0].decodedPath, exists)).toBe(decoded)
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

  test('resolveLocalMediaPath finds a bare filename in the attachment folder', () => {
    const exists = (path: string) => path === '../../../Notes/Projects/Source_attachments/bare.png'
    expect(m.resolveLocalMediaPath('Notes', 'Projects/Source.md', 'bare.png', exists)).toBe('Source_attachments/bare.png')
    expect(m.resolveLocalMediaPath('Notes', 'Projects/Source.md', 'missing.png', exists)).toBeNull()
  })

  test('stripLocalMediaLink removes image and file forms and leaves the rest of the line', () => {
    const input = 'keep ![image](Note_attachments/a.png) and ![file](<Note_attachments/a.pdf>) tail'
    expect(m.stripLocalMediaLink(input, 'Note_attachments/a.png')).toBe('keep  and ![file](<Note_attachments/a.pdf>) tail')
    expect(m.stripLocalMediaLink(input, 'Note_attachments/a.pdf')).toBe('keep ![image](Note_attachments/a.png) and  tail')
  })

  test('classifyEmbeddedMedia reports missing links and folders with no resolved link', () => {
    const paths: { [string]: boolean } = {
      '../../../Notes/Projects/A_attachments': true,
      '../../../Notes/Projects/A_attachments/pic.png': true,
      '../../../Notes/Projects/C_attachments': true,
      '../../../Calendar/20261102_attachments': true,
    }
    const exists = (path: string) => paths[path] === true
    const notes = [
      { filename: 'Projects/A.md', type: 'Notes', content: 'no links' },
      { filename: 'Projects/B.md', type: 'Notes', content: '![image](A_attachments/pic.png)' },
      { filename: 'Projects/C.md', type: 'Notes', content: '![image](https://example.com/a.png)\n![file](C_attachments/gone.pdf)' },
      { filename: 'Projects/D.md', type: 'Notes', content: '![image](D_attachments/gone.png)' },
      { filename: '20261102.md', type: 'Calendar', content: '' },
    ]
    const result = m.classifyEmbeddedMedia(notes, exists)
    expect(result.brokenLinks.map((row) => `${row.filename} ${row.decodedPath}`)).toEqual([
      'Projects/C.md C_attachments/gone.pdf',
      'Projects/D.md D_attachments/gone.png',
    ])
    expect(result.brokenLinks[0].folderExists).toBe(true)
    expect(result.brokenLinks[1].folderExists).toBe(false)
    expect(result.unusedFolders.map((row) => `${row.noteType} ${row.folderPath}`)).toEqual([
      'Calendar 20261102_attachments',
      'Notes Projects/C_attachments',
    ])
  })

  test('storageRootFromAbsoluteMedia and absoluteAttachmentFolder rebuild the folder path', () => {
    const text = '![image](file:///Users/me/NotePlan/Notes/Projects/A_attachments/pic.png)'
    expect(m.storageRootFromAbsoluteMedia(text)).toBe('/Users/me/NotePlan')
    expect(m.absoluteAttachmentFolder('/Users/me/NotePlan', 'Notes', 'Projects/A.md')).toBe('/Users/me/NotePlan/Notes/Projects/A_attachments')
    expect(m.absoluteAttachmentFolder('/Users/me/NotePlan', 'Calendar', '20261102.md')).toBe('/Users/me/NotePlan/Calendar/20261102_attachments')
    expect(m.fileUrlForAbsoluteFolder('/Users/me/Note Plan/Notes/A_attachments')).toBe('file:///Users/me/Note%20Plan/Notes/A_attachments/')
    const encoded = '![image](/Users/me/Library/Application%20Support/NotePlan/Notes/A_attachments/pic.png)'
    expect(m.storageRootFromAbsoluteMedia(encoded)).toBe('/Users/me/Library/Application Support/NotePlan')
    expect(m.fileUrlForAbsoluteFolder('/Users/me/Library/Application%20Support/NotePlan/Notes/A_attachments')).toBe(
      'file:///Users/me/Library/Application%20Support/NotePlan/Notes/A_attachments/',
    )
    expect(m.fileUrlForAbsoluteFolder('/Users/me/Notes/(1) Myths [draft]_attachments')).toBe(
      'file:///Users/me/Notes/%281%29%20Myths%20%5Bdraft%5D_attachments/',
    )
    expect(m.fileUrlForAbsoluteFolder('/Users/me/Notes/%281%29%20Myths_attachments')).toBe('file:///Users/me/Notes/%281%29%20Myths_attachments/')
  })
})
