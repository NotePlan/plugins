// @flow
import pluginJson from '../plugin.json'
import type { SortableParagraphSubset } from '../../helpers/sorting'
import type { AutoTimeBlockingConfig } from './config'
import { appendLinkIfNecessary, removeDateTagsFromArray, includeTasksWithPatterns, excludeTasksWithPatterns } from './timeblocking-helpers'
import { validateAutoTimeBlockingConfig, getTimeBlockingDefaults } from './config'
import { sortListBy } from '@helpers/sorting'
import { JSP, clo, log, logError, logWarn, logDebug, clof } from '@helpers/dev'
import { getTodaysReferences, findOpenTodosInNote } from '@helpers/NPnote'
import { showMessage } from '@helpers/userInput'
import { isTimeBlockLine } from '@helpers/timeblocks'
import { eliminateDuplicateSyncedParagraphs } from '@helpers/syncedCopies'
import { getSyncedCopiesAsList } from '@helpers/NPSyncedCopies'
import { insertContentUnderHeading } from '@helpers/NPParagraph'

export const shouldRunCheckedItemChecksOriginal = (config: AutoTimeBlockingConfig): boolean => config.checkedItemChecksOriginal && ['+'].indexOf(config.todoChar) > -1

/**
 * Deletes paragraphs containing a specific string from the given note and returns the strings without the leading time signature
 *
 * @param {CoreNoteFields} destNote - the note to delete paragraphs from
 * @param {string} timeBlockTag - the string to search for in the paragraphs
 * @return {Array<string>} - the contents of the deleted paragraphs without the AutoTimeBlocking tag
 */
export function deleteParagraphsContainingString(destNote: CoreNoteFields, timeBlockTag: string): Array<string> {
  const destNoteParas = destNote.paragraphs
  const parasToDelete = []
  for (let i = 0; i < destNoteParas.length; i++) {
    const p = destNoteParas[i]
    if (new RegExp(timeBlockTag, 'gm').test(p.content)) {
      parasToDelete.push(p)
    }
  }
  if (parasToDelete.length > 0) {
    const deleteListByIndex = sortListBy(parasToDelete, ['lineIndex']) //NP API may give wrong results if lineIndexes are not in ASC order
    destNote.removeParagraphs(deleteListByIndex)
  }
  return parasToDelete.map((p) => p.content.replace(timeBlockTag, '').replace(/^\d{2}:\d{2}-\d{2}:\d{2} /g, ''))
}

/**
 * Creates synced copies of the provided todo items according to the configuration.
 * This is a helper function used within insertAndFinalizeTimeBlocks.
 *
 * @param {Array<TParagraph>} todos - The list of todo items to create synced copies for.
 * @param {AutoTimeBlockingConfig} config - The configuration object for auto time blocking.
 * @returns {Promise<void>}
 */
export async function createSyncedCopies(todos: Array<SortableParagraphSubset>, config: AutoTimeBlockingConfig): Promise<void> {
  // Assuming `writeSyncedCopies` is a utility function that handles the creation of synced copies.
  await writeSyncedCopies(todos, { runSilently: true, ...config })
}

/**
 * Fetches and prepares the todo items for today. It filters out completed items,
 * appends necessary links based on the configuration, and removes date tags from
 * todo items.
 *
 * @param {AutoTimeBlockingConfig} config - The configuratifetchon object for auto time blocking.
 * @param {Array<TParagraph>} completedItems - List of paragraphs/items that have been completed.
 * @param {Object} pluginJson - Plugin metadata for logging purposes.
 * @returns {Promise<Array<TParagraph>>} - The prepared list of todo items for today.
 */
export async function gatherAndPrepareTodos(config: AutoTimeBlockingConfig, completedItems: Array<TParagraph>, pluginJson: Object): Promise<$ReadOnlyArray<TParagraph>> {
  deleteParagraphsContainingString(Editor, config.timeBlockTag)

  // Fetch todo items for today
  const todosParagraphs = await getTodaysFilteredTodos(config)
    .filter((todo) => todo.type === 'open')
    .filter((todo) => todo.filename !== Editor.filename || (todo.filename === Editor.filename && !completedItems.find((c) => c.lineIndex === todo.lineIndex)))

  logDebug(pluginJson, `Back from getTodaysFilteredTodos, ${todosParagraphs.length} potential items`)

  // Append links if necessary
  const todosWithLinksMaybe = appendLinkIfNecessary(todosParagraphs, config)
  logDebug(pluginJson, `After appendLinkIfNecessary, ${todosWithLinksMaybe.length} potential items`)

  // Remove date tags from todo items
  const cleanTodayTodoParas = removeDateTagsFromArray(todosWithLinksMaybe)
  logDebug(pluginJson, `After removeDateTagsFromArray, ${cleanTodayTodoParas.length} potential items`)

  return cleanTodayTodoParas
}

