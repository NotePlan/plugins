// @flow

import toml from 'toml'
import json5 from 'json5'
import { load } from 'js-yaml'
import { showMessage, chooseOption } from '../../nmn.sweep/src/userInput'
import {
  getOrMakeTemplateFolder,
  createDefaultConfigNote,
} from './template-folder'

const ALLOWED_FORMATS = ['javascript', 'json', 'json5', 'yaml', 'toml', 'ini']
const FORMAT_MAP = {
  javascript: 'json5',
  ini: 'toml',
}

// @nmn original, but split up by @jgclark
export async function getDefaultConfiguration(): Promise<?{
  [string]: ?mixed,
}> {
  const templateFolder = await getOrMakeTemplateFolder()
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
export async function parseFirstCodeblock(
  block: string,
): Promise<?{ [string]: ?mixed }> {
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
  console.log(
    `\tparseFirstCodeblock: will parse ${contents.length} bytes of ${format}`,
  )

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
      console.log(
        `\tparseFirstCodeblock: error: can't deal with format ${format}`,
      )
  }
}

// Get configuration section, or if not present, save into _configuraiton file
// Only deals with json5 case
// minimumRequiredConfig contains fields which must exist and type, e.g.
// { openWeatherAPIKey:'string' } @dwertheimer
// @jgclark
export async function getOrMakeConfigurationSection(
  configSectionName: string,
  configSectionDefault: string,
  minimumRequiredConfig: { [string]: ?mixed } = {},
): Promise<?{ [string]: ?mixed }> {
  let templateFolder = await getOrMakeTemplateFolder()
  if (templateFolder == null) {
    console.log(
      `  getOrMakeConfigurationSection: couldn't find the templateFolder ... will try to create it ...`,
    )
    templateFolder = getOrMakeTemplateFolder()
    return {}
  }

  console.log(`  getOrMakeConfigurationSection: got folder ${templateFolder}`)
  let configFile = DataStore.projectNotes
    // $FlowIgnore[incompatible-call]
    .filter((n) => n.filename?.startsWith(templateFolder))
    .find((n) => !!n.title?.startsWith('_configuration'))

  if (configFile == null) {
    console.log(
      `  getOrMakeConfigurationSection: Error: cannot find '_configuration' fil. Will create from default.`,
    )
    createDefaultConfigNote()
    configFile = DataStore.projectNotes
      // $FlowIgnore[incompatible-call]
      .filter((n) => n.filename?.startsWith(templateFolder))
      .find((n) => !!n.title?.startsWith('_configuration'))
  }

  const content: ?string = configFile?.content
  if (configFile == null || content == null) {
    console.log(
      `  getOrMakeConfigurationSection: Error: '_configuration' file not found or empty`,
    )
    await showMessage(
      `Error: missing or empty '_configuration' file. Please check.`,
    )
    // Really strange to get here: won't code a response, but will just stop.
    return {}
  }
  console.log('  getOrMakeConfigurationSection: got _configuration file')

  // Get config contents
  const firstCodeblock = content.split('\n```')[1]
  const config: { [string]: mixed } =
    (await parseFirstCodeblock(firstCodeblock)) ?? {}

  // Does it contain the section we want?
  if (
    firstCodeblock == null ||
    config[configSectionName] == // alternative to dot notation that allows variables
      null
  ) {
    // No, so offer to make it and populate it
    const shouldAddDefaultConfig = await chooseOption<boolean, boolean>(
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
    const backtickParas = configFile.paragraphs.filter((p) =>
      p.content.match(/```/),
    )
    // const startJSFirstBlockParas = configFile.paragraphs.filter((p) => p.content.match(/^```\s*javascript/))
    if (
      backtickParas.length > 0 &&
      backtickParas[0].content.endsWith('javascript')
    ) {
      // Insert new default configuration at the top of the current _configuration block
      const startFirstBlockLineNumber = backtickParas[0].lineIndex + 2
      // const endFirstBlockLineNumber = backtickParas[1].lineIndex - 1 // this used to do the bottom of the block
      // insert paragraph just before second ``` line
      if (startFirstBlockLineNumber !== undefined) {
        configFile.insertParagraph(
          configSectionDefault,
          startFirstBlockLineNumber,
          'text',
        )
        await showMessage(
          `Inserted default configuration for ${configSectionName}.`,
          `OK: I will check this before re-running the command.`,
        )
        Editor.openNoteByFilename(configFile.filename)
        return {}
      } else {
        await showMessage(
          `Error: cannot create default configuration for ${configSectionName}`,
          `OK: I will check this before re-running the command.`,
        )
        Editor.openNoteByFilename(configFile.filename)
        return {}
      }
    } else {
      // Couldn't find javascript first codeblock, so insert it at line 2
      const configAsJSBlock = `\`\`\` javascript\n{\n${configSectionDefault}\n}\n\`\`\``
      configFile.insertParagraph(configAsJSBlock, 2, 'text')

      await showMessage(
        `Created default configuration for ${configSectionName}.`,
        `OK: I will check this before re-running the command.`,
      )
      Editor.openNoteByFilename(configFile.filename)
      return {}
    }
  }

  // We have the configuration, so return it
  if (Object.keys(minimumRequiredConfig) && config[configSectionName]) {
    // $FlowIgnore
    return validateMinimumConfig(
      // $FlowIgnore
      config[configSectionName],
      minimumRequiredConfig,
    )
  } else {
    // $FlowIgnore
    return config[configSectionName]
  }
}

function validateMinimumConfig(
  config: { [string]: mixed },
  validations: { [string]: mixed },
): { [string]: mixed } {
  let failed = false
  if (Object.keys(validations).length) {
    Object.keys(validations).forEach((v) => {
      //$FlowIgnore
      if (config[v] == null) {
        console.log(`Config required field: ${v} is missing`)
        failed = true
      }
      if (typeof config[v] !== validations[v]) {
        console.log(
          `Config required field: ${v} is not of type ${String(
            validations[v],
          )}`,
        )
        failed = true
      }
    })
  }
  if (failed) {
    console.log(`Config failed minimum validation spec!`)
    return {}
  } else {
    console.log(`Config passed minimum validation spec`)
    //$FlowIgnore
    return config
  }
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
