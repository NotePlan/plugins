// @flow
//-----------------------------------------------------------------------------
// Cache helper functions for Dashboard
// last updated 2025-04-13 for v2.3.0.a1
//-----------------------------------------------------------------------------
// Cache structure (JSON file):
// {
//   generatedAt: new Date(),
//   lastUpdated: new Date(),
//   regularNotes: [{file: 'note1.md', items: ['@BOB', '@BOB2']}, {file: 'note2.md', items: ['@BOB']}],
//   calendarNotes: [{file: 'note3.md', items: ['#BOB']}, {file: 'note4.md', items: ['#BOB']}],
// }
//-----------------------------------------------------------------------------

/**
 * Note: In a weird development (literally), I (JGC) found that a refactor of the original findNotesWithMatchingHashtag() suddenly made it now as fast, if not faster, as this new Cache.
 * I didn't take out any code, so I'm mystified. 
 * But not complaining, particularly as this still had some work required.
 */

import moment from 'moment/min/moment-with-locales'
import { getDashboardSettings } from './dashboardHelpers'
import type { TPerspectiveDef } from './types'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { clo, clof, JSP, log, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import { CaseInsensitiveSet, percent } from '@helpers/general'
import { findNotesMatchingHashtagOrMention, getNotesChangedInInterval } from '@helpers/NPnote'
import {
  caseInsensitiveIncludes,
  caseInsensitiveStartsWith,
  caseInsensitiveSubstringMatch,
} from '@helpers/search'

//--------------------------------------------------------------------------
// Constants

const wantedTagMentionsList = 'wantedTagMentionsList.json'
const tagMentionCacheFile = 'tagMentionCache.json'
const lastTimeThisWasRunPref = 'jgclark.Dashboard.tagMentionCache.lastTimeUpdated'

const turnOffAPILookups = true

//-----------------------------------------------------------------
// exported Getter and setter functions

/**
 * Get the list of wanted mentions and tags from the wantedTagMentionsList.json file.
 * @returns {Array<string>} An array containing the list of mentions and tags
 */
export function getTagMentionCacheDefinitions(): Array<string> {
  if (DataStore.fileExists(wantedTagMentionsList)) {
    const data = DataStore.loadData(wantedTagMentionsList, true) ?? ''
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
export function addTagMentionCacheDefinition(mentionOrTag: string): void {
  const itemList: Array<string> = getTagMentionCacheDefinitions()
  // But only add if it's not already in the list
  if (!itemList.includes(mentionOrTag)) {
    itemList.push(mentionOrTag)
  }
  DataStore.saveData(JSON.stringify({ items: itemList }), wantedTagMentionsList, true)
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
  DataStore.saveData(JSON.stringify(cache), wantedTagMentionsList, true)
  logInfo('setTagMentionCacheDefinitions', `Saved [${String(items)}] items to ${wantedTagMentionsList}`)
}

/**
 * Set the tag and mentions to the wantedTagMentionsList.json file based on the current perspectives.
 */
export function setTagMentionCacheDefinitionsFromAllPerspectives(allPerspectiveDefs: Array<TPerspectiveDef>): void {
  const wantedItems = getWantedTagsAndMentionsFromAllPerspectives(allPerspectiveDefs)
  setTagMentionCacheDefinitions(wantedItems)
}

/**
 * Returns a list of notes that contain the given tags and/or mentions from the tagMentionCache.
 * It does so in a case-insensitive way, so asking for '@BOB' will find '@bob' and '@Bob'.
 * It does not do any filtering by para type.
 * @param {Array<string>} tagOrMentions The tags and/or mentions to search for.
 * @param {boolean} firstUpdateCache If true, the cache will be updated before the search is done. (Default: true)
 * @returns {Array<string>} An array of note filenames that contain the tag or mention.
 */
export async function getFilenamesOfNotesWithTagOrMentions(tagOrMentions: Array<string>, firstUpdateCache: boolean = true): Promise<Array<string>> {
  try {
    logDebug('getFilenamesOfNotesWithTagOrMentions', `Starting for tag/mention(s) [${String(tagOrMentions)}]${firstUpdateCache ? '. (First update cache)' : ''}`)

    // Warn if we're asked for a tag/mention that's not in the wantedTagMentionsList.json file, and if so, add it to the list and then regenrate the cache.
    const wantedItems = getTagMentionCacheDefinitions()
    const missingItems = tagOrMentions.filter((item) => !wantedItems.includes(item))
    if (missingItems.length > 0) {
      logWarn('getFilenamesOfNotesWithTagOrMentions', `Warning: the following tags/mentions are not in the wantedTagMentionsList.json file: [${String(missingItems)}]. I will add them to the list and then regenrate the cache.`)
      setTagMentionCacheDefinitions(wantedItems.concat(missingItems))
      await generateTagMentionCache()
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

    // Get from Calendar notes using Cache
    let matchingNotesFromCache = calNoteItems.filter((line) => line.items.some((tag) => lowerCasedTagOrMentions.includes(tag))).map((item) => item.file)

    // Get from Regular notes using Cache
    // eslint-disable-next-line max-len
    matchingNotesFromCache = matchingNotesFromCache.concat(regularNoteItems.filter((line) => line.items.some((tag) => lowerCasedTagOrMentions.includes(tag))).map((item) => item.file))
    // $FlowIgnore[unsafe-arithmetic]
    const cacheLookupTime = new Date() - startTime
    logTimer('getFilenamesOfNotesWithTagOrMentions', startTime, `-> found ${String(matchingNotesFromCache.length)} notes from CACHE with wanted tags/mentions [${String(tagOrMentions)}]:`, 500)

    // Now for interest get from the API instead, and compare the results (depending on turnOffAPILookups)
    if (!turnOffAPILookups) {
      const thisStartTime = new Date()
      let matchingNotesFromAPI: Array<TNote> = []
      for (const tagOrMention of tagOrMentions) {
        matchingNotesFromAPI = matchingNotesFromAPI.concat(findNotesMatchingHashtagOrMention(tagOrMention, true, true, true))
      }
      // $FlowIgnore[unsafe-arithmetic]
      const APILookupTime = new Date() - thisStartTime
      logTimer('getFilenamesOfNotesWithTagOrMentions', thisStartTime, `-> found ${matchingNotesFromAPI.length} notes from API with wanted tags/mentions [${String(tagOrMentions)}]`)

      logInfo('getFilenamesOfNotesWithTagOrMentions', `- CACHE took ${percent(cacheLookupTime, APILookupTime)} compared to API`)
      // Compare the two lists and warn if different
      if (matchingNotesFromCache.length !== matchingNotesFromAPI.length) {
        logError('getFilenamesOfNotesWithTagOrMentions', `- # notes from CACHE !== API:`)
        // Write a list of filenames that are in one but not the other
        const filenamesInCache = matchingNotesFromCache
        const filenamesInAPI = matchingNotesFromAPI.map((n) => n.filename)
        // const filenamesInBoth = filenamesInCache.filter((f) => filenamesInAPI.includes(f))
        logError('getFilenamesOfNotesWithTagOrMentions', `- filenames in CACHE but not in API: ${filenamesInCache.filter((f) => !filenamesInAPI.includes(f)).join(', ')}`)
        logError('getFilenamesOfNotesWithTagOrMentions', `- filenames in API but not in CACHE: ${filenamesInAPI.filter((f) => !filenamesInCache.includes(f)).join(', ')}`)
      }
    }
    return matchingNotesFromCache
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
 */
export async function generateTagMentionCache(): Promise<void> {
  try {
    const startTime = new Date()
    const wantedItems = getTagMentionCacheDefinitions()
    const config = await getDashboardSettings()
    logDebug('generateTagMentionCache', `Starting with wantedItems:[${String(wantedItems)}]${config.FFlag_TagCacheOnlyForOpenItems ? ' ONLY FOR OPEN ITEMS' : ''}`)

    const wantedParaTypes = config.FFlag_TagCacheOnlyForOpenItems ? ['open', 'checklist', 'scheduled', 'checklistScheduled'] : []

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
      const foundWantedItems = (wantedItems.length > 0) ? getWantedTagOrMentionListFromNote(note, wantedItems, wantedParaTypes) : []
      if (foundWantedItems.length > 0) {
        logDebug('generateTagMentionCache', `-> ${String(foundWantedItems.length)} foundWantedItems [${String(foundWantedItems)}] calWantedItems`)
        calWantedItems.push({ file: note.filename, items: foundWantedItems })
        ccal++
      }
    }
    const regularWantedItems = []
    let creg = 0
    for (const note of allRegularNotes) {
      const foundWantedItems = (wantedItems.length > 0) ? getWantedTagOrMentionListFromNote(note, wantedItems, wantedParaTypes) : []
      if (foundWantedItems.length > 0) {
        logDebug('generateTagMentionCache', `-> ${String(foundWantedItems.length)} foundWantedItems [${String(foundWantedItems)}] regularWantedItems`)
        regularWantedItems.push({ file: note.filename, items: foundWantedItems })
        creg++
      }
    }
    logTimer('generateTagMentionCache', startTime, `to find ${ccal} calendar notes with wanted items / ${creg} regular notes with wanted items`)

    // Save the filteredMentions and filteredTags to the mentionTagCacheFile
    const cache = {
      generatedAt: startTime,
      lastUpdated: startTime,
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
    const config = await getDashboardSettings()
    const startTime = new Date() // just for timing this function

    // Read current list from tagMentionCacheFile, and get time of it.
    // Note: can't get a timestamp from plugin files, so need to use a separate preference
    logDebug('updateTagMentionCache', `About to read ${tagMentionCacheFile} ...`)
    if (!DataStore.fileExists(tagMentionCacheFile)) {
      logWarn('updateTagMentionCache', `${tagMentionCacheFile} file does not exist, so re-generating the cache from scratch.`)
      await generateTagMentionCache()
      return
    }

    // Get the list of wanted tags, mentions, and para types
    const wantedItems = getTagMentionCacheDefinitions()
    const wantedParaTypes = config.FFlag_TagCacheOnlyForOpenItems ? ['open', 'checklist', 'scheduled', 'checklistScheduled'] : []

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
      const foundWantedItems = getWantedTagOrMentionListFromNote(note, wantedItems, wantedParaTypes)
      if (foundWantedItems.length > 0) logDebug('updateTagMentionCache', `-> ${String(foundWantedItems.length)} foundWantedItems [${String(foundWantedItems)}] calWantedItems`)
      if (foundWantedItems.length > 0) {
        if (isCalendarNote) {
          cache.calendarNotes.push({ file: note.filename, items: foundWantedItems })
        } else {
          cache.regularNotes.push({ file: note.filename, items: foundWantedItems })
        }
        c++
      }
    }
    logTimer('updateTagMentionCache', startTime, `-> ${c} recently changed notes with wanted items`)

    // Update the last updated time
    cache.lastUpdated = startTime

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
- Wanted items: ${String(getTagMentionCacheDefinitions())}
- Generated at: ${parsedCache.generatedAt}
- Last updated: ${parsedCache.lastUpdated}
- # Regular notes: ${parsedCache.regularNotes.length}
- # Calendar notes: ${parsedCache.calendarNotes.length}`
  return summary
}

/**
 * Get list of any of the 'wantedItems' tags/mentions that appear in this note. Does filtering by para type, if 'wantedParaTypes' is provided, and is not empty.
 * @param {TNote} note 
 * @param {Array<string>} wantedItems 
 * @param {Array<string>?} wantedParaTypes?
 * @returns 
 */
export function getWantedTagOrMentionListFromNote(note: TNote, wantedItems: Array<string>, wantedParaTypes: Array<string> = []): Array<string> {
  try {
    if (wantedItems.length === 0) {
      logWarn('getWantedTagListFromNote', `Starting, with empty wantedItems params`)
      return []
    }

    const seenWantedItems: Array<string> = []
    // Ask API for all seen tags in this note, and reverse them
    const allTagsInNote = note.hashtags.slice().reverse()
    let lastTag = ''
    for (const tag of allTagsInNote) {
      // if this tag is starting subset of the last one, assume this is an example of the bug, so skip this tag
      if (caseInsensitiveStartsWith(tag, lastTag)) {
        // logDebug('getWantedTagOrMentionListFromNote', `- Found ${tag} but ignoring as part of a longer hashtag of the same name`)
      }
      else {
        // check this is one of the ones we're after, then add
        if (caseInsensitiveIncludes(tag, wantedItems)) {
          // logDebug('getWantedTagOrMentionListFromNote', `- Found matching occurrence ${tag} on date ${n.filename}`)
          seenWantedItems.push(tag)
        }
      }
      lastTag = tag
    }

    // Now create (case-insensitive) deduped list of the tags
    const tagSet = new CaseInsensitiveSet(seenWantedItems)
    let distinctTags: Array<string> = [...tagSet]
    const distinctTagsInitialCount = distinctTags.length

    // If we want to restrict to certain para types, do so now
    if (wantedParaTypes.length > 0) {
      distinctTags = filterItemsInNoteToWantedParaTypes(note, distinctTags, wantedParaTypes)
      logDebug('getWantedTagListFromNote', `-> filtered out ${distinctTagsInitialCount - distinctTags.length} tags that didn't match the wanted para types`)
    }

    if (distinctTags.length > 0) {
      logDebug('getWantedTagListFromNote', `-> ${String(distinctTags.length)} distinct tags found from ${String(distinctTags.length)} instances in ${String(note.filename)}`)
    }

    // Now ask API for all seen mentions in this note, and reverse them
    const allMentionsInNote = note.mentions.slice().reverse()
    let lastMention = ''
    for (const mention of allMentionsInNote) {
      // if this mention is starting subset of the last one, assume this is an example of the bug, so skip this mention
      if (caseInsensitiveStartsWith(mention, lastMention)) {
        // logDebug('getWantedTagOrMentionListFromNote', `- Found ${mention} but ignoring as part of a longer hashmention of the same name`)
      }
      else {
        // check this is one of the ones we're after, then add
        if (caseInsensitiveIncludes(mention, wantedItems)) {
          // logDebug('getWantedTagOrMentionListFromNote', `- Found matching occurrence ${mention} on date ${n.filename}`)
          seenWantedItems.push(mention)
        }
      }
      lastMention = mention
    }

    // Now create (case-insensitive) set of the mentions
    const mentionSet = new CaseInsensitiveSet(seenWantedItems)
    let distinctMentions: Array<string> = [...mentionSet]
    const distinctMentionsInitialCount = distinctMentions.length

    // If we want to restrict to certain para types, do so now
    if (wantedParaTypes.length > 0) {
      distinctMentions = filterItemsInNoteToWantedParaTypes(note, distinctMentions, wantedParaTypes)
      logDebug('getWantedTagListFromNote', `-> filtered out ${distinctMentionsInitialCount - distinctMentions.length} mentions that didn't match the wanted para types`)
    }

    if (seenWantedItems.length > 0) {
      logDebug('getWantedTagOrMentionListFromNote', `-> ${String(distinctMentions.length)} distinct mentions found from ${String(seenWantedItems.length)} instances in ${String(note.filename)}`)
    }

    return distinctTags.concat(distinctMentions)
  } catch (err) {
    logError('getWantedTagListFromNote', JSP(err))
    return []
  }
}

//-----------------------------------------------------------------
// private helper functions

function filterItemsInNoteToWantedParaTypes(note: TNote, initialItems: Array<string>, wantedParaTypes: Array<string>): Array<string> {
  // Filter out any items where every paragraph in the note that contains the tag has a para type that doesn't match the wanted para types
  const filteredItems = initialItems.filter((t) => {
    const paragraphsWithTag = note.paragraphs.filter((p) => caseInsensitiveSubstringMatch(t, p.content))
    return paragraphsWithTag.every((p) => wantedParaTypes.includes(p.type))
  })
  logDebug('filterItemsInNoteToWantedParaTypes', `-> filtered out ${initialItems.length - filteredItems.length} tags that didn't match the wanted para types`)

  if (filteredItems.length > 0) {
    logDebug('filterItemsInNoteToWantedParaTypes', `-> ${String(filteredItems.length)} distinct tags found from ${String(initialItems.length)} instances in ${String(note.filename)}`)
  }

  return filteredItems
}

/**
 * Get the list of wanted tags and mentions from all perspectives.
 * Note: moved from perspectiveHelpers.js to here to avoid circular dependency.
 * @returns {Array<string>} An array containing the list of mentions and tags
 */
function getWantedTagsAndMentionsFromAllPerspectives(allPerspectives: Array<TPerspectiveDef>): Array<string> {
  const wantedItems = new Set < string > ()
  for (const perspective of allPerspectives) {
    logDebug('getWantedTagsAndMentionsFromAllPerspectives', `- reading perspective: [${String(perspective.name)}]`)
    const tagsAndMentionsStr = perspective.dashboardSettings.tagsToShow ?? ''
    const tagsAndMentionsArr = stringListOrArrayToArray(tagsAndMentionsStr, ',')
    tagsAndMentionsArr.forEach((torm) => {
      wantedItems.add(torm)
    })
  }
  logDebug('', `=> wantedItems: ${String(Array.from(wantedItems))}`)
  return Array.from(wantedItems)
}
