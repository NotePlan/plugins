// @flow
import { showMessage } from '../../helpers/userInput'
import pluginJson from '../plugin.json'
import { checkAccessToken, escapeTwitterHandle } from './NPReadwiseHelpers'
import { parseHighlightsAndWriteToNote } from './NPReadwiseNotes'
import { startReadwiseSyncLog, finishReadwiseSyncLog } from './NPReadwiseSync'
import { log, logDebug, logError } from '@helpers/dev'

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
  let downloadHiglightCount = 0,
    updatedSourceCount = 0
  await startReadwiseSyncLog()
  response.forEach((highightSource) => {
    updatedSourceCount++
    downloadHiglightCount += highightSource.highlights.length
    parseHighlightsAndWriteToNote(highightSource)
  })
  log(pluginJson, `Downloaded ${downloadHiglightCount} highlights from Readwise. Updated ${updatedSourceCount} notes.`)
  await showMessage(`Downloaded ${downloadHiglightCount} highlights from Readwise. Updated ${updatedSourceCount} notes.`)
  await finishReadwiseSyncLog(downloadHiglightCount, updatedSourceCount)
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
    // DataStore.saveData(JSON.stringify(Json), 'readwise_data.json', true)
    const pageCursor = parsedJson.nextPageCursor
    logDebug(pluginJson, `page cursor is : ${pageCursor}`)

    let data: any = []
    const count = parsedJson.count + downloadCount
    if (pageCursor !== null && pageCursor !== '') {
      data = await doReadWiseFetch(accessToken, lastFetchTime, count, pageCursor)
    }
    return parsedJson.results.concat(data)
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
      const formattedHighlight = `${highlight.text.replace(/\n/g, ' ')} [ [[${highlight.title}]], [[${escapeTwitterHandle(highlight.author)}]] ]`
      highlightString += `> ${formattedHighlight}\n`
    })
    if (highlightString.length > 1) { // remove the last newline
      highlightString = highlightString.substring(0, highlightString.length - 1)
    }
    logDebug(pluginJson, `daily review highlights are \n\n ${highlightString}`)
    return highlightString
  } catch (error) {
    logError(pluginJson, error)
  }
}
