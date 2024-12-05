// @flow
import { showMessage } from '../../helpers/userInput'
import pluginJson from '../plugin.json'
import { checkAccessToken, escapeTwitterHandle, getParagraphTypeChar, removeInvalidChars, removeNewlines } from './NPReadwiseHelpers'
import { parseHighlightsAndWriteToNote } from './NPReadwiseNotes'
import { startReadwiseSyncLog, finishReadwiseSyncLog } from './NPReadwiseSyncLog'
import { log, logDebug, logError } from '@np/helpers/dev'

const LAST_SYNC_TIME = 'last_sync_time'

/**
 * Syncs new readwise highlights
 */
export async function readwiseSync(): Promise<void> {
  checkAccessToken()
  const response = await getReadwise(false)
  await handleReadwiseSync(response)
}

/**
 * Rebuilds all readwise highlights
 */
export async function readwiseRebuild(): Promise<void> {
  checkAccessToken()
  const response = await getReadwise(true)
  await handleReadwiseSync(response)
}

/**
 * Gets the daily review highlights from Readwise
 * @returns {string} - the highlights as a string
 */
export async function readwiseDailyReview(): Promise<string> {
  checkAccessToken()
  return await getReadwiseDailyReview()
}

async function handleReadwiseSync(response: any): Promise<void> {
  let downloadHighlightCount = 0,
    updatedSourceCount = 0
  await startReadwiseSyncLog()
  response.forEach((highlightSource) => {
    updatedSourceCount++
    downloadHighlightCount += highlightSource.highlights.length
    parseHighlightsAndWriteToNote(highlightSource)
  })
  log(pluginJson, `Downloaded ${downloadHighlightCount} highlights from Readwise. Updated ${updatedSourceCount} notes.`)
  await showMessage(`Downloaded ${downloadHighlightCount} highlights from Readwise. Updated ${updatedSourceCount} notes.`)
  await finishReadwiseSyncLog(downloadHighlightCount, updatedSourceCount)
}

/**
 * Gets the readwise data from the API
 * @param {boolean} force - if true, will ignore the last sync time and get all data
 * @returns {*} - the readwise data as a JSON object
 * @see https://readwise.io/api_deets
 */
async function getReadwise(force: boolean): Promise<any> {
  const accessToken = DataStore.settings.accessToken ?? ''
  let lastFetchTime = DataStore.loadData(LAST_SYNC_TIME, true) ?? ''
  if (DataStore.settings.forceSync === 'true' || force === true) {
    lastFetchTime = ''
  }
  log(pluginJson, `last fetch time is : ${lastFetchTime}`)
  logDebug(pluginJson, `base folder is : ${DataStore.settings.baseFolder}`)

  return await doReadWiseFetch(accessToken, lastFetchTime, 0, '')
}

/*
 * Recursively fetches readwise data
 * @param {string} accessToken - the readwise access token
 * @param {string} lastFetchTime - the last time the data was fetched
 * @param {int} downloadCount - the number of highlights downloaded
 * @param {string} nextPageCursor - the cursor for the next page of data
 * @returns {*} - the readwise data as a JSON object
 * @see https://readwise.io/api_deets
 */
async function doReadWiseFetch(accessToken: string, lastFetchTime: string, downloadCount: number, nextPageCursor: string): Promise<any> {
  try {
    const url = `https://readwise.io/api/v2/export/?updatedAfter=${lastFetchTime}&pageCursor=${nextPageCursor}`

    const options = {
      method: 'GET',
      headers: {
        Authorization: `token ${accessToken}`,
      },
    }
    const response = await fetch(url, options)
    DataStore.saveData(new Date().toISOString(), LAST_SYNC_TIME, true)

    const parsedJson = JSON.parse(response)
    const pageCursor = parsedJson.nextPageCursor
    logDebug(pluginJson, `page cursor is : ${pageCursor}`)

    let data: any = []
    const count = parsedJson.count + downloadCount
    if (pageCursor !== null && pageCursor !== '') {
      data = await doReadWiseFetch(accessToken, lastFetchTime, count, pageCursor)
    }
    const result = parsedJson.results.concat(data)
    // DataStore.saveData(JSON.stringify(result), 'readwise_data.json', true)
    return result
  } catch (error) {
    logError(pluginJson, error)
  }
}
/*
 * Gets the users Daily review from the readwise api
 * @returns {string} - the daily review highlights
 */
async function getReadwiseDailyReview(): Promise<string> {
  const accessToken = DataStore.settings.accessToken ?? ''
  let highlightString = ''
  try {
    const url = `https://readwise.io/api/v2/review/`

    const options = {
      method: 'GET',
      headers: {
        Authorization: `token ${accessToken}`,
      },
    }
    const response = await fetch(url, options)
    const highlights = JSON.parse(response).highlights

    await highlights.map((highlight) => {
      const formattedHighlight = `${removeNewlines(highlight.text)} [ [[${removeInvalidChars(highlight.title)}]], [[${escapeTwitterHandle(highlight.author)}]] ]`
      highlightString += `${getParagraphTypeChar()} ${formattedHighlight}\n`
    })
    if (highlightString.endsWith('\n')) {
      // remove the last newline
      highlightString = highlightString.substring(0, highlightString.length - 1)
    }
    logDebug(pluginJson, `Daily review highlights are\n\n ${highlightString}`)
  } catch (error) {
    logError(pluginJson, error)
  }
  return highlightString
}
