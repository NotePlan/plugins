/* eslint-disable */

import CodedungeonToolbox from './support/CodedungeonToolbox'

let toolbox
beforeEach(() => {
  toolbox = new CodedungeonToolbox()
})

test('codedungeon.Toolbox convertToRtf - headings', () => {
  const markdown = `#Heading1\n##Heading2\n###Heading3\n####Heading4\n**TODO Items:**\n* Item 1\n*Item 2`

  const rtf = toolbox.markdownToRtf(markdown)
})