/**
 * Get the config for this plugin, from DataStore.settings or the defaults if settings are not valid
 * Note: augments settings with current DataStore.preference('timeblockTextMustContainString') setting
 * @returns {} config object
 */
export function getConfig(): AutoTimeBlockingConfig {
  const config = DataStore.settings || {}
  if (Object.keys(config).length) {
    try {
      // $FlowIgnore
      // In real NotePlan, config.timeblockTextMustContainString won't be set, but in testing it will be, so this covers both test and prod
      if (!config.timeblockTextMustContainString) config.timeblockTextMustContainString = DataStore.preference('timeblockTextMustContainString') || ''
      validateAutoTimeBlockingConfig(config)
      return config
    } catch (error) {
      showMessage(`Plugin Settings ${error.message}\nRunning with default settings. You should probably open the plugin configuration dialog and fix the problem(s) listed above.`)
      logDebug(pluginJson, `Plugin Settings ${error.message} Running with default settings`)
    }
  } else {
    logDebug(pluginJson, `config was empty. will use defaults`)
  }
  const defaultConfig = getTimeBlockingDefaults()
  return defaultConfig
}

/**
 * Find all (unduplicated) todos:
 * - todo items from references list (aka "backlinks")
 * + items in the current note marked >today or with today's >date
 * + open todos in the note (if that setting is on)
 * + ...which include the include pattern (if specified in the config)
 * - ...which do not include items the exclude pattern (if specified in the config)
 * - items in the current note that are synced tasks to elsewhere (will be in references also)
 *
 * @param {*} config
 * @returns
 */
export function getTodaysFilteredTodos(config: AutoTimeBlockingConfig): Array<TParagraph> {
  const { includeTasksWithText, excludeTasksWithText, includeAllTodos, timeBlockTag } = config
  // filter down to just the open todos
  const backlinkParas = getTodaysReferences(Editor.note).filter((p) => p.type === 'open')
  logDebug(pluginJson, `Found ${backlinkParas.length} backlink paras`)
  clof(backlinkParas, `getTodaysFilteredTodos backlinkParas filtered to open`, ['filename', 'type', 'content'], true)
  let todosInNote = Editor.note ? findOpenTodosInNote(Editor.note, includeAllTodos) : []
  if (todosInNote.length > 0) {
    logDebug(pluginJson, ` getTodaysFilteredTodos: todosInNote Found ${todosInNote.length} items in today's note. Adding them to the possibilities.`)
    // we want to eliminate linked lines (for synced lines on the page)
    // because these should be in the references from other pages
    // but it's possible that this is a normal task in the note that is not in references, so for now, commenting this filter out
    // because it should get deduped later in this function
    const todayTasksWithSyncedLines = todosInNote.filter((todo) => /\^[a-zA-Z0-9]{6}/.test(todo.content))
    logDebug(
      pluginJson,
      ` getTodaysFilteredTodos: todosInNote had ${todayTasksWithSyncedLines.length} synced line items in today's note. If they are dupes in references, they should get deduped in the following steps.`,
    )
    todosInNote = todosInNote.filter((todo) => !isTimeBlockLine(todo.content)) // if a user is using the todo character for timeblocks, eliminate those lines
    todosInNote = todosInNote.filter((todo) => !new RegExp(timeBlockTag).test(todo.content)) // just to be extra safe, make sure we're not adding our own timeblocks
  }
  const backLinksAndNoteTodos = [...backlinkParas, ...todosInNote]
  logDebug(pluginJson, `Found ${backLinksAndNoteTodos.length} backlinks+today-note items (may include completed items)`)
  const undupedBackLinkParas = eliminateDuplicateSyncedParagraphs(backLinksAndNoteTodos, 'first', true)
  logDebug(pluginJson, `Found ${undupedBackLinkParas.length} undupedBackLinkParas after duplicate elimination`)
  // let todosParagraphs: Array<TParagraph> = makeAllItemsTodos(undupedBackLinkParas) //some items may not be todos but we want to pretend they are and timeblock for them
  // logDebug(pluginJson, `After makeAllItemsTodos, ${todosParagraphs.length} potential items`)
  let todosParagraphs =
    Array.isArray(includeTasksWithText) && includeTasksWithText?.length > 0 ? includeTasksWithPatterns(undupedBackLinkParas, includeTasksWithText) : undupedBackLinkParas
  logDebug(pluginJson, `After includeTasksWithPatterns (${(includeTasksWithText ?? []).join(', ')}), ${todosParagraphs.length} potential items`)
  todosParagraphs = Array.isArray(excludeTasksWithText) && excludeTasksWithText?.length > 0 ? excludeTasksWithPatterns(todosParagraphs, excludeTasksWithText) : todosParagraphs
  logDebug(pluginJson, `After excludeTasksWithPatterns (${(excludeTasksWithText ?? []).join(', ')}), ${todosParagraphs.length} potential items`)
  return todosParagraphs.filter((t) => t.content)
}

