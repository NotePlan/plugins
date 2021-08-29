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

test('codedungeon.Toolbox convertToRtf - headings', async () => {
  const markdown = `#Heading1\n##Heading2\n###Heading3\n####Heading4\n**TODO Items:**\n* Item 1\n*Item 2`

  const rtf = await toolbox.markdownToRtf(markdown)

  expect(rtf).toContain('{\\rtf1\\ansi')
  expect(rtf).toContain('{\\pard\n{\\b\nTODO Items:\n}')
})
