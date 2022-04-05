// @flow
/*
TO DO:
- For fuse refactor writeIndex to get the index and write it
- For FUSE make a version of getMetaData() to use instead of the map to remove hashtags and mentions to skip
- for FUSE index, skip the html files
- for FUSE figure out how to do dates (right now it's ISO)
- Move functions to support directory with tests
- Add config fields/defaults
- Add back in showProgress calls but they trap errors so don't turn on until you know it all works

*/
const OUTPUT_SEARCH_RESULTS = true

import * as dh from './support/data-helpers'
import * as fh from './support/fuse-helpers'
// import { testDB } from './support/database' //didn't seem to work

import { log, logError, clo, timer } from '../../helpers/dev'
import pluginJson from '../plugin.json'

type NoteIndex = {
  hashtags: { [string]: mixed },
  mentions: { [string]: mixed },
}

type NoteIndexType = {
  filename: string,
  title: string,
  content: string,
}

const INDEX_FILENAME = 'fuse-index.json'

const SEARCH_OPTIONS = {
  keys: ['type', 'title', 'hashtags', 'mentions', 'content', 'filename'],
  includeScore: true,
  includeMatches: true,
  useExtendedSearch: true,
  shouldSort: true,
  findAllMatches: true,
}

export function getNotesForIndex(config) {
  const consolidatedNotes = [...DataStore.projectNotes, ...DataStore.calendarNotes]
  log(pluginJson, `getNotesForIndex: ${consolidatedNotes.length} notes before eliminating foldersToIgnore `)
  // consolidatedNotes.prototype.changedDateISO = () => this.changedDate.toISOString()
  return consolidatedNotes
    .filter((note) => {
      let include = true
      config.foldersToIgnore.forEach((skipFolder) => {
        if (note.filename.includes(`${skipFolder}/`)) {
          include = false
        }
      })
      return include
    })
    .map((n) => ({
      type: n.type,
      title: n.title,
      hashtags: n.hashtags,
      mentions: n.mentions,
      content: n.content,
      filename: n.filename,
    }))
  // Note: had to do the map above to get the actual NP objects to be visible in the console
  // May not be necessary in production
  // return includedNotes
}

/**
 * Create searchable (Fuse) index and write it to disk
 * @returns {NoteIndexType | null}
 */
export async function writeIndex(index): null | FuseIndex {
  try {
    // CommandBar.showLoading(true, 'Building search index')
    // await CommandBar.onAsyncThread()
    // const consolidatedNotes = [...DataStore.projectNotes, ...DataStore.calendarNotes].map((note) => ({ ...note, changedDate: note.changedDate.toISOString() }))
    let timeStart = new Date()
    log(pluginJson, `writeIndex: index is of type: "${typeof index}" ; ${JSON.stringify(index).length} char length of index`)
    DataStore.saveJSON(JSON.stringify(index), INDEX_FILENAME)
    let elapsed = timer(timeStart)
    log(pluginJson, `createIndex: ${includedNotes.length} notes written to disk as ${INDEX_FILENAME} total elapsed: ${elapsed}`)

    // await CommandBar.onMainThread()
    // CommandBar.showLoading(false)
    return index
  } catch (error) {
    clo(error, 'writeIndex: caught error')
    return null
  }
}

/**
 * Create Fuse Index of current notes
 * @param {Object} notesToInclude (optional) if you have the cleansed note list, pass it in, otherwise it will be created
 * @returns {FuseIndex}
 */
export function createIndex(notesToInclude = []) {
  let timeStart = new Date()
  const config = getDefaultConfig()
  const includedNotes = notesToInclude.length ? notesToInclude : getNotesForIndex(config)
  const index = fh.buildIndex(includedNotes, SEARCH_OPTIONS)
  let elapsed = timer(timeStart)
  log(pluginJson, `createIndex: ${includedNotes.length} notes indexed in: ${elapsed} `)
  return index
}

export async function search(pattern = `'"review alpha"`, loadIndexFromDisk: boolean = false) {
  let index
  let timeStart = new Date()
  if (loadIndexFromDisk) {
    try {
      index = DataStore.loadJSON(INDEX_FILENAME)
    } catch (error) {
      clo(error, 'search: caught error')
    }
  }
  // test search
  //FIXME: I need the cleansed notes here!!!!!
  const config = getDefaultConfig()
  // const consolidatedNotes = [...DataStore.projectNotes, ...DataStore.calendarNotes].map((note) => ({ ...note, changedDate: note.changedDate.toISOString() }))
  const includedNotes = getNotesForIndex(config)
  if (!index) index = createIndex(includedNotes)
  const results = fh.searchIndex(includedNotes, pattern, { options: SEARCH_OPTIONS, index })
  log(pluginJson, `search for ${pattern} took: ${timer(timeStart)} including load/index; returned ${results.length} results`)
  if (OUTPUT_SEARCH_RESULTS) {
    // for debugging
    clo(results[0] || '', `search: results:${results.length} results[0] example full`)
    results.forEach((item, i) => {
      clo(item.item, `search: result(${i}) matches:${item.matches.length} score:${item.score}`)
    })
  }
}

