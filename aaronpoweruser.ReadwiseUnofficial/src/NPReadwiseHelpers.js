// @flow
import { showMessage } from '../../helpers/userInput'
import pluginJson from '../plugin.json'
import { logDebug } from '@helpers/dev'

const READWISE_API_KEY_LENGTH = 50

/**
 * Checks if the readwise access token is valid
 */
export async function checkAccessToken(): void {
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
    return source.readable_title.replace(/\/*$/, '').replace(/^(.+)\/[^\/]*?$/, '$1')
  } else if (source.title !== '') {
    return source.title.replace(/\/*$/, '').replace(/^(.+)\/[^\/]*?$/, '$1')
  } else {
    return source.author.replace(/\/*$/, '').replace(/^(.+)\/[^\/]*?$/, '$1')
  }
}

/**
 * Parse readwise data and generate front matter
 * @param {*} source - the readwise data as a JSON object
 * @returns
 */
export function buildReadwiseFrontMatter(source: any): any {
  const frontMatter = {}
  frontMatter.author = `[[${escapeTwitterHandle(source.author)}]]`
  if (source.readable_title.toLowerCase().trim() !== source.title.toLowerCase().trim()) {
    frontMatter.long_title = source.title
  }
  if (source.book_tags !== null && source.book_tags.length > 0) {
    frontMatter.tags = source.book_tags.map((tag) => `${formatTag(tag.name)}`).join(', ')
  }
  if (source.unique_url !== null) {
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
  let metadata = `author: [[${escapeTwitterHandle(source.author)}]]` + '\n'
  if (source.book_tags !== null && source.book_tags.length > 0) {
    metadata += `tags: ${source.book_tags.map((tag) => `${formatTag(tag.name)}`).join(', ')}\n`
  }
  if (source.unique_url !== null) {
    metadata += `url: ${source.unique_url}`
  }
  if (source.readable_title.toLowerCase().trim() !== source.title.toLowerCase().trim()) {
    metadata += `long_title: ${source.title}`
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
  if (prefix === '') {
    return `#${tag}`
  } else {
    return `#${prefix}/${tag}`
  }
}

/*
 * removes all empty lines in a note
 * @param {Tnote} note - the note to remove empty lines from
 */
export function removeEmptyLines(note: ?Tnote): void {
  note.content = note?.content?.replace(/^\s*\n/gm, '')
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
