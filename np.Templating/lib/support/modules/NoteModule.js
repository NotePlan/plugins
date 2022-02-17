// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

export default class NoteModule {
  constructor(config: any) {
    // $FlowFixMe
    this.config = config
  }

  setCursor(line: number = 0, position: number = 0): string {
    // await Editor.highlightByIndex(line, position)
    return '$NP_CURSOR'
  }
}
