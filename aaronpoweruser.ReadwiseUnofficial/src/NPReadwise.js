// @flow
import { showMessage } from '../../helpers/userInput'
import pluginJson from '../plugin.json'
import { setFrontMatterVars } from '../../helpers/NPFrontMatter'
import { log, logDebug, logError, logWarn, clo, JSP } from '@helpers/dev'
import { getOrMakeNote } from '@helpers/note'

const READWISE_API_KEY_LENGTH = 50
const LAST_SYNÇ_TIME = 'last_sync_time'

// This is the main function that will be called by NotePlan
export async function readwiseSync(): Promise<void> {
  checkAccessToken()
  const response = await getReadwise(false)
  response.map(parseBookAndWriteToNote)
}

// This is the main function that will be called by NotePlan
export async function readwiseSyncForce(): Promise<void> {
  checkAccessToken()
  const response = await getReadwise(true)
  response.map(parseBookAndWriteToNote)
}

function checkAccessToken(): void {
  const accessToken = DataStore.settings.accessToken ?? ''
  logDebug(pluginJson, `access token is : ${accessToken}`)

  if (accessToken === '') {
    showMessage(pluginJson, 'No access token found. Please add your Readwise access token in the plugin settings.')
    return
  } else if (accessToken.length !== READWISE_API_KEY_LENGTH) {
    showMessage(pluginJson, 'Invalid access token. Please check your Readwise access token in the plugin settings.')
    return
  }
}

// Downloads readwise data
async function getReadwise(force: boolean): Promise<any> {
  const accessToken = DataStore.settings.accessToken ?? ''
  let lastFetchTime = DataStore.loadData(LAST_SYNÇ_TIME, true) ?? ''
  if (DataStore.settings.forceSync === 'true' || force === true) {
    lastFetchTime = ''
  }
  log(pluginJson, `last fetch time is : ${lastFetchTime}`)
  logDebug(pluginJson, `base folder is : ${DataStore.settings.baseFolder}`)

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

async function parseBookAndWriteToNote(source): Promise<void> {
  try {
    const outputNote: ?TNote = await getOrCreateReadwiseNote(source.title, source.category)
    const useFrontMatter = DataStore.settings.useFrontMatter === 'FrontMatter'
    if (outputNote) {
      if (new Date() - new Date(outputNote?.createdDate) < 2000) {
        if (!useFrontMatter) {
          outputNote?.addParagraphBelowHeadingTitle(createReadwiseMetadataHeading(source), 'text', 'Metadata', true, true)
        }
        outputNote?.addParagraphBelowHeadingTitle('', 'text', 'Highlights', true, true)
      }
      if (useFrontMatter) {
        setFrontMatterVars(outputNote, buildReadwiseFrontMatter(source))
      }
      source.highlights.map((highlight) => appendHighlightToNote(outputNote, highlight, source.source, source.asin))
    }
  } catch (error) {
    logError(pluginJson, error)
  }
}

function buildReadwiseFrontMatter(source): any {
  const frontMatter = {}
  frontMatter.author = `[[${source.author}]]`
  if (source.book_tags !== null) {
    frontMatter.tags = source.book_tags.map((tag) => `${formatTag(tag.name)}`).join(', ')
  }
  if (source.unique_url !== null) {
    frontMatter.url = source.unique_url
  }
  return frontMatter
}

function formatTag(tag: string): string {
  const prefix = DataStore.settings.tagPrefix ?? ''
  return `#${prefix}/${tag}`
}

function createReadwiseMetadataHeading(source): string {
  let metadata = `Author: [[${source.author}]]` + '\n'
  if (source.book_tags !== null) {
    metadata += `Tags: ${source.book_tags.map((tag) => `${formatTag(tag.name)}`).join(', ')}\n`
  }
  if (source.unique_url !== null) {
    metadata += `URL: ${source.unique_url}`
  }
  return metadata
}

async function getOrCreateReadwiseNote(title: string, category: string): Promise<?TNote> {
  const rootFolder = DataStore.settings.baseFolder ?? 'Readwise'
  let baseFolder = rootFolder
  let outputNote: ?TNote
  if (DataStore.settings.groupByType === true) {
    baseFolder = `${rootFolder}/${category}`
  }
  try {
    outputNote = await getOrMakeNote(title, baseFolder, '')
  } catch (error) {
    logError(pluginJson, error)
  }
  return outputNote
}

function appendHighlightToNote(note: TNote, highlight: any, source: string, asin: string): void {
  // remove "- " from the start of the highlight
  const contentWithoutDash = highlight.text.replace(/^- /, '')
  let formatedUrl = ''

  if (source === 'supplemental') {
    formatedUrl = ` [View highlight](${highlight.readwise_url})`
  } else if (asin !== null) {
    formatedUrl = ` [Location ${highlight.location}](https://readwise.io/to_kindle?action=open&asin=${asin}&location=${highlight.location})`
  } else if (highlight.url !== null) {
    formatedUrl = ` [View highlight](${highlight.url})`
  }
  note.appendParagraph(contentWithoutDash + formatedUrl, 'list')
}
