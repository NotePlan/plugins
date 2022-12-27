// @flow
import { insertContentUnderHeading } from "../../helpers/NPParagraph"
import pluginJson from '../plugin.json'
import { log, logDebug, logError, logWarn, clo, JSP } from '@helpers/dev'
import { getOrMakeNote } from '@helpers/note'

// This is the main function that will be called by NotePlan
export async function readwiseSync(): Promise<void> {
  const settings = DataStore.settings
  const accessToken = settings.accessToken ?? ''
  logDebug(pluginJson, `access token is : ${accessToken}`)

  const response = await getReadwise()
  response.map(parseBook)
}

// Downloads readwise data
async function getReadwise(): Promise<any> {
  const accessToken = DataStore.settings.accessToken ?? ''
  // TODO: Uncomment before merge
  // const lastFetchTime = DataStore.loadData('last_sync_time', true) ?? ''
  const lastFetchTime = ''
  log(pluginJson, `last fetch time is : ${lastFetchTime}`)

  try {
    const url = `https://readwise.io/api/v2/export/?updatedAfter=${lastFetchTime}`

    const options = {
      method: 'GET',
      headers: {
        'Authorization': `token ${ accessToken}`,
      },
    }
    const response = await fetch(url, options)
    DataStore.saveData(new Date().toISOString(), "last_sync_time", true)
 
    return JSON.parse(response).results
  } catch (error) {
    logError(pluginJson, error)
  }
}

async function parseBook(source) {
  const title = source.readable_title
  const author = source.author
  const category = source.category
  const highlights = source.highlights
  let metadata = `author: [[${author}]]` + '\n' + `Category: [[${category}]]` + '\n'
  if (source.book_tags !== null) {
     metadata += `Document tags: ${source.book_tags.map(tag => `#${tag.name} `).join(', ')}\n`
  }
  if (source.unique_url !== null) {
    metadata += `URL: ${source.unique_url}`
  }
  const rootFolder = DataStore.settings.baseFolder ?? 'Readwise'
  let baseFolder = rootFolder
  if (DataStore.settings.groupByType === 'true') {
    baseFolder = `${rootFolder}/${category}`
  }
  log(pluginJson, `base folder is : ${baseFolder}`)
  const outputNote = await getOrMakeNote(title, baseFolder, '')
  // TODO: This is adding empty newlines to the note need to fix.
  await insertContentUnderHeading(outputNote, 'Highlights', '', 2)
  // Probably shouldn't depend on this sorting and order by hand
  await insertContentUnderHeading(outputNote, 'Metadata', metadata, 2)
  highlights.map(highlight => appendToNote(highlight, outputNote))
}

function appendToNote(highlight, note) {
  const content = highlight.text
  const formatedUrl = ` [View highlight](${highlight.url})`
  note.appendParagraph(content + formatedUrl, 'list')
}
