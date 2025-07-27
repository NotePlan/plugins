// @flow
//-------------------------------------------------------------------------------
// Note-level Functions that require NP API calls
//-------------------------------------------------------------------------------

// import moment from 'moment/min/moment-with-locales'
import moment from 'moment/min/moment-with-locales'
import { getBlockUnderHeading } from './NPParagraph'
import * as dt from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { getFolderFromFilename, getRegularNotesInFolder } from '@helpers/folders'
import { displayTitle, isValidUUID } from '@helpers/general'
import { noteType } from '@helpers/note'
import { endOfFrontmatterLineIndex, ensureFrontmatter } from '@helpers/NPFrontMatter'
import { findStartOfActivePartOfNote, findEndOfActivePartOfNote } from '@helpers/paragraph'
import { caseInsensitiveIncludes, caseInsensitiveSubstringMatch, getCorrectedHashtagsFromNote } from '@helpers/search'
import { parseTeamspaceFilename } from '@helpers/teamspace'
import { isOpen, isClosed, isDone, isScheduled } from '@helpers/utils'

//-------------------------------------------------------------------------------

const pluginJson = 'NPnote.js'

//-------------------------------------------------------------------------------

/**
 * Print summary of note details to log.
 * @author @eduardmet
 * @param {?TNote} noteIn
 * @param {boolean?} alsoShowParagraphs? (default: false)
 */
// eslint-disable-next-line require-await
export async function printNote(noteIn: ?TNote, alsoShowParagraphs: boolean = false): Promise<void> {
  try {
    const note = (noteIn == null) ? Editor : noteIn
    if (!note) {
      logWarn('note/printNote()', `No valid note found. Stopping.`)
      return
    }

    console.log(`# ${note.type} Note: '${displayTitle(note)}'${noteIn == null ? ' from Editor' : ''}:`)
    // If it's a Teamspace note, show some details
    if (note.isTeamspaceNote) {
      // $FlowIgnore[incompatible-type]
      console.log(`- 🧑‍🤝‍🧑 teamspace: ${note.teamspaceTitle} (id ${note.teamspaceID})\n- filename ${note.filename}`)
    } else {
      console.log(`- Private note\n- filename ${note.filename}`)
    }

    if (note.type === 'Notes') {
      const endOfActive = findEndOfActivePartOfNote(note)
      console.log(
        `- created: ${String(note.createdDate) ?? ''}\n- changed: ${String(note.changedDate) ?? ''
        }\n- paragraphs: ${note.paragraphs.length} (endOfActive: ${String(endOfActive)})\n- hashtags: ${note.hashtags?.join(', ') ?? ''}\n- mentions: ${note.mentions?.join(', ') ?? ''
        }`,
      )
    } else {
      // Calendar note
      console.log(dt.getDateStringFromCalendarFilename(note.filename))
      console.log(
        `- created: ${String(note.createdDate) ?? ''}\n- changed: ${String(note.changedDate) ?? ''}\n- paragraphs: ${note.paragraphs.length
        }\n- hashtags: ${note.hashtags?.join(', ') ?? ''}\n- mentions: ${note.mentions?.join(', ') ?? ''}`,
      )
    }

    if (note.paragraphs.length > 0) {
      const open = note.paragraphs.filter((p) => isOpen(p)).length
      const done = note.paragraphs.filter((p) => isDone(p)).length
      const closed = note.paragraphs.filter((p) => isClosed(p)).length
      const scheduled = note.paragraphs.filter((p) => isScheduled(p)).length
      console.log(`- open: ${String(open)}\n- done: ${String(done)}\n- closed: ${String(closed)}\n- scheduled: ${String(scheduled)}`)
      if (alsoShowParagraphs) {
        console.log(`Paragraphs`)
        note.paragraphs.map((p) => console.log(`  ${p.lineIndex}: ${p.type} ${p.rawContent}`))
      }
    }

    // Now show .backlinks
    if (note.backlinks?.length > 0) {
      console.log(`Backlinks`)
      console.log(`- ${String(note.backlinks.length)} backlinked notes`)
      // $FlowIgnore[prop-missing]
      const flatBacklinkParas = getFlatListOfBacklinks(note) ?? [] // Note: this requires DataStore
      console.log(`- ${String(flatBacklinkParas.length)} backlink paras:`)
      for (let i = 0; i < flatBacklinkParas.length; i++) {
        const p = flatBacklinkParas[i]
        console.log(`  - ${p.note?.filename ?? '?'}:${p.lineIndex} [${p.type}, ${p.indents}]: ${p.content}`)
      }
    }

    if (note.isTeamspaceNote) {
      try { // without catch, so just continue
        const p0 = note.paragraphs[0]
        console.log(`\nExtra Teamspace tests using p[0] {${p0.content}}:`)
        console.log(`- p0.note.type: ${String(p0.note?.type)}`)
        console.log(`- p0.note.isTeamspaceNote: ${String(p0.note?.isTeamspaceNote)}`)
        console.log(`- p0.note.teamspaceTitle: ${String(p0.note?.teamspaceTitle)}`)
        console.log(`- p0.note.teamspaceID: ${String(p0.note?.teamspaceID)}`)
        console.log(`- p0.note.filename: ${String(p0.note?.filename)}`)
        console.log(`- p0.note.resolvedFilename: ${String(p0.note?.resolvedFilename)}`)
      } catch (e) {
        logError('note/printNote', `Teamspace Error: ${e.message}`)
      }
    }
  } catch (e) {
    logError('note/printNote', `Error printing note: ${e.message}`)
  }
}

/**
 * Get the teamspace details from a note.
 * Note: requires NotePlan v3.17 or later.
 * @author @jgclark
 * @param {TNote} note
 * @returns {TTeamspace | null} teamspace details, or null if not a teamspace note or if NotePlan build version is too old
 */
export function getTeamspaceDetailsFromNote(note: TNote): TTeamspace | null {
  try {
    if ((NotePlan.environment.buildVersion < 1366 && NotePlan.environment.platform === 'macOS') || (NotePlan.environment.buildVersion < 1295 && NotePlan.environment.platform !== 'macOS')) {
      return null
    }
    if (note.isTeamspaceNote) {
      const teamspaceId = note.filename.split('/')[1]
      const resolvedFilename = note.resolvedFilename
      const teamspaceTitle = resolvedFilename.split('/')[0]
      if (!teamspaceId || !teamspaceId.length || !isValidUUID(teamspaceId)) {
        throw new Error(`Note ${note.filename} is a teamspace note but cannot get valid ID for it`)
      }
      if (!teamspaceTitle || !teamspaceTitle.length) {
        throw new Error(`Note ${note.filename} is a teamspace note but cannot get title for it`)
      }
      // logDebug('NPnote/getTeamspaceIDFromNote', `Note ${note.filename} is a teamspace note with ID ${teamspaceId}`)
      return { id: teamspaceId, title: teamspaceTitle }
    }
    logWarn('NPnote/getTeamspaceIDFromNote', `Note ${note.filename} is not a teamspace note`)
    return null
  } catch (err) {
    logError('NPnote/getTeamspaceIDFromNote', `${err.name}: ${err.message}`)
    return null
  }
}

/**
 * Get a note from its full filename, coping with Teamspace notes.
 * @author @jgclark for 3.17 for Teamspace notes
 * @param {string} filename
 * @returns {TNote?} note if found, or null
 */
