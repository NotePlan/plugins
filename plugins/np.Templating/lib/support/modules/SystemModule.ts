// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

export default class SystemModule {
  config: any
  constructor(config: any = {}) {
    this.config = config
  }

  selection(): string {
    return Editor.selectedParagraphs.map((para) => para.rawContent).join('\n')
    // return this.config.selection
  }

  clipboard(): string {
    return this.config.clipboard
  }
}
