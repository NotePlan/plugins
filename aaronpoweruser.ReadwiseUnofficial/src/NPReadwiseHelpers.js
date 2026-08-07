// @flow
import { showMessage } from '../../helpers/userInput'
import pluginJson from '../plugin.json'
import { logDebug } from '@helpers/dev'

const READWISE_API_KEY_LENGTH = 50

/**
 * Checks if the readwise access token is valid
 */
export async function checkAccessToken(): Promise<void> {
  const accessToken = DataStore.settings.accessToken ?? ''
  logDebug(pluginJson, `access token is : ${accessToken}`)

  if (accessToken === '') {
    await showMessage('No access token found. Please add your Readwise access token in the plugin settings.')
  } else if (accessToken.length !== READWISE_API_KEY_LENGTH) {
    await showMessage('Invalid access token. Please check your Readwise access token in the plugin settings.')
  }
}

/**
 * @param {*} source Readwise data as a JSON object
 * @returns Note title
 */
export function buildReadwiseNoteTitle(source: any): string {
  if (source.readable_title !== '') {
    return removeInvalidChars(source.readable_title)
  } else if (source.title !== '') {
    return removeInvalidChars(source.title)
  } else {
    return removeInvalidChars(source.author)
  }
}

/**
 * Sanitize the string by removing invalid characters
 * @param {string} string - the string to sanitize
 * @returns {string} - the sanitized string
 */
export function removeInvalidChars(string: string): string {
  return removeNewlines(
    string
      .replace(/^"/, '') // remove leading double quote
      .trim(),
  )
}

/**
 * Parse readwise data and generate front matter
 * @param {*} source - the readwise data as a JSON object
 * @returns
 */
export function buildReadwiseFrontMatter(source: any): any {
  const frontMatter = {}
  // $FlowIgnore[prop-missing] - intentionally setting properties dynamically as frontMatter keys are dynamic
  frontMatter.author = `[[${escapeTwitterHandle(source.author)}]]`
  if (source.readable_title.toLowerCase().trim() !== source.title.toLowerCase().trim()) {
    // $FlowIgnore[prop-missing] - intentionally setting properties dynamically as frontMatter keys are dynamic
    frontMatter.long_title = removeInvalidChars(source.title)
  }
  if (source.book_tags !== null && source.book_tags.length > 0) {
    // $FlowIgnore[prop-missing] - intentionally setting properties dynamically as frontMatter keys are dynamic
    frontMatter.tags = source.book_tags.map((tag) => `${formatTag(tag.name)}`).join(', ')
  }
  if (source.unique_url !== null) {
    // $FlowIgnore[prop-missing] - we are intentionally setting properties dynamically
    frontMatter.url = source.unique_url
  }
  return frontMatter
}

/**
 * Creates the metadata heading for the note
 * @param {*} source - the readwise data as a JSON object
 * @returns {string} - the formatted heading
 */
export function buildReadwiseMetadataHeading(source: any): string {
  let metadata = `author: [[${escapeTwitterHandle(source.author)}]]\n`
  if (source.book_tags !== null && source.book_tags.length > 0) {
    metadata += `tags: ${source.book_tags.map((tag) => `${formatTag(tag.name)}`).join(', ')}\n`
  }
  if (source.unique_url !== null) {
    metadata += `url: ${source.unique_url}`
  }
  if (source.readable_title.toLowerCase().trim() !== source.title.toLowerCase().trim()) {
    metadata += `long_title: ${removeInvalidChars(source.title)}`
  }
  return metadata
}

/**
 * Formats the note tag using the prefix from plugin settings
 * @param {string} tag - the tag to format
 * @returns {string} - the formatted tag
 */
function formatTag(tag: string): string {
  const prefix = DataStore.settings.tagPrefix ?? ''
  return `#${prefix ? `${prefix}/` : ''}${tag}`
    .replace(/ /g, '_')
    .replace(/&/g, 'and')}

/**
 * Remove all newline characters from a string
 * @param {string} text - the text to remove newline characters from
 * @returns {string} - the text with newline characters removed
 */
export function removeNewlines(text: string): string {
  return text.replaceAll(/\n/g, ' ')
}

/**
 * Escapes Twitter handles by adding 'Twitter/' before the '@' symbol
 * to avoid creating a mention in Noteplan
 * and removing 'on Twitter' from the handle
 * @param {string} handle - the Twitter handle to escape
 * @returns {string} - the escaped Twitter handle
 */
export function escapeTwitterHandle(handle: string): string {
  if (handle.startsWith('@') && handle.endsWith(' on Twitter')) {
    return handle.replace('@', 'Twitter/@').replace(' on Twitter', '')
  }
  return handle
}

/**
 * Gets the date in iso format with the local timezone
 * @returns {string} - the local date
 */
export function getLocalDate(): string {
  const local_dateTime_in_mills = new Date().setHours(new Date().getHours() - new Date().getTimezoneOffset() / 60)
  const local_dateTime = new Date(local_dateTime_in_mills).toISOString()
  return local_dateTime.split('T')[0]
}

/**
 * Get the paragraph type character based on settings
 * @returns {string} - the paragraph type character
 */
export function getParagraphTypeChar(): string {
  const paragraphType = DataStore.settings.paragraphType ?? 'quote'
  let paragraphChar = '>'
  if (paragraphType === 'quote') {
    paragraphChar = '>'
  } else if (paragraphType === 'list') {
    paragraphChar = '-'
  }
  return paragraphChar
}