export function getNoteFromFilename(filenameIn: string): TNote | null {
  try {
    let foundNote: TNote | null = null
    const { filename, isTeamspace, teamspaceID } = parseTeamspaceFilename(filenameIn)
    // logInfo('NPnote/getNoteFromFilename', `- filenameIn: ${filenameIn} / filename: ${filename} / isTeamspace: ${String(isTeamspace)} /  teamspaceID: ${String(teamspaceID)}`)
    if (isTeamspace) {
      if (!teamspaceID) {
        throw new Error(`Note ${filenameIn} is a teamspace note but cannot get valid ID for it.`)
      }
      // FIXME(Eduard): projectNoteByFilename() is not working for teamspace notes
      // So we have to do it this way ...
      foundNote = DataStore.noteByFilename(filenameIn, 'Notes', teamspaceID)
        ?? DataStore.noteByFilename(filenameIn, 'Calendar', teamspaceID)
        ?? null
      logInfo('NPnote/getNoteFromFilename', `Found teamspace note '${displayTitle(foundNote)}' from ${filenameIn}`)
    } else {
      // Check for private notes
      foundNote = DataStore.projectNoteByFilename(filenameIn) ?? null
      if (!foundNote) {
        // Check for calendar notes
        const isPossibleCalendarFilename = dt.isValidCalendarNoteFilename(filenameIn)
        if (isPossibleCalendarFilename) {
          const dateString = dt.getDateStringFromCalendarFilename(filenameIn)
          foundNote = DataStore.calendarNoteByDateString(dateString) ?? null
        }
      }
      if (foundNote) {
        logInfo('NPnote/getNoteFromFilename', `Found note '${displayTitle(foundNote)}' from ${filenameIn}`)
      } else {
        logInfo('NPnote/getNoteFromFilename', `No note found for ${filenameIn}`)
      }
    }
    return foundNote
  } catch (err) {
    logError('NPnote/getNoteFromFilename', `${err.name}: ${err.message}`)
    return null
  }
}

/**
 * Get a note from (in order):
 * - its title (for a project note)
 * - its relative date description ('today', 'yesterday', 'tomorrow', 'this week', 'last week', 'next week')
 * - an ISO date (i.e. YYYY-MM-DD)
 * - for date intervals '{[+-]N[dwmqy]}' calculate the date string relative to today
 * - for calendar notes, from it's NP date string (e.g. YYYYMMDD, YYYY-Wnn etc.)
 * @param {string} noteIdentifier: project note title, or date interval (e.g.'-1d'), or NotePlan's (internal) calendar date string
 * @returns {TNote?} note if found, or null
 */
export function getNoteFromIdentifier(noteIdentifierIn: string): TNote | null {
  try {
    let thisFilename = ''
    // TODO: Ideally move this to a function, for i18n. Moment library doesn't quite cover all of this. Could Chrono library help?
    const noteIdentifier =
      noteIdentifierIn === 'today'
        ? '{0d}'
        : noteIdentifierIn === 'yesterday'
        ? '{-1d}'
        : noteIdentifierIn === 'tomorrow'
        ? '{+1d}'
        : noteIdentifierIn === 'this week'
        ? '{0w}'
        : noteIdentifierIn === 'last week'
        ? '{-1w}'
        : noteIdentifierIn === 'next week'
        ? '{+1w}'
        : noteIdentifierIn
    const possibleProjectNotes = DataStore.projectNoteByTitle(noteIdentifier) ?? []
    if (possibleProjectNotes.length > 0) {
      thisFilename = possibleProjectNotes[0].filename
      logDebug('NPnote/getNoteFromIdentifier', `-> found project note with filename '${thisFilename}'`)
      return possibleProjectNotes[0]
    }
    // Not a project note, so look at calendar notes
    let possDateString = noteIdentifier
    if (new RegExp(dt.RE_OFFSET_DATE).test(possDateString)) {
      // this is a date interval, so -> date string relative to today
      // $FlowIgnore[incompatible-use]
      const thisOffset = possDateString.match(new RegExp(dt.RE_OFFSET_DATE_CAPTURE))[1]
      possDateString = dt.calcOffsetDateStrUsingCalendarType(thisOffset)
      logDebug('NPnote/getNoteFromIdentifier', `found offset date ${thisOffset} -> '${possDateString}'`)
    }
    // If its YYYY-MM-DD then have to turn it into YYYYMMDD
    if (new RegExp(dt.RE_ISO_DATE).test(possDateString)) {
      possDateString = dt.convertISODateFilenameToNPDayFilename(possDateString)
    }
    // If this matches a calendar note by filename (YYYYMMDD or YYYY-Wnn etc.)
    if (dt.isValidCalendarNoteFilenameWithoutExtension(possDateString)) {
      const thisNote = DataStore.calendarNoteByDateString(possDateString)
      if (thisNote) {
        thisFilename = thisNote.filename
        logDebug('NPnote/getNoteFromIdentifier', `-> found calendar note with filename '${thisFilename}' from ${possDateString}`)
        return thisNote
      } else {
        logError('NPnote/getNoteFromIdentifier', `${possDateString} doesn't seem to have a calendar note?`)
      }
    } else {
      logError('NPnote/getNoteFromIdentifier', `${possDateString} is not a valid date string`)
    }
    logError('NPnote/getNoteFromIdentifier', `-> no note found for '${noteIdentifierIn}'`)
    return null
  } catch (err) {
    logError(pluginJson, err.message)
    return null
  }
}

/**
 * Get a note's filename from (in order):
 * - its title (for a project note)
 * - an ISO date (i.e. YYYY-MM-DD)
 * - for date intervals '[+-]N[dwmqy]' calculate the date string relative to today
 * - for calendar notes, from it's NP date string (e.g. YYYYMMDD, YYYY-Wnn etc.)
 * @param {string} inputStr: project note title, or date interval (e.g.'-1d'), or NotePlan's (internal) calendar date string
 * @returns {string} filename of note if found, or null
 */
export function getNoteFilenameFromTitle(inputStr: string): string | null {
  let thisFilename = ''
  const possibleProjectNotes = DataStore.projectNoteByTitle(inputStr) ?? []
  if (possibleProjectNotes.length > 0) {
    thisFilename = possibleProjectNotes[0].filename
    logDebug('NPnote/getNoteFilenameFromTitle', `-> found project note '${thisFilename}'`)
    return thisFilename
  }
  // Not a project note, so look at calendar notes
  let possDateString = inputStr
  if (new RegExp(dt.RE_OFFSET_DATE).test(possDateString)) {
    // this is a date interval, so -> date string relative to today
    // $FlowIgnore[incompatible-use]
    const thisOffset = possDateString.match(new RegExp(dt.RE_OFFSET_DATE_CAPTURE))[1]
    possDateString = dt.calcOffsetDateStrUsingCalendarType(thisOffset)
    logDebug('NPnote/getNoteFilenameFromTitle', `found offset date ${thisOffset} -> '${possDateString}'`)
  }
  // If its YYYY-MM-DD then have to turn it into YYYYMMDD
  if (new RegExp(dt.RE_ISO_DATE).test(possDateString)) {
    possDateString = dt.convertISODateFilenameToNPDayFilename(possDateString)
  }
  // If this matches a calendar note by filename (YYYYMMDD or YYYY-Wnn etc.)
  if (dt.isValidCalendarNoteFilenameWithoutExtension(possDateString)) {
    const thisNote = DataStore.calendarNoteByDateString(possDateString)
    if (thisNote) {
      thisFilename = thisNote.filename
      logDebug('NPnote/getNoteFilenameFromTitle', `-> found calendar note '${thisFilename}' from ${possDateString}`)
      return thisFilename
    } else {
      logError('NPnote/getNoteFilenameFromTitle', `${possDateString} doesn't seem to have a calendar note?`)
    }
  } else {
    logError('NPnote/getNoteFilenameFromTitle', `${possDateString} is not a valid date string`)
  }
  logError('NPnote/getNoteFilenameFromTitle', `-> no note found for '${inputStr}'`)
  return null
}

