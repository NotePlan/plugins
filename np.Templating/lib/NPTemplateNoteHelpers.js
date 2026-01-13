// @flow

import pluginJson from '../plugin.json'
import { getTemplateFolder } from './config/configManager'
import { log, logError, logDebug, timer, clo, clof, JSP } from '@helpers/dev'
import { getNote } from '@helpers/note'

/**
 * Get a template note and return the note object or null if not found
 * Searches in both @Templates and @Forms directories (and teamspace equivalents)
 * @param {string} _templateName - title or filename of the template note
 * @param {boolean} runSilently
 * @returns {Promise<TNote | null>}
 */
export async function getTemplateNote(_templateName: string = '', runSilently: boolean = false): Promise<TNote | null> {
  // Get template folder name from DataStore.preference (localized) or fall back to environment variable
  const templateFolderEnv = await getTemplateFolder()
  const templateFolderPreference = DataStore.preference('templateFolder')
  const templateFolderName: string = (typeof templateFolderPreference === 'string' && templateFolderPreference) || templateFolderEnv || '@Templates'
  
  // Get Forms folder name - check if there's a preference, otherwise use default
  const formsFolderPreference = DataStore.preference('formsFolder')
  const formsFolderName: string = (typeof formsFolderPreference === 'string' && formsFolderPreference) || '@Forms'
  
  // Build list of folders to search in
  const searchFolders: Array<string> = [templateFolderName, formsFolderName]
  
  const isFilename = _templateName.endsWith('.md') || _templateName.endsWith('.txt')
  const containsFolder = _templateName.includes('/')
  const startsWithTemplateFolder = _templateName.startsWith(`${templateFolderName}/`) || _templateName.startsWith(`${formsFolderName}/`)
  logDebug(
    pluginJson,
    `getTemplateNote: _templateName="${_templateName}" isFilename=${String(isFilename)} containsFolder=${String(containsFolder)} startsWithTemplateFolder=${String(
      startsWithTemplateFolder,
    )} searching in folders: ${searchFolders.join(', ')}`,
  )
  let theNote: TNote | null = null
  if (_templateName) {
    // Try searching in each folder
    for (const folder of searchFolders) {
      theNote = (await getNote(_templateName, false, folder)) || null
      if (theNote) {
        logDebug(pluginJson, `getTemplateNote: Found template "${_templateName}" in ${folder}`)
        return theNote
      }
    }
  }
  if (!runSilently) {
    const folderList = searchFolders.join(' or ')
    logError(pluginJson, `Unable to locate template "${_templateName}" in ${folderList}`)
    await CommandBar.prompt(`Unable to locate template "${_templateName}"`, `Unable to locate template "${_templateName}" in ${folderList}`)
  }
  logDebug(pluginJson, `getTemplateNote: Unable to locate template "${_templateName}" in ${searchFolders.join(' or ')}`)
  return null
}
