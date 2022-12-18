// @flow

import pluginJson from '../plugin.json'
import NPTemplating from '../../np.Templating/lib/NPTemplating'
import { chooseTheme } from './NPThemeChooser'
import { createThemeSamples } from './NPThemeCustomizer'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
import { /* getPluginJson ,*/ updateSettingData, pluginUpdated } from '@helpers/NPConfiguration'
import { rememberPresetsAfterInstall } from '@helpers/NPPresets'

/*
 * NOTEPLAN HOOKS
 * The rest of these functions are called by NotePlan automatically under certain conditions
 * It is unlikely you will need to edit/add anything below this line
 */

/**
 * NotePlan calls this function after the plugin is installed or updated.
 * The `updateSettingData` function looks through the new plugin settings in plugin.json and updates
 * the user preferences to include any new fields
 */
export async function onUpdateOrInstall(): Promise<void> {
  log(pluginJson, 'NPThemeChooser::onUpdateOrInstall running')
  await updateSettingData(pluginJson)
  await rememberPresetsAfterInstall(pluginJson)
}

/**
 * NotePlan calls this function every time the plugin is run (any command in this plugin)
 * You should not need to edit this function. All work should be done in the commands themselves
 */
export function init(): void {
  //   clo(DataStore.settings, `${pluginJson['plugin.id']} Plugin Settings`)
  DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], true, false, false).then((r) => pluginUpdated(pluginJson, r))
}

/**
 * NotePlan calls this function settings are updated in the Preferences panel
 * You should not need to edit this function
 */
export async function onSettingsUpdated(): Promise<void> {}

/**
 * onOpen
 * Plugin entrypoint for command: "/onOpen"
 * @param {*} incoming
 */
export async function onOpenTheme(note: TNote): Promise<void> {
  try {
    logDebug(pluginJson, `onOpen running with incoming:${String(note.filename)}`)
    logDebug(pluginJson, `onOpen: note is a template, not doing anything`)
    const { frontmatterBody, frontmatterAttributes } = await NPTemplating.preRender(note.content)
    clo(frontmatterAttributes, `onOpen: frontmatterAttributes`)
    clo(frontmatterBody, `onOpen: frontmatterBody`)
    if (frontmatterAttributes.themeName) {
      const themeName = frontmatterAttributes.themeName
      await chooseTheme(themeName)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * When note is opened, check if it's been awhile and if so, reload the contents
 * Triggered on open using:
 * triggers:	onOpen => np.ThemeChooser.onOpenRefreshPage
 * @param {*} note
 */
export async function onOpenRefreshPage(note: TNote): Promise<void> {
  try {
    const now = new Date()
    if (Editor?.note?.changedDate) {
      const lastEdit = new Date(Editor?.note?.changedDate)
      if (now - lastEdit > 30000) {
        // const refresherPara = note.paragraphs[1]
        // note.removeParagraph(refresherPara) // try to keep circular refresh from happening
        // do not refresh unless it's been at least 15 seconds since the last
        logDebug(pluginJson, `onOpenRefreshPage ${timer(lastEdit)} since last edit. auto-refreshing page`)
        await createThemeSamples('', true)
      } else {
        logDebug(pluginJson, `onOpenRefreshPage ${(now - lastEdit) / 1000}s since last edit, not refreshing`)
      }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * onEdit
 * Plugin entrypoint for command: "/onEdit"
 * @param {*} incoming
 */
export async function onEdit(note: TNote) {
  try {
    logDebug(pluginJson, `onEdit running with note:${String(note.filename)}`)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * onSave
 * Plugin entrypoint for command: "/onSave"
 * @param {*} incoming
 */
export async function onSave(note: TNote) {
  try {
    logDebug(pluginJson, `onSave running with incoming:${String(note.filename)}`)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
