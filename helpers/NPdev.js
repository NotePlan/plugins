// @flow

import { showMessage } from './userInput'
import { clo, logDebug, logError, logWarn } from '@helpers/dev'
import { createRunPluginCallbackUrl } from '@helpers/general'
import { chooseOption, getInput, getInputTrimmed, showMessageYesNo } from '@helpers/userInput'

/**
 * Print to the console log all contents of the environment variable, introduced in v3.3.2
 * @author @dwertheimer
 */
export function logAllEnvironmentSettings(): void {
  if (NotePlan.environment) {
    // TODO: don't know why this is no longer working for me:
    clo(NotePlan.environment, 'NotePlan.environment:')
    // TODO: when the following simple case *is* working:
    // console.log(NotePlan.environment.platform)
  } else {
    logWarn('logAllEnvironmentSettings', `NotePlan.environment not available until NP 3.3.2.`)
  }
}

export async function chooseRunPluginXCallbackURL(showInstalledOnly: boolean = true): Promise<boolean | { url: string, pluginID: string, command: string, args: Array<string> }> {
  const plugins = showInstalledOnly ? await DataStore.installedPlugins() : await DataStore.listPlugins(true)

  let commandMap = []
  plugins?.forEach((plugin) => {
    if (Array.isArray(plugin.commands)) {
      plugin.commands?.forEach((command) => {
        const show = `${command.name} (${plugin.name})`
        // $FlowIgnore
        commandMap.push({
          name: command.name,
          description: command.desc,
          command: command,
          plugin: plugin,
          label: show,
          value: show,
        })
      })
    }
  })
  commandMap = commandMap.sort((a, b) => a.label.localeCompare(b.label))
  const chosenID = await chooseOption('Which command?', commandMap, '__NONE__')
  logDebug(`NPdev::chooseRunPluginXCallbackURL`, `chosen: ${chosenID}`)
  const chosenCommand = commandMap.find((command) => command.value === chosenID)
  const command = chosenCommand?.command?.name
  const pluginID = chosenCommand?.plugin.id

  let res
  if (chosenCommand && command?.length && pluginID) {
    let finished = false
    let i = 0
    const args = []
    const url = chosenCommand?.plugin?.repoUrl || ''
    if (url.length) {
      const getYesNo = await showMessageYesNo(
        `We are about to ask you for parameters to supply to the plugin command. You may want to review the plugin's documentation to ensure you get the parameters (if there are any) correct.\n\nOpen docs for\n"${chosenCommand.label}"?`,
        ['Yes', 'No'],
        'Open Documentation?',
      )
      // logDebug(`NPdev::getArgumentText`, `getYesNo: ${getYesNo} Opening ${url}`)
      if (getYesNo === 'Yes') {
        NotePlan.openURL(url)
      }
    }
    while (!finished) {
      res = await getArgumentText(chosenCommand, i)
      if ('__NO_PLUGIN__' === res) return false
      if (res === '' || res === false) {
        // NOTE: false here could optionally kill the whole wizard
        finished = true
      } else {
        args.push(res)
        i++
      }
    }
    return res === false ? false : { pluginID, command, args, url: createRunPluginCallbackUrl(pluginID, command, args) }
  } else {
    return false
  }
}

/**
 * Get arg0...argN from the user for for the XCallbackURL
 * @param {string:any} command
 * @param {number} i - index of the argument (e.g. arg0, arg1, etc.)
 * @returns {string|false} - false if user cancels, otherwise the text entered (or '__NO_PLUGIN__' if plugin not found)
 */
async function getArgumentText(command: any, i: number): Promise<string | false> {
  const message = `If parameters are required for this plugin, enter one-by-one in the correct order per the plugin's documentation.`
  const stopMessage = `\n\n(Leave the text field empty and hit ENTER/OK to finish argument entry)`
  // TODO: once Eduard adds arguments to the command.arguments object that gets passed through, we can skip the following few lines
  const commandPluginJson = DataStore.loadJSON(`../../${command?.plugin?.id}/plugin.json`)
  if (!commandPluginJson) {
    clo(command, 'getArgumentText could not load JSON for command. Will attempt to install it from github. User instructed to download plugin and try again.')
    await showMessage(
      `Could not find plugin "${command.plugin.name}". We will try to install it automatically now, but you should check that it's installed and run this command again.`,
    )
    const plugin = (await DataStore.listPlugins(true, true, true)).find((p) => p.id === command.plugin.id)
    if (plugin) {
      await DataStore.installPlugin(plugin, true)
    }
    return '__NO_PLUGIN__'
  }
  const commandInfo = commandPluginJson['plugin.commands'].find((c) => c.name === command.name)
  const argDescriptions = commandInfo ? commandInfo.arguments : null // eventually = command.arguments
  clo(argDescriptions, 'argDescriptions')
  const addlInfo = argDescriptions && argDescriptions[i] ? `\n\n"arg${i}" description:\n"${argDescriptions[i]}"` : `\n\nWhat should arg${i}'s value be?`
  return await getInput(`${message}${addlInfo}${stopMessage}`, 'OK', `Plugin Arguments for \n"${command.label}"`)
}

/**
 * Write the local preference 'key' to console, along with its type
 * @param {string} key
 */
export function logPreference(key: string): void {
  try {
    const value = DataStore.preference(key) ?? undefined
    if (value === undefined) {
      logDebug(`logPreference`, `"${key}" not found`)
    } else if (typeof value === 'object') {
      clo(value, `logPreference "${key}" [object]:`)
    } else if (typeof value === 'string') {
      logDebug('logPreference', `"${key}" [string]: "${value}"`)
    } else if (typeof value === 'number') {
      logDebug('logPreference', `"${key}" [number]: "${String(value)}"`)
    } else if (typeof value === 'boolean') {
      logDebug('logPreference', `"${key}" [boolean]: "${String(value)}"`)
    } else {
      logDebug('logPreference', `"${key}": "${String(value)}"`)
    }
  } catch (error) {
    logError('logPreference', error.message)
  }
}

/**
 * Write the local preference 'key' to console, requested by asking user
 * @param {string} key
 */
export async function logPreferenceAskUser(): Promise<void> {
  try {
    const res = await getInputTrimmed('Enter key/name to display to log', 'OK', 'Log Preference')
    if (typeof res !== 'boolean') {
      logPreference(res)
    }
  } catch (error) {
    logError('logPreferenceAskUser', error.message)
  }
}

/**
 * Unset a local preference using passed parameter, or by asking user
 * @param {string} prefName
 */
export function unsetPreference(prefName: string): void {
  try {
    DataStore.setPreference(prefName, null)
    logDebug('unsetPreference', `Unset local pref ${prefName}`)
  } catch (error) {
    logError('unsetPreference', error.message)
  }
}

/**
 * Unset a local preference, requested by asking user
 * @param {string?} prefName?
 */
export async function unsetPreferenceAskUser(): Promise<void> {
  try {
    const res = await getInputTrimmed('Enter key/name to unset', 'OK', 'Unset Preference')
    if (typeof res !== 'boolean') {
      unsetPreference(res)
    }
  } catch (error) {
    logError('unsetPreferenceAskUser', error.message)
  }
}
