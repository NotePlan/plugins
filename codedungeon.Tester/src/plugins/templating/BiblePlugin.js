/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2021 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

const BiblePlugin = {
  var: 'mike',
  async votd() {
    return 'this is the actual plugin method'
  },
  async votd2() {
    return 'votd2'
  },
}

module.exports = BiblePlugin
