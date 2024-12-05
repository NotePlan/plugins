// @flow
/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2021-2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import { showMessage } from '../../helpers/userInput'
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
