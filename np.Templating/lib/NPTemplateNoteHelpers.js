// @flow

import pluginJson from '../plugin.json'
import { log, logError, logDebug, timer, clo, clof, JSP } from '@helpers/dev'
import { getNote } from '@helpers/note'

/**
 * Get a template note and return the note object or null if not found
 * @param {string} _templateName - title or filename of the template note
 * @param {boolean} runSilently
 * @returns {Promise<TNote | null>}
 */
export async function getTemplateNote(_templateName: string = '', runSilently: boolean = false): Promise<TNote | null> {
  const templateFolder = NotePlan.environment.templateFolder || '@Templates'
  const isFilename = _templateName.endsWith('.md') || _templateName.endsWith('.txt')
  const containsFolder = _templateName.includes('/')
  const startsWithTemplateFolder = _templateName.startsWith(`${templateFolder}/`)
  logDebug(
    pluginJson,
    `getTemplateNote: _templateName="${_templateName}" isFilename=${String(isFilename)} containsFolder=${String(containsFolder)} startsWithTemplateFolder=${String(
      startsWithTemplateFolder,
    )}`,
  )
  let theNote: TNote | null = null
  if (_templateName) {
    theNote = (await getNote(_templateName, false, templateFolder)) || null
    if (theNote) return theNote
  }
  if (!runSilently) {
    await CommandBar.prompt(`Unable to locate template "${_templateName}"`, `Unable to locate template "${_templateName}" in ${templateFolder}`)
  }
  logDebug(pluginJson, `getTemplateNote: Unable to locate template "${_templateName}" in ${templateFolder}`)
  return null
}