/**
 * Convert the note to use frontmatter syntax.
 * If optional default text is given, this is added to the frontmatter.
 * @author @jgclark
 * @param {TNote} note to convert
 * @param {string?} defaultFMText to add to frontmatter if supplied
 * @returns {boolean} success?
 */
export function convertNoteToFrontmatter(note: TNote, defaultFMText: string = ''): void {
  try {
    if (!note) {
      throw new Error('NPnote/convertNoteToFrontmatter: No valid note supplied.')
    }

    const result = ensureFrontmatter(note)
    if (result) {
      logDebug('NPnote/convertNoteToFrontmatter', `ensureFrontmatter() worked for note ${note.filename}`)

      if (defaultFMText !== '') {
        const endOfFMLineIndex: number | false = endOfFrontmatterLineIndex(note) // closing separator line
        if (endOfFMLineIndex !== false) {
          note.insertParagraph(defaultFMText, endOfFMLineIndex, 'text') // inserts before closing separator line
        } else {
          logWarn('NPnote/convertNoteToFrontmatter', `endOfFrontmatterLineIndex() failed for note ${note.filename}`)
        }
      }
    } else {
      logWarn('NPnote/convertNoteToFrontmatter', `ensureFrontmatter() failed for note ${note.filename}`)
    }
  } catch (error) {
    logError(pluginJson, `convertNoteToFrontmatter: ${error.message}`)
  }
}

/**
 * Select the first non-title line in Editor
 * NotePlan will always show you the ## before a title if your cursor is on a title line, but
 * this is ugly. And so in this function we find and select the first non-title line
 * @author @dwertheimer
 * @returns
 */
export function selectFirstNonTitleLineInEditor(): void {
  if (Editor && Editor.content) {
    for (let i = findStartOfActivePartOfNote(Editor); i < Editor.paragraphs.length; i++) {
      const line = Editor.paragraphs[i]
      if (line.type !== 'title' && line?.contentRange && line.contentRange.start >= 0) {
        Editor.select(line.contentRange.start, 0)
        return
      }
    }
  }
}

/**
 * Find paragraphs in note which are open and (maybe) tagged for today (either >today or hyphenated date)
 * If includeAllTodos is true, then all open todos are returned except for ones scheduled for a different day
 * @author @dwertheimer
 * @param {TNote} note
 * @param {boolean} includeAllTodos - whether to include all open todos, or just those tagged for today
 * @returns {Array<TParagraph>} of paragraphs which are open or open+tagged for today
 */
export function findOpenTodosInNote(note: TNote, includeAllTodos: boolean = false): Array<TParagraph> {
  const hyphDate = dt.todaysDateISOString
  // const toDate = getDateObjFromDateTimeString(hyphDate)
  const isTodayItem = (text: string) => [`>${hyphDate}`, '>today'].filter((a) => text.indexOf(a) > -1).length > 0
  // const todos:Array<TParagraph>  = []
  if (note.paragraphs) {
    return note.paragraphs.filter((p) => isOpen(p) && (isTodayItem(p.content) || (includeAllTodos && !dt.isScheduled(p.content))))
  }
  logDebug(`findOpenTodosInNote could not find note.paragraphs. returning empty array`)
  return []
}

/**
 * note.backlinks is an array of Paragraphs, but its subItems can be nested. The nesting can be multiple levels deep.
 * This function returns an array of TParagraphs, one for each backlink, undoing the nesting.
 */
// $FlowFixMe[incompatible-return]
export function getFlatListOfBacklinks(note: TNote): Array<TParagraph> {
  // Iterate over all backlinks, recursing where necessary to visit all subItems, returning a flat list of lineIndex
  // function flattenSubItems(subItems: Array<TBacklinkFields>): Array<TBacklinkFields> {
  //   const items: Array<TBacklinkFields> = []
  //   subItems.forEach((item) => {
  //     if (item.subItems) {
  //       items.push(item)
  //       // logDebug('note/getFlatListOfBacklinks', `+ ${item.lineIndex}: ${item.content} [has ${items.length} saved indexes`)
  //       // Recursively process any subItems of the current item
  //       items.push(...flattenSubItems(item.subItems))
  //     }
  //   })
  //   return items
  // }

  try {
    const noteBacklinks = note.backlinks
    if (noteBacklinks.length === 0) {
      return []
    }
    logDebug('NPnote/getFlatListOfBacklinks', `Starting for ${String(noteBacklinks.length)} backlinks in ${String(note.filename)} ...`)
    const flatBacklinkParas: Array<TParagraph> = []
    for (const noteBacklink of noteBacklinks) {
      // const startTime = new Date() // only for timing inside this loop

      // v1: which has the issue of getting all paras, which has gone very slow.
      // Get the note that this backlink points to
      // const thisBacklinkNote = DataStore.noteByFilename(noteBacklink.filename, noteBacklink.noteType)
      // clo(noteBacklink.subItems, `noteBackLink in ${thisBacklinkNote?.filename ?? '(error)'}`)
      // const thisBacklinkNoteParas = thisBacklinkNote?.paragraphs
      // if (!thisBacklinkNoteParas) {
      //   logError('NPnote/getFlatListOfBacklinks', `Error getting paragraphs for ${noteBacklink.filename}`)
      // }
      // let thisNoteItems: Array<TBacklinkFields> = []
      // // thisNoteLineIndexes.push(noteBacklink.lineIndex) // noteBacklink.lineIndex

      // if (noteBacklink.subItems && noteBacklink.subItems.length > 0) {
      //   logDebug('NPnote/getFlatListOfBacklinks', `- has ${noteBacklink.subItems.length} top-levelsubItems`)
      //   thisNoteItems = flattenSubItems(noteBacklink.subItems)
      // }
      // logDebug('NPnote/getFlatListOfBacklinks', `  => ${thisNoteItems.length} items`)

      // // Now find paragraphs from those lineIndexes
      // for (const item of thisNoteItems) {
      //   logDebug('NPnote/getFlatListOfBacklinks', `+ ${item.lineIndex}`)
      //   // $FlowIgnore[incompatible-use]
      //   flatBacklinkParas.push(thisBacklinkNoteParas[item.lineIndex])
      // }
      // logTimer('NPnote/getFlatListOfBacklinks', startTime, `- after processing backlinks for ${thisBacklinkNote?.filename ?? '(error)'} with ${String(thisBacklinkNoteParas?.length)} paras, now have ${String(flatBacklinkParas.length)} flat backlinks`, 100)

      // v2: which just works on data returned within subItems (which are actual para refs it turns out)
      for (const subItem of noteBacklink.subItems) {
        if (subItem.type !== 'title') {
          flatBacklinkParas.push(subItem)
        }
      }
      // logTimer('NPnote/getFlatListOfBacklinks', startTime, `- after processing backlinks for ${thisBacklinkNote?.filename ?? '(error)'} now has ${String(flatBacklinkParas.length)} flat backlinks`, 100)
    }
    // logTimer('NPnote/getFlatListOfBacklinks', startTime, `=> ${String(noteBacklinks.length)} in flatListOfBacklinks`)
    return flatBacklinkParas
  } catch (err) {
    logError('NPnote/getFlatListOfBacklinks', JSP(err))
  }
}

