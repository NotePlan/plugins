// @flow
/**
 * @fileoverview Functions for integrating with other NotePlan plugins
 * Provides utilities to check for command availability and invoke commands
 */

import pluginJson from '../../plugin.json'
import { logDebug, logError } from '@helpers/dev'

/**
 * Returns a formatted error message for template-related errors.
 *
 * @param {string} location - The source location where the error occurred
 * @param {Error|string} error - The error object or message
 * @returns {string} A formatted error message string
 */
export function templateErrorMessage(location: string, error: Error | string): string {
  const errorMsg = error instanceof Error ? `${error.message}\n${error.stack || ''}` : error
  logError(pluginJson, `${location} error: ${errorMsg}`)
  return `Template Error in ${location}:\n${errorMsg}`
}

/**
 * Check if a command is available in another plugin
 *
 * @param {string} pluginId - The ID of the plugin to check
 * @param {string} commandName - The name of the command to check for
 * @returns {Promise<boolean>} Promise resolving to true if the command is available
 */
export async function isCommandAvailable(pluginId: string, commandName: string): Promise<boolean> {
  try {
    logDebug(pluginJson, `Checking if command ${commandName} is available in plugin ${pluginId}`)

    // Check if DataStore.installedPlugins exists (introduced in NotePlan 3.0.15)
    if (!DataStore.installedPlugins) {
      logDebug(pluginJson, 'DataStore.installedPlugins not available in this version of NotePlan')
      return false
    }

    // Look for the specified plugin in the installed plugins
    const matchingPlugin = await Promise.resolve(DataStore.installedPlugins.find((p) => p.id === pluginId))
    if (!matchingPlugin) {
      logDebug(pluginJson, `Plugin ${pluginId} not found in installed plugins`)
      return false
    }

    // Check if the plugin has the specified command
    const hasCommand = matchingPlugin.commands.some((cmd) => cmd.name === commandName)
    logDebug(pluginJson, `Command ${commandName} ${hasCommand ? 'found' : 'not found'} in plugin ${pluginId}`)

    return hasCommand
  } catch (error) {
    logError(pluginJson, `Error checking command availability: ${error.message}`)
    return false
  }
}

/**
 * Invoke a command from another plugin by name
 *
 * @param {string} pluginId - The ID of the plugin containing the command
 * @param {string} commandName - The name of the command to invoke
 * @param {any} [args={}] - Arguments to pass to the command
 * @returns {Promise<any>} Promise resolving to the result of the command
 */
export async function invokePluginCommandByName(pluginId: string, commandName: string, args: any = {}): Promise<any> {
  try {
    logDebug(pluginJson, `Invoking command ${commandName} from plugin ${pluginId}`)

    // Check if the command is available before attempting to invoke it
    const isAvailable = await isCommandAvailable(pluginId, commandName)
    if (isAvailable) {
      // Use NotePlan's API to call the command
      const result = await NotePlan.invokePluginCommandByName(commandName, pluginId, args)
      return result
    } else {
      throw new Error(`Command ${commandName} not available in plugin ${pluginId}`)
    }
  } catch (error) {
    logError(pluginJson, `Error invoking plugin command: ${error.message}`)
    throw error
  }
}

// Export all functions as named exports and as a default object
export default {
  templateErrorMessage,
  isCommandAvailable,
  invokePluginCommandByName,
}
