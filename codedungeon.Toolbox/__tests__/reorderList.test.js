/* eslint-disable */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2021 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import CodedungeonToolbox from '../src/support/CodedungeonToolbox'

let toolbox
beforeEach(() => {
  toolbox = new CodedungeonToolbox()
})

test('codedungeon.Toolbox reorderList', async () => {
  let list = ['1. item 1', '\t1. subitem 1', '\t2. subitem 1', '2. item 2', '3. item 3', '3. item 4', '4. item 5']

  let result = await toolbox.reorderList(list)

  expect(result[0]).toBe('1. item 1')
  expect(result[3]).toBe('2. item 2')
  expect(result[4]).toBe('3. item 3')
  expect(result[5]).toBe('4. item 4')
  expect(result[6]).toBe('5. item 5')
})
