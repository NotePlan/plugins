/* global describe, test, expect */
// @flow
import { renderCanvasHTML, inlineJSON } from '../src/canvasRenderer'

const client = require('../requiredFiles/canvasClient.js')

const sampleCanvas = {
  nodes: [
    { id: 'a', type: 'text', text: '# Hello **bold** [[My Note]]', x: 0, y: 0, width: 250, height: 120, color: '4' },
    { id: 'g', type: 'group', label: 'Group A', x: -50, y: -50, width: 800, height: 500 },
  ],
  edges: [{ id: 'e1', fromNode: 'a', toNode: 'g', label: 'links to' }],
}

describe('canvasRenderer shell', () => {
  test('embeds canvas data, path, toolbar and client script', () => {
    const html = renderCanvasHTML(sampleCanvas, 'test', '../../../Notes/Canvases/x.canvas')
    expect(html).toContain('window.__canvas = ')
    expect(html).toContain('"links to"')
    expect(html).toContain('window.__canvasPath = "../../../Notes/Canvases/x.canvas"')
    expect(html).toContain('src="./canvasClient.js"')
    expect(html).toContain('id="toolbar"')
    expect(html).toContain('data-color="6"')
  })

  test('embedded JSON cannot break out of the script tag', () => {
    const evil = { nodes: [{ id: 'x', type: 'text', text: '</script><script>alert(1)</script>', x: 0, y: 0, width: 10, height: 10 }] }
    expect(renderCanvasHTML(evil, 't', 'p')).not.toContain('</script><script>alert(1)')
    expect(inlineJSON('</script>')).not.toContain('</script>')
  })
})

describe('canvasClient pure helpers', () => {
  test('resolveColor maps presets and passes hex through', () => {
    expect(client.resolveColor('1')).toEqual('#e93147')
    expect(client.resolveColor('#123456')).toEqual('#123456')
    expect(client.resolveColor(undefined, '#fff')).toEqual('#fff')
  })

  test('renderMarkdown handles heading, bold, wikilink and escapes HTML', () => {
    const html = client.renderMarkdown('# Hi\n\n**yo** [[Some/Path/Note.md|alias]]\n<script>x</script>')
    expect(html).toMatch(/<h1[^>]*>Hi<\/h1>/)
    // <b>/<emph> matching NotePlan theme CSS selectors 'p b' / 'p emph'
    expect(html).toContain('<b>yo</b>')
    expect(html).toContain('data-note-title="Note"')
    expect(html).toContain('>alias</a>')
    expect(html).not.toContain('<script>x')
  })

  test('renderMarkdown renders tables', () => {
    const html = client.renderMarkdown('| Col A | Col B |\n|---|---|\n| a1 | b1 |\n| a2 | b2 |')
    expect(html).toContain('<table>')
    expect(html).toMatch(/<th[^>]*>Col A<\/th>/)
    expect(html).toContain('b2</td>')
  })

  test('renderMarkdown renders images: external as-is, relative against assetBase', () => {
    const html = client.renderMarkdown('![pic](https://x.y/i.png)\n\n![](%D0%9F_attachments/IMG.jpg)\n\n![[embed.png]]', '../../Notes/Sub/')
    expect(html).toContain('src="https://x.y/i.png"')
    expect(html).toContain('src="../../Notes/Sub/%D0%9F_attachments/IMG.jpg"') // pre-encoded: not encoded twice
    expect(html).toContain('src="../../Notes/Sub/embed.png"')
  })

  test('renderMarkdown renders checkboxes as GFM tasklists', () => {
    const html = client.renderMarkdown('- [ ] todo\n- [x] done')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('checked')
  })

  test('autoSides picks facing sides', () => {
    const a = { x: 0, y: 0, width: 100, height: 100 }
    const right = { x: 500, y: 0, width: 100, height: 100 }
    const below = { x: 0, y: 500, width: 100, height: 100 }
    expect(client.autoSides(a, right)).toEqual(['right', 'left'])
    expect(client.autoSides(a, below)).toEqual(['bottom', 'top'])
  })

  test('nearestSide finds the closest node side to a point', () => {
    const n = { x: 0, y: 0, width: 100, height: 100 }
    expect(client.nearestSide(n, 105, 50)).toEqual('right')
    expect(client.nearestSide(n, 50, -5)).toEqual('top')
  })

  test('nodeInsideGroup detects full containment', () => {
    const g = { id: 'g', x: 0, y: 0, width: 500, height: 500 }
    expect(client.nodeInsideGroup({ id: 'a', x: 10, y: 10, width: 100, height: 100 }, g)).toBe(true)
    expect(client.nodeInsideGroup({ id: 'b', x: 450, y: 10, width: 100, height: 100 }, g)).toBe(false)
    expect(client.nodeInsideGroup(g, g)).toBe(false)
  })

  test('filterNotes ranks prefix > title > path matches and caps at 8', () => {
    const idx = [
      { t: 'Заплановане', f: 'Work/Заплановане.md' },
      { t: 'Плани', f: 'Notes/Плани.md' },
      { t: 'Інше', f: 'Архів/плани-старі.md' },
      ...Array.from({ length: 10 }, (_, i) => ({ t: `Нотатка ${i}`, f: `n${i}.md` })),
    ]
    const res = client.filterNotes(idx, 'план')
    expect(res[0].t).toEqual('Плани')
    expect(res[1].t).toEqual('Заплановане')
    expect(res[2].t).toEqual('Інше')
    expect(client.filterNotes(idx, '').length).toBeLessThanOrEqual(8)
  })

  test('isGroupBorderHit: frame activates, interior does not', () => {
    const g = { x: 0, y: 0, width: 500, height: 400 }
    expect(client.isGroupBorderHit(g, 5, 200, 14)).toBe(true) // left frame
    expect(client.isGroupBorderHit(g, 250, 395, 14)).toBe(true) // bottom frame
    expect(client.isGroupBorderHit(g, 250, 200, 14)).toBe(false) // deep interior
  })

  test('genId makes 16-char hex ids like Obsidian', () => {
    expect(client.genId()).toMatch(/^[0-9a-f]{16}$/)
  })
})
