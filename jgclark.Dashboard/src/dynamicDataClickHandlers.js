// @flow

import pluginJson from '../plugin.json'
import type { MessageDataObject, TBridgeClickHandlerResult } from './types'
import { handlerResult, setPluginData } from './dashboardHelpers'
import { log, logError, logDebug, timer, clo, clof, JSP } from '@helpers/dev'
import { getHeadingsFromNote } from '@helpers/NPnote'
import { getNote } from '@helpers/note'

/**
 * Get notes from the project notes
 * @param {MessageDataObject} _data - The data object
 * Sends the notes back asynchronously as an array of options via setPluginData
 * in the var: pluginData.dynamicData.getNotesResults
 * @returns {Promise<TBridgeClickHandlerResult>} - The result of the handler
 */
export async function getNotes(_data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const notes = [...DataStore.projectNotes.filter((note) => !note.filename.startsWith('@')), ...DataStore.calendarNotes.filter((note) => !note.filename.startsWith('@'))]
  const options = notes.map((note) => ({
    label: note.title || note.filename,
    value: note.filename,
  }))
  const updatedPluginData = { dynamicData: { getNotesResults: options } }
  logDebug('getNotes', `Updating dynamicData.getNotesResults in global pluginData`)
  await setPluginData(updatedPluginData, `_Updated dynamicData.getNotesResults in global pluginData`)
  return handlerResult(true)
}

/**
 * Get headings from a note
 * @param {MessageDataObject} data - The data object
 * Sends the headings back asynchronously as an array of options via setPluginData
 * in the var: pluginData.dynamicData.getHeadingsResults
 * @returns {Promise<TBridgeClickHandlerResult>} - The result of the handler
 */
export async function getHeadings(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename } = data
  if (!filename) {
    return handlerResult(false, [], { errorMsg: `No filename provided` })
  }

  const note = await getNote(filename)
  if (!note) {
    return handlerResult(false, [], { errorMsg: `Note not found: ${filename || ''}` })
  }
  const headings = await getHeadingsFromNote(note)
  const options = headings.map((heading) => ({
    label: heading,
    value: heading,
  }))
  const updatedPluginData = { dynamicData: { getHeadingsResults: options } }
  logDebug('getHeadings', `Updating dynamicData.getHeadingsResult in global pluginData`)
  await setPluginData(updatedPluginData, `_Updated dynamicData.getHeadingsResults in global pluginData`)
  return handlerResult(true)
}

/**
 * Get folders from the project folders
 * @param {MessageDataObject} _data - The data object
 * Sends the folders back asynchronously as an array of options via setPluginData
 * in the var: pluginData.dynamicData.getFoldersResults
 * @returns {Promise<TBridgeClickHandlerResult>} - The result of the handler
 */
export async function getFolders(_data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const folders = DataStore.folders.filter((folder) => !folder.startsWith('@'))
  const options = folders.map((folder) => ({
    label: folder,
    value: folder,
  }))
  const updatedPluginData = { dynamicData: { getFoldersResults: options } }
  logDebug('getFolders', `Updating dynamicData.getFoldersResults in global pluginData`)
  await setPluginData(updatedPluginData, `_Updated dynamicData.getFoldersResults in global pluginData`)
  return handlerResult(true)
}