/**
 * Get the paragraphs in 'note' which are scheduled for date of the 'calendar' note.
 * @author @dwertheimer extended by @jgclark
 * @param {CoreNoteFields} calendar note to look for links to (the note or Editor)
 * @param {CoreNoteFields} includeHeadings? (default to true for backwards compatibility)
 * @returns {Array<TParagraph>} - paragraphs which reference today in some way
 */
export function getReferencedParagraphs(calNote: Note, includeHeadings: boolean = true): Array<TParagraph> {
  try {
    const thisDateStr = calNote.title || '' // will be  2022-10-10 or 2022-10 or 2022-Q3 etc depending on the note type
    const wantedParas = []

    // Use .backlinks, which is described as "Get all backlinks pointing to the current note as Paragraph objects. In this array, the toplevel items are all notes linking to the current note and the 'subItems' attributes (of the paragraph objects) contain the paragraphs with a link to the current note. The headings of the linked paragraphs are also listed here, although they don't have to contain a link."
    // Note: @jgclark reckons that the subItem.headingLevel data returned by this might be wrong.
    const backlinkParas: Array<TParagraph> = getFlatListOfBacklinks(calNote) // an array of notes which link to this note
    // logDebug(`getReferencedParagraphs`, `found ${String(backlinkParas.length)} backlinked paras for ${displayTitle(calNote)}:`)

    backlinkParas.forEach((para) => {
      // If we want to filter out the headings, then check the subItem content actually includes the date of the note of interest.
      if (includeHeadings) {
        // logDebug(`getReferencedParagraphs`, `- adding  "${para.content}" as we want headings`)
      } else if (para.content.includes(`>${thisDateStr}`) || para.content.includes(`>today`)) {
        // logDebug(`getReferencedParagraphs`, `- adding "${para.content}" as it includes >${thisDateStr} or >today`)
        wantedParas.push(para)
      } else {
        // logDebug(`getReferencedParagraphs`, `- skipping "${para.content}" as it doesn't include >${thisDateStr}`)
      }
    })

    // logDebug(`getReferencedParagraphs`, `"${calNote.title || ''}" has ${wantedParas.length} wantedParas`)
    return wantedParas
  } catch (err) {
    logError('NPnote/getReferencedParagraphs', JSP(err))
    return []
  }
}

/**
 * Get linked items from the references section (.backlinks)
 * @param { note | null} pNote
 * @returns {Array<TParagraph>} - paragraphs which reference today in some way
 * Backlinks format: {"type":"note","content":"_Testing scheduled sweeping","rawContent":"_Testing scheduled sweeping","prefix":"","lineIndex":0,"heading":"","headingLevel":0,"isRecurring":0,"indents":0,"filename":"zDELETEME/Test scheduled.md","noteType":"Notes","linkedNoteTitles":[],"subItems":[{},{},{},{}]}
 * backlinks[0].subItems[0] =JSLog: {"type":"open","content":"scheduled for 10/4 using app >today","rawContent":"* scheduled for 10/4 using app
 * ","prefix":"* ","contentRange":{},"lineIndex":2,"date":"2021-11-07T07:00:00.000Z","heading":"_Testing scheduled sweeping","headingRange":{},"headingLevel":1,"isRecurring":0,"indents":0,"filename":"zDELETEME/Test scheduled.md","noteType":"Notes","linkedNoteTitles":[],"subItems":[]}
 */
export function getTodaysReferences(pNote: TNote | null = null): $ReadOnlyArray<TParagraph> {
  // logDebug(pluginJson, `getTodaysReferences starting`)
  const note = pNote || Editor.note
  if (note == null) {
    logDebug(pluginJson, `timeblocking could not open Note`)
    return []
  }
  return getReferencedParagraphs(note)
}

export type OpenNoteOptions = Partial<{
  newWindow?: boolean,
  splitView?: boolean,
  highlightStart?: number,
  highlightEnd?: number,
  createIfNeeded?: boolean,
  content?: string,
}>

/**
 * Convenience Method for Editor.openNoteByFilename, include only the options you care about (requires NP v3.7.2+)
 * Tries to work around NP bug where opening a note that doesn't exist doesn't work
 * If you send the options.content field to force content setting,   it should have a value or undefined (not null)
 * @param {string} filename - Filename of the note file (can be without extension), but has to include the relative folder such as `folder/filename.txt`
 * @param {OpenNoteOptions} options - options for opening the note (all optional -- see fields in type)
 * @returns {Promise<TNote|void>} - the note that was opened
 * @author @dwertheimer
 */
export async function openNoteByFilename(filename: string, options: OpenNoteOptions = {}): Promise<TNote | void> {
  const isCalendarNote = dt.isValidCalendarNoteFilename(filename)
  let note = await Editor.openNoteByFilename(
    filename,
    options.newWindow || false,
    options.highlightStart || 0,
    options.highlightEnd || 0,
    options.splitView || false,
    options.createIfNeeded || false,
    options.content || undefined /* important for this to be undefined or NP creates a note with "null" */,
  )
  if (!note) {
    logDebug(pluginJson, `openNoteByFilename could not open note with filename: "${filename}" (probably didn't exist)`)
    // note may not exist yet, so try to create it (if it's a calendar note)
    const dataStoreNote = isCalendarNote ? await DataStore.noteByFilename(filename, 'Calendar') : null
    if (dataStoreNote) {
      dataStoreNote.content = ''
      // $FlowIgnore[incompatible-call]
      note = await Editor.openNoteByFilename(
        filename,
        options.newWindow || false,
        options.highlightStart || 0,
        options.highlightEnd || 0,
        options.splitView || false,
        options.createIfNeeded || false,
        options.content || undefined,
      )
    }
  }
  if (!note) {
    logError(
      pluginJson,
      `openNoteByFilename could not open ${isCalendarNote ? 'Calendar ' : 'Project'} note with filename: "${filename}" ${
        isCalendarNote ? '' : '. You may need to set "createIfNeeded" to true for this to work'
      }`,
    )
  }
  return note
}

/**
 * Highlight/scroll to a paragraph (a single line) in the editor matching a string (in the Editor, open document)
 * Most likely used to scroll a page to a specific heading (though it can be used for any single line/paragraph)
 * Note: the line will be selected, so a user keystroke following hightlight would delete the block
 * IF you want to just scroll to the content but not leave it selected, use the function scrollToParagraphWithContent()
 * @param {string} content - the content of the paragraph to highlight
 * @returns {boolean} - true if the paragraph was found and highlighted, false if not
 */
export function highlightParagraphWithContent(content: string): boolean {
  const para = Editor.paragraphs.find((p) => p.content === content)
  if (para) {
    Editor.highlight(para)
    return true
  }
  logError(`highlightParagraphWithContent could not find paragraph with content: "${content}" in the Editor`)
  return false
}

/**
 * Scroll to and Highlight an entire block under a heading matching a string (in the Editor, open document)
 * Note: the block will be the cursor selection, so a user keystroke following hightlight would delete the block
 * IF you want to just scroll to the content but not leave it selected, use the function scrollToParagraphWithContent()
 * @param {string} content - the content of the paragraph to highlight
 * @returns {boolean} - true if the paragraph was found and highlighted, false if not
 */
