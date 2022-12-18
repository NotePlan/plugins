// @flow

import { get } from 'lodash-es'
import pluginJson from '../../plugin.json'
import { createPrettyRunPluginLink, escapeRegex } from '@helpers/general'
import { log, logError, logDebug, timer, clo, JSP, getFilteredProps } from '@helpers/dev'

/**
 * Get a (shallow) list of properties that are different between two objects
 * (top level only, not recursive)
 * @param {Object} obj1
 * @param {Object} obj2
 * @returns
 */
export function getPropDifferences(obj1: Object, obj2: Object): [Array<string>, Array<string>] {
  const onlyIn1 = []
  const onlyIn2 = []
  for (const key in obj1) {
    if (!obj2.hasOwnProperty(key)) {
      onlyIn1.push(key)
    }
  }
  for (const key in obj2) {
    if (!obj1.hasOwnProperty(key)) {
      onlyIn2.push(key)
    }
  }
  return [onlyIn1, onlyIn2]
}

/**
 * Check if this property is a color prop inside an object which becomes a link and gets overridden by the link color (tintColor)
 * Setting type to blank string will make it not a link (so color will work)
 * @param {string} prop
 * @param {string} parentPath
 * @returns {boolean} true if it's a color setting that will have no effect because it's overridden by the link color
 */
const isLinkColorProp = (prop: string, parentPath: string): boolean => {
  const lastPart = parentPath.split('.').pop()
  const typeIsBlankString = get(Editor.currentTheme.values, `${parentPath}.type`) === ''
  return (
    prop === 'color' &&
    ['link', 'schedule-to-date-link', 'done-date', 'schedule-from-date-link', 'note-title-link', 'hashtag', 'attag', 'phonenumber'].indexOf(lastPart) > -1 &&
    !typeIsBlankString
  )
}

/**
 * Return an array of keys which have _info (e.g. 'foo_info'), but not the _info itself (just foo is returned)
 * the assumption being that there is a key called foo which NP reads, and foo_info which is the description info
 * @param {any} currentObj
 * @returns {Array<string>} props with info
 */
export const getPropsWithInfo = (currentObj: any): Array<string> =>
  getFilteredProps(currentObj)
    .filter((p) => /^(.*)_info$/.test(p))
    .map((p) => p.replace(/_info$/, ''))

/**
 * Return an array of keys which are holding objects (for further nesting), but not the _info objects
 * @param {any} currentObj
 * @returns {Array<string>} props of objects
 */
export const getPropNamesOfObjects = (currentObj: any): Array<string> =>
  // return an array of the properties of the current object which are objects
  getFilteredProps(currentObj).filter((p) => typeof currentObj[p] === 'object' && !(currentObj[p] instanceof Date) && !/^(.*)_info$/.test(p))

/**
 * Find all properties with _info in the masterTheme file
 * @param {*} currentObj
 * @param {*} output
 */
