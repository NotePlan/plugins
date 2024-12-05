// @flow
/* eslint-disable */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import { initConfiguration, updateSettingData } from '@np/helpers/NPConfiguration'
import { logError } from '../../helpers/dev'
import { onUpdateOrInstall } from './Templating'
import pluginJson from '../plugin.json'

export async function templateInit(): Promise<void> {
  try {
    const pluginSettingsData = await DataStore.loadJSON(`../${pluginJson['plugin.id']}/settings.json`)
    if (typeof pluginSettingsData === 'object') {
      const result = await CommandBar.prompt('Templating Settings', 'np.Templating settings have already been created. \n\nWould you like to reset to default settings?', [
        'Yes',
        'No',
      ])

      if (result === 0) {
        DataStore.settings = { ...(await initConfiguration(pluginJson)) }
      }
    } else {
      onUpdateOrInstall({ silent: true })
    }
  } catch (error) {
    logError(pluginJson, error)
  }
}