export function highlightBlockWithHeading(content: string): boolean {
  const blockParas = getBlockUnderHeading(Editor, content, true)
  if (blockParas && blockParas.length > 0) {
    // $FlowFixMe[incompatible-call] but still TODO(@dwertheimer): why is 'Range' undefined?
    const contentRange = Range.create(blockParas[0].contentRange?.start, blockParas[blockParas.length - 1].contentRange?.end)
    Editor.highlightByRange(contentRange) // highlight the entire block
    return true
  }
  logError(`highlightBlockWithHeading could not find paragraph with content: "${content}" in the Editor`)
  return false
}

/**
 * Scroll to a paragraph (a single line) in the editor matching a string (in the Editor, open document)
 * Most likely used to scroll a page to a specific heading (though it can be used for any single line/paragraph)
 * Note: the line will be selected, so a user keystroke following hightlight would delete the block
 * IF you want to just scroll to the content but not leave it selected, use the function
 * @param {string} content - the content of the paragraph to highlight
 * @returns {boolean} - true if the paragraph was found and highlighted, false if not
 */
export function scrollToParagraphWithContent(content: string): boolean {
  const para = Editor.paragraphs.find((p) => p.content === content)
  if (para && para.contentRange?.end) {
    Editor.highlightByIndex(para.contentRange.end, 0)
    return true
  }
  logError(`scrollToParagraphWithContent could not find paragraph with content: "${content}" in the Editor`)
  return false
}

/**
 * Return list of all notes of type ['Notes'] or ['Calendar'] or both (default).
 * Note: .slice() is used to avoid mutating the original arrays. This doesn't appear to affect performance, so I'm leaving them in.
 * @author @jgclark
 * @param {Array<string>} noteTypesToInclude
 * @returns {Array<TNote>}
 */
export function getAllNotesOfType(noteTypesToInclude: Array<string> = ['Calendar', 'Notes']): Array<TNote> {
  try {
    if (noteTypesToInclude.length === 0) {
      throw new Error(`No note types given. Returning empty array.`)
    }
    let allNotesToCheck: Array<TNote> = []
    if (noteTypesToInclude === ['Calendar', 'Notes'] || noteTypesToInclude === ['Notes', 'Calendar']) {
      allNotesToCheck = DataStore.calendarNotes.slice().concat(DataStore.projectNotes)
    }
    else if (noteTypesToInclude.includes('Calendar')) {
      allNotesToCheck = DataStore.calendarNotes.slice()
    }
    else if (noteTypesToInclude.includes('Notes')) {
      allNotesToCheck = DataStore.projectNotes.slice()
    }
    return allNotesToCheck
  } catch (err) {
    logError('getAllNotesOfType', `${err.name}: ${err.message}`)
    return [] // for completeness
  }
}

/**
 * Return list of all notes changed in the last 'numDays'.
 * Set 'noteTypesToInclude' to just ['Notes'] or ['Calendar'] to include just those note types.
 * Note: if numDays === 0 then it will only return notes changed in the current day, not the last 24 hours.
 * @author @jgclark
 * @param {number} numDays
 * @param {Array<string>} noteTypesToInclude
 * @returns {Array<TNote>}
 */
export function getNotesChangedInInterval(numDays: number, noteTypesToInclude: Array<string> = ['Calendar', 'Notes']): Array<TNote> {
  try {
    const startTime = new Date()
    // Note: This operations takes >700ms for JGC
    // I have asked @EM to make suggestions for optimising this.
    const allNotesToCheck: Array<TNote> = getAllNotesOfType(noteTypesToInclude)
    logTimer('getNotesChangedInInterval', startTime, `to get list of ${allNotesToCheck.length} notes to check`)

    let matchingNotes: Array<TNote> = []
    const todayStart = new moment().startOf('day') // use moment instead of `new Date` to ensure we get a date in the local timezone
    const momentToStartLooking = todayStart.subtract(numDays, 'days')
    const jsdateToStartLooking = momentToStartLooking.toDate()

    matchingNotes = allNotesToCheck.filter((f) => f.changedDate >= jsdateToStartLooking)
    // Note: This operations takes 3ms for JGC
    logTimer('getNotesChangedInInterval', startTime,
      `from ${allNotesToCheck.length} notes of type ${String(noteTypesToInclude)} found ${matchingNotes.length} changed after ${String(momentToStartLooking)}:`,
    )
    return matchingNotes
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    return [] // for completeness
  }
}

/**
 * Return array of notes changed in the last 'numDays' from provided array of 'notesToCheck'
 * @author @jgclark
 * @param {Array<TNote>} notesToCheck
 * @param {number} numDays
 * @returns {Array<TNote>}
 */
export function getNotesChangedInIntervalFromList(notesToCheck: $ReadOnlyArray<TNote>, numDays: number): Array<TNote> {
  try {
    const todayStart = new moment().startOf('day') // use moment instead of `new Date` to ensure we get a date in the local timezone
    const momentToStartLooking = todayStart.subtract(numDays, 'days')
    const jsdateToStartLooking = momentToStartLooking.toDate()

    const matchingNotes: Array<TNote> = notesToCheck.filter((f) => f.changedDate >= jsdateToStartLooking)
    // logDebug('getNotesChangedInInterval', `from ${notesToCheck.length} notes found ${matchingNotes.length} changed after ${String(momentToStartLooking)}`)
    return matchingNotes
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    return [] // for completeness
  }
}

/**
 * Get a note's display title (optionally enclosed as a [[...]] notelink) from its filename.
 * Handles both Notes and Calendar, matching the latter by regex matches. (Not foolproof though.)
 * @author @jgclark
 * @param {string} filename
 * @param {boolean} makeLink? - whether to return a link to the note (default false)
 * @returns {string} title of note
 */
export function getNoteTitleFromFilename(filename: string, makeLink?: boolean = false): string {
  const thisNoteType: NoteType = noteType(filename)
  const note = DataStore.noteByFilename(filename, thisNoteType)
  if (note) {
    return makeLink ? `[[${displayTitle(note) ?? ''}]]` : displayTitle(note)
  } else {
    logError('note/getNoteTitleFromFilename', `Couldn't get valid title for note filename '${filename}'`)
    return '(error)'
  }
}

/**
 * Return list of regular (and optionally calendar) notes with a given #hashtag or @mention (singular), with further optional parameters about which (sub)folders to look in, and a term to defeat on etc.
 * Note: since Feb 2025 @jgclark has developed a newer, faster, mechanism for this: the tagMentionCache. But leaving this here for now.
 * @author @jgclark
 * @param {string} item - tag/mention name to look for
 * @param {boolean} caseInsensitiveMatch? - whether to ignore case when matching
 * @param {boolean} alsoSearchCalendarNotes? - whether to search calendar notes
 * @param {boolean} excludeSpecialFolders? - whether to ignore regular notes in special folders, i.e. those starting with '@', including @Templates, @Archive and @Trash (optional, defaults to true)
 * @param {Array<string>} itemsToExclude - optional list of tags/mentions that if found in the note, excludes the note
 * @param {Array<string>?} wantedParaTypes - optional list of paragraph types to include (default is all)
 * @param {string?} folder - optional folder to limit to
 * @param {boolean?} includeSubfolders? - if folder given, whether to look in subfolders of this folder or not (optional, defaults to true)
 * @return {Array<TNote>}
 */
