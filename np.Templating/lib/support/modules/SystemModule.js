// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2021 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import clipboard from 'clipboardy'

export default class SystemModule {
  constructor() {
    //
  }

  async cliboard(): Promise<string> {
    return clipboard.readSync()
  }

  async prompt(value: string = '', message: string = ''): Promise<string> {
    if (value.length > 0) {
      return value
    }
    return 'response'
  }
}
