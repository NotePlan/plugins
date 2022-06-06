// @flow

import { clo, JSP, logAllPropertyNames } from './dev'

import { createRunPluginCallbackUrl } from './general'
import { chooseOption, getInput } from './userInput'
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

export async function chooseRunPluginXCallbackURL(showInstalledOnly: boolean = true): Promise<string | false> {
  const plugins = (await showInstalledOnly) ? DataStore.installedPlugins() : DataStore.listPlugins()

  let commandMap = []
  plugins.forEach((plugin) => {
    plugin.commands?.forEach((command) => {
      const show = `${command.name} (${plugin.name})`
      commandMap.push({
        name: command.name,
        description: command.description,
        command: command,
        plugin: plugin,
        label: show,
        value: show,
      })
    })
  })
  commandMap = commandMap.sort((a, b) => a.label.localeCompare(b.label))
  const chosenID = await chooseOption('Which command?', commandMap, '__NONE__')
  console.log(`chosen: ${chosenID}`)
  const chosenCommand = commandMap.find((command) => command.value === chosenID)
  const command = chosenCommand?.command?.name
  const pluginID = chosenCommand?.plugin.id

  let res
  if (chosenCommand && command?.length && pluginID) {
    let finished = false,
      i = 0,
      args = []
    while (!finished) {
      res = await getArgumentText(chosenCommand.label, i)
      if (res === '' || res === false) {
        // NOTE: false here could optionally kill the whole wizard
        finished = true
      } else {
        args.push(res)
        i++
      }
    }
    return res === false ? false : createRunPluginCallbackUrl(pluginID, command, args)
  } else {
    return 'Error - no command chosen'
  }
}

async function getArgumentText(commandName: string, i: number): Promise<string | false> {
  const message = `Some plugin commands need/expect additional information in order to work.\n\nEnter parameters one-by-one in the correct order per the plugin's documentation. \n\n(Leave the text field empty and hit ENTER/OK to finish argument entry)\n\narg${i} value?`
  return await getInput(message, 'OK', `Plugin Arguments for \n"${commandName}"`)
}
