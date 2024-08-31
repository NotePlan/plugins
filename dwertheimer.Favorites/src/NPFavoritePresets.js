// @flow

import pluginJson from '../plugin.json'
import { showMessage, chooseOption } from '@helpers/userInput'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
import { type PresetCommand, savePluginCommand, choosePreset, presetChosen } from '@helpers/NPPresets'
import { getPluginJson } from '@helpers/NPConfiguration'

const COMMAND_NAME_TEMPLATE = 'Favorites: Set Preset '

// check whether valid URL or xcallback URL
const isValidURL = (url) => /^(https?|[a-z0-9\-]+):\/\/[a-z0-9\-]+/i.test(url)

/**
 * Get the URL either through the callback creator or hand-entered
 */
export async function getURL(commandName: string, defaultValue: string): Promise<string> {
  const options = [
    { label: 'Run Link Creator to get URL (e.g. a NotePlan X-Callback)', value: 'linkCreator' },
    { label: 'Enter/Paste URL (you know or can paste the URL)', value: 'enter' },
  ]
  if (defaultValue) options.push({ label: `Keep Previous Value: "${defaultValue}"`, value: 'previous' })
  const choice = await chooseOption('How do you want to set the URL?', options, null)
  let url = ''
  if (choice) {
    if (choice === 'linkCreator') {
      url = await DataStore.invokePluginCommandByName('Get X-Callback-URL', 'np.CallbackURLs', ['', true])
    } else if (choice === 'enter') {
      url = await CommandBar.textPrompt('Set Preset X-Callback', `What X-Callback or URL do you want to run when the command\n"${commandName}"\nis selected?`, defaultValue || '')
    } else if (choice === 'previous') {
      url = defaultValue
    }
  } else {
    logDebug(pluginJson, `getURL no choice made. Returning empty string.`)
  }
  return url || ''
}

/**
 * Each of the preset commands calls this function, as does set/reset a command
 * It is called indirectly, as a callback sent to presetChosen
 * @param {PresetCommand} commandDetails - the full command object from the current plugin.json
 * @param {boolean} overwrite - this is a set/reset call
 */
export async function favoritePresetChosen(commandDetails: PresetCommand | null = null, overwrite: boolean = false) {
  if (!Editor) {
    showMessage(`You must be in the Editor with a document open to run this command`)
    return
  }
  clo(commandDetails, `favoritePresetChosen: overwrite:${String(overwrite)} commandDetails:`)
  if (commandDetails) {
    let commandName = commandDetails.name.startsWith(COMMAND_NAME_TEMPLATE) ? '' : commandDetails.name
    commandName = DataStore.settings.charsToPrepend ? commandName.replace(DataStore.settings.charsToPrepend, '').trim() : commandName
    logDebug(pluginJson, `favoritePresetChosen: command.name = "${commandDetails.name}" overwrite?:${String(overwrite)}`)
    // Put the text of an unset command in the plugin.json here (how we tell if it's vanilla/unset)
    const favoriteIsUnset = !commandDetails.name || commandDetails.name.match(/Set Preset/)
    logDebug(pluginJson, `favoritePresetChosen: favoriteIsUnset=${String(favoriteIsUnset)}`)
    if (favoriteIsUnset || overwrite) {
      // SET THE PRESET COMMAND
      let favoriteCommand = await CommandBar.textPrompt(
        'Set Preset Text',
        'What human-readable text do you want to use for the command? (this is the text you will see in the Command Bar when you type slash)\n\nLeave blank to unset the command',
        commandName,
      )
      logDebug(pluginJson, `favoritePresetChosen favoriteCommand entered=${String(favoriteCommand)}`)
      if (favoriteCommand && favoriteCommand !== '') {
        favoriteCommand = DataStore.settings.charsToPrepend ? `${DataStore.settings.charsToPrepend}${favoriteCommand}` : favoriteCommand
        const text = await getURL(favoriteCommand, commandDetails.data || '')
        if (text) {
          // validate x-callback URL
          if (!isValidURL(text)) {
            await showMessage(`"${text}" is not a valid URL. Must be an X-Callback URL or full Web URL. Please try again.`)
            return
          }
          await savePluginCommand(pluginJson, { ...commandDetails, name: favoriteCommand, data: text })
          await showMessage(
            `Menu command set.\n\nYou will find it in the CommandBar immediately by typing:\n"/${String(
              favoriteCommand,
            )}"\nYou won't see it in the menu until you restart NotePlan.`,
          )
        } else {
          // User cancelled the x-callback prompt
          await showMessage(`Command not set. You must enter an X-Callback URL to set this command.`)
        }
      } else {
        if (favoriteCommand === '') {
          clo(commandDetails, `favoritePresetChosen: Unsetting commandDetails:`)
          const numString = commandDetails.jsFunction.replace(/runPreset/, '')
          await savePluginCommand(pluginJson, { ...commandDetails, name: `${COMMAND_NAME_TEMPLATE} ${numString}`, data: '' })
          await showMessage(`Preset ${numString} has been deleted and can be reused.`)
        } // otherwise someone canceled the command
      }
    } else {
      // EXECUTE THE COMMAND CLICKED
      if (commandDetails.data) {
        NotePlan.openURL(commandDetails.data)
      } else {
        logError(pluginJson, `favoritePresetChosen No commandDetails.data for command: ${commandName}. Cannot move forward.`)
      }
    }
  } else {
    logError(pluginJson, `favoritePresetChosen: no command details object sent. Cannot continue.`)
  }
}