export function getThemePropertiesInfoText(currentObj: any, output: Array<string> = [], currentKey: string = '', currentTheme: any, myInfo: any = null): Array<string> {
  // clo(currentTheme, 'getThemePropertiesInfoText currentTheme')
  // const thisLevelProps = getPropsWithInfo(currentObj)
  // get all properties that are not objects
  const allProps = getFilteredProps(currentObj).filter((p) => typeof currentObj[p] !== 'object' && !(currentObj[p] instanceof Date) && p.charAt(0) !== '_')
  // get the props which are in allProps but not in thisLevelProps
  // const propsWithoutInfo = allProps.filter((p) => !thisLevelProps.includes(p))
  // const viewingMasterTheme = currentTheme.name === 'ThemeChooserMasterTheme' //FIXME: don't show the sets when viewing master theme and tell people why at top
  const activeIsBuiltInTheme = isBuiltInTheme(Editor.currentTheme.filename)
  const curObjPath = currentKey ? `${currentKey}.` : ''
  // const lastPart = currentKey.split('.').pop()
  const existsInCurrentTheme = Boolean(get(currentTheme, currentKey))
  // logDebug(pluginJson, `getThemePropertiesInfoText currentKey:${currentKey} lastPart:${lastPart} curObjPath:${curObjPath}`)
  if (currentKey !== '') {
    const addWholeObjLink = !existsInCurrentTheme ? createPrettyRunPluginLink(`Add to My Theme`, `np.ThemeChooser`, `addStyle`, [`${currentKey}`]) : ''
    output.push(`### ${currentKey}${addWholeObjLink ? ` ${addWholeObjLink}` : ''}`)
    if (myInfo) {
      const { description, example } = myInfo
      if (description) output.push(`\t> ${description}`)
      if (example) output.push(`${example}`)
    }
  }
  allProps.forEach((p) => {
    if (p.includes('.')) {
      logError(pluginJson, `getThemePropertiesInfoText: property ${p} contains a period, which is not allowed`)
      // return [`Theme contains a property with a period in it: "${p}" -- this is illegal and will cause problems`]
    } else {
      const path = `${curObjPath}${p}`
      let valueInCurrentTheme = get(currentTheme, path)
      if (valueInCurrentTheme === '') valueInCurrentTheme = 'EMPTY STRING'
      const valueInMasterTheme = currentObj[p]
      let description, type, example
      if (currentObj[`${p}_info`]) {
        description = currentObj[`${p}_info`].description
        type = currentObj[`${p}_info`].type
        example = currentObj[`${p}_info`].example
      }
      if (!(typeof currentObj[p] === 'object')) {
        const isRegex = p === 'regex'
        const valueText = isRegex && valueInCurrentTheme ? (activeIsBuiltInTheme ? 'REGEX' : 'REGEX-CLICK TO VIEW') : valueInCurrentTheme ?? `NOT SET`
        const exampleText = example ? `\n${example}` : ''
        let removeStyleLink = activeIsBuiltInTheme ? null : createPrettyRunPluginLink(`✖️`, 'np.ThemeChooser', 'removeStyle', [path /*, `np.ThemeChooser`, `Customize Themes`*/])

        let setLink = activeIsBuiltInTheme
          ? null
          : createPrettyRunPluginLink(escapeRegex(valueText), 'np.ThemeChooser', 'Edit a Theme Style Attribute', [path /*, `np.ThemeChooser`, `Customize Themes`*/])

        if (isLinkColorProp(p, currentKey)) setLink = `(This is a link, and all links are colored with tintColor)`
        if (valueInMasterTheme === 'noteplanstate') setLink = `(This is a special value (noteplanstate), and cannot be changed)`
        if (['styles', 'author', 'author.name', 'editor', 'name', 'style'].indexOf(path.toLowerCase()) > -1) removeStyleLink = null

        const addLink =
          valueInCurrentTheme === undefined && !activeIsBuiltInTheme
            ? createPrettyRunPluginLink(`Add default (${isRegex ? 'REGEX' : valueInMasterTheme}) to current theme`, 'np.ThemeChooser', 'addStyle', [
                path,
                type || 'text',
                `np.ThemeChooser`,
                `Customize Themes`,
              ])
            : ''
        //TODO: LOOK AT DARK AND LIGHT THEMES AND ONLY DISPLAY THE ADD BUTTON IF YOU DON'T HAVE IT
        output.push(
          `- ***${p}***: \` ${setLink ? `${setLink}` : valueText} \` ${addLink ? `  ${addLink}` : `  ${removeStyleLink ?? ''}`}${
            description ? `\n\t> ${description}` : ''
          }${exampleText}`,
        )
      }
    }
  })
  // get all properties that are objects
  const objects = getPropNamesOfObjects(currentObj)
  objects.forEach((p) => {
    // logDebug(pluginJson, `getThemePropertiesInfoText p=${p} currentObj[p]_info=${currentObj[`${p}_info`]}`)
    getThemePropertiesInfoText(currentObj[p], output, `${curObjPath}${p}`, currentTheme, currentObj[`${p}_info`])
  })
  // get items which are in activeTheme but not in masterTheme
  return output
}

/**
 * Compare a filename string to the list of known theme files
 * @param {string} filename
 * @returns {boolean} true if the filename matches one of the built-in theme files
 */
export const isBuiltInTheme = (filename: string): boolean => {
  return [
    'apple-dark.json',
    'ayumirage.json',
    'black-morning.json',
    'black-night.json',
    'breakers.json',
    'charcoal.json',
    'contrast.json',
    'default.json',
    'dracula-pro.json',
    'dracula.json',
    'green.json',
    'markdown-regex.json',
    'materialdark.json',
    'monokai.json',
    'Monospace-Light.json',
    'solarized-dark.json',
    'solarized-light.json',
    'spacegray.json',
    'toothbleach-condensed.json',
    'toothbleach.json',
    'toothpaste-condensed.json',
    'toothpaste.json',
    'ThemeChooserMasterTheme.json',
  ].includes(filename)
}
