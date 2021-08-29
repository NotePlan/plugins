// @flow
/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2021 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import { showMessage } from '../../helperFunctions'
import CodedungeonToolbox from './support/CodedungeonToolbox'

export async function convertSelectionToHtml(): Promise<void> {
  const toolbox = new CodedungeonToolbox()

  const note = Editor.selectedLinesText.join('\n') || ''

  const html = toolbox.markdownToHtml(note)

  Clipboard.string = html

  if (html.length > 0) {
    await showMessage('Content Copied To Clipboard')
  } else {
    await showMessage('An error occured converting content to HTML')
  }
}
