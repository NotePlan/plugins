// @flow
/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2021 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import { showMessage } from '../../helperFunctions'
import CodedungeonToolbox from './support/CodedungeonToolbox'

export async function reorderList(): Promise<void> {
  const toolbox = new CodedungeonToolbox()

  const listData = Editor.selectedLinesText

  const newList = await toolbox.reorderList(listData)

  Editor.replaceSelectionWithText(newList.join('\n'))
}
