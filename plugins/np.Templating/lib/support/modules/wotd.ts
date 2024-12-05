/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

// @flow

import { clo } from '@np/helpers/dev'

export async function getWOTD(params?: any): Promise<string> {
  try {
    const url = 'https://wordsapiv1.p.rapidapi.com/words/?random=true'

    const options = {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': 'Xwiq2Q2FCrmshVLkpU1ApDOasM3rp1OIm7vjsnlVvRfpkFBmeX',
        'X-RapidAPI-Host': 'wordsapiv1.p.rapidapi.com',
      },
    }

    const result = await fetch(url, options)

    // @ts-ignore
    const data = JSON.parse(result)

    let word = data?.word
    if (params?.attribution) {
      word = `${data?.word} ${data?.word}`
    }

    return word
  } catch (error: any) {
    return `**An error occurred accessing wotd service**`
  }
}
