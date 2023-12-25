// @flow
// From the command line:
// `noteplan-cli plugin:dev np.ThemeChooser --test --watch --coverage`

import pluginJson from '../plugin.json'
import { logDebug, log, logError, clo, JSP } from '../../helpers/dev'
import { isBuiltInTheme } from './support/themeHelpers'
import { getThemeObj } from './NPThemeShared'
import { showMessage, showMessageYesNo, chooseOption } from '@helpers/userInput'
import { sortListBy } from '@helpers/sorting'
import { getFrontMatterAttributes, addTrigger, setFrontMatterVars } from '@helpers/NPFrontMatter.js'

/**
 * Get the theme object by name
 * @param {string} name - the name of the theme to get
 * @returns {any} - the object of the theme or null if not found
 */
export function getThemeObjByName(name: string): any | null {
  const themes = Editor.availableThemes
  logDebug(pluginJson, `getThemeObjByName, looking for ${name}, total themes: ${themes.length}`)
  const theme = themes.filter((t) => t.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase())
  logDebug(pluginJson, `getThemeObjByName, after filter themename = ${theme.length ? theme[0].name : ''} theme.length=${theme.length}`)
  if (theme.length) {
    // clo(theme[0], `getThemeObjByName returning theme object`)
    if (theme.length > 1) logError(pluginJson, `getThemeObjByName, found more than one theme with name ${name}. Choosing the first`)
    return theme[0]
  } else {
    logDebug(pluginJson, `getThemeObjByName Could not find theme named: ${name}`)
    // await showMessage(`Could not find theme named: ${name}`)
    return null
  }
}

