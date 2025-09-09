// @flow
/* eslint-disable */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2021-2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import ejs from '../support/ejs'
import { logDebug } from '@helpers/dev'
import pluginJson from '../../plugin.json'
import { convertEJSClosingTags } from '../shared/templateUtils'

/**
 * Renders template data using EJS with the provided render context.
 * @param {string} processedTemplateData - The template string to render
 * @param {Object} renderData - The render context data
 * @param {Object} options - EJS rendering options
 * @returns {Promise<string>} The rendered template result
 */
export async function renderTemplateWithEJS(processedTemplateData: string, renderData: Object, options: Object): Promise<string> {
  logDebug(pluginJson, `EJS render: ${Object.keys(renderData).length} data keys available`)

  // Convert EJS closing tags to prevent unwanted whitespace
  processedTemplateData = convertEJSClosingTags(processedTemplateData)

  const result = await ejs.render(processedTemplateData, renderData, options)

  return result
}

/**
 * Post-processes the rendered result to clean up common issues.
 * @param {string} result - The raw rendered result
 * @returns {string} The cleaned up result
 */
export function postProcessResult(result: string): string {
  // Clean up undefined values and promise objects
  let cleanedResult = (result && result?.replace(/undefined/g, '')) || ''
  cleanedResult = cleanedResult.replace(
    /\[object Promise\]/g,
    `[object Promise] (**Templating was not able to get the result of this tag. Try adding an 'await' before the function call. See documentation for more information.**)`,
  )

  return cleanedResult
}

/**
 * Replaces double dashes at the beginning and end of a frontmatter block with triple dashes.
 * This allows for a template to render a new note with a frontmatter block.
 * @param {string} templateData - The template string potentially containing frontmatter
 * @returns {string} The template with double dashes converted to triple dashes if needed
 */
export function replaceDoubleDashes(templateData: string): string {
  let returnedData = templateData
  // replace double dashes at top with triple dashes
  const lines = templateData.split('\n')
  const startBlock = lines.indexOf('--')
  const endBlock = startBlock === 0 ? lines.indexOf('--', startBlock + 1) : -1
  if (startBlock >= 0 && endBlock > 0) {
    lines[startBlock] = '---'
    lines[endBlock] = '---'
    returnedData = lines.join('\n')
  }
  return returnedData
}

/**
 * Converts triple dashes at the beginning and end of a frontmatter block to double dashes.
 * This is the opposite of replaceDoubleDashes and allows for template processing of frontmatter.
 * Only processes templates that start with "---\n" (three dashes followed by newline).
 * @param {string} templateData - The template string potentially containing frontmatter with triple dashes
 * @returns {string} The template with triple dashes converted to double dashes if needed
 */
export function convertToDoubleDashesIfNecessary(templateData: string): string {
  // Only process if template starts with "---\n"
  if (!templateData.startsWith('---\n')) {
    return templateData
  }

  let returnedData = templateData
  // convert first two occurrences of triple dashes to double dashes
  const lines = templateData.split('\n')
  const startBlock = 0 // We know it starts with "---" since we checked above
  const endBlock = lines.indexOf('---', startBlock + 1)

  if (endBlock > startBlock) {
    lines[startBlock] = '--'
    lines[endBlock] = '--'
    returnedData = lines.join('\n')
    logDebug(pluginJson, `convertToDoubleDashesIfNecessary: converted triple dashes to double dashes; templateData is now: "${templateData}"`)
  }

  return returnedData
}

/**
 * Appends previous phase errors to successful renders if they exist.
 * @param {string} result - The rendered result
 * @param {Array<{phase: string, error: string, context: string}>} previousPhaseErrors - Errors from previous phases
 * @returns {string} Result with previous phase errors appended if any exist
 */
export function appendPreviousPhaseErrors(result: string, previousPhaseErrors: Array<{ phase: string, error: string, context: string }>): string {
  if (previousPhaseErrors && previousPhaseErrors.length > 0) {
    let updatedResult = result + `\n\n---\n**Note: Issues occurred during frontmatter processing:**\n`
    previousPhaseErrors.forEach((err) => {
      updatedResult += `### ${err.phase}:\n`
      updatedResult += `Error: ${err.error}\n`
      updatedResult += `Context: ${err.context}\n\n`
    })
    updatedResult += '---\n'
    return updatedResult
  }
  return result
}
