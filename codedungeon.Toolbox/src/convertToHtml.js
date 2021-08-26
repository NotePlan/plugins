// @flow
// If you're not up for Flow typechecking (it's quite an undertaking), delete the line above
// Plugin code goes in files like this. Can be one per command, or several in a file.
// export default async function [name of the function called by Noteplan]
// Type checking reference: https://flow.org/
// Specific how-to re: Noteplan: https://github.com/NotePlan/plugins/blob/main/Flow_Guide.md

import { showMessage } from '../../helperFunctions'
import CodedungeonToolbox from './support/CodedungeonToolbox'

export async function convertToHtml(): Promise<void> {
  const toolbox = new CodedungeonToolbox()

  const note = Editor.content || ''

  const html = toolbox.markdownToHtml(note)

  Clipboard.string = html

  if (html.length > 0) {
    await showMessage('Content Copied To Clipboard')
  } else {
    await showMessage('An error occured converting content to HTML')
  }
}
