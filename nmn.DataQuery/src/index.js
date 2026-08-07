// @flow

import json5 from 'json5'

/**
 * A `$`-prefixed query object written in a ```javascript code block in the current note. `json5.parse()` returns
 * `mixed`, so the individual keys this renderer understands (`$title`, `$showAs`, `$select`) are refined below rather
 * than asserted here.
 */
type DataQuery = { +[key: string]: mixed }

/**
 * Reads a query key as a string, returning '' when the key is absent or not a string.
 * @param {DataQuery} query - the parsed query object
 * @param {string} key - the key to read
 * @returns {string} the string value, or '' if absent/non-string
 */
function readQueryString(query: DataQuery, key: string): string {
  const value = query[key]
  return typeof value === 'string' ? value : ''
}

export async function openTestHTML() {
  //   await CommandBar.onAsyncThread()

  const note = Editor.note
  const paragraphs = note?.paragraphs ?? []

  let inCodeBlock = false
  let queryString = ''
  for (const paragraph of paragraphs) {
    console.log(paragraph.type)
    if (paragraph.type === 'code') {
      console.log('in code block')
      if (inCodeBlock) {
        queryString += `${paragraph.content  }\n`
      } else if (paragraph.content.startsWith('```javascript')) {
        console.log('found start of codeblock')
        inCodeBlock = true
      } else {
        console.log(`Huh!${  paragraph.content}`)
      }
    } else {
      if (inCodeBlock) {
        console.log('found end of codeblock')
      }
      inCodeBlock = false
    }
  }

  console.log(queryString)

  //   await CommandBar.onMainThread()
  if (!queryString) {
    await CommandBar.textPrompt('Errror', 'No code queryString found', 'OK')
    return
  }

  queryString = queryString.slice(0, -4)
  const parsed = json5.parse(queryString)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    await CommandBar.textPrompt('Error', 'Query code block did not parse to an object', 'OK')
    return
  }
  const query: DataQuery = parsed
  const title = readQueryString(query, '$title')
  const showAs = readQueryString(query, '$showAs')
  const select = readQueryString(query, '$select')

  let html = ''
  if (title) {
    html += `<h1>${title}</h1>`
  }
  if (showAs === 'List') {
    html += `<ul>`
    if (select === 'Files') {
      const files = (await DataStore.projectNotes) ?? []
      for (const file of files) {
        html += `<li><a href="noteplan://x-callback-url/openNote?filename=${encodeURIComponent(file.filename)}">${file.title ?? file.filename}</a></li>`
      }
    }
    html += `</ul>`
  } else {
    await CommandBar.textPrompt('Error', 'Can only render lists of files for now', 'OK')
    return
  }

  NotePlan.openURL(`shortcuts://x-callback-url/run-shortcut?name=ShowHTML&input=${  encodeURIComponent(`<html><body><pre>${html}</pre></body></html>`)}`)
}
