// @flow
/**
 * @fileoverview Centralized export for all prompt handlers
 * This file provides a clean interface for accessing all prompt handler functions
 * while maintaining backward compatibility with the old NPTemplating API.
 */

import StandardPromptHandler from '../StandardPromptHandler'
import PromptDateHandler from '../PromptDateHandler'
import PromptDateIntervalHandler from '../PromptDateIntervalHandler'
import PromptKeyHandler from '../PromptKeyHandler'
import PromptTagHandler from '../PromptTagHandler'
import PromptMentionHandler from '../PromptMentionHandler'
import BasePromptHandler from '../BasePromptHandler'
import { processPrompts, processPromptTag, getRegisteredPromptNames, isPromptTag } from '../PromptRegistry'

/**
 * Displays a date picker prompt to the user.
 * @param {string} message - The message to display in the prompt
 * @param {string} defaultValue - The default date value
 * @returns {Promise<any>} A promise that resolves to the selected date
 */
export const promptDate = (message: string, defaultValue: string): Promise<any> => {
  return PromptDateHandler.promptDate('', message, defaultValue)
}

/**
 * Displays a date interval picker prompt to the user.
 * @param {string} message - The message to display in the prompt
 * @param {string} defaultValue - The default date interval value
 * @returns {Promise<any>} A promise that resolves to the selected date interval
 */
export const promptDateInterval = (message: string, defaultValue: string): Promise<any> => {
  return PromptDateIntervalHandler.promptDateInterval('', message, defaultValue)
}

/**
 * Parses parameters from a prompt key tag.
 * @param {string} tag - The prompt key tag to parse
 * @returns {Object} The parsed parameters
 */
export const parsePromptKeyParameters = (tag: string): Object => {
  return PromptKeyHandler.parsePromptKeyParameters(tag)
}

/**
 * Shows a prompt to the user with optional configuration.
 * @param {string} message - The message to display in the prompt
 * @param {any} options - Options for the prompt
 * @returns {Promise<any>} A promise that resolves to the user's response
 */
export const prompt = (message: string, options: any = null): Promise<any> => {
  return StandardPromptHandler.prompt('', message, options)
}

/**
 * Extracts parameters from a prompt tag.
 * @param {string} promptTag - The prompt tag to extract parameters from
 * @returns {Promise<mixed>} A promise that resolves to the extracted parameters
 */
export const getPromptParameters = (promptTag: string): mixed => {
  return BasePromptHandler.getPromptParameters(promptTag)
}

// Export everything needed for backward compatibility
export { processPrompts, processPromptTag, getRegisteredPromptNames, isPromptTag }

// Export default object with all methods for easy import
export default {
  promptDate,
  promptDateInterval,
  parsePromptKeyParameters,
  prompt,
  getPromptParameters,
  processPrompts,
  processPromptTag,
  getRegisteredPromptNames,
  isPromptTag,
}
