// @flow
// NOTE: Strip out all the comments if you want to just read the code (hopefully pretty self explanatory)

import pluginJson from '../plugin.json'

// import np.Templating Library
import NPTemplating from 'NPTemplating'

import { formattedDateTimeTemplate } from '@plugins/dwertheimer.DateAutomations/src/dateFunctions'
// import { getSetting } from '@helpers/NPconfiguration'

import { updateSettingData } from '@helpers/NPconfiguration'
import { log, logError } from '@helpers/dev'

export async function templateFormattedDateTime(): Promise<void> {
  try {
    // NOTE: this is only here to initialize settings since the plugin was never installed
    await updateSettingData(pluginJson)

    const templateObj = {
      methods: {
        myFormattedDateTime: async (params: any = {}) => {
          // this is only looking in current plugin settings file, more generic method coming in getSetting
          const defaultFormat: string = DataStore.settings.format

          // build format string passed to `formattedDateTimeTemplate`
          const format: string = params && params.hasOwnProperty('format') ? params.format : defaultFormat

          // NOTE: np.Templating actually passes an as it is defined in template, unlike existing templating passes things as a string
          // create string version of format block which `formattedDateTimeTemplate` expects
          const formatString: string = `{format: '${format}'}`

          // call existing `formattedDateTimeTemplate` from `./dwertheimer.DateAutomations/src/dateFunctions`
          return formattedDateTimeTemplate(formatString)
        },
      },
    }

    // Assumes a template with name `FormattedDateTime` exists
    // see `FormattedDateTime.md` in plugin root for sample
    const result: string = (await NPTemplating.renderTemplate('FormattedDateTime', templateObj)) || ''

    Editor.insertTextAtCursor(result)
  } catch (error) {
    logError(pluginJson, `templateFormattedDateTime :: ${error}`)
  }
}

export async function onUpdateOrInstall(): Promise<void> {
  updateSettingData(pluginJson)
}
