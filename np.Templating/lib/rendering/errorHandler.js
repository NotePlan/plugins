// @flow
/**
 * @fileoverview Error handling utilities for template rendering.
 */

import pluginJson from '../../plugin.json'
import { templateErrorMessage as errorMessageUtil } from '../utils/errorHandling'
import { logDebug, logError } from '@helpers/dev'

/**
 * Returns a formatted error message for template rendering errors.
 * @param {string} location - The source location of the error
 * @param {Error|string} error - The error object or message
 * @returns {string} A formatted error message
 */
export function templateErrorMessage(location: string, error: Error | string): string {
  return errorMessageUtil(location, error)
}
