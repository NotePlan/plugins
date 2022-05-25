/* eslint-disable */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2021 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import CodedungeonToolbox from './support/CodedungeonToolbox'

let toolbox
beforeEach(() => {
  toolbox = new CodedungeonToolbox()
})

test('codedungeon.Toolbox convertToHtml - headings', () => {
  const markdown = `#Heading1\n##Heading2\n###Heading3\n####Heading4\n**TODO Items:**\n* Item 1\n*Item 2`

  const html = toolbox.markdownToHtml(markdown, { removeAttributes: false })

  expect(html).toContain('<h1 id="heading1">Heading1</h1>')
  expect(html).toContain('<h2 id="heading2">Heading2</h2>')
  expect(html).toContain('<h3 id="heading3">Heading3</h3>')
  expect(html).toContain('<h4 id="heading4">Heading4</h4>')

  expect(html).toContain('<h4 id="heading4">Heading4</h4>')
})

test('codedungeon.Toolbox convertToHtml - bold, italic', () => {
  const markdown = `**Bold Item**
*Italic Item*
~~Striketrough~~`

  const html = toolbox.markdownToHtml(markdown)

  expect(html).toContain('<strong>Bold Item</strong>')
  expect(html).toContain('<em>Italic Item</em>')
})

test('codedungeon.Toolbox convertToHtml - tasks', () => {
  const markdown = `**TODO Items:**
* Item 1
* Item 2`

  const html = toolbox.markdownToHtml(markdown)

  expect(html).toContain('<strong>TODO Items:</strong>')
  expect(html).toContain('<li>Item 1</li>')
  expect(html).toContain('<li>Item 2</li>')
})

test('codedungeon.Toolbox convertToHtml - unordered lists', () => {
  const toolbox = new CodedungeonToolbox()

  const markdown = `**Lists:**
- Item 1
- Item 2
- Item 3`

  const html = toolbox.markdownToHtml(markdown)

  expect(html).toContain('<strong>Lists:</strong>')
  expect(html).toContain('<ul>')
  expect(html).toContain('<li>Item 1</li>')
  expect(html).toContain('<li>Item 2</li>')
  expect(html).toContain('</ul>')
})
