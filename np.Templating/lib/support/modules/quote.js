/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

// @flow

export async function getDailyQuote(): Promise<string> {
  const response = await fetch(`https://zenquotes.io/api/random`, { timeout: 3000 })
  if (response) {
    const quoteLines = JSON.parse(response)
    if (quoteLines.length > 0) {
      const data = quoteLines[0]
      return `${data.q} - *${data.a}*`
    }
    // Previously fell out of the bottom here and resolved `undefined` out of a `Promise<string>`
    return `**quote() web service returned no quotes**`
  }
  return `**quote() web service did not respond**`
}
