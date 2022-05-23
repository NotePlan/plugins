// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2021-2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

export async function showError(method: string = '', message: string = ''): Promise<void> {
  const line = '*'.repeat(message.length + 30)
  console.log(line)
  console.log(`   ERROR`)
  console.log(`   Method: ${method}:`)
  console.log(`   Message: ${message}`)
  console.log(line)
  console.log('\n')
  Editor.insertTextAtCursor(`**Error: ${method}**\n- **${message}**`)
}