export async function chooseTheme(
  incomingThemeName: ?string = '',
  pluginIDToCall: string | null = null,
  pluginCommandToCall: string | null = null,
  args: Array<string> = [],
  forceRefresh: boolean = false,
): Promise<void> {
  // every command/plugin entry point should always be wrapped in a try/catch block
  try {
    // const settings = DataStore.settings // Plugin settings documentation: https://help.noteplan.co/article/123-plugin-configuration
    if (!Editor) {
      showMessage(`You must be in the Editor with a document open to run this command`)
      return
    }
    if (incomingThemeName?.length) {
      logDebug(pluginJson, `chooseTheme, incoming theme name: ${incomingThemeName}`)
      const themeName = incomingThemeName.trim()
      const activeTheme = Editor.currentTheme
      if (!forceRefresh && activeTheme.name.trim().toLocaleLowerCase() === themeName.trim().toLocaleLowerCase()) {
        logDebug(pluginJson, `chooseTheme ${themeName} is already in use. no need to change. returning.`)
        return
      }
      const theme = await getThemeObj(themeName.trim())
      if (theme && theme.filename) {
        logDebug(pluginJson, `chooseTheme, setting theme to filename: ${theme.filename}`)
        Editor.setTheme(theme.filename)
        logDebug(pluginJson, `chooseTheme, After Editor.setTheme. We're done and out.`)
      } else {
        await showMessage(`Passed Theme "${incomingThemeName || ''}" does not seem to be installed.`)
        logDebug(pluginJson, `chooseTheme: Theme "${incomingThemeName || ''}" does not seem to be installed`)
        return
      }
    } else {
      const themeName = await getThemeChoice()
      logDebug(pluginJson, `chooseTheme: "${themeName}" chosen`)
      const selected = await getThemeObj(themeName)
      if (selected && selected.filename) {
        logDebug(pluginJson, `chooseTheme: About to Editor.setTheme(${selected.filename}) Editor.setTheme(${selected.name})`)
        Editor.setTheme(selected.filename)
      } else {
        logError(pluginJson, `chooseTheme filename does not exist: selected=${JSP(selected)}`)
      }
    }
    if (pluginIDToCall && pluginCommandToCall) {
      logDebug(pluginJson, `chooseTheme, After Editor.setTheme. Executing command: ${pluginCommandToCall} in plugin: ${pluginIDToCall}`)
      await DataStore.invokePluginCommandByName(pluginCommandToCall, pluginIDToCall, args)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Ask user to choose a theme, return the name (string) of the chosen theme
 * @param {string} lightOrDark //not currently used
 * @param {string} message // message to display to user (default: 'Choose a Theme')
 * @returns {string} theme name or default -- BLANK: "Theme Chooser: Set Preset"
 */
export async function getThemeChoice(lightOrDark: string = '', message: string = 'Choose a Theme'): Promise<string> {
  const themeData = Editor.availableThemes // {name:string,mode:'light'|'dark',values:<themedata>}
  // clo(themeData, `getThemeChoice, themeData`)
  let themeOpts = themeData.map((t) => ({
    value: t.name,
    label: `${t.name} (${t.mode || ''})${isBuiltInTheme(t.filename) ? '' : ' - Custom Theme'}`,
    isBuiltIn: isBuiltInTheme(t.filename),
  }))
  // $FlowIgnore
  themeOpts = sortListBy(themeOpts, ['isBuiltIn', 'label'])
  // clo(themeOpts, `getThemeChoice, themeOpts`)
  if (lightOrDark !== '') {
    // would be nice to filter here
  }
  const selection = await chooseOption(message, themeOpts, '')
  logDebug(pluginJson, `getThemeChoice user selected: ${JSP(selection)}`)
  return selection ? selection : ''
}

/*
 * PLUGIN ENTRYPOINTS BELOW THIS LINE
 */

/**
 * Set default light or dark theme
 * Plugin entrypoint for "/Set Default Light/Dark Theme (for this device)"
 * @param {'Light' | 'Dark' | null = null} typeToSet
 * @param {string | null = null} setThemeName
 * @param {string | null = null} pluginIDToCall - call this plugin after setting (e.g. to refresh)
 * @param {string | null = null} pluginCommandToCall  - call this command
 * @param {Array<string> = []} args - with these args
 * @returns
 */
export async function setDefaultLightDarkTheme(
  typeToSet: 'Light' | 'Dark' | null = null,
  setThemeName: string | null = null,
  pluginIDToCall: string | null = null,
  pluginCommandToCall: string | null = null,
  args: Array<string> = [],
): Promise<void> {
  try {
    if (!Editor) {
      showMessage(`You must be in the Editor with a document open to run this command`)
      return
    }
    const which = typeToSet?.length
      ? typeToSet
      : await showMessageYesNo(
          `Default Light/Dark Themes need to be set on a per-device basis. Which default theme do you want to set?`,
          ['Light', 'Dark'],
          `Set device default Light/Dark theme`,
        )
    const themeName = setThemeName?.length ? setThemeName : await getThemeChoice(which)
    const themeObj = await getThemeObj(themeName)
    const themeFilename = themeObj?.filename ?? ''
    const themeChoice = themeObj?.name || ''
    if (themeFilename.length && which) {
      if (which === 'Light') {
        // DataStore.setPreference('themeChooserLight', themeChoice)
        Editor.saveDefaultTheme(themeFilename, which.toLowerCase())
      } else {
        // DataStore.setPreference('themeChooserDark', themeChoice)
        Editor.saveDefaultTheme(themeFilename, which.toLowerCase())
      }
      if (pluginIDToCall && pluginCommandToCall) {
        logDebug(pluginJson, `chooseTheme, After Editor.setTheme. Executing command: ${pluginCommandToCall} in plugin: ${pluginIDToCall}`)
        await DataStore.invokePluginCommandByName(pluginCommandToCall, pluginIDToCall, args)
      } else {
        await showMessage(`Default ${which} theme set to: ${themeChoice}. You may need to restart NotePlan to see it in action.`)
      }
      logDebug(pluginJson, `setDefaultLightDarkTheme set${which} to ${themeFilename} ("${themeChoice}")`)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Copy a theme to the user's custom themes folder and switch Editor to use it
 * @param {string} themeNameToCopy
 * @param {string} pluginIDToCall - plugin id to call after theme is copied
 * @param {string} pluginCommandToCall - plugin command to call after theme is copied
 * @param {Array<string>} args - args array to be passed to pluginCommandToCall
 * @returns {Promise<void>}
 */
export async function copyCurrentTheme(
  themeNameToCopy: string | null = null,
  pluginIDToCall: string | null = null,
  pluginCommandToCall: string | null = null,
  args: Array<string> = [],
): Promise<void> {
  try {
    logDebug(pluginJson, `copyCurrentTheme running copy:${String(themeNameToCopy)}`)
    const themeObj = themeNameToCopy ? getThemeObj(themeNameToCopy) : Editor.currentTheme
    const theme = themeObj?.values || {}
    const themeName = await CommandBar.textPrompt('Copy Theme', 'Enter a name for the new copied theme', `${theme.name} Copy`)
    if (themeName && themeName.length) {
      const avails = Editor.availableThemes
      if (avails.filter((t) => t.name === themeName).length) {
        await showMessage(`Theme "${themeName}" already exists. Please choose a different name.`)
        return
      } else {
        // $FlowIgnore
        theme.name = themeName || ''
        const success = Editor.addTheme(JSON.stringify(theme), `${themeName}.json`)
        logDebug(pluginJson, `copyCurrentTheme saving theme success: ${String(success)}`)
        if (!success) {
          await showMessage(`Something went wrong saving theme "${themeName}" as ${themeName}.json.`)
          return
        } else {
          await chooseTheme(themeName, pluginIDToCall, pluginCommandToCall, args)
        }
      }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Toggle between light and dark theme
 * Originally had to ask which you want because there was no way to know if you were in light/dark mode, but now we know so
 * TODO: do something more automatic with light/dark?
 * (entry point for /Toggle Light/Dark Theme)
 */
export async function toggleTheme() {
  try {
    if (!Editor) {
      showMessage(`You must be in the Editor with a document open to run this command`)
      return
    }
    // const lightTheme = String(DataStore.preference('themeChooserLight')) || ''
    // const darkTheme = String(DataStore.preference('themeChooserDark')) || ''
    const lightTheme = String(DataStore.preference('themeLight') || '')
    const darkTheme = String(DataStore.preference('themeDark') || '')
    logDebug(pluginJson, `toggleTheme: lightTheme = ${String(lightTheme)} | darkTheme = ${String(darkTheme)}`)
    if (lightTheme && darkTheme) {
      const current = Editor.currentTheme
      logDebug(pluginJson, `toggleTheme Editor.currentTheme.name = "${current.name}" | mode = "${current.mode}"`)
      let switchTo = ''
      if (current.mode === 'light') {
        switchTo = darkTheme
      } else if (current.mode === 'dark') {
        switchTo = lightTheme
      } else {
        const opts = [
          { label: `Light: "${String(lightTheme)}"`, value: String(lightTheme) },
          { label: `Dark: "${String(darkTheme)}"`, value: String(darkTheme) },
          { label: `[Change Default Light/Dark Themes]`, value: `__change__` },
        ]
        switchTo = await chooseOption(`Which theme do you want to switch to?`, opts, opts[0].value)
        if (switchTo === '__change__') {
          await setDefaultLightDarkTheme()
          await toggleTheme()
          return
        }
      }
      if (switchTo !== '') {
        const theme = await getThemeObj(String(switchTo), true)
        if (theme) {
          logDebug(pluginJson, `toggleTheme: Setting theme to: ${String(switchTo)}`)
          Editor.setTheme(theme.filename)
        } else {
          logError(pluginJson, `toggleTheme: could not find theme: ${String(switchTo)}`)
          await showMessage(`could not find theme: ${String(switchTo)}`)
        }
      } else {
        logError(pluginJson, `toggleTheme: switchTo was blank ${String(switchTo)}`)
      }
    } else {
      await showMessage(`You need to set the default Light and Dark themes first.\nYour current themes are:\nLight: ${String(lightTheme)}\nDark: ${String(darkTheme)}`)
      await setDefaultLightDarkTheme()
      await toggleTheme()
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Change theme from frontmatter:
 *    triggers: onOpen => np.ThemeChooser.setTheme
 *    theme: "Theme Name"
 * Plugin entrypoint for command: "/setTheme" "Change the theme based on frontmatter field 'theme'"
 * @author @dwertheimer
 * @param {*} incoming
 */
export async function changeThemeFromFrontmatter() {
  try {
    logDebug(pluginJson, `changeThemeFromFrontmatter running`)
    const frontMatter = getFrontMatterAttributes(Editor)
    if (frontMatter && frontMatter.theme) {
      const themeName = frontMatter.theme
      // validate that a theme of that name exists
      logDebug(pluginJson, `changeThemeFromFrontmatter: themeName="${themeName}"`)
      const themeObj = getThemeObjByName(themeName)
      if (themeObj) {
        await chooseTheme(themeName)
      } else {
        logDebug(pluginJson, `changeThemeFromFrontmatter: 'Theme named: "${themeName}" does not exist. Please check the exact name of the theme'`)
        await showMessage(`Theme named: "${themeName}" does not exist. Please check the exact name of the theme`)
      }
    } else {
      logDebug(pluginJson, `changeThemeFromFrontmatter: 'There must be frontmatter and a "theme" field in frontmatter.'`)
      await showMessage('There must be a theme field in frontmatter.')
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Add/Change This Note’s Theme in Frontmatter
 * Plugin entrypoint for command: "/Add/Change This Note’s Theme"
 * @author @dwertheimer
 * @param {string|null} themeName
 */
export async function addThemeFrontmatter(themeName?: string | null = null) {
  try {
    logDebug(pluginJson, `addThemeFrontmatter running with incoming:${String(themeName)}`)
    const theme = themeName || (await getThemeChoice())
    if (theme) {
      Editor.note ? addTrigger(Editor, 'onOpen', 'np.ThemeChooser', 'setTheme') : ''
      Editor.note ? setFrontMatterVars(Editor, { theme }) : ''
      await chooseTheme(theme)
    } else {
      logDebug(pluginJson, `addThemeFrontmatter: 'No theme chosen. No changes made.'`)
      await showMessage(`No theme chosen. No changes made.`)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
