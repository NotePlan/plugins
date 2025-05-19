// @flow
/* eslint-disable */

import { clo, logDebug, logError } from '@helpers/dev'
import moment from 'moment/min/moment-with-locales'
import { getOpenTasksAndChildren } from '@helpers/parentsAndChildren'
import pluginJson from '../../../plugin.json'

// DataStore will be globally available in the NotePlan environment. Flow might not know about TNote/TParagraph.

/**
 * @class TasksModule
 * @description Handles tasks-related template functions.
 */
export default class TasksModule {
  config: { [string]: any }

  /**
   * @constructor
   * @param {Object} config - Optional configuration object.
   */
  constructor(config: { [string]: any } = {}) {
    this.config = config
    logDebug(pluginJson, `TasksModule initialized with config: ${JSON.stringify(config)}`)
  }

  /**
   * Resolves special source identifiers like '<today>' or '<yesterday>' to date strings.
   * @private
   * @param {string} sourceIdentifier - The identifier to resolve.
   * @returns {string} - The resolved identifier (e.g., a YYYY-MM-DD date string or the original identifier).
   */
  _resolveSourceIdentifier(sourceIdentifier: string): string {
    if (sourceIdentifier === '<today>') {
      const resolved = moment().format('YYYY-MM-DD')
      logDebug(pluginJson, `_resolveSourceIdentifier: Resolved "<today>" to date: ${resolved}`)
      return resolved
    } else if (sourceIdentifier === '<yesterday>') {
      const resolved = moment().subtract(1, 'days').format('YYYY-MM-DD')
      logDebug(pluginJson, `_resolveSourceIdentifier: Resolved "<yesterday>" to date: ${resolved}`)
      return resolved
    }
    logDebug(pluginJson, `_resolveSourceIdentifier: Identifier "${sourceIdentifier}" resolved to itself.`)
    return sourceIdentifier
  }

  /**
   * Fetches a note (calendar or project) based on a resolved identifier.
   * @private
   * @param {string} resolvedIdentifier - A YYYY-MM-DD, YYYYMMDD, YYYY-Www, YYYY-MM, YYYY-Qq, YYYY date string, or a project note title.
   * @returns {Promise<?any>} - The TNote object or null if not found.
   */
  async _getNoteByIdentifier(resolvedIdentifier: string): Promise<?any> {
    let note: ?any = null
    // Regex to identify various calendar note date string formats
    const calendarDatePattern = /(^\d{4}-\d{2}-\d{2}$)|(^\d{8}$)|(^\d{4}-W\d{1,2}$)|(^\d{4}-Q\d$)|(^\d{4}-\d{2}$)|(^\d{4}$)/

    if (calendarDatePattern.test(resolvedIdentifier)) {
      logDebug(pluginJson, `_getNoteByIdentifier: Attempting to get calendar note for date-like identifier: ${resolvedIdentifier}`)
      // $FlowIgnore - DataStore is a global in NotePlan
      note = await DataStore.calendarNoteByDateString(resolvedIdentifier)
      if (!note) {
        logDebug(pluginJson, `_getNoteByIdentifier: Calendar note not found for identifier: ${resolvedIdentifier}`)
      }
    } else {
      logDebug(pluginJson, `_getNoteByIdentifier: Attempting to get project note by title: "${resolvedIdentifier}"`)
      // $FlowIgnore - DataStore is a global in NotePlan
      const notes = await DataStore.projectNoteByTitle(resolvedIdentifier)
      if (notes && notes.length > 0) {
        note = notes[0]
        if (notes.length > 1) {
          logDebug(pluginJson, `_getNoteByIdentifier: Multiple project notes found for title "${resolvedIdentifier}". Using the first one: "${note.filename || ''}".`)
        }
      } else {
        logDebug(pluginJson, `_getNoteByIdentifier: Project note not found for title: "${resolvedIdentifier}"`)
      }
    }
    return note
  }

  /**
   * Filters open task paragraphs from a note and ensures they have block IDs.
   * @private
   * @param {any} note - The TNote object.
   * @returns {Array<any>} - An array of open task TParagraph objects with block IDs.
   */
  _ensureBlockIdsForOpenTasks(note: any): Array<TParagraph> {
    if (!note.paragraphs || note.paragraphs.length === 0) {
      logDebug(pluginJson, `_ensureBlockIdsForOpenTasks: Note "${note.filename || 'N/A'}" has no paragraphs.`)
      return []
    }

    // const openTaskParagraphs = note.paragraphs.filter((p) => p.type === 'open').filter((p) => p.content.trim() !== '')
    const openTaskParagraphs = getOpenTasksAndChildren(note.paragraphs.filter((p) => p.content.trim() !== ''))
    logDebug(pluginJson, `_ensureBlockIdsForOpenTasks: Found ${openTaskParagraphs.length} open tasks in note "${note.filename || 'N/A'}".`)

    if (openTaskParagraphs.length === 0) {
      return []
    }

    openTaskParagraphs.forEach((para) => note.addBlockID(para))

    note.updateParagraphs(openTaskParagraphs)

    return openTaskParagraphs
  }

  /**
   * Retrieves open tasks from a specified note (daily note or project note),
   * ensuring each open task paragraph has a block ID.
   * The block IDs are added to the paragraphs in the NotePlan store by the note.addBlockID method.
   * @async
   * @param {string} sourceIdentifier - '<today>', '<yesterday>', an ISO 8601 date string (YYYY-MM-DD), or the title of a project note.
   * @returns {Promise<string>} - A string of open task TParagraph objects with block IDs, or an empty string if the note is not found or has no open tasks.
   * @example <%- await tasks.getSyncedOpenTasksFrom('<today>') %>
   * @example <%- await tasks.getSyncedOpenTasksFrom('2023-12-25') %>
   * @example <%- await tasks.getSyncedOpenTasksFrom('My Project Note Title') %>
   */
  async getSyncedOpenTasksFrom(sourceIdentifier: string): Promise<string> {
    logDebug(pluginJson, `TasksModule.getSyncedOpenTasksFrom called with sourceIdentifier: "${sourceIdentifier}"`)

    const resolvedIdentifier = this._resolveSourceIdentifier(sourceIdentifier)
    const note = await this._getNoteByIdentifier(resolvedIdentifier)

    if (!note) {
      logError(pluginJson, `TasksModule.getSyncedOpenTasksFrom: Note not found for identifier: "${sourceIdentifier}" (resolved to: "${resolvedIdentifier}")`)
      return ''
    }

    logDebug(
      pluginJson,
      `TasksModule.getSyncedOpenTasksFrom: Found note: "${note.filename || 'N/A'}" (Type: ${note.type || 'N/A'}) with ${note.paragraphs ? note.paragraphs.length : 0} paragraphs.`,
    )

    const syncedTasks = this._ensureBlockIdsForOpenTasks(note)

    logDebug(pluginJson, `TasksModule.getSyncedOpenTasksFrom: Finished processing ${syncedTasks.length} open tasks for note "${note.filename || 'N/A'}".`)
    return syncedTasks.map((task) => task.rawContent).join('\n')
  }
}