/**
 * Write synced copies of passed paragraphs to the Editor
 * Assumes any deletions were done already
 * @param {Array<TParagraph>} todosParagraphs - the paragraphs to write
 * @return {Promise<void}
 */
export async function writeSyncedCopies(todosParagraphs: Array<SortableParagraphSubset>, config: AutoTimeBlockingConfig): Promise<void> {
  if (!todosParagraphs.length && !config.runSilently) {
    await showMessage(`No todos/references marked for this day!`, 'OK', 'Write Synced Copies')
  } else {
    clof(todosParagraphs, `writeSyncedCopies: todosParagraphs`, 'content', true)
    const syncedList = getSyncedCopiesAsList(todosParagraphs)
    clo(syncedList, `writeSyncedCopies: syncedList`)
    logDebug(pluginJson, `Deleting previous synced list heading and content`)
    if (!String(config.syncedCopiesTitle)?.length) {
      await showMessage(`You need to set a synced copies title in the plugin settings`)
      return
    }
    logDebug(pluginJson, `Inserting synced list content: ${syncedList.length} items`)
    // $FlowIgnore
    await insertItemsIntoNote(Editor, syncedList, config.syncedCopiesTitle, config.foldSyncedCopiesHeading, config)
  }
}

export async function insertItemsIntoNote(
  note: CoreNoteFields,
  list: Array<string> | null = [],
  heading: string = '',
  shouldFold: boolean = false,
  config: AutoTimeBlockingConfig = getConfig(),
) {
  if (list && list.length > 0 && note) {
    // $FlowIgnore
    logDebug(pluginJson, `insertItemsIntoNote: items.length=${list.length}`)
    clo(list, `insertItemsIntoNote: list`)
    clof(list, `insertItemsIntoNote: list`, null, false)
    // Note: could probably use API addParagraphBelowHeadingTitle to insert
    insertContentUnderHeading(note, heading, list.join('\n'))
    // Fold the heading to hide the list
    if (shouldFold && heading !== '') {
      const thePara = note.paragraphs.find((p) => p.type === 'title' && p.content.includes(heading))
      if (thePara) {
        logDebug(pluginJson, `insertItemsIntoNote: folding "${heading}" - isFolded=${String(Editor.isFolded(thePara))}`)
        // $FlowIgnore[method-unbinding] - the function is not being removed from the Editor object.
        if (Editor.isFolded) {
          // make sure this command exists
          if (!Editor.isFolded(thePara)) {
            Editor.toggleFolding(thePara)
            logDebug(pluginJson, `insertItemsIntoNote: folded heading "${heading}"`)
          }
        } else {
          thePara.content = `${String(heading)} …` // this was the old hack for folding
          await note.updateParagraph(thePara)
          note.content = note.content ?? ''
        }
      } else {
        logDebug(pluginJson, `insertItemsIntoNote could not find heading: ${heading}`)
      }
    }
  } else {
    if (config && !config.passBackResults) {
      // await showMessage('No items to insert or work hours left. Check config/presets. Also look for calendar events which may have blocked off the rest of the day.')
    }
  }
}