export function findNotesMatchingHashtagOrMention(
  item: string,
  caseInsensitiveMatch: boolean,
  alsoSearchCalendarNotes: boolean,
  excludeSpecialFolders: boolean,
  itemsToExclude: Array<string> = [],
  wantedParaTypes: Array<string> = [],
  folder: ?string,
  includeSubfolders?: boolean = true,
): Array<TNote> {
  try {
    // Check for special conditions first
    if (item === '') {
      throw new Error(`No hashtag given. Stopping`)
    }
    const isHashtag = item.startsWith('#')
    let notesToSearch = excludeSpecialFolders ? DataStore.projectNotes.filter((n) => !n.filename.startsWith('@')) : DataStore.projectNotes

    if (alsoSearchCalendarNotes) {
      notesToSearch = notesToSearch.concat(DataStore.calendarNotes)
    }
    logDebug(
      'NPnote/findNotesMatchingHashtagOrMention',
      `starting with ${notesToSearch.length} notes (${notesToSearch ? 'from the notesToSearchIn param' : 'from DataStore.projectNotes'} ${
        alsoSearchCalendarNotes ? '+ calendar notes)' : ')'
      }. Search is case ${caseInsensitiveMatch ? 'INsensitive' : 'sensitive'} for '${item}'`,
    )

    // const startTime = new Date()
    let notesInFolder: Array<TNote>
    // If folder given (not empty) then filter using it
    if (folder && folder !== '') {
      if (includeSubfolders) {
        // use startsWith as filter to include subfolders
        notesInFolder = notesToSearch.slice().filter((n) => n.filename.startsWith(`${folder}/`))
      } else {
        // use match as filter to exclude subfolders
        notesInFolder = notesToSearch.slice().filter((n) => getFolderFromFilename(n.filename) === folder)
      }
    } else {
      // no folder specified, so grab all notes from DataStore
      // $FlowIgnore[incompatible-type]
      notesInFolder = notesToSearch
    }
    logDebug(
      `NPnote/findNotesMatchingHashtagOrMention`,
      `item:${item} folder:${String(folder ?? '<all>')} includeSubfolders:${String(includeSubfolders)} ItemsToExclude:${String(itemsToExclude)} for ${String(
        notesInFolder.length,
      )} notes`,
    )

    // Filter by tag and/or mentions
    // Note: now using the cut-down list of hashtags as the API returns partial duplicates
    let notesWithItem: Array<TNote>
    if (caseInsensitiveMatch) {
      notesWithItem = notesInFolder.filter((n) => {
        const correctedHashtags = getCorrectedHashtagsFromNote(n)
        return isHashtag
          ? caseInsensitiveIncludes(item, correctedHashtags)
          : // $FlowIgnore[incompatible-call] only about $ReadOnlyArray
            caseInsensitiveIncludes(item, n.mentions)
      })
    } else {
      notesWithItem = notesInFolder.filter((n) => {
        const correctedHashtags = getCorrectedHashtagsFromNote(n)
        return isHashtag
          ? correctedHashtags.includes(item)
          : n.mentions.includes(item)
      })
    }
    if (notesWithItem.length === 0) {
      logDebug('NPnote/findNotesMatchingHashtagOrMention', `-> no notes matching '${item}'`)
      return []
    }
    logDebug('NPnote/findNotesMatchingHashtagOrMention', `In folder '${folder ?? '<all>'}' found ${notesWithItem.length} notes matching '${item}'`)
    logDebug('NPnote/findNotesMatchingHashtagOrMention', `= ${String(notesWithItem.map((n) => n.title))}`)

    // Restrict to certain para types, if wanted
    if (wantedParaTypes.length > 0) {
      notesWithItem = notesWithItem.filter((n) => filterTagsOrMentionsInNoteByWantedParaTypes(n, [item], wantedParaTypes).length > 0)
      logDebug('NPnote/findNotesMatchingHashtagOrMention', `After filtering to only include notes with wanted para types [${String(wantedParaTypes)}] -> ${String(notesWithItem.length)} notes`)
      logDebug('NPnote/findNotesMatchingHashtagOrMention', `= ${String(notesWithItem.map((n) => n.title))}`)
    }

    // If we have 'itemsToExclude' then further filter out notes with these items
    if (itemsToExclude.length > 0) {
      const doesNotMatchItemsToExclude = (e: string) => !itemsToExclude.includes(e)
      const notesWithItemWithoutExclusion = notesWithItem.filter((n) => n.hashtags.some(doesNotMatchItemsToExclude))
      const removedItems = notesWithItem.length - notesWithItemWithoutExclusion.length
      if (removedItems > 0) {
        logDebug('NPnote/findNotesMatchingHashtagOrMention', `- but removed ${removedItems} excluded notes:`)
        logDebug('NPnote/findNotesMatchingHashtagOrMention', `= ${String(notesWithItem.filter((n) => n.hashtags.includes(itemsToExclude)).map((m) => m.title))}`)
      }
      return notesWithItemWithoutExclusion
    } else {
      return notesWithItem
    }
  } catch (err) {
    logError('NPnote/findNotesMatchingHashtagOrMention', err.message)
    return []
  }
}

/**
 * Filters tags or mentions ('items') seen in 'note' to wantedParagraphTypes
 * @param {TNote} note
 * @param {Array<string>} items - The list of tags or mentions to filter
 * @param {Array<string>} wantedParaTypes - The paragraph types to allow
 * @returns {Array<string>} Filtered tagsOrMentions that match the criteria
 */
function filterTagsOrMentionsInNoteByWantedParaTypes(
  note: TNote,
  tagsOrMentions: Array<string>,
  wantedParaTypes: Array<string>,
): Array<string> {
  try {
    // Filter items based on paragraph types and note tags
    const filteredItems = tagsOrMentions.filter(item => {
      const paragraphsWithItem = note.paragraphs.filter(p => caseInsensitiveSubstringMatch(item, p.content))
      // logDebug('NPnote/filterTagsOMINBWPT', `Found ${paragraphsWithItem.length} paragraphs with item ${item} in ${note.filename}:`)
      const hasValidParagraphType = paragraphsWithItem.some(p => wantedParaTypes.includes(p.type))

      return hasValidParagraphType
    })

    // logDebug('NPnote/filterTagsOMINBWPT', `Found ${filteredItems.length} of ${tagsOrMentions.length} wanted tags/mentions in ${note.filename}: [${String(filteredItems)}]`)

    return filteredItems
  } catch (error) {
    logError('NPnote/filterTagsOMINBWPT', `Error filtering items in note ${note.filename}: ${error.message}`)
    return []
  }
}

/**
 * From a given array of notes, return the subset with a given #hashtag or @mention (singular), with further optional parameters about which (sub)folders to look in, and a term to defeat on etc.
 * @author @jgclark
 * @param {string} item - tag/mention name to look for
 * @param {Array<TNote>} notesToSearchIn - array of notes to search in
 * @param {boolean} caseInsensitiveMatch? - whether to ignore case when matching
 * @param {boolean} alsoSearchCalendarNotes?
 * @param {string?} folder - optional folder to limit to
 * @param {boolean?} includeSubfolders? - if folder given, whether to look in subfolders of this folder or not (optional, defaults to false)
 * @param {Array<string>?} itemsToExclude - optional list of tags/mentions that if found in the note, excludes the note
 * @return {Array<TNote>}
 */
