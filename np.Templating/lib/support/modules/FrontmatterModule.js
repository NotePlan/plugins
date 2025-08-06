// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import fm from 'front-matter'
import pluginJson from '../../../plugin.json'
import { getSanitizedFmParts, isValidYamlContent, getValuesForFrontmatterTag, updateFrontMatterVars, getFrontmatterAttributes } from '@helpers/NPFrontMatter'
import { logDebug, logError, JSP } from '@helpers/dev'

export default class FrontmatterModule {
  // $FlowIgnore
  constructor(NPTemplating: any = null) {
    if (NPTemplating) {
      // $FlowIgnore
      this.templatingInstance = NPTemplating
    }
  }

  isFrontmatterTemplate(templateData: string): boolean {
    // First check if the template has the frontmatter structure (starts with --- and has another ---)
    if (!templateData.startsWith('---')) return false
    const lines = templateData.split('\n')
    if (lines.length >= 2 && lines[0].trim() === '---') {
      // Find the second --- separator
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
          // Now validate that the content between the --- markers is actually YAML-like
          // Extract the content between the first and second ---
          const frontmatterContent = lines.slice(1, i).join('\n')
          return isValidYamlContent(frontmatterContent)
        }
      }
    }
    return false
  }

  getFrontmatterBlock(templateData: string): string {
    const templateLines = templateData.split('\n')
    if (templateLines[0] === '---') {
      templateLines.shift()
      if (templateLines.indexOf('---') > 0) {
        return templateData
      }
    }

    return ''
  }

  getFrontmatterText(templateData: string): string {
    return templateData.replace(this.body(templateData), '')
  }

  parse(template: string = ''): any {
    if (this.isFrontmatterTemplate(template)) {
      const fmData = getSanitizedFmParts(template)
      Object.keys(fmData?.attributes).forEach((key) => {
        fmData.attributes[key] ? fmData.attributes[key] : (fmData.attributes[key] = '')
      })
      // fmData.body = fmData.body.replace(/---/gi, '*****')

      // Add debug logging
      logDebug(pluginJson, `FrontmatterModule.parse: Extracted body with ${fmData?.body?.length || 0} chars: "${(fmData?.body || '').substring(0, 200)}..."`)
      logDebug(pluginJson, `FrontmatterModule.parse: Extracted attributes: ${JSON.stringify(fmData?.attributes || {})}`)

      return fmData
    } else {
      return {}
    }
  }

  attributes(templateData: string = ''): any {
    try {
      const fmData = getSanitizedFmParts(templateData)
      Object.keys(fmData?.attributes).forEach((key) => {
        fmData.attributes[key] ? fmData.attributes[key] : (fmData.attributes[key] = '')
      })

      return fmData && fmData?.attributes ? fmData.attributes : {}
    } catch (error) {
      // logDebug(error)
      return {}
    }
  }

  body(templateData: string = ''): string {
    const fmData = getSanitizedFmParts(templateData)

    return fmData && fmData?.body ? fmData.body : ''
  }

  /**
   * Get all the values in frontmatter for all notes for a given key
   * @param {string} tag - The frontmatter key to search for
   * @returns {Promise<string>} JSON string representation of the values array
   */
  async getValuesForKey(tag: string): Promise<string> {
    try {
      // Get the values using the frontmatter helper
      const values = await getValuesForFrontmatterTag(tag)

      // Convert to string
      const result = JSON.stringify(values).trim()
      logDebug(pluginJson, `FrontmatterModule.getValuesForKey: ${tag} = ${result}`)

      // Return the string result
      return result
    } catch (error) {
      // Log the error but don't throw it - this helps with resilience
      logError(pluginJson, `FrontmatterModule.getValuesForKey error: ${error}`)

      // Return an empty array string as fallback
      return ''
    }
  }

  /**
   * Get all frontmatter attributes from a note or an empty object if the note has no front matter
   * @param {CoreNoteFields} note - The note to get attributes from
   * @returns {{ [string]: string }} Object of attributes or empty object if the note has no front matter
   */
  getFrontmatterAttributes(note: CoreNoteFields): { [string]: string } {
    try {
      // Defensive check: ensure the note object exists and has the expected structure
      if (!note) {
        logError(pluginJson, `FrontmatterModule.getFrontmatterAttributes: note is null or undefined`)
        return {}
      }

      // Call the NPFrontMatter helper, which handles null/undefined frontmatterAttributes
      return getFrontmatterAttributes(note)
    } catch (error) {
      logError(pluginJson, `FrontmatterModule.getFrontmatterAttributes error: ${error}`)
      return {}
    }
  }

  /**
   * Update existing front matter attributes based on the provided newAttributes
   * @param {TEditor | TNote} note - The note to update
   * @param {{ [string]: string }} newAttributes - The complete set of desired front matter attributes
   * @param {boolean} deleteMissingAttributes - Whether to delete attributes that are not present in newAttributes (default: false)
   * @returns {boolean} Whether the front matter was updated successfully
   */
  updateFrontMatterVars(note: TEditor | TNote, newAttributes: { [string]: string }, deleteMissingAttributes: boolean = false): boolean {
    return updateFrontMatterVars(note, newAttributes, deleteMissingAttributes)
  }

  /**
   * Alias for updateFrontMatterVars - Update existing front matter attributes
   * @param {TEditor | TNote} note - The note to update
   * @param {{ [string]: string }} newAttributes - The complete set of desired front matter attributes
   * @param {boolean} deleteMissingAttributes - Whether to delete attributes that are not present in newAttributes (default: false)
   * @returns {boolean} Whether the front matter was updated successfully
   */
  updateFrontmatterAttributes(note: TEditor | TNote, newAttributes: { [string]: string }, deleteMissingAttributes: boolean = false): boolean {
    return this.updateFrontMatterVars(note, newAttributes, deleteMissingAttributes)
  }

  /**
   * Get all frontmatter properties/attributes from a note as an object
   * @param {CoreNoteFields} note - The note to get properties from (defaults to Editor.note if not provided)
   * @returns {{ [string]: string }} Object of all frontmatter properties
   */
  properties(note: CoreNoteFields = Editor?.note): { [string]: string } {
    try {
      // Defensive check: ensure the note object exists
      if (!note) {
        logError(pluginJson, `FrontmatterModule.properties: note is null or undefined`)
        return {}
      }

      // Use the existing getFrontmatterAttributes method
      return this.getFrontmatterAttributes(note)
    } catch (error) {
      logError(pluginJson, `FrontmatterModule.properties error: ${error}`)
      return {}
    }
  }

  convertProjectNoteToFrontmatter(projectNote: string = ''): any {
    if (this.isFrontmatterTemplate(projectNote)) {
      return -3
    }

    let note = projectNote

    if (note.length === 0) {
      return -1
    }

    const lines = note.split('\n')
    if (lines.length === 0) {
      return -1
    }

    let title = lines.shift()
    if (!title.startsWith('#')) {
      return -2
    }

    title = title.substr(2)

    note = lines.join('\n')

    // construct fronmatter object
    // - use first line from above as `title` attribute value
    let frontmatter = '---\n'
    frontmatter += `title: ${title}\n`
    frontmatter += 'type: empty-note\n'
    frontmatter += '---\n'

    note = `${frontmatter}${note}`

    return note
  }
}
