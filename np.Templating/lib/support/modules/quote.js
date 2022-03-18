/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

// @flow

// NOTE: Not using `@helpers/dev` here because it can't be resolved in jest tests
//       this should serve as a strong reason to support module aliases such as `@helpers`
//       as this is an ugly import
import { fetchWithTimeout } from '../../../../helpers/dev'

// $FlowFixMe
export async function getDailyQuote(): Promise<string> {
  const response = await fetchWithTimeout(`https://zenquotes.io/api/random`)
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
