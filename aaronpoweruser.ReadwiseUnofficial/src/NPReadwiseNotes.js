// @flow
import pluginJson from '../plugin.json'
import { setFrontMatterVars } from '../../helpers/NPFrontMatter'
import { findEndOfActivePartOfNote } from '../../helpers/paragraph'
import { buildReadwiseFrontMatter, buildReadwiseMetadataHeading, buildReadwiseNoteTitle, removeEmptyLines } from './NPReadwiseHelpers'
import { writeReadwiseSyncLogLine } from './NPReadwisesync'
import { logDebug, logError } from '@helpers/dev'
import { getOrMakeNote } from '@helpers/note'

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
    // Note: supplmentals are not guaranteed to have user generated highlights
    if (DataStore.settings.ignoreSupplementals === true && category === 'supplementals') {
      baseFolder = `${rootFolder}/books`
    } else {
      baseFolder = `${rootFolder}/${category}`
    }
  }
  try {
    outputNote = await getOrMakeNote(title, baseFolder, '')
  } catch (error) {
    logError(pluginJson, error)
  }
  return outputNote
}

/**
 * Parses the readwise data and writes it to a note
 * @param {*} source - the readwise data as a JSON object
 */
export async function parseHighlightsAndWriteToNote(highightSource: any): Promise<any> {
  try {
    const noteTtile: string = buildReadwiseNoteTitle(highightSource)
    const outputNote: ?TNote = await getOrCreateReadwiseNote(noteTtile, highightSource.category)
    const useFrontMatter = DataStore.settings.useFrontMatter === 'FrontMatter'
    if (outputNote) {
      if (!useFrontMatter) {
        //TODO: Support updating metadata (tags)
        if (!outputNote?.content?.includes('## Metadata')) {
          outputNote?.addParagraphBelowHeadingTitle(buildReadwiseMetadataHeading(highightSource), 'text', 'Metadata', true, true)
        }
      } else {
        setFrontMatterVars(outputNote, buildReadwiseFrontMatter(highightSource))
      }
      if (!outputNote?.content?.includes('# Highlights')) {
        outputNote.insertHeading('Highlights', findEndOfActivePartOfNote(outputNote) + 1, 1)
      }
    }
    await writeReadwiseSyncLogLine(noteTtile, highightSource.highlights.length)
    await highightSource.highlights.map((highlight) => appendHighlightToNote(outputNote, highlight, highightSource.source, highightSource.asin))
    removeEmptyLines(outputNote)
  } catch (error) {
    logError(pluginJson, error)
  }
}

/**
 * Appends the highlight with a link to the note
 * @param {TNote} outputNote - the note to append to
 * @param {*} highlight - the readwise highlight as a JSON object
 * @param {string} category - the source of the highlight
 * @param {string} asin - the asin of the book
 */
function appendHighlightToNote(outputNote: TNote, highlight: any, category: string, asin: string): void {
  const filteredContent = highlight.text.replace(/\n/g, ' ')
  let linkToHighlightOnWeb = ''
  let userNote = ''

  if (highlight.tags !== null && highlight.tags !== '') {
    for (const tag of highlight.tags) {
      if (tag.name !== null && tag.name !== '' && tag.name.startsWith('h') && tag.name.length === 2) {
        const headingLevel = parseInt(tag.name.substring(1)) + 1
        outputNote.insertHeading(highlight.text, findEndOfActivePartOfNote(outputNote) + 1, headingLevel)
      }
    }
  }

  if (highlight.note !== null && highlight.note !== '') {
    userNote = `(${highlight.note})`
  }

  if (DataStore.settings.showLinkToHighlight === true) {
    if (category === 'supplemental') {
      linkToHighlightOnWeb = ` [View highlight](${highlight.readwise_url})`
    } else if (asin !== null && highlight.location !== null) {
      linkToHighlightOnWeb = ` [Location ${highlight.location}](https://readwise.io/to_kindle?action=open&asin=${asin}&location=${highlight.location})`
    } else if (highlight.url !== null) {
      linkToHighlightOnWeb = ` [View highlight](${highlight.url})`
    }
  }
  outputNote.appendParagraph(filteredContent + userNote + linkToHighlightOnWeb, 'quote')
}
