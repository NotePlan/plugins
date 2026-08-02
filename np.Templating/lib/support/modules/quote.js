/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

// @flow

// KNOWN BUG - when the service responds but returns an empty array, this function falls out of the bottom and
// resolves `undefined` rather than a string. Declaring the return type `Promise<string | void>` would be honest but
// would only push the same defect onto the callers (`const verse: string = await getDailyQuote()`); the real fix is a
// missing return, which is a runtime change.
// $FlowFixMe[incompatible-return]
export async function getDailyQuote(): Promise<string> {
  const response = await fetch(`https://zenquotes.io/api/random`, { timeout: 3000 })
  if (response) {
    const quoteLines = JSON.parse(response)
    if (quoteLines.length > 0) {
      const data = quoteLines[0]
      return `${data.q} - *${data.a}*`
    }
  } else {
    return `**quote() web service did not respond**`
  }
}
