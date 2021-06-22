// @flow

import toml from 'toml'
import json5 from 'json5'
import { load } from 'js-yaml'
import { showMessage, chooseOption } from '../../nmn.sweep/src/userInput'
import { getOrMakeTemplateFolder } from './template-folder'

const ALLOWED_FORMATS = ['javascript', 'json', 'json5', 'yaml', 'toml', 'ini']
const FORMAT_MAP = {
  javascript: 'json5',
  ini: 'toml',
}

// @nmn original, but split up by @jgclark
export async function getDefaultConfiguration(): Promise<?{
  [string]: ?mixed,
}> {
  const templateFolder = await getTemplateFolder()
  if (templateFolder == null) {
    return {}
  }

  const configFile = DataStore.projectNotes
    .filter((n) => n.filename?.startsWith(templateFolder))
    .find((n) => !!n.title?.startsWith('_configuration'))

  const content: ?string = configFile?.content
  if (content == null) {
    return {}
  }

  const firstCodeblock = content.split('\n```')[1]
  return await parseFirstCodeblock(firstCodeblock)
}

// Parse first codeblock as JSON/JSON5/YAML/TOML
export async function parseFirstCodeblock(block: string): Promise<?{ [string]: ?mixed }> {
  if (block == null) {
    await showMessage('No configuration block found in configuration file.')
    return {}
  }

  let [format, ...contents] = block.split('\n')
  contents = contents.join('\n')
  format = format.trim()

  if (!ALLOWED_FORMATS.includes(format)) {
    await showMessage('Invalid configuration format in the config file.')
    return {}
  }
  format = FORMAT_MAP[format] ?? format
  console.log(`parseFirstCodeblock: will parse format ${format} length ${contents.length}`)

  switch (format) {
    case 'json':
      return parseJSON(contents)
    case 'json5':
      return parseJSON5(contents)
    case 'yaml':
      return parseYAML(contents)
    case 'toml':
      return parseTOML(contents)
    default:
      console.log(`parseFirstCodeblock: error: can't deal with format ${format}`)
  }
}

// Get configuration section, or if not present, save into _configuraiton file
// Only deals with json5 case
// @jgclark
export async function getOrMakeConfigurationSection(
  configSectionName: string,
  configSectionDefault: string): Promise<?{ [string]: ?mixed }> {
  
  const templateFolder = await getOrMakeTemplateFolder()
  if (templateFolder == null) {
    return {}
  }

  console.log(`getOrMakeConfigurationSection: got folder ${templateFolder}`)
  const configFile = DataStore.projectNotes
  .filter((n) => n.filename?.startsWith(templateFolder))
  .find((n) => !!n.title?.startsWith('_configuration'))

  const content: ?string = configFile?.content
  if (content == null) {
    await showMessage(`Error: cannot find '_configuration' file`)
    // TODO: make new _configuration file
    return {}
  }
  console.log('getOrMakeConfigurationSection: got configFile content')

  // Get config contents
  const firstCodeblock = content.split('\n```')[1]
  const config = await parseFirstCodeblock(firstCodeblock) ?? {}

  // Does it contain the section we want?
  if (firstCodeblock === undefined ||
      config[configSectionName] == null) { // alternative to dot notation that allows variables
    // No, so offer to make it and populate it
    const shouldAddDefaultConfig = await chooseOption <boolean, boolean> (
      `No '${configSectionName}' configuration section found.`,
      [
        {
          label: `✅ Create ${configSectionName} configuration from its defaults`,
          value: true,
        },
        {
          label: `❌ Don't Create; cancel command`,
          value: false,
        },
      ],
      false,
    )
    if (!shouldAddDefaultConfig) {
      return {}
    }

    // Add default configuration
    // TODO: check for javascript block start
    const backtickParas = configFile.paragraphs.filter((p) => p.content.match(/```/))
    // const startJSFirstBlockParas = configFile.paragraphs.filter((p) => p.content.match(/^```\s*javascript/))
    if (backtickParas.length > 0 && backtickParas[0].content.endsWith('javascript')) {
      // Insert new default configuration at the bottom of the current _configuration block
      const endFirstBlockLineNumber = backtickParas[1].lineIndex - 1
      // insert paragraph just before second ``` line
      if (endFirstBlockLineNumber !== undefined) {
        configFile.insertParagraph(configSectionDefault, endFirstBlockLineNumber, 'text')
        // FIXME: doesn't do next line
        await showMessage(`Inserted default javascript-style configuration for ${configName}.\nPlease check before re-running command.`)
        Editor.openNoteByFilename(configFile.filename)
      } else {
        await showMessage(`Error: cannot create default configuration for ${configName}`)
        return {}
      }
    } else {
      // Couldn't find javascript first codeblock, so insert it at line 2
      const configAsJSBlock = `\`\`\` javascript\n{\n${configSectionDefault}\n}\n\`\`\``
      configFile.insertParagraph(configAsJSBlock, 2, 'text')
      // FIXME: doesn't do next line
      await showMessage(`Created default javascript-style configuration for ${configName}.\nPlease check before re-running command.`)
      Editor.openNoteByFilename(configFile.filename)
      return {}
    }
  }

  // We have the configuration, so return it
  return config
}


async function parseJSON(contents: string): Promise<?{ [string]: ?mixed }> {
  try {
    return JSON.parse(contents)
  } catch (e) {
    console.log(e)
    await showMessage(
      'Invalid JSON in your configuration. Please fix it to use configuration',
    )
    return {}
  }
}

export async function parseJSON5(
  contents: string,
): Promise<?{ [string]: ?mixed }> {
  try {
    const value = json5.parse(contents)
    return (value: any)
  } catch (e) {
    console.log(e)
    await showMessage(
      'Invalid JSON5 in your configuration. Please fix it to use configuration',
    )
    return {}
  }
}

async function parseYAML(contents: string): Promise<?{ [string]: ?mixed }> {
  try {
    const value = load(contents)
    if (typeof value === 'object') {
      return (value: any)
    } else {
      return {}
    }
  } catch (e) {
    console.log(contents)
    console.log(e)
    await showMessage(
      'Invalid YAML in your configuration. Please fix it to use configuration',
    )
    return {}
  }
}

async function parseTOML(contents: string): Promise<?{ [string]: ?mixed }> {
  try {
    const value = toml.parse(contents)
    if (typeof value === 'object') {
      return (value: any)
    } else {
      return {}
    }
  } catch (e) {
    console.log(e)
    await showMessage(
      'Invalid TOML in your configuration. Please fix it to use configuration',
    )
    return {}
  }
}
