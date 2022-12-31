// @flow
import { showMessage } from '../../helpers/userInput'
import pluginJson from '../plugin.json'
import { log, logDebug, logError, logWarn, clo, JSP } from '@helpers/dev'
import { getOrMakeNote } from '@helpers/note'

const READWISE_API_KEY_LENGTH = 50
const LAST_SYNÇ_TIME = 'last_sync_time'

// This is the main function that will be called by NotePlan
export async function readwiseSync(): Promise<void> {
  const accessToken = DataStore.settings.accessToken ?? ''
  logDebug(pluginJson, `access token is : ${accessToken}`)

  if (accessToken === '') {
    showMessage(pluginJson, 'No access token found. Please add your Readwise access token in the plugin settings.')
    return
  } else if (accessToken.length !== READWISE_API_KEY_LENGTH) {
    showMessage(pluginJson, 'Invalid access token. Please check your Readwise access token in the plugin settings.')
    return
  }

  const response = await getReadwise()
  response.map(parseBookAndWriteToNote)
}

// Downloads readwise data
async function getReadwise(): Promise<any> {
  const accessToken = DataStore.settings.accessToken ?? ''
  let lastFetchTime = DataStore.loadData(LAST_SYNÇ_TIME, true) ?? ''
  if (DataStore.settings.forceSync === 'true') {
    lastFetchTime = ''
  }
  log(pluginJson, `last fetch time is : ${lastFetchTime}`)

  try {
    const url = `https://readwise.io/api/v2/export/?updatedAfter=${lastFetchTime}`

    const options = {
      method: 'GET',
      headers: {
        Authorization: `token ${accessToken}`,
      },
    }
    const response = await fetch(url, options)
    DataStore.saveData(new Date().toISOString(), LAST_SYNÇ_TIME, true)

    const Json = JSON.parse(response)
    log(pluginJson, `Downloaded : ${Json.count} highlights`)
    
    return Json.results
  } catch (error) {
    logError(pluginJson, error)
  }
}

async function parseBookAndWriteToNote(source) {
  try {
    const title = source.readable_title
    const author = source.author
    const category = source.category
    const highlights = source.highlights
    let metadata = `author: [[${author}]]` + '\n' // + `Category: [[${category}]]` + '\n'
    if (source.book_tags !== null) {
      metadata += `Document tags: ${source.book_tags.map((tag) => `#${tag.name} `).join(', ')}\n`
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

    // Find a better way to check if the note is new
    if (new Date() - new Date(outputNote?.createdDate) < 1000) {
      outputNote.addParagraphBelowHeadingTitle(metadata, 'text', 'Metadata', true, true)
    }

    highlights.map((highlight) => appendHighlightToNote(outputNote, highlight, source.asin))
  } catch (error) {
    logError(pluginJson, error)
  }
}

function appendHighlightToNote(note, highlight, asin = '') {
  const content = highlight.text
  let formatedUrl = ''
  if (highlight.url !== null) {
    formatedUrl = ` [View highlight](${highlight.url})`
  } else if (asin !== '') {
    formatedUrl = ` [Location ${highlight.location}](https://readwise.io/to_kindle?action=open&asin=${asin}&location=${highlight.location})`
  }
  note.appendParagraph(content + formatedUrl, 'list')
}