export async function buildIndex(): Promise<void> {
  try {
    const timeStart = new Date()
    const config = getDefaultConfig()

    let noteIndex = getInitialIndex()

    const projectNotes = getNotes(false)
    const calendarNotes = getNotes(true)
    const notes = [...projectNotes, ...calendarNotes]
    clo(projectNotes[0], 'projectNotes[0]')
    clo(calendarNotes[0], 'calendarNotes[0]')

    log(`Notes.length = ${notes.length}`)
    noteIndex = buildIndexFromNotes(notes, noteIndex, config)
    clo(noteIndex, 'noteIndex')
    log(pluginJson, `^^^^ buildIndex: \nnoteIndex.hashtags (${Object.keys(noteIndex.hashtags).length}):\n${metaListKeys(noteIndex.hashtags)}`)
    log(pluginJson, `^^^^ buildIndex: \nnoteIndex.mentions (${Object.keys(noteIndex.mentions).length}):\n${metaListKeys(noteIndex.mentions)}`)

    Editor.insertTextAtCursor(`Elapsed time: ${timer(timeStart)}`)
  } catch (error) {
    clo(error, 'buildIndex: caught error')
  }
}

function getInitialIndex(): NoteIndex {
  return { hashtags: {}, mentions: {} }
}

function getDefaultConfig(): { [string]: mixed } {
  return {
    foldersToIgnore: ['_resources', '_evernote_attachments'],
    ignoreHTMLfiles: true,
    skipDoneMentions: true,
    mentionsToSkip: ['@sleep('], //FIXME: add to config and skipping,
    hashtagsToSkip: ['#🕑'], //FIXME: add to config and skipping
  }
}

/**
 * Search an array to compare a strinig to an array of strings using regex
 * NOTE: the array items are the regexes (not the needle)
 * @param {*} needle - the single value to compare
 * @param {*} haystack - the array of string/regexes to compare against
 * @returns
 */
export function existsInArray(needle: string, haystackArrOfRegexes: Array<string>): boolean {
  const found = haystackArrOfRegexes.filter((elem) => {
    const expr = new RegExp(elem, 'gi')
    expr.test(needle)
  })
  return found.length > 0
}

// Temp for debugging
function metaListKeys(inArray) {
  const outArray = []
  Object.keys(inArray).forEach((key) => {
    outArray.push(`${key} (${inArray[key].length})`)
  })
  return outArray.sort().join('\n')
}

/**
 * Given one note, adds to the index for mType (e.g. hashtags or mentions)
 * @param {*} note
 * @param {*} mType
 * @param {*} noteIndex
 * @returns
 */
function getMetaData(note: TNote, mType: string, noteIndex: NoteIndex, config: { [string]: mixed }): NoteMetaData {
  let index = noteIndex
  let skip = false
  if (/<html>|<!DOCTYPE/i.test(note.title || '') && config.ignoreHTMLfiles) skip = true
  if (note && mType && note[mType]?.length && !skip) {
    note[mType].forEach((item) => {
      if (/@done(.*)/i.test(item) && config.skipDoneMentions) skip = true
      if (mType === 'hashtags' && existsInArray(item, config.hashtagsToSkip)) skip = true
      if (mType === 'mentions' && existsInArray(item, config.mentionsToSkip)) skip = true
      if (item !== '' && !skip) {
        // log(pluginJson, `${mType}:${item}`)
        // clo(index, `getMetaData: index=`)
        if (!index[mType][item]) {
          index[mType][item] = []
        }
        // log(pluginJson, `getMetaData: ${index[mType][item]}`)
        index[mType][item].push({
          filename: note.filename,
          title: note.title,
          item: item,
          type: note.type,
          changed: note.changedDate || note.createdDate,
        })
        // if (item == '') clo(note[mType], `note[mType][${mType}] ${note.filename}`)
      }
    })
  }
  return index
}

/**
 * Given an array of notes, populates the index with the details of each note
 * @param {*} notes
 * @param {*} noteIndex
 * @returns
 */
function buildIndexFromNotes(notes: Array<TNote>, noteIndex: NoteIndex, config: { [string]: mixed }): NoteIndex {
  // log(pluginJson, `getNoteDetails()`)
  // clo(noteIndex, 'getNoteDetails: noteIndex=')
  let index = noteIndex
  notes.forEach((note) => {
    index = getMetaData(note, 'hashtags', index, config)
    index = getMetaData(note, 'mentions', index, config)
  })
  return index
}

function getNotes(isCalendar?: boolean = false): $ReadOnlyArray<TNote> {
  return isCalendar ? DataStore.calendarNotes : DataStore.projectNotes
}
