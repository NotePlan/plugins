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

export async function chooseRunPluginXCallbackURL(showInstalledOnly: boolean = true) {
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
  // const args = await getArgList(command, pluginID)
  let finished = false,
    i = 0,
    args = []
  while (!finished) {
    console.log(i)
    const res = await getArgumentText(chosenCommand.label, i)
    if (res === '') {
      finished = true
    } else {
      args.push(res)
      i++
    }
  }
  return createRunPluginCallbackUrl(pluginID, command, args)
}

async function getArgumentText(commandName, i) {
  const message = `What's the value you want for arg${i}?\n\n(ENTER to finish)`
  const res = await getInput(message, 'OK', 'Plugin Arguments')
  console.log(`res: ${res}`)
  return res
}