export function findNotesMatchingHashtagOrMentionFromList(
  item: string,
  notesToSearchIn: Array<TNote>,
  caseInsensitiveMatch: boolean,
  alsoSearchCalendarNotes: boolean,
  folder: ?string,
  includeSubfolders: boolean = false,
  itemsToExclude: Array<string> = [],
): Array<TNote> {
  try {
    // Check for special conditions first
    if (item === '') {
      logError('NPnote/findNotesMatchingHashtagOrMentionFromList', `No tag/mention given. Stopping`)
      return [] // for completeness
    }
    const isHashtag = item.startsWith('#')
    let notesToSearch = notesToSearchIn
    if (alsoSearchCalendarNotes) {
      notesToSearch = notesToSearch.concat(DataStore.calendarNotes)
    }
    // logDebug('NPnote/findNotesMatchingHashtagOrMentionFromList', `starting with ${notesToSearch.length} notes (${notesToSearchIn ? 'from the notesToSearchIn param' : 'from DataStore.projectNotes'} ${alsoSearchCalendarNotes ? '+ calendar notes)' : ')'}`)

    // const startTime = new Date()
    let projectNotesInFolder: Array<TNote>
    // If folder given (not empty) then filter using it
    if (folder && folder !== '') {
      if (includeSubfolders) {
        // use startsWith as filter to include subfolders
        projectNotesInFolder = notesToSearch.slice().filter((n) => n.filename.startsWith(`${folder}/`))
      } else {
        // use match as filter to exclude subfolders
        projectNotesInFolder = notesToSearch.slice().filter((n) => getFolderFromFilename(n.filename) === folder)
      }
    } else {
      // no folder specified, so grab all notes from DataStore
      projectNotesInFolder = notesToSearch.slice()
    }
    // logDebug(
    //   `NPnote/findNotesMatchingHashtagOrMentionFromList`,
    //   `item:${item} folder:${String(folder)} includeSubfolders:${String(includeSubfolders)} itemsToExclude:${String(itemsToExclude)} for ${String(
    //     projectNotesInFolder.length,
    //   )} notes`,
    // )

    // Filter by tag (and now mentions as well, if requested)
    // Note: now using the cut-down list of hashtags as the API returns partial duplicates
    let projectNotesWithItem: Array<TNote>
    if (caseInsensitiveMatch) {
      projectNotesWithItem = projectNotesInFolder.filter((n) => {
        const correctedHashtags = getCorrectedHashtagsFromNote(n)
        // if (correctedHashtags.length > 0) logDebug('NPnote/findNotesMatchingHashtagOrMentionFromList', `- ${n.filename}: has hashtags [${String(correctedHashtags)}]`)
        return isHashtag
          ? caseInsensitiveIncludes(item, correctedHashtags)
          : // $FlowIgnore[incompatible-call] only about $ReadOnlyArray
            caseInsensitiveIncludes(item, n.mentions)
      })
    } else {
      projectNotesWithItem = projectNotesInFolder.filter((n) => {
        const correctedHashtags = getCorrectedHashtagsFromNote(n)
        // if (correctedHashtags.length > 0) logDebug('NPnote/findNotesMatchingHashtagOrMentionFromList', `- ${n.filename}: has hashtags [${String(correctedHashtags)}]`)
        return isHashtag
          ? caseInsensitiveIncludes(item, correctedHashtags)
          : // $FlowIgnore[incompatible-call] only about $ReadOnlyArray
            caseInsensitiveIncludes(item, n.mentions)
      })
    }
    if (projectNotesWithItem.length > 0) {
      // logDebug('NPnote/findNotesMatchingHashtagOrMentionFromList',`In folder '${folder ?? '<all>'}' found ${projectNotesWithItem.length} notes matching '${tag}': [${String(projectNotesWithItem.map((a) => a.title ?? a.filename ?? '?'))}]`)
      logDebug('NPnote/findNotesMatchingHashtagOrMentionFromList', `In folder '${folder ?? '<all>'}' found ${projectNotesWithItem.length} notes matching '${item}'`)
    }

    // If we care about the excluded tag, then further filter out notes where it is found
    if (itemsToExclude.length > 0) {
      const doesNotMatchItemsToExclude = (e: string) => !itemsToExclude.includes(e)
      const projectNotesWithItemWithoutExclusion = projectNotesWithItem.filter((n) => n.hashtags.some(doesNotMatchItemsToExclude))
      const removedItems = projectNotesWithItem.length - projectNotesWithItemWithoutExclusion.length
      if (removedItems > 0) {
        // logDebug('NPnote/findNotesMatchingHashtagOrMentionFromList', `- but removed ${removedItems} excluded notes:`)
        // logDebug('NPnote/findNotesMatchingHashtagOrMentionFromList', `= ${String(projectNotesWithItem.filter((n) => n.hashtags.includes(tagToExclude)).map((m) => m.title))}`)
      }
      return projectNotesWithItemWithoutExclusion
    } else {
      return projectNotesWithItem
    }
  } catch (err) {
    logError('NPnote/findNotesMatchingHashtagOrMentionFromList', err.message)
    return []
  }
}

/**
 * Get list of headings from a note, optionally including markdown markers.
 * Note: If the first 'title' line matches the note title, then skip it (as it's the title itself).
 * Note: There is no right-trimming of the heading text, as this can cause problems with NP API calls which don't do trimming when you expect they would.
 * @author @dwertheimer (adapted from @jgclark)
 *
 * @param {TNote} note - note to get headings from
 * @param {boolean} includeMarkdown - whether to include markdown markers in the headings
 * @param {boolean} optionAddATopAndtBottom - whether to add 'top of note' and 'bottom of note' options. Default: true.
 * @param {boolean} optionCreateNewHeading - whether to offer to create a new heading at top or bottom of note. Default: false.
 * @param {boolean} includeArchive - whether to include headings in the Archive section of the note (i.e. after 'Done'). Default: false.
 * @return {Array<string>}
 */
