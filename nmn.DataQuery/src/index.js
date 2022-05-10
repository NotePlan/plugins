// @flow

import json5 from 'json5'

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
        queryString += paragraph.content + '\n'
      } else if (paragraph.content.startsWith('```javascript')) {
        console.log('found start of codeblock')
        inCodeBlock = true
      } else {
        console.log('Huh!' + paragraph.content)
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
  const query: $FlowFixMe = json5.parse(queryString)

  let html = ''
  if (query.$title) {
    html += `<h1>${query.$title}</h1>`
  }
  if (query.$showAs === 'List') {
    html += `<ul>`
    if (query.$select === 'Files') {
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

  NotePlan.openURL('shortcuts://x-callback-url/run-shortcut?name=ShowHTML&input=' + encodeURIComponent(`<html><body><pre>${html}</pre></body></html>`))
}
