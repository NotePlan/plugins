/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

// @flow

// $FlowFixMe
export async function getDailyQuote(): Promise<string> {
  const response = await fetch(`https://zenquotes.io/api/random`, { timeout: 3000 })
  if (response) {
    //$FlowIgnore[incompatible-call]
    const quoteLines = JSON.parse(response)
    if (quoteLines.length > 0) {
      const data = quoteLines[0]
      return `${data.q} - *${data.a}*`
    }
  } else {
    return '**An error occurred accessing quoting service**'
  }
}