export function getHeadingsFromNote(
  note: TNote,
  includeMarkdown: boolean = false,
  optionAddATopAndtBottom: boolean = true,
  optionCreateNewHeading: boolean = false,
  includeArchive: boolean = false,
): Array<string> {
  let headingStrings = []
  const spacer = '#'
  let headingParas: Array<TParagraph> = []
  const indexEndOfActive = findEndOfActivePartOfNote(note)
  if (includeArchive) {
    headingParas = note.paragraphs.filter((p) => p.type === 'title' && p.lineIndex < indexEndOfActive)
  } else {
    headingParas = note.paragraphs.filter((p) => p.type === 'title')
  }

  // If this is the title line, skip it
  if (headingParas.length > 0) {
    if (headingParas[0].content === note.title) {
      headingParas = headingParas.slice(1)
    }
  }
  if (headingParas.length > 0) {
    headingStrings = headingParas.map((p) => {
      let prefix = ''
      for (let i = 0; i < p.headingLevel; i++) {
        prefix += spacer
      }
      return `${prefix} ${p.content.trimLeft()}`
    })
  }
  if (optionCreateNewHeading) {
    if (note.type === 'Calendar') {
      headingStrings.unshift('➕#️⃣ (first insert new heading at the start of the note)')
    } else {
      headingStrings.unshift(`➕#️⃣ (first insert new heading under the title)`)
    }
    headingStrings.push(`➕#️⃣ (first insert new heading at the end of the note)`)
  }
  if (optionAddATopAndtBottom) {
    headingStrings.unshift('⏫ (top of note)')
    headingStrings.push('⏬ (bottom of note)')
  }
  if (headingStrings.length === 0) {
    return ['']
  }
  if (!includeMarkdown) {
    headingStrings = headingStrings.map((h) => h.replace(/^#{1,5}\s*/, '')) // remove any markdown heading markers
  }
  return headingStrings
}

/**
 * Return a standardised safe filepath for a regular note, to match its title.
 * Note: it's not explicity stated (I think), but filenames shouldn't start with a '/' character.
 * Substitutes '\/:*?@$"<>|' characters in filename with '_' to avoid problems in Apple or NTFS filesystems.
 * Additionally, filenames cannot end with a period (.) or a space, although these characters can be used within the filename itself.
 * @author @Leo, improved by @jgclark
 * @param {TNote} note
 * @returns {string} filepath
 */
export function getFSSafeFilenameFromNoteTitle(note: TNote): string {
  const { defaultFileExtension } = DataStore

  // If this is a Calendar note, then give a warning, but return the filename as is.
  if (note.type === 'Calendar') {
    logWarn('getFSSafeFilenameFromNoteTitle', `Shouldn't be called on Calendar notes. Returning ${note.filename} filename as is.`)
    return note.filename
  }

  // Get the folder name from the filename.
  // Note: if in root folder, then justFolderName will be '/'
  const justFolderName = getFolderFromFilename(note.filename)

  // Get new title for note, though with any '/:@$' replaced with '_'
  if (!note.title) {
    logWarn('getFSSafeFilenameFromNoteTitle', `No title found in note ${note.filename}. Returning empty string.`)
    return ''
  }
  let filesystemSafeTitle = note.title
    .trim()
    .replaceAll('\\', '_')
    .replaceAll('/', '_')
    .replaceAll('@', '_')
    .replaceAll('$', '_')
    .replaceAll(':', '_')
    .replaceAll('*', '_')
    .replaceAll('?', '_')
    .replaceAll('"', '_')
    .replaceAll('<', '_')
    .replaceAll('>', '_')
    .replaceAll('|', '_')
  // Replace multiple underscores with a single underscore
  filesystemSafeTitle = filesystemSafeTitle.replace(/_+/g, '_')
  if (filesystemSafeTitle !== '') {
    const newName = justFolderName !== '/'
      ? `${justFolderName}/${filesystemSafeTitle}.${defaultFileExtension}`
      : `${filesystemSafeTitle}.${defaultFileExtension}`
    return newName
  } else {
    logWarn('NPnote.js', `getFSSafeFilenameFromNoteTitle(): No title found in note ${note.filename}. Returning empty string.`)
    return ''
  }
}

/**
 * Get or create the relevant regular note in the given folder (not calendar notes)
 * Note: titles with # characters are stripped out first, as they are stripped out by NP when reporting a note.title
 * If it makes a new note, it will add the title first.
 * TODO: is this teamspace-aware?
 * @author @jgclark
 *
 * @param {string} noteTitle - title of note to look for
 * @param {string} noteFolder - folder to look in (must be full path or "/")
 * @param {boolean?} partialTitleToMatch - optional partial note title to use with a starts-with not exact match
 * @returns {Promise<TNote>} - note object
 */
export async function getOrMakeRegularNoteInFolder(noteTitle: string, noteFolder: string, partialTitleToMatch: string = ''): Promise<?TNote> {
  logDebug('note / getOrMakeRegularNoteInFolder', `starting with noteTitle '${noteTitle}' / folder '${noteFolder}' / partialTitleToMatch ${partialTitleToMatch}`)
  let existingNotes: $ReadOnlyArray<TNote> = []

  // If we want to do a partial match, see if matching note(s) have already been created (ignoring @Archive and @Trash)
  if (partialTitleToMatch) {
    const partialTestString = partialTitleToMatch.split('#').join('')
    const allNotesInFolder = getRegularNotesInFolder(noteFolder)
    existingNotes = allNotesInFolder.filter((f) => f.title?.startsWith(partialTestString))
    logDebug('note / getOrMakeRegularNoteInFolder', `- found ${existingNotes.length} existing partial '${partialTestString}' note matches`)
  } else {
    // Otherwise do an exact match on noteTitle
    const potentialNotes = DataStore.projectNoteByTitle(noteTitle, true, false) ?? []
    // now filter out wrong folders
    existingNotes = potentialNotes && noteFolder !== '/' ? potentialNotes.filter((n) => n.filename.startsWith(noteFolder)) : potentialNotes
    logDebug('note / getOrMakeRegularNoteInFolder', `- found ${existingNotes.length} existing '${noteTitle}' note(s)`)
  }

  if (existingNotes.length > 0) {
    logDebug('note / getOrMakeRegularNoteInFolder', `- first matching note filename = '${existingNotes[0].filename}'`)
    return existingNotes[0] // return the only or first match (if more than one)
  } else {
    logDebug('note / getOrMakeRegularNoteInFolder', `- found no existing notes, so will try to make one`)
    // no existing note, so need to make a new one
    const noteFilename = await DataStore.newNote(noteTitle, noteFolder)
    // NB: filename here = folder + filename
    if (noteFilename != null && noteFilename !== '') {
      logDebug('note / getOrMakeRegularNoteInFolder', `- newNote filename: ${String(noteFilename)}`)
      const note = await DataStore.projectNoteByFilename(noteFilename)
      if (note != null) {
        return note
      } else {
        logError('note / getOrMakeRegularNoteInFolder', `can't read new ${noteTitle} note`)
        return
      }
    } else {
      logError('note / getOrMakeRegularNoteInFolder', `empty filename of new ${noteTitle} note`)
      return
    }
  }
}

/**
 * Get or create the relevant calendar note
 * TODO: make teamspace-aware
 * @author @jgclark
 *
 * @param {string} calendarDateStr - date string to look for (e.g. '20250726' or '2025-W30')
 * @returns {TNote} - note object
 */
export function getOrMakeCalendarNote(calendarDateStr: string): ?TNote {
  try {
    logDebug('NPnote/getOrMakeCalendarNote', `starting with calendarDateStr '${calendarDateStr}'`)
    let dateStrToUse = calendarDateStr
    // First convert from ISO to calendar filename format if needed
    if (dt.isDailyDateStr(calendarDateStr)) {
      dateStrToUse = dt.convertISOToYYYYMMDD(calendarDateStr)
    }
    if (!dt.isValidCalendarNoteFilenameWithoutExtension(dateStrToUse)) {
      throw new Error(`Invalid calendar date string: ${dateStrToUse}`)
    }

    const calendarNote: ?TNote = DataStore.calendarNoteByDateString(dateStrToUse)
    if (!calendarNote) {
      throw new Error(`Cannot find or make calendar note for ${calendarDateStr}, for reasons I don't understand.`)
    }

    // If the note has no content -- which it will if the note hasn't been created before now -- set it to empty string
    if (!calendarNote?.content) {
      logWarn('NPnote/getOrMakeCalendarNote', `Calendar note ${dateStrToUse} has no defined content. Will set it to empty string.`)
      calendarNote.content = ''
    }
    return calendarNote
  } catch (err) {
    logError('NPnote/getOrMakeCalendarNote', `${err.name}: ${err.message}`)
    return null
  }
}