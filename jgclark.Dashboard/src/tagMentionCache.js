// @flow
//-----------------------------------------------------------------------------
// Cache helper functions for Dashboard
// last updated 2025-04-11 for v2.3.0.a1
//-----------------------------------------------------------------------------

/**
 * Note: In a weird development (literally), I (JGC) found that a refactor of the original findNotesWithMatchingHashtag() suddenly made it now as fast, if not faster, as this new Cache.
 * I didn't take out any code, so I'm mystified. 
 * But not complaining, particularly as this still had some work required.
 */

import moment from 'moment/min/moment-with-locales'
import type { TPerspectiveDef } from './types'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { clo, clof, JSP, log, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import { CaseInsensitiveSet } from '@helpers/general'
import { getNotesChangedInInterval } from '@helpers/NPnote'
import {
  caseInsensitiveIncludes,
  caseInsensitiveStartsWith,
} from '@helpers/search'

//--------------------------------------------------------------------------

const wantedTagMentionsList = 'wantedTagMentionsList.json'
const tagMentionCacheFile = 'tagMentionCache.json'
// const tagMentionTodayCacheFile = 'tagMentionTodayCache.json'
const lastTimeThisWasRunPref = 'jgclark.Dashboard.tagMentionCache.lastTimeUpdated'

//-----------------------------------------------------------------
// exported Getter and setter functions

/**
 * Get the list of wanted mentions and tags from the wantedTagMentionsList.json file.
 * @returns {Object} An object containing the list of mentions and tags. { "mentions": [...], "tags": [...] }
 */
export function getTagMentionCacheDefinitions(): any {
  if (DataStore.fileExists(wantedTagMentionsList)) {
    const data = DataStore.loadData(wantedTagMentionsList, true) ?? ''
    const parsedData = JSON.parse(data)
    return parsedData
  } else {
    return { "mentions": [], "tags": [] }
  }
}

/**
 * Add a new mention or tag to the wantedTagMentionsList.json file.
 * @param {string} mentionOrTag The mention or tag to add.
 */
export function addTagMentionCacheDefinition(mentionOrTag: string): void {
  const cache = getTagMentionCacheDefinitions()
  // If the first character is a #, add to tags, otherwise add to mentions
  // But only add if it's not already in the list
  if (mentionOrTag.startsWith('#')) {
    if (!cache.tags.includes(mentionOrTag)) {
      cache.tags.push(mentionOrTag)
    }
  } else {
    if (!cache.mentions.includes(mentionOrTag)) {
      cache.mentions.push(mentionOrTag)
    }
  }
  DataStore.saveData(JSON.stringify(cache), wantedTagMentionsList, true)
}

/**
 * Set the tag and mentions to the wantedTagMentionsList.json file.
 * Note: see following variant that works out all tags/mentions of interest given the current perspectives.
 * @param {Array<string>} tags The tags to set.
 * @param {Array<string>} mentions The mentions to set.
 */
export function setTagMentionCacheDefinitions(tags: Array<string>, mentions: Array<string>): void {
  const cache = {
    tags: tags,
    mentions: mentions,
  }
  DataStore.saveData(JSON.stringify(cache), wantedTagMentionsList, true)
  logInfo('setTagMentionCacheDefinitions', `Saved [${String(tags)}] tags and [${String(mentions)}] mentions to ${wantedTagMentionsList}`)
}

/**
 * Set the tag and mentions to the wantedTagMentionsList.json file based on the current perspectives.
 */
export function setTagMentionCacheDefinitionsFromAllPerspectives(allPerspectiveDefs: Array<TPerspectiveDef>): void {
  const { wantedTags, wantedMentions } = getWantedTagsAndMentionsFromAllPerspectives(allPerspectiveDefs)
  setTagMentionCacheDefinitions(wantedTags, wantedMentions)
}

/**
 * Returns a list of notes that contain the given tag or mention. 
 * It does so in a case-insensitive way, so asking for '@BOB' will find '@bob' and '@Bob'.
 * It does not do any filtering by para type.
 * @param {string} tagOrMention The tag or mention to search for.
 * @param {boolean} firstUpdateCache If true, the cache will be updated before the search is done. (Default: true)
 * @returns {Array<string>} An array of note filenames that contain the tag or mention.
 */
export async function getNotesWithTagOrMention(tagOrMentions: Array<string>, firstUpdateCache: boolean = true): Promise<Array<string>> {
  try {
    logDebug('getNotesWithTagMention', `Starting for tag/mention(s) [${String(tagOrMentions)}]${firstUpdateCache ? '. (First update cache)' : ''}`)
    if (firstUpdateCache) {
      await updateTagMentionCache()
    }
    const startTime = new Date()
    const cache = DataStore.loadData(tagMentionCacheFile, true) ?? ''
    const parsedCache = JSON.parse(cache)
    const regularNoteItems = parsedCache.regularNotes
    const calNoteItems = parsedCache.calendarNotes
    const lowerCasedTagOrMentions = tagOrMentions.map((item) => item.toLowerCase())

    // Get from Calendar notes using Cache
    let outputList = calNoteItems.filter((item) => item.tags.some((tag) => lowerCasedTagOrMentions.includes(tag))).map((item) => item.filename)
    outputList = outputList.concat(calNoteItems.filter((item) => item.mentions.some((tag) => lowerCasedTagOrMentions.includes(tag))).map((item) => item.filename))

    // Get from Regular notes using Cache
    outputList = outputList.concat(regularNoteItems.filter((item) => item.tags.some((tag) => lowerCasedTagOrMentions.includes(tag))).map((item) => item.filename))
    outputList = outputList.concat(regularNoteItems.filter((item) => item.mentions.some((tag) => lowerCasedTagOrMentions.includes(tag))).map((item) => item.filename))
    logTimer('getNotesWithTagMention', startTime, `- ${String(outputList.length)} notes found with wanted tag/mention [${String(tagOrMentions)}]:`, 400)
    // logDebug('getNotesWithTagMention', `For [${String(tagOrMentions)}] =>\n${outputList.join('\n')}`)
    return outputList
  }
  catch (err) {
    logError('getNotesWithTagMention', JSP(err))
    return []
  }
}

/**
 * Generate the mention tag cache from scratch.
 * Writes all instances of wanted mentions and tags (from the wantedTagMentionsList) to the tagMentionCacheFile, by filename.
 * Note: this includes all calendar notes, and all regular notes, apart from those in special folders (starts with '@'), including @Templates, @Archive and @Trash folders.
 */
export async function generateTagMentionCache(): Promise<void> {
  try {
    const startTime = new Date()
    const wantedMentions = getTagMentionCacheDefinitions().mentions
    const wantedTags = getTagMentionCacheDefinitions().tags
    logDebug('generateTagMentionCache', `Starting with wantedMentions:[${wantedMentions}] and wantedTags:[${wantedTags}]`)

    // Start backgroud thread
    await CommandBar.onAsyncThread()

    // Get all notes to scan
    const allCalNotes = DataStore.calendarNotes
    const allRegularNotes = DataStore.projectNotes.filter((note) => !note.filename.startsWith('@'))
    logTimer('generateTagMentionCache', startTime, `- processing ${allCalNotes.length} calendar notes + ${allRegularNotes.length} regular notes ...`)

    // Iterate over all notes and get all open paras with tags and mentions
    const calWantedItems = []
    let ccal = 0
    for (const note of allCalNotes) {
      const foundWantedTags = (wantedTags.length > 0) ? getWantedTagListFromNote(note, wantedTags) : []
      // if (foundWantedTags.length > 0) logDebug('generateTagMentionCache', `-> ${String(foundWantedTags.length)} foundWantedTags [${String(foundWantedTags)}] calWantedTags`)
      const foundWantedMentions = (wantedMentions.length > 0) ? getWantedMentionListFromNote(note, wantedMentions) : []
      if (foundWantedTags.length > 0 || foundWantedMentions.length > 0) {
        calWantedItems.push({ filename: note.filename, tags: foundWantedTags, mentions: foundWantedMentions })
        ccal++
      }
    }
    const regularWantedItems = []
    let creg = 0
    for (const note of allRegularNotes) {
      const foundWantedTags = (wantedTags.length > 0) ? getWantedTagListFromNote(note, wantedTags) : []
      // if (foundWantedTags.length > 0) logDebug('generateTagMentionCache', `-> ${String(foundWantedTags.length)} foundWantedTags [${String(foundWantedTags)}] regularWantedTags`)
      const foundWantedMentions = (wantedMentions.length > 0) ? getWantedMentionListFromNote(note, wantedMentions) : []
      if (foundWantedTags.length > 0 || foundWantedMentions.length > 0) {
        regularWantedItems.push({ filename: note.filename, tags: foundWantedTags, mentions: foundWantedMentions })
        creg++
      }
    }
    logTimer('generateTagMentionCache', startTime, `to find ${ccal} calendar notes with wanted items / ${creg} regular notes with wanted items`)

    // Save the filteredMentions and filteredTags to the mentionTagCacheFile
    const cache = {
      regularNotes: regularWantedItems,
      calendarNotes: calWantedItems,
    }

    // Finish backgroud thread
    await CommandBar.onMainThread()

    DataStore.saveData(JSON.stringify(cache), tagMentionCacheFile, true)
    logTimer('generateTagMentionCache', startTime, `- after saving to mentionTagCacheFile`)
  } catch (err) {
    logError('generateTagMentionCache', JSP(err))
  }
}

/**
 * Update the tagMentionCacheFile.
 * It works smartly: it only recalculates notes that have been updated since the last time this was run, according to JS date saved in 'lastTimeThisWasRunPref'.
 */
export async function updateTagMentionCache(): Promise<void> {
  try {
    const startTime = new Date() // just for timing this function

    // Read current list from tagMentionCacheFile, and get time of it.
    // Note: can't get a timestamp from plugin files, so need to use a separate preference
    logDebug('updateTagMentionCache', `About to read ${tagMentionCacheFile} ...`)
    if (!DataStore.fileExists(tagMentionCacheFile)) {
      logWarn('updateTagMentionCache', `${tagMentionCacheFile} file does not exist, so re-generating the cache from scratch.`)
      await generateTagMentionCache()
      return
    }

    // Get the list of wanted tags and mentions
    const { wantedTags: wantedTags, wantedMentions: wantedMentions } = getTagMentionCacheDefinitions()

    const data = DataStore.loadData(tagMentionCacheFile, true) ?? ''
    const cache = JSON.parse(data)
    // existingCache.forEach((item) => {
    //   changedNoteMap.set(item.filename, {
    //     lastUpdated: new Date(item.lastUpdated),
    //     completedTasks: item.completedTasks,
    //   })
    // })

    // Get last updated time from special preference
    const previousJSDate = DataStore.preference(lastTimeThisWasRunPref) ?? null
    if (!previousJSDate) {
      throw new Error(`No previous cache update time found (as pref '${lastTimeThisWasRunPref}' appears not to be set)`)
    }
    const momPrevious = moment(previousJSDate)
    const momNow = moment()
    const fileAgeMins = momNow.diff(momPrevious, 'minutes')
    logDebug('updateTagMentionCache', `Last updated ${fileAgeMins.toFixed(3)} mins ago (previous time: ${momPrevious.format()} / now time: ${momNow.format()})`)

    // Find all notes updated since the last time this was run
    const jsdateToStartLooking = momPrevious.toDate()
    const numDaysBack = momPrevious.diff(momNow, 'days', true) // don't round to nearest integer
    const recentlychangedNotes = getNotesChangedInInterval(numDaysBack).filter((n) => n.changedDate >= jsdateToStartLooking)
    logDebug('updateTagMentionCache', `Found ${recentlychangedNotes.length} changed notes in that time`)

    // For each note, get wanted tags and mentions, and overwrite the existing cache details
    let c = 0
    for (const note of recentlychangedNotes) {
      // Work out if this note is a calendar note or a regular note
      const isCalendarNote = note.type === 'Calendar'

      // First clear existing details for this note
      logDebug('updateTagMentionCache', `- deleting existing items for recently changed file '${note.filename}'`)
      if (isCalendarNote) {
        cache.calendarNotes = cache.calendarNotes.filter((item) => item.filename !== note.filename)
      } else {
        cache.regularNotes = cache.regularNotes.filter((item) => item.filename !== note.filename)
      }

      // Then get wanted tags and mentions, and add them
      const foundWantedTags = getWantedTagListFromNote(note, wantedTags)
      if (foundWantedTags.length > 0) logDebug('updateTagMentionCache', `-> ${String(foundWantedTags.length)} foundWantedTags [${String(foundWantedTags)}] calWantedTags`)
      const foundWantedMentions = getWantedMentionListFromNote(note, wantedMentions)
      if (foundWantedMentions.length > 0) logDebug('updateTagMentionCache', `-> ${String(foundWantedMentions.length)} foundWantedMentions [${String(foundWantedMentions)}] calWantedMentions`)
      if (foundWantedTags.length > 0 || foundWantedMentions.length > 0) {
        if (isCalendarNote) {
          cache.calendarNotes.push({ filename: note.filename, tags: foundWantedTags, mentions: foundWantedMentions })
        } else {
          cache.regularNotes.push({ filename: note.filename, tags: foundWantedTags, mentions: foundWantedMentions })
        }
        c++
      }
    }
    logTimer('updateTagMentionCache', startTime, `-> ${c} recently changed notes with wanted items`)

    DataStore.saveData(JSON.stringify(cache), tagMentionCacheFile, true)
    logTimer('updateTagMentionCache', startTime, `- after saving to mentionTagCacheFile`)

    // Update the preference for current time
    DataStore.setPreference(lastTimeThisWasRunPref, new Date())
    logDebug('updateTagMentionCache', `pref is now ${moment(DataStore.preference(lastTimeThisWasRunPref)).format()}`)

    logTimer(`updateTagMentionCache`, startTime, `total runtime`, 1000)
    return
  } catch (err) {
    logError('updateTagMentionCache', err.message)
    return
  }
}

//-----------------------------------------------------------------
// private helper functions

/**
 * Get list of any of the wanted tags that appear in this note. Note: does not do filtering by para type.
 * @param {TNote} note 
 * @param {Array<string>} wantedItems 
 * @returns 
 */
export function getWantedTagListFromNote(note: TNote, wantedItems: Array<string>): Array<string> {
  try {
    if (wantedItems.length === 0) {
      logWarn('getWantedTagListFromNote', `Starting, with empty wantedItems params`)
      return []
    }

    const output: Array<string> = []
    // Ask API for all seen tags in this note, and reverse them
    const seenTags = note.hashtags.slice().reverse()
    let lastTag = ''
    for (const tag of seenTags) {
      // if this tag is starting subset of the last one, assume this is an example of the bug, so skip this tag
      if (caseInsensitiveStartsWith(tag, lastTag)) {
        // logDebug('getWantedTagListFromNote', `- Found ${tag} but ignoring as part of a longer hashtag of the same name`)
      }
      else {
        // check this is one of the ones we're after, then add
        if (caseInsensitiveIncludes(tag, wantedItems)) {
          // logDebug('getWantedTagListFromNote', `- Found matching occurrence ${tag} on date ${n.filename}`)
          output.push(tag)
        }
      }
      lastTag = tag
    }

    // Now create (case-insensitive) set of the tags
    const tagSet = new CaseInsensitiveSet(output)
    const distinctTags: Array<string> = [...tagSet]
    if (output.length > 0) {
      logDebug('getWantedTagListFromNote', `→ ${String(distinctTags.length)} distinct tags found from ${String(output.length)} instances in ${String(note.filename)}`)
    }
    return distinctTags
  } catch (err) {
    logError('getWantedTagListFromNote', JSP(err))
    return []
  }
}

/**
 * Get list of any of the wanted mentions that appear in this note. Note: does not do filtering by para type.
 * @param {TNote} note 
 * @param {Array<string>} wantedItems 
 * @returns 
 */
export function getWantedMentionListFromNote(note: TNote, wantedItems: Array<string>): Array<string> {
  try {
    if (wantedItems.length === 0) {
      logWarn('getWantedMentionListFromNote', `Starting, with empty wantedItems params`)
      return []
    }
    const output: Array<string> = []
    // Ask API for all seen mentions in this note, and reverse them
    const seenMentions = note.mentions.slice().reverse()
    let lastMention = ''
    for (const mention of seenMentions) {
      // if this mention is starting subset of the last one, assume this is an example of the bug, so skip this mention
      if (caseInsensitiveStartsWith(mention, lastMention)) {
        // logDebug('getWantedMentionListFromNote', `- Found ${mention} but ignoring as part of a longer hashmention of the same name`)
      }
      else {
    // check this is one of the ones we're after, then add
        // FIXME: can get undefined is not an object (evaluating 'arrayToSearch.filter') in this line
        if (caseInsensitiveIncludes(mention, wantedItems)) {
          // logDebug('getWantedMentionListFromNote', `- Found matching occurrence ${mention} on date ${n.filename}`)
          output.push(mention)
        }
      }
      lastMention = mention
    }

    // Now create (case-insensitive) set of the mentions
    const mentionSet = new CaseInsensitiveSet(output)
    const distinctMentions: Array<string> = [...mentionSet]
    if (output.length > 0) {
      logDebug('getWantedMentionListFromNote', `→ ${String(distinctMentions.length)} distinct mentions found from ${String(output.length)} instances in ${String(note.filename)}`)
    }
    return distinctMentions
  } catch (err) {
    logError('getWantedMentionListFromNote', JSP(err))
    return []
  }
}


/**
 * Get the list of wanted tags and mentions from all perspectives.
 * Note: moved from perspectiveHelpers.js to here to avoid circular dependency.
 * @returns {Object} An object containing the list of mentions and tags. { "mentions": [...], "tags": [...] }
 */
function getWantedTagsAndMentionsFromAllPerspectives(allPerspectives: Array<TPerspectiveDef>): { wantedTags: Array<string>, wantedMentions: Array<string> } {
  const wantedTags = new Set < string > ()
  const wantedMentions = new Set < string > ()
  for (const perspective of allPerspectives) {
    logDebug('getWantedTagsAndMentionsFromAllPerspectives', `- reading perspective: [${String(perspective.name)}]`)
    const tagsAndMentionsStr = perspective.dashboardSettings.tagsToShow ?? ''
    const tagsAndMentionsArr = stringListOrArrayToArray(tagsAndMentionsStr, ',')
    tagsAndMentionsArr.forEach((torm) => {
      if (torm.startsWith('@')) {
        wantedMentions.add(torm)
      } else {
        wantedTags.add(torm)
      }
    })
  }
  logDebug('', `=> wantedTags: ${String(Array.from(wantedTags))}`)
  logDebug('', `=> wantedMentions: ${String(Array.from(wantedMentions))}`)
  return { wantedTags: Array.from(wantedTags), wantedMentions: Array.from(wantedMentions) }
}
