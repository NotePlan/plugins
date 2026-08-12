// @flow

export { syncGranolaNotes, syncGranolaNotesAll, findGranolaDuplicates } from './NPPluginMain'

import pluginJson from '../plugin.json'

// eslint-disable-next-line import/order
import { updateSettingData, pluginUpdated } from '@helpers/NPConfiguration'
import { logError, JSP } from '@helpers/dev'

export async function onUpdateOrInstall(): Promise<void> {
  await updateSettingData(pluginJson)
}

// eslint-disable-next-line require-await
export async function init(): Promise<void> {
  try {
    DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false).then((r) =>
      pluginUpdated(pluginJson, r),
    )
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function onSettingsUpdated(): Promise<void> {}
