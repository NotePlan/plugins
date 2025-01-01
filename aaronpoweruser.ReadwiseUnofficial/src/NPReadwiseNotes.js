// @flow
import pluginJson from '../plugin.json'
import { setFrontMatterVars } from '../../helpers/NPFrontMatter'
import { findEndOfActivePartOfNote } from '../../helpers/paragraph'
import { buildReadwiseFrontMatter, buildReadwiseMetadataHeading, buildReadwiseNoteTitle, removeNewlines } from './NPReadwiseHelpers'
import { writeReadwiseSyncLogLine } from './NPReadwiseSyncLog'
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
    // Note: supplementals are not guaranteed to have user generated highlights
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
export async function parseHighlightsAndWriteToNote(highlightSource: any): Promise<any> {
  try {
    const noteTitle: string = buildReadwiseNoteTitle(highlightSource)
    const outputNote: ?TNote = await getOrCreateReadwiseNote(noteTitle, highlightSource.category)
    const useFrontMatter = DataStore.settings.useFrontMatter === 'FrontMatter'
    if (outputNote) {
      if (!useFrontMatter) {
        //TODO: Support updating metadata (tags)
        if (!outputNote?.content?.includes('## Metadata')) {
          outputNote?.addParagraphBelowHeadingTitle(buildReadwiseMetadataHeading(highlightSource), 'text', 'Metadata', true, true)
        }
      } else {
        setFrontMatterVars(outputNote, buildReadwiseFrontMatter(highlightSource))
      }
      if (!outputNote?.content?.includes('# Highlights')) {
        outputNote.insertHeading('Highlights', findEndOfActivePartOfNote(outputNote) + 1, 1)
      }
    }
    if (outputNote) {
      await highlightSource.highlights.map((highlight) => appendHighlightToNote(outputNote, highlight, highlightSource.source, highlightSource.asin))
      await writeReadwiseSyncLogLine(noteTitle, highlightSource.highlights.length)
    }
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
  let linkToHighlightOnWeb = ''
  let userNote = ''

  if (highlight.tags !== null && highlight.tags !== '') {
    for (const tag of highlight.tags) {
      if (tag.name !== null && tag.name !== '' && tag.name.toLowerCase().startsWith('h') && tag.name.trim().length === 2) {
        const headingLevel = parseInt(tag.name.substring(1)) + 1
        if (headingLevel <= 8) {
          outputNote.insertHeading(removeNewlines(highlight.text), findEndOfActivePartOfNote(outputNote) + 1, headingLevel)
        }
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
      linkToHighlightOnWeb = ` [Location ${highlight.location}](https://read.amazon.com/?asin=${asin})`
    } else if (highlight.url !== null) {
      linkToHighlightOnWeb = ` [View highlight](${highlight.url})`
    }
  }
  const paragraphType = DataStore.settings.paragraphType ?? 'quote'
  outputNote.appendParagraph(removeNewlines(highlight.text) + userNote + linkToHighlightOnWeb, paragraphType)
}
