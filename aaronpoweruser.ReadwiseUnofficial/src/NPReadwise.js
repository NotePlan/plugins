// @flow
import { showMessage } from '../../helpers/userInput'
import pluginJson from '../plugin.json'
import { setFrontMatterVars } from '../../helpers/NPFrontMatter'
import { log, logDebug, logError, logWarn, clo, JSP } from '@helpers/dev'
import { getOrMakeNote } from '@helpers/note'

const READWISE_API_KEY_LENGTH = 50
const LAST_SYNÇ_TIME = 'last_sync_time'
let downloadHiglightCount: number = 0
let updatedSourceCount: number = 0

// This is the main function that will be called by NotePlan
export async function readwiseSync(): Promise<void> {
  checkAccessToken()
  const response = await getReadwise(false)
  await handleReadwiseSync(response)
}

// This is the main function that will be called by NotePlan
export async function readwiseRebuild(): Promise<void> {
  checkAccessToken()
  const response = await getReadwise(true)
  await handleReadwiseSync(response)
}

async function handleReadwiseSync(response: any): Promise<void> {
  await response.map(parseBookAndWriteToNote)
  log(pluginJson, `Downloaded ${downloadHiglightCount} highlights from Readwise. Updated ${updatedSourceCount} notes.`)
  await showMessage(`Downloaded ${downloadHiglightCount} highlights from Readwise. Updated ${updatedSourceCount} notes.`)
}

/**
 * Checks if the readwise access token is valid
 */
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

/**
 * Gets the readwise data from the API
 * @param {boolean} force - if true, will ignore the last sync time and get all data
 * @returns {*} - the readwise data as a JSON object
 * @see https://readwise.io/api_deets
 */
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
    downloadHiglightCount = Json.count
    logDebug(pluginJson, `Downloaded : ${downloadHiglightCount} highlights`)
    return Json.results
  } catch (error) {
    logError(pluginJson, error)
  }
}

/**
 * Parses the readwise data and writes it to a note
 * @param {*} source - the readwise data as a JSON object
 */
async function parseBookAndWriteToNote(source: any): Promise<void> {
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
      removeEmptyLines(outputNote)
    }
  } catch (error) {
    logError(pluginJson, error)
  }
}

// removes all empty lines in a note
function removeEmptyLines(note: ?Tnote): void {
  note.content = note?.content?.replace(/^\s*\n/gm, '')
}

/**
 * Parse readwise data and generate front matter
 * @param {*} source - the readwise data as a JSON object
 * @returns
 */
function buildReadwiseFrontMatter(source: any): any {
  const frontMatter = {}
  frontMatter.author = `[[${source.author}]]`
  if (source.book_tags !== null && source.book_tags.length > 0) {
    frontMatter.tags = source.book_tags.map((tag) => `${formatTag(tag.name)}`).join(', ')
  }
  if (source.unique_url !== null) {
    frontMatter.url = source.unique_url
  }
  return frontMatter
}

/**
 * Formats the note tag using the prefix from plugin settings
 * @param {string} tag - the tag to format
 * @returns {string} - the formatted tag
 */
function formatTag(tag: string): string {
  const prefix = DataStore.settings.tagPrefix ?? ''
  return `#${prefix}/${tag}`
}

/**
 * Creates the metadata heading for the note
 * @param {*} source - the readwise data as a JSON object
 * @returns {string} - the formatted heading
 */
function createReadwiseMetadataHeading(source: any): string {
  let metadata = `Author: [[${source.author}]]` + '\n'
  if (source.book_tags !== null && source.book_tags.length > 0) {
    metadata += `Tags: ${source.book_tags.map((tag) => `${formatTag(tag.name)}`).join(', ')}\n`
  }
  if (source.unique_url !== null) {
    metadata += `URL: ${source.unique_url}`
  }
  return metadata
}

/**
 * Gets or creates the note for the readwise data
 * @param {string} title - the title of the note
 * @param {string} category - the category of the note
 * @returns {TNote} - the note
 */
async function getOrCreateReadwiseNote(title: string, category: string): Promise<?TNote> {
  const rootFolder = DataStore.settings.baseFolder ?? 'Readwise'
  let baseFolder = rootFolder
  let outputNote: ?TNote
  if (DataStore.settings.groupByType === true) {
    baseFolder = `${rootFolder}/${category}`
  }
  try {
    outputNote = await getOrMakeNote(title, baseFolder, '')
    updatedSourceCount++
  } catch (error) {
    logError(pluginJson, error)
  }
  return outputNote
}

/**
 * Appends the highlight with a link to the note
 * @param {TNote} note - the note to append to
 * @param {*} highlight - the readwise highlight as a JSON object
 * @param {string} category - the source of the highlight
 * @param {string} asin - the asin of the book
 */
function appendHighlightToNote(note: TNote, highlight: any, category: string, asin: string): void {
  // remove "• " from the start of the highlight
  const filteredContent = highlight.text.replace(/[•\t.+]/g, '')
  let linkToHighlightOnWeb = ''

  if (DataStore.settings.showLinkToHighlight === true) {
    if (category === 'supplemental') {
      linkToHighlightOnWeb = ` [View highlight](${highlight.readwise_url})`
    } else if (asin !== null) {
      linkToHighlightOnWeb = ` [Location ${highlight.location}](https://readwise.io/to_kindle?action=open&asin=${asin}&location=${highlight.location})`
    } else if (highlight.url !== null) {
      linkToHighlightOnWeb = ` [View highlight](${highlight.url})`
    }
  }
  note.appendParagraph(filteredContent + linkToHighlightOnWeb, 'list')
}
