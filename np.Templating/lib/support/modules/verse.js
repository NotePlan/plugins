// @flow

// <%- await web.services('https://labs.bible.org/api/?passage=random&type=json',['> 🙏🏻 ', '[0].bookname', ' ', '[0].chapter', ':', '[0].verse', '\n> 🗣 "', '[0].text','"']) %>

export async function getVerse(): Promise<string> {
  const URL = `https://labs.bible.org/api/?passage=random&type=json`

  try {
    const response: any = await fetch(URL)

    const data = JSON.parse(response)[0]

    const result = `> 🙏🏻  ${data.bookname} ${data.chapter}:${data.verse} \n> 🗣  ${data.text}`

    return result
  } catch (error) {
    return '**An error occurred accessing verse service**'
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
