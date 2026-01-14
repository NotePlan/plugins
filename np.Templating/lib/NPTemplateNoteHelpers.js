// @flow

import pluginJson from '../plugin.json'
import { getTemplateFolderPrefixes } from './core/templateManager'
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
  // Get all template folder prefixes (includes private root and all teamspace root folders)
  const searchFolders = await getTemplateFolderPrefixes()

  const isFilename = _templateName.endsWith('.md') || _templateName.endsWith('.txt')
  const containsFolder = _templateName.includes('/')

  // Check if template name starts with any of the search folder prefixes
  const startsWithTemplateFolder = searchFolders.some((folder) => _templateName.startsWith(`${folder}/`))

  logDebug(
    pluginJson,
    `getTemplateNote: _templateName="${_templateName}" isFilename=${String(isFilename)} containsFolder=${String(containsFolder)} startsWithTemplateFolder=${String(
      startsWithTemplateFolder,
    )} searching in ${searchFolders.length} folders`,
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
    logError(pluginJson, `Unable to locate template "${_templateName}" in any of ${searchFolders.length} template folders`)
    await CommandBar.prompt(
      `Unable to locate template "${_templateName}"`,
      `Unable to locate template "${_templateName}" in any template folder (searched ${searchFolders.length} folders)`,
    )
  }
  logDebug(pluginJson, `getTemplateNote: Unable to locate template "${_templateName}" in any of ${searchFolders.length} template folders`)
  return null
}
