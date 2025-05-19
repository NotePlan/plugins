// @flow
//-----------------------------------------------------------------------------
// Cache helper functions for Dashboard
// last updated 2025-05-15 for v2.3.0, @jgclark
//-----------------------------------------------------------------------------
// Cache structure (JSON file):
// {
//   generatedAt: new Date(),
//   lastUpdated: new Date(),
//   wantedItems: ['@Alice', '@Bob'],
//   regularNotes: [{filename: 'note1.md', items: ['@BOB', '@BOB2']}, {filename: 'note2.md', items: ['@BOB']}],
//   calendarNotes: [{filename: 'note3.md', items: ['#BOB']}, {filename: 'note4.md', items: ['#BOB']}],
// }
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
// import { getDashboardSettings } from './dashboardHelpers'
import type { TPerspectiveDef } from './types'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { clo, clof, JSP, log, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import { CaseInsensitiveSet, displayTitle, percent } from '@helpers/general'
import { getFrontMatterAttribute, noteHasFrontMatter } from '@helpers/NPFrontMatter'
import { findNotesMatchingHashtagOrMention, getNotesChangedInInterval } from '@helpers/NPnote'
import {
  caseInsensitiveIncludes,
  caseInsensitiveMatch,
  caseInsensitiveStartsWith,
  caseInsensitiveSubstringMatch,
} from '@helpers/search'

//--------------------------------------------------------------------------
// Constants

const wantedTagMentionsListFile = 'wantedTagMentionsList.json'
const tagMentionCacheFile = 'tagMentionCache.json'
const lastTimeThisWasRunPref = 'jgclark.Dashboard.tagMentionCache.lastTimeUpdated'

// TODO(later): remove these in time
const turnOnAPIComparison = true
const TAG_CACHE_ONLY_FOR_OPEN_ITEMS = false
const TAG_CACHE_ON_ALL_OPEN_ITEMS = false // if true, then will cache all open items, otherwise will cache only the wanted items
// If TAG_CACHE_ON_ALL_OPEN_ITEMS is true, then will use this 'blacklist' of tags/mentions
const EXCLUDED_TAGS_OR_MENTIONS = ['@done', '@start', '@review', '@completed']

//-----------------------------------------------------------------
// exported Getter and setter functions

/**
 * Get the list of wanted mentions and tags from the wantedTagMentionsList.json file.
 * @returns {Array<string>} An array containing the list of mentions and tags
 */
export function getTagMentionCacheDefinitions(): Array<string> {
  if (DataStore.fileExists(wantedTagMentionsListFile)) {
    const data = DataStore.loadData(wantedTagMentionsListFile, true) ?? ''
    const parsedData = JSON.parse(data)
    return parsedData.items
  } else {
    return []
  }
}

/**
 * Add a new mention or tag to the wantedTagMentionsList.json file.
 * @param {string} mentionOrTag The mention or tag to add.
 */
export function addTagMentionCacheDefinition(mentionOrTagIn: string): void {
  const mentionOrTag = mentionOrTagIn.trim()
  const itemList: Array<string> = getTagMentionCacheDefinitions()
  // But only add if it's not already in the list
  if (!itemList.includes(mentionOrTag)) {
    itemList.push(mentionOrTag)
  }
  DataStore.saveData(JSON.stringify({ items: itemList }), wantedTagMentionsListFile, true)
}

/**
 * Set the tag and mentions to the wantedTagMentionsList.json file.
 * Note: see following variant that works out all tags/mentions of interest given the current perspectives.
 * @param {Array<string>} items The items to set.
 */
export function setTagMentionCacheDefinitions(items: Array<string>): void {
  const cache = {
    items: items,
  }
  DataStore.saveData(JSON.stringify(cache), wantedTagMentionsListFile, true)
  logInfo('setTagMentionCacheDefinitions', `Saved [${String(items)}] items to ${wantedTagMentionsListFile}`)
}

/**
 * Set the tag and mentions to the wantedTagMentionsList.json file based on the current perspectives.
 */
export function setTagMentionCacheDefinitionsFromAllPerspectives(allPerspectiveDefs: Array<TPerspectiveDef>): void {
  const wantedItems = getListOfWantedTagsAndMentionsFromAllPerspectives(allPerspectiveDefs)
  setTagMentionCacheDefinitions(wantedItems)
}

/**
 * Use tagMentionCache to returns a list of notes that contain the given tags and/or mentions.
 * It does so in a case-insensitive way, so asking for '@BOB' will find '@bob' and '@Bob'.
 * It does not do any filtering by para type.
 * @param {Array<string>} tagOrMentions The tags and/or mentions to search for.
 * @param {boolean} firstUpdateCache If true, the cache will be updated before the search is done. (Default: true)
 * @returns {Array<string>} An array of note filenames that contain the tag or mention.
 */
export async function getFilenamesOfNotesWithTagOrMentions(tagOrMentions: Array<string>, firstUpdateCache: boolean = true): Promise<Array<string>> {
  try {
    logInfo('getFilenamesOfNotesWithTagOrMentions', `Starting for tag/mention(s) [${String(tagOrMentions)}]${firstUpdateCache ? '. (First update cache)' : ''}`)

    // Warn if we're asked for a tag/mention that's not in the wantedTagMentionsList.json file, and if so, add it to the list and then regenrate the cache.
    const wantedItems = getTagMentionCacheDefinitions()
    const missingItems = tagOrMentions.filter((item) => !wantedItems.includes(item))
    if (missingItems.length > 0) {
      logWarn('getFilenamesOfNotesWithTagOrMentions', `Warning: the following tags/mentions are not in the wantedTagMentionsList.json filename: [${String(missingItems)}]. I will add them to the list and then regenerate the cache.`)
      setTagMentionCacheDefinitions(wantedItems.concat(missingItems))
      await generateTagMentionCache(true)
    } else {
      // Update the cache if requested
      if (firstUpdateCache) {
        await updateTagMentionCache()
      }
    }

    // Get the cache contents
    const startTime = new Date()
    const cache = DataStore.loadData(tagMentionCacheFile, true) ?? ''
    const parsedCache = JSON.parse(cache)
    const regularNoteItems = parsedCache.regularNotes
    const calNoteItems = parsedCache.calendarNotes
    const lowerCasedTagOrMentions = tagOrMentions.map((item) => item.toLowerCase())

    // Get matching Calendar notes using Cache
    let matchingNoteFilenamesFromCache = calNoteItems.filter((line) => line.items.some((tag) => lowerCasedTagOrMentions.includes(tag))).map((item) => item.filename)

    // Get matching Regular notes using Cache
    // eslint-disable-next-line max-len
    matchingNoteFilenamesFromCache = matchingNoteFilenamesFromCache.concat(regularNoteItems.filter((line) => line.items.some((tag) => lowerCasedTagOrMentions.includes(tag))).map((item) => item.filename))
    // $FlowIgnore[unsafe-arithmetic]
    const cacheLookupTime = new Date() - startTime
    logTimer('getFilenamesOfNotesWithTagOrMentions', startTime, `-> found ${String(matchingNoteFilenamesFromCache.length)} notes from CACHE with wanted tags/mentions [${String(tagOrMentions)}]:`)

    // If wanted, compare the Cache results with API results
    if (turnOnAPIComparison) {
      const thisStartTime = new Date()
      let matchingNotesFromAPI: Array<TNote> = []
      for (const tagOrMention of tagOrMentions) {
        matchingNotesFromAPI = matchingNotesFromAPI.concat(findNotesMatchingHashtagOrMention(tagOrMention, true, true, true, []))
      }
      // $FlowIgnore[unsafe-arithmetic]
      const APILookupTime = new Date() - thisStartTime
      logTimer('getFilenamesOfNotesWithTagOrMentions', thisStartTime, `-> found ${matchingNotesFromAPI.length} notes from API with wanted tags/mentions [${String(tagOrMentions)}]`)

      logInfo('getFilenamesOfNotesWithTagOrMentions', `- CACHE took ${percent(cacheLookupTime, APILookupTime)} compared to API (${String(APILookupTime)}ms)`)
      // Compare the two lists and warn if different
      if (matchingNoteFilenamesFromCache.length !== matchingNotesFromAPI.length) {
        logError('getFilenamesOfNotesWithTagOrMentions', `- # notes from CACHE (${matchingNoteFilenamesFromCache.length}) !== API (${matchingNotesFromAPI.length})`)
        // Write a list of filenames that are in one but not the other
        const filenamesInCache = matchingNoteFilenamesFromCache
        const filenamesInAPI = matchingNotesFromAPI.map((n) => n.filename)
        // const filenamesInBoth = filenamesInCache.filter((f) => filenamesInAPI.includes(f))
        logError('getFilenamesOfNotesWithTagOrMentions', `- filenames in CACHE but not in API: ${filenamesInCache.filter((f) => !filenamesInAPI.includes(f)).join(', ')}`)
        logError('getFilenamesOfNotesWithTagOrMentions', `- filenames in API but not in CACHE: ${filenamesInAPI.filter((f) => !filenamesInCache.includes(f)).join(', ')}`)
      }
      else {
        logInfo('getFilenamesOfNotesWithTagOrMentions', `- 😃 # notes from CACHE (${matchingNoteFilenamesFromCache.length}) === API (${matchingNotesFromAPI.length})`)
      }
    }
    return matchingNoteFilenamesFromCache
  }
  catch (err) {
    logError('getFilenamesOfNotesWithTagOrMentions', JSP(err))
    return []
  }
}

/**
 * Generate the mention tag cache from scratch.
 * Writes all instances of wanted mentions and tags (from the wantedTagMentionsList) to the tagMentionCacheFile, by filename.
 * Note: this includes all calendar notes, and all regular notes, apart from those in special folders (starts with '@'), including @Templates, @Archive and @Trash folders.
 * @param {boolean} forceRebuild If true, the cache will be rebuilt from scratch, otherwise it will revert to the quicker 'updateTagMentionCache' function if the wantedParaTypes are all already in the cache.
 */
export async function generateTagMentionCache(forceRebuild: boolean = true): Promise<void> {
  try {
    const startTime = new Date()
    const wantedItems = getTagMentionCacheDefinitions()
    // const config = await getDashboardSettings()
    logDebug('generateTagMentionCache', `Starting with wantedItems:[${String(wantedItems)}]${TAG_CACHE_ONLY_FOR_OPEN_ITEMS ? ' ONLY FOR OPEN ITEMS' : ' ON ANY PARA TYPE'}`)

    const wantedParaTypes = TAG_CACHE_ONLY_FOR_OPEN_ITEMS ? ['open', 'checklist', 'scheduled', 'checklistScheduled'] : []

    // If we're not forcing a rebuild, and the wantedParaTypes are the same as (or less than) what is in the cache, then use the quicker 'updateTagMentionCache' function
    if (!forceRebuild) {
      // Get wantedItems from the cache
      const existingCache = DataStore.loadData(tagMentionCacheFile, true) ?? ''
      const parsedCache = JSON.parse(existingCache) ?? {}
      const cachedWantedItems = parsedCache.wantedItems ?? []
      logInfo('generateTagMentionCache', `- cachedWantedItems: [${String(cachedWantedItems)}]`)
      if (wantedItems.every((item, index) => item === cachedWantedItems[index])) {
        logInfo('generateTagMentionCache', `- Not forcing a rebuild, and wantedParaTypes are all present already in the cache, so calling updateTagMentionCache() instead.`)
        await updateTagMentionCache()
        return
      } else {
        logDebug('generateTagMentionCache', `- rebuild not forced, but wanted items are different, so will rebuild cache.`)
      }
    }
    logDebug('generateTagMentionCache', `- forcing a cache rebuild`)

    // Start backgroud thread
    await CommandBar.onAsyncThread()

    // Get all notes to scan
    const allCalNotes = DataStore.calendarNotes
    const allRegularNotes = DataStore.projectNotes.filter((note) => !note.filename.startsWith('@'))
    logTimer('generateTagMentionCache', startTime, `- processing ${allCalNotes.length} calendar notes + ${allRegularNotes.length} regular notes ...`)

    // Iterate over all notes and get all open paras with tags and mentions
    // First, get all calendar notes ...
    const calWantedItems = []
    let ccal = 0
    logDebug('generateTagMentionCache', `- Processing ${allCalNotes.length} calendar notes ...`)
    for (const note of allCalNotes) {
      // Then get wanted/all tags and mentions, and add them
      let foundItems: Array<string> = []
      if (TAG_CACHE_ON_ALL_OPEN_ITEMS) {
        foundItems = getWantedTagOrMentionListFromNote(note, [], wantedParaTypes, true)
        // Remove any items that are in the blacklist
        if (EXCLUDED_TAGS_OR_MENTIONS.length > 0) {
          foundItems = foundItems.filter((item) => !EXCLUDED_TAGS_OR_MENTIONS.includes(item))
        }
      } else {
        foundItems = getWantedTagOrMentionListFromNote(note, wantedItems, wantedParaTypes, true)
      }
      if (foundItems.length > 0) {
        ccal++
        logDebug('generateTagMentionCache', `-> ${String(foundItems.length)} foundItems [${String(foundItems)}]`)
        calWantedItems.push({ filename: note.filename, items: foundItems })
      }
    }

    // ... then all regular notes.
    const regularWantedItems = []
    let creg = 0
    logDebug('generateTagMentionCache', `- Processing ${allRegularNotes.length} regular notes ...`)
    for (const note of allRegularNotes) {
      if (note.filename.includes('CCC Projects')) logInfo('generateTagMentionCache', `- Processing ${note.filename}`)
      // Then get wanted/all tags and mentions, and add them
      let foundItems: Array<string> = []
      if (TAG_CACHE_ON_ALL_OPEN_ITEMS) {
        foundItems = getWantedTagOrMentionListFromNote(note, [], wantedParaTypes, true)
        if (note.filename.includes('CCC Projects')) logDebug('generateTagMentionCache', `  - ${String(foundItems.length)} foundItems [${String(foundItems)}]`)
        // Remove any items that are in the blacklist
        if (EXCLUDED_TAGS_OR_MENTIONS.length > 0) {
          foundItems = foundItems.filter((item) => !EXCLUDED_TAGS_OR_MENTIONS.includes(item))
        }
      } else {
        foundItems = getWantedTagOrMentionListFromNote(note, wantedItems, wantedParaTypes, true)
      }
      if (foundItems.length > 0) {
        creg++
        logDebug('generateTagMentionCache', `-> ${String(foundItems.length)} foundItems [${String(foundItems)}]`)
        regularWantedItems.push({ filename: note.filename, items: foundItems })
      }
    }
    logTimer('generateTagMentionCache', startTime, `to find ${ccal} calendar notes with wanted items / ${creg} regular notes with wanted items`)

    // Save the filteredMentions and filteredTags to the mentionTagCacheFile
    const cache = {
      generatedAt: startTime,
      lastUpdated: startTime,
      wantedItems: wantedItems,
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
    // const config = await getDashboardSettings()
    const startTime = new Date() // just for timing this function

    // Read current list from tagMentionCacheFile, and get time of it.
    // Note: can't get a timestamp from plugin files, so need to use a separate preference
    logDebug('updateTagMentionCache', `About to read ${tagMentionCacheFile} ...`)
    if (!DataStore.fileExists(tagMentionCacheFile)) {
      logWarn('updateTagMentionCache', `${tagMentionCacheFile} file does not exist, so re-generating the cache from scratch.`)
      await generateTagMentionCache(true)
      return
    }
    // Get the list of wanted tags, mentions, and para types
    const wantedItems = getTagMentionCacheDefinitions()
    const wantedParaTypes = TAG_CACHE_ONLY_FOR_OPEN_ITEMS ? ['open', 'checklist', 'scheduled', 'checklistScheduled'] : []

    const data = DataStore.loadData(tagMentionCacheFile, true) ?? ''
    const cache = JSON.parse(data)

    // Get last updated time from special preference
    const previousJSDate = DataStore.preference(lastTimeThisWasRunPref) ?? null
    if (!previousJSDate) {
      logWarn('updateTagMentionCache', `No previous cache update time found (as pref '${lastTimeThisWasRunPref}' appears not to be set)`)
    }
    const momPrevious = moment(previousJSDate)
    const momNow = moment()
    const fileAgeMins = momNow.diff(momPrevious, 'minutes')
    logDebug('updateTagMentionCache', `Last updated ${fileAgeMins.toFixed(3)} mins ago (previous time: ${momPrevious.format()} / now time: ${momNow.format()})`)
    if (momNow.diff(momPrevious, 'seconds') < 3) {
      logInfo('updateTagMentionCache', `- Not updating cache as it was updated less than 3 seconds ago`)
      return
    }

    // Find all notes updated since the last time this was run
    const jsdateToStartLooking = momPrevious.toDate()
    const numDaysBack = momPrevious.diff(momNow, 'days', true) // don't round to nearest integer
    // Note: This operations takes >500ms for JGC
    const recentlychangedNotes = getNotesChangedInInterval(numDaysBack).filter((n) => n.changedDate >= jsdateToStartLooking)
    logTimer('updateTagMentionCache', startTime, `Found ${recentlychangedNotes.length} changed notes in that time`)

    // For each note, get wanted tags and mentions, and overwrite the existing cache details
    // Possible TODO: Idea: don't do filtering by wantedItems; it probably costs very little to keep track of them all, and then avoids more generations later
    let c = 0
    for (const note of recentlychangedNotes) {
      const isCalendarNote = note.type === 'Calendar'

      // First clear existing details for this note
      logDebug('updateTagMentionCache', `- removing existing items for recently changed file '${note.filename}'`)
      if (isCalendarNote) {
        cache.calendarNotes = cache.calendarNotes.filter((item) => item.filename !== note.filename)
      } else {
        cache.regularNotes = cache.regularNotes.filter((item) => item.filename !== note.filename)
      }

      // Then get either just-wanted or all-except-blacklist tags and mentions, and add them
      let foundWantedItems: Array<string> = []
      if (TAG_CACHE_ON_ALL_OPEN_ITEMS) {
        foundWantedItems = getWantedTagOrMentionListFromNote(note, [], wantedParaTypes, true)
        // Remove any items that are in the blacklist
        if (EXCLUDED_TAGS_OR_MENTIONS.length > 0) {
          foundWantedItems = foundWantedItems.filter((item) => !EXCLUDED_TAGS_OR_MENTIONS.includes(item))
        }
      } else {
        foundWantedItems = getWantedTagOrMentionListFromNote(note, wantedItems, wantedParaTypes, true)
      }
      if (foundWantedItems.length > 0) logDebug('updateTagMentionCache', `-> ${String(foundWantedItems.length)} foundWantedItems [${String(foundWantedItems)}] calWantedItems`)
      if (foundWantedItems.length > 0) {
        if (isCalendarNote) {
          cache.calendarNotes.push({ filename: note.filename, items: foundWantedItems })
        } else {
          cache.regularNotes.push({ filename: note.filename, items: foundWantedItems })
        }
        c++
      }
    }
    logTimer('updateTagMentionCache', startTime, `-> ${c} recently changed notes with wanted items`)

    // Update the last updated time and wanted items (which should be the same,)
    cache.lastUpdated = startTime
    cache.wantedItems = wantedItems

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

export function generateTagMentionCacheSummary(): string {
  const cache = DataStore.loadData(tagMentionCacheFile, true) ?? ''
  const parsedCache = JSON.parse(cache)
  const summary = `## Tag/Mention Cache Stats:
- Wanted items: ${getTagMentionCacheDefinitions().join(', ')}
- Generated at: ${parsedCache.generatedAt}
- Last updated: ${parsedCache.lastUpdated} (according to the cache file)
- Last updated: ${String(DataStore.preference(lastTimeThisWasRunPref))} (according to the preference)
- # Regular notes: ${parsedCache.regularNotes.length}
- # Calendar notes: ${parsedCache.calendarNotes.length}`
  return summary
}

/**
 * Get list of any of the 'wantedTagsOrMentions' tags/mentions that appear in this note. If this is empty, then will return all tags/mentions in the note.
 * Does filtering by para type, if 'wantedParaTypes' is provided, and is not empty.
 * If 'includeNoteTags' is true, include matching frontmatter tags in the results.
 * @param {TNote} note 
 * @param {Array<string>} wantedTagsOrMentions -- if empty array, then will return all tags/mentions in the note
 * @param {Array<string>?} wantedParaTypes?
 * @param {boolean?} includeNoteTags?
 * @returns {Array<string>} list of wanted tags/mentions found in the note
 */
export function getWantedTagOrMentionListFromNote(
  note: TNote,
  wantedTagsOrMentions: Array<string>,
  wantedParaTypes: Array<string> = [],
  includeNoteTags: boolean = false,
): Array<string> {
  try {
    // if (wantedTagsOrMentions.length === 0) {
    //   logWarn('getWantedTagListFromNote', `Starting, with empty wantedTagsOrMentions params`)
    //   return []
    // }

    // TAGS: 
    // Ask API for all seen tags in this note, and reverse them
    const allTagsInNote = note.hashtags.slice().reverse()
    const seenWantedTags: Array<string> = []
    let lastTag = ''
    for (const tag of allTagsInNote) {
      // if this tag is starting subset of the last one, assume this is an example of the bug, so skip this tag
      if (caseInsensitiveStartsWith(tag, lastTag)) {
        // logDebug('getWantedTagOrMentionListFromNote', `- Found ${tag} but ignoring as part of a longer hashtag of the same name`)
      }
      else {
        // check this is one of the ones we're after, then add
        if (wantedTagsOrMentions.length === 0 || caseInsensitiveIncludes(tag, wantedTagsOrMentions)) {
          // logDebug('getWantedTagOrMentionListFromNote', `- Found matching occurrence ${tag} on date ${n.filename}`)
          seenWantedTags.push(tag)
        }
      }
      lastTag = tag
    }

    // Now create (case-insensitive) deduped list of the tags
    const tagSet = new CaseInsensitiveSet(seenWantedTags)
    const distinctTags: Array<string> = [...tagSet]

    // MENTIONS:
    // Now ask API for all seen mentions in this note, and reverse them
    const allMentionsInNote = note.mentions.slice().reverse()
    const seenWantedMentions: Array<string> = []
    let lastMention = ''
    for (const mention of allMentionsInNote) {
      // if this mention is starting subset of the last one, assume this is an example of the bug, so skip this mention
      if (caseInsensitiveStartsWith(mention, lastMention)) {
        // logDebug('getWantedTagOrMentionListFromNote', `- Found ${mention} but ignoring as part of a longer mention of the same name`)
      }
      else {
        // check this is one of the ones we're after, then add
        if (wantedTagsOrMentions.length === 0 || caseInsensitiveIncludes(mention, wantedTagsOrMentions)) {
          // logDebug('getWantedTagOrMentionListFromNote', `- Found matching occurrence ${mention} on date ${n.filename}`)
          seenWantedMentions.push(mention)
        }
      }
      lastMention = mention
    }

    // Now create (case-insensitive) set of the mentions
    const mentionSet = new CaseInsensitiveSet(seenWantedMentions)
    const distinctMentions: Array<string> = [...mentionSet]

    // If FFlag_UseNoteTags is true, include the frontmatter tags in the results
    const seenWantedNoteTagsOrMentions: Array<string> = []
    if (includeNoteTags && noteHasFrontMatter(note)) {
      const frontmatterAttributes = note.frontmatterAttributes
      if (frontmatterAttributes && 'note-tag' in frontmatterAttributes) {
        const seenNoteTags = frontmatterAttributes['note-tag'].split(',')
        seenWantedNoteTagsOrMentions.push(...seenNoteTags.map((t) => t.trim()))
        logInfo('getWantedTagOrMentionListFromNote', `-> found and added ${String(seenNoteTags)} noteTags from FM in ${displayTitle(note)}`)
      }
    }

    let tagsAndMentions = distinctTags.concat(distinctMentions).concat(seenWantedNoteTagsOrMentions)

    // Restrict to certain para types, if wanted
    if (wantedParaTypes.length > 0) {
      tagsAndMentions = filterTagsOrMentionsInNoteByWantedParaTypesOrNoteTags(note, tagsAndMentions, wantedParaTypes, includeNoteTags)
    }

    if (tagsAndMentions.length > 0) {
      const distinctTagsAndMentions = [...new Set(tagsAndMentions)]
      // logDebug('getWantedTagOrMentionListFromNote', `-> ${String(distinctTagsAndMentions.length)} distinct tags/mentions found from ${String(seenWantedTagsOrMentions.length)} instances in ${String(note.filename)}`)
      return distinctTagsAndMentions
    } else {
      // logDebug('getWantedTagOrMentionListFromNote', `-> No wanted tags/mentions found in ${String(note.filename)}`)
      return []
    }
  } catch (err) {
    logError('getWantedTagOrMentionListFromNote', JSP(err))
    return []
  }
}

//-----------------------------------------------------------------
// private helper functions

/**
 * Filters tags or mentions ('items') seen in note to:
 * - wantedParagraphTypes
 * - matching note tags (i.e. frontmatter attribute 'note-tag') that matches the wanted tags or mentions
 * @param {TNote} note - The note to process
 * @param {Array<string>} items - The list of tags or mentions to filter
 * @param {Array<string>} wantedParaTypes - The paragraph types to allow
 * @param {boolean} allowNoteTags - Whether to allow tagsOrMentions from note tags
 * @returns {Array<string>} Filtered tagsOrMentions that match the criteria
 */
function filterTagsOrMentionsInNoteByWantedParaTypesOrNoteTags(
  note: TNote,
  tagsOrMentions: Array<string>,
  wantedParaTypes: Array<string>,
  allowNoteTags: boolean = false,
): Array<string> {
  try {
    // Get note tag from frontmatter if it exists
    const noteTagAttribute = getFrontMatterAttribute(note, 'note-tag')
    const noteTagList = noteTagAttribute ? stringListOrArrayToArray(noteTagAttribute, ',') : []
    if (noteTagList.length > 0) {
      logInfo('filterTagsOrMentionsInNoteByWantedParaTypesOrNoteTags', `Found noteTag(s): '${String(noteTagList)}' in ${note.filename}`)
    }

    // Filter items based on paragraph types and note tags
    const filteredItems = tagsOrMentions.filter(item => {
      const paragraphsWithItem = note.paragraphs.filter(p => caseInsensitiveSubstringMatch(item, p.content))
      const hasValidParagraphType = paragraphsWithItem.some(p => wantedParaTypes.includes(p.type))
      const hasMatchingNoteTag = allowNoteTags && noteTagList && noteTagList.some(tag => caseInsensitiveMatch(item, tag))

      return hasValidParagraphType || hasMatchingNoteTag
    })

    if (filteredItems.length > 0) {
      // logDebug('filterTagsOrMentionsInNoteByWantedParaTypesOrNoteTags', `Found ${filteredItems.length} distinct items from ${tagsOrMentions.length} instances in ${note.filename}`)
    }

    return filteredItems
  } catch (error) {
    logError('filterTagsOrMentionsInNoteByWantedParaTypesOrNoteTags', `Error filtering items in note ${note.filename}: ${error.message}`)
    return []
  }
}

/**
 * Get the list of wanted tags and mentions from all perspectives.
 * Note: moved from perspectiveHelpers.js to here to avoid circular dependency.
 * @param {Array<TPerspectiveDef>} allPerspectives
 * @returns {Array<string>} An array containing the list of mentions and tags
 */
function getListOfWantedTagsAndMentionsFromAllPerspectives(allPerspectives: Array<TPerspectiveDef>): Array<string> {
  const wantedItems = new Set < string > ()
  for (const perspective of allPerspectives) {
    logDebug('getListOfWantedTagsAndMentionsFromAllPerspectives', `- reading perspective: [${String(perspective.name)}]`)
    const tagsAndMentionsStr = perspective.dashboardSettings.tagsToShow ?? ''
    const tagsAndMentionsArr = stringListOrArrayToArray(tagsAndMentionsStr, ',')
    tagsAndMentionsArr.forEach((torm) => {
      wantedItems.add(torm.trim())
    })
  }
  logDebug('', `=> wantedItems: ${String(Array.from(wantedItems))}`)
  return Array.from(wantedItems)
}
