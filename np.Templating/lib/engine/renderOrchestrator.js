// @flow
/* eslint-disable */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2021-2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import { logDebug, logError, clo } from '@helpers/dev'
import pluginJson from '../../plugin.json'

// Import all the modular components
import { processFrontmatter, integrateFrontmatterData } from './frontmatterProcessor'
import { renderTemplate, postProcessResult, replaceDoubleDashes, appendPreviousPhaseErrors } from './templateRenderer'
import { cleanErrorMessage, extractErrorContext, buildBasicErrorMessage, appendPreviousPhaseErrorsToError } from './errorProcessor'
import { analyzeErrorWithAI, handleAIAnalysisResult } from './aiAnalyzer'
import { integratePlugins } from './pluginIntegrator'

/**
 * Orchestrates the complete template rendering process using modular components.
 * This is the main render method that coordinates all the rendering steps.
 * @param {string} templateData - The template string to render
 * @param {Object} renderData - The render context data
 * @param {Object} options - EJS rendering options
 * @param {Array<{name: string, method: Function}>} templatePlugins - Array of registered template plugins
 * @param {string} originalScript - The original user script for error reporting
 * @param {Array<{phase: string, error: string, context: string}>} previousPhaseErrors - Errors from previous phases
 * @returns {Promise<string>} The rendered template or error message
 */
export async function orchestrateRender(
  templateData: string,
  renderData: Object,
  options: Object,
  templatePlugins: Array<{ name: string, method: Function }>,
  originalScript: string,
  previousPhaseErrors: Array<{ phase: string, error: string, context: string }>,
): Promise<string> {
  try {
    logDebug('RENDER ENGINE: Starting template rendering process')

    // Step 1: Process frontmatter if present
    const { processedTemplateData, frontmatterData } = await processFrontmatter(templateData, renderData)

    // Step 2: Integrate frontmatter data into render context
    const enhancedRenderData = integrateFrontmatterData(renderData, frontmatterData)

    // Step 3: Integrate custom plugins
    const finalRenderData = integratePlugins(enhancedRenderData, templatePlugins)

    // Step 4: Render the template
    outputDebugData('Before template rendering', finalRenderData)
    let result = await renderTemplate(processedTemplateData, finalRenderData, options)

    // Step 5: Post-process the result
    result = postProcessResult(result)

    // Step 6: Append previous phase errors if any exist
    if (previousPhaseErrors && previousPhaseErrors.length > 0) {
      logDebug(`RENDER ENGINE: Appending ${previousPhaseErrors.length} previous phase errors`)
      result = appendPreviousPhaseErrors(result, previousPhaseErrors)
    }

    // Step 7: Final formatting
    result = replaceDoubleDashes(result)

    logDebug(`🚒 ✅ RENDER ENGINE COMPLETE: Successfully rendered template`)
    return result
  } catch (error) {
    logDebug(`❌ RENDER ENGINE ERROR: Template rendering failed`)
    return await handleRenderError(error, templateData, renderData, originalScript, previousPhaseErrors)
  }
}

/**
 * Handles rendering errors using modular error processing components.
 * @param {Error} error - The error that occurred during rendering
 * @param {string} processedTemplateData - The processed template data
 * @param {Object} renderData - The render context data
 * @param {string} originalScript - The original user script
 * @param {Array<{phase: string, error: string, context: string}>} previousPhaseErrors - Previous phase errors
 * @returns {Promise<string>} The formatted error message
 */
async function handleRenderError(
  error: Error,
  processedTemplateData: string,
  renderData: Object,
  originalScript: string,
  previousPhaseErrors: Array<{ phase: string, error: string, context: string }>,
): Promise<string> {
  logDebug(`🔧 RENDER ENGINE ERROR HANDLING STEP 1: Cleaning error message`)
  logDebug(`Raw error: ${typeof error === 'object' ? JSON.stringify(error, null, 2) : error}`)
  outputDebugData('Error context render data')

  // Step 1: Clean the error message
  const rawErrorMessage = error.message || 'Unknown error'
  const cleanedErrorMessage = cleanErrorMessage(rawErrorMessage)

  // Step 2: Extract error context
  logDebug(`🔧 RENDER ENGINE ERROR HANDLING STEP 2: Extracting error context`)
  const { contextLines, lineInfo, adjustedLine } = extractErrorContext(error, processedTemplateData)

  // Step 3: Build basic error message
  logDebug(`🔧 RENDER ENGINE ERROR HANDLING STEP 3: Building basic error message`)
  const basicErrorMessage = buildBasicErrorMessage(cleanedErrorMessage, lineInfo, contextLines, originalScript)

  // Step 4: Try AI analysis
  logDebug(`🔧 RENDER ENGINE ERROR HANDLING STEP 4: Attempting AI analysis`)
  try {
    const aiAnalysis = await analyzeErrorWithAI(rawErrorMessage, processedTemplateData, renderData, originalScript, previousPhaseErrors)

    // Step 5: Handle AI analysis result
    logDebug(`🔧 RENDER ENGINE ERROR HANDLING STEP 5: Processing AI analysis result`)
    const finalResult = handleAIAnalysisResult(aiAnalysis, basicErrorMessage, rawErrorMessage, previousPhaseErrors)

    return finalResult.replace(/\n\n/g, '\n')
  } catch (aiError) {
    logError(pluginJson, `AI error analysis failed: ${aiError.message}`)

    // Step 5 (fallback): Handle error without AI analysis
    logDebug(`🔧 RENDER ENGINE ERROR HANDLING STEP 5 (FALLBACK): Processing without AI analysis`)
    let result = basicErrorMessage
    result = appendPreviousPhaseErrorsToError(result, previousPhaseErrors)

    return result.replace(/\n\n/g, '\n')
  }
}

/**
 * Helper function to output debug information about the render context data.
 * @param {string} message - A message to include with the debug output
 * @param {Object} renderData - The render data to debug (optional)
 */
function outputDebugData(message: string, renderData: Object = {}): void {
  /**
   * Gets only the top-level primitive properties from an object for cleaner logging.
   * @param {Object} obj - The object to extract properties from
   * @returns {Object} A new object containing only the top-level primitive properties
   */
  const getTopLevelProps = (obj: Object) =>
    Object.entries(obj).reduce((acc, [key, value]) => (typeof value !== 'object' || value === null || typeof value === 'function' ? { ...acc, [key]: value } : acc), {})

  clo(getTopLevelProps(renderData), `🔍 Templating context object (top level values only) ${message}`)
}