/*
 * PLUGIN ENTRYPOINTS BELOW THIS LINE
 */

/**
 * Change a preset to another one
 * Plugin entrypoint for command: "/Change favorite Preset"
 * @param {*} incoming
 */
export async function changePreset(incoming: string) {
  try {
    logDebug(pluginJson, `changePreset  running incoming:${incoming}`)
    const livePluginJson = await getPluginJson(pluginJson['plugin.id'])
    const chosen = await choosePreset(livePluginJson, 'Choose a preset to set/reset')
    if (chosen) {
      logDebug(pluginJson, `changePreset: ${chosen} -- calling presetChosen with favoritePresetChosen callback`)
      await presetChosen(pluginJson, chosen, favoritePresetChosen, [true])
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * PRESET ENTRYPOINTS BELOW
 */

export const runPreset01 = async (): Promise<void> => await presetChosen(pluginJson, `runPreset01`, favoritePresetChosen)
export const runPreset02 = async (): Promise<void> => await presetChosen(pluginJson, `runPreset02`, favoritePresetChosen)
export const runPreset03 = async (): Promise<void> => await presetChosen(pluginJson, `runPreset03`, favoritePresetChosen)
export const runPreset04 = async (): Promise<void> => await presetChosen(pluginJson, `runPreset04`, favoritePresetChosen)
export const runPreset05 = async (): Promise<void> => await presetChosen(pluginJson, `runPreset05`, favoritePresetChosen)
export const runPreset06 = async (): Promise<void> => await presetChosen(pluginJson, `runPreset06`, favoritePresetChosen)
export const runPreset07 = async (): Promise<void> => await presetChosen(pluginJson, `runPreset07`, favoritePresetChosen)
export const runPreset08 = async (): Promise<void> => await presetChosen(pluginJson, `runPreset08`, favoritePresetChosen)
export const runPreset09 = async (): Promise<void> => await presetChosen(pluginJson, `runPreset09`, favoritePresetChosen)
export const runPreset10 = async (): Promise<void> => await presetChosen(pluginJson, `runPreset10`, favoritePresetChosen)
export const runPreset11 = async (): Promise<void> => await presetChosen(pluginJson, `runPreset11`, favoritePresetChosen)
export const runPreset12 = async (): Promise<void> => await presetChosen(pluginJson, `runPreset12`, favoritePresetChosen)
export const runPreset13 = async (): Promise<void> => await presetChosen(pluginJson, `runPreset13`, favoritePresetChosen)
export const runPreset14 = async (): Promise<void> => await presetChosen(pluginJson, `runPreset14`, favoritePresetChosen)
export const runPreset15 = async (): Promise<void> => await presetChosen(pluginJson, `runPreset15`, favoritePresetChosen)
export const runPreset16 = async (): Promise<void> => await presetChosen(pluginJson, `runPreset16`, favoritePresetChosen)
export const runPreset17 = async (): Promise<void> => await presetChosen(pluginJson, `runPreset17`, favoritePresetChosen)
export const runPreset18 = async (): Promise<void> => await presetChosen(pluginJson, `runPreset18`, favoritePresetChosen)
export const runPreset19 = async (): Promise<void> => await presetChosen(pluginJson, `runPreset19`, favoritePresetChosen)
export const runPreset20 = async (): Promise<void> => await presetChosen(pluginJson, `runPreset20`, favoritePresetChosen)
