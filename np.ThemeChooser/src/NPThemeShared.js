// @flow

import pluginJson from '../plugin.json'
import { logDebug, log, logError, clo, JSP } from '@helpers/dev'

/**
 * Get the theme object by name
 * @param {string} name - the name of the theme to get
 * @returns {any} - the object of the theme or null if not found
 */
export function getThemeObj(name: string, isFilename: boolean = false): any | null {
  const themes = Editor.availableThemes
  logDebug(pluginJson, `getThemeObj, looking for ${name}, total themes: ${themes.length}`)
  const propName = isFilename ? 'filename' : 'name'
  const theme = themes.filter((t) => t[propName].trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase())
  logDebug(pluginJson, `getThemeObj, after filter themename = ${theme.length ? theme[0].name : ''} theme.length=${theme.length}`)
  if (theme.length) {
    // clo(theme[0], `getThemeObj returning theme object`)
    if (theme.length > 1) logError(pluginJson, `getThemeObj, found more than one theme with name ${name}. Choosing the first`)
    return theme[0]
  } else {
    logDebug(pluginJson, `getThemeObj Could not find theme named: ${name}`)
    // await showMessage(`Could not find theme named: ${name}`)
    return null
  }
}
