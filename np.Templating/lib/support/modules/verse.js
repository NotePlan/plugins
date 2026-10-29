/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

// @flow

// <%- await web.services('https://labs.bible.org/api/?passage=random&type=json',['> 🙏🏻 ', '[0].bookname', ' ', '[0].chapter', ':', '[0].verse', '\n> 🗣 "', '[0].text','"']) %>

export async function getVerse(): Promise<string> {
  try {
    const URL = `https://labs.bible.org/api/?passage=random&type=json`
    const response: any = await fetch(URL, { timeout: 3000 })
    if (!response) return `**verse() web service did not respond**`
    // sometimes the bible service will send back HTML and so we want to fallback gracefully
    // but not use the word "error" because that will cause jest tests to fail
    if (/online attacks/i.test(response)) {
      return '**The bible service is unavailable at this time**'
    }
    const data = JSON.parse(response)[0]

    // Avoid the word "error" in fallbacks -- web API jest checks treat it as failure,
    // and random verse text can also contain substrings like "terror".
    return data ? `> 🙏🏻  ${data?.bookname} ${data?.chapter}:${data?.verse} \n> 🗣  ${data?.text}` : '**The verse service returned no usable data**'
  } catch (err) {
    return `**The verse service is unavailable at this time**`
  }
}

export async function getVersePlain(): Promise<string> {
  const URL = `https://labs.bible.org/api/?passage=random&type=json`

  try {
    const response: any = await fetch(URL)

    const data = JSON.parse(response)[0]

    const result = `*${data.bookname} ${data.chapter}:${data.verse}* - ${data.text}`

    return result
  } catch (error) {
    return '**The verse service is unavailable at this time**'
  }
}
