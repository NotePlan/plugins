// @flow
/*
TO DO:
- Move functions to support directory with tests
- Add config fields/defaults

*/
import dh from './support/data-helpers'
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
