/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

// @flow

// <%- await web.services('https://labs.bible.org/api/?passage=random&type=json',['> 🙏🏻 ', '[0].bookname', ' ', '[0].chapter', ':', '[0].verse', '\n> 🗣 "', '[0].text','"']) %>

import { clo } from '@helpers/dev'

export async function getVerse(): Promise<string> {
  try {
    const URL = `https://labs.bible.org/api/?passage=random&type=json`
    const response: any = await await fetch(URL, { timeout: 3000 })
    const data = JSON.parse(response)[0]
    clo(data)
    return data ? `> 🙏🏻  ${data?.bookname} ${data?.chapter}:${data?.verse} \n> 🗣  ${data?.text}` : '**An error occurred accessing quoting service**'
  } catch (err) {
    return `**An error occurred accessing quoting service**`
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
    return '**An error occurred accessing verse service**'
  }
}
