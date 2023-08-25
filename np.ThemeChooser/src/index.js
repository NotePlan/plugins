// @flow

export { chooseTheme, setDefaultLightDarkTheme, toggleTheme, copyCurrentTheme, changeThemeFromFrontmatter, addThemeFrontmatter } from './NPThemeChooser' // add one of these for every command specifified in plugin.json (the function could be in any file as long as it's exported)
export { copyThemeStyle, editStyleAttribute, createThemeSamples, setColor, removeStyle } from './NPThemeCustomizer'
export { changePreset, runPreset01, runPreset02, runPreset03, runPreset04, runPreset05 } from './NPThemePresets'
export { onOpenTheme, onOpenRefreshPage, onEdit, onSave, onUpdateOrInstall, init, onSettingsUpdated } from './NPThemeHooks'

// Do not change this line. This is here so your plugin will get recompiled every time you change your plugin.json file
import pluginJson from '../plugin.json'
import { log, clo } from '@helpers/dev'
