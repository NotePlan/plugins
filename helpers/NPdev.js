// @flow

import { clo, log } from './dev'

import { createRunPluginCallbackUrl } from './general'
import { chooseOption, getInput, showMessageYesNo } from './userInput'
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
    console.log(`  NotePlan.environment not defined; it isn't available in NP until v3.3.2.`)
  }
}

export async function chooseRunPluginXCallbackURL(
  showInstalledOnly: boolean = true,
): Promise<boolean | { url: string, pluginID: string, command: string, args: Array<string> }> {
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
  log(`NPdev::chooseRunPluginXCallbackURL`, `chosen: ${chosenID}`)
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
      // log(`NPdev::getArgumentText`, `getYesNo: ${getYesNo} Opening ${url}`)
      if (getYesNo === 'Yes') {
        NotePlan.openURL(url)
      }
    }
    while (!finished) {
      res = await getArgumentText(chosenCommand, i)
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
 * @returns
 */
async function getArgumentText(command: any, i: number): Promise<string | false> {
  const message = `If parameters are required for this plugin, enter one-by-one in the correct order per the plugin's documentation.`
  const stopMessage = `\n\n(Leave the text field empty and hit ENTER/OK to finish argument entry)`
  // TODO: once Eduard adds arguments to the command.arguments object that gets passed through, we can skip the following few lines
  const commandPluginJson = DataStore.loadJSON(`../../${command?.plugin?.id}/plugin.json`)
  const commandInfo = commandPluginJson['plugin.commands'].find((c) => c.name === command.name)
  const argDescriptions = commandInfo ? commandInfo.arguments : null // eventually = command.arguments
  clo(argDescriptions, 'argDescriptions')
  const addlInfo =
    argDescriptions && argDescriptions[i]
      ? `\n\n"arg${i}" description:\n"${argDescriptions[i]}"`
      : `\n\nWhat should arg${i}'s value be?`
  return await getInput(`${message}${addlInfo}${stopMessage}`, 'OK', `Plugin Arguments for \n"${command.label}"`)
}
