// @flow

import { showMessage, chooseOption, showMessageYesNo } from '../../helpers/userInput'
import {
  // parseJSON,
  parseJSON5,
  // parseTOML,
  // parseYAML
} from '../../helpers/general'
import { getOrMakeTemplateFolder, createDefaultConfigNote } from './template-folder'

const ALLOWED_FORMATS = ['javascript', 'json', 'json5', 'yaml', 'toml', 'ini']
const FORMAT_MAP = {
  javascript: 'json5',
  ini: 'toml',
}

export async function openConfigFileInEditor(): Promise<void> {
  const templateFolder = await getOrMakeTemplateFolder()
  if (templateFolder == null) {
    await showMessage('No template folder found')
    return
  }

  const configFile = DataStore.projectNotes
    .filter((n) => n.filename?.startsWith(templateFolder))
    .find((n) => !!n.title?.startsWith('_configuration'))

  if (configFile == null) {
    await showMessage('No _configuration file found')
    return
  }

  await Editor.openNoteByFilename(configFile.filename)
}

/**
 * Get configuration as JSON/JSON5/YAML/TOML from <template folder>/_configuration file
 * @author @nmn split up by @jgclark
 * @return return this as structured data, in the format specified by the first line of the codeblock
 */
export async function getStructuredConfiguration(): Promise<?{
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

/**
 * Parse first codeblock as JSON/JSON5/YAML/TOML
 * @author @nmn
 * @param {string} block - contents of first codeblock as string (exludes ``` delimiters)
 * @return {mixed} structured version of this data, in the format specified by the first line of the codeblock
 */
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
  // console.log(`\tparseFirstCodeblock: will parse ${contents.length} bytes of ${format}`)

  switch (format) {
    // case 'json':
    //   return parseJSON(contents)
    case 'json5':
      return parseJSON5(contents)
    // case 'yaml':
    //   return parseYAML(contents)
    // case 'toml':
    //   return parseTOML(contents)
    default:
      console.log(`\tparseFirstCodeblock: error: can't deal with format ${format}`)
  }
}

/**
 * Get configuration section, validating its config if requested.
 * If configuration section not present, add a default one into the _configuration file (if given)
 * Only deals with json5 case.
 * @author @nmn, @jgclark, @dwertheimer
 * @param {string} configSectionName - name of configuration section to retrieve
 * @param {string?} configSectionDefault - optional JSON5 string to use as default values for this configuration section
 * @param {mixed?} minimumRequiredConfig - optional map of fields which must exist and type, e.g. "{ openWeatherAPIKey: 'string' }"
 * @return {mixed} return config as structured data, in the format specified by the first line of the first codeblock
 */
export async function getOrMakeConfigurationSection(
  configSectionName: string,
  configSectionDefault: string = '',
  minimumRequiredConfig: { [string]: ?mixed } = {},
): Promise<?{ [string]: ?mixed }> {
  let templateFolder = await getOrMakeTemplateFolder()
  if (templateFolder == null) {
    console.log(`  getOrMakeConfigurationSection: couldn't find the templateFolder ... will try to create it ...`)
    templateFolder = getOrMakeTemplateFolder()
    return {}
  }

  // console.log(`  getOrMakeConfigurationSection: got folder ${templateFolder}`)
  let configFile = DataStore.projectNotes
    // $FlowIgnore[incompatible-call]
    .filter((n) => n.filename?.startsWith(templateFolder))
    .find((n) => !!n.title?.startsWith('_configuration'))

  if (configFile == null) {
    console.log(`  getOrMakeConfigurationSection: Error: cannot find '_configuration' file. Will create from default.`)
    createDefaultConfigNote()
    configFile = DataStore.projectNotes
      // $FlowIgnore[incompatible-call]
      .filter((n) => n.filename?.startsWith(templateFolder))
      .find((n) => !!n.title?.startsWith('_configuration'))
  }

  const content: ?string = configFile?.content
  if (configFile == null || content == null) {
    // Really strange to get here: won't code a response, but will just error.
    console.log(`  getOrMakeConfigurationSection: Error: '_configuration' file not found or empty`)
    await showMessage(`Error: missing or empty '_configuration' file. Please check.`)
    return {}
  }
  // console.log('  getOrMakeConfigurationSection: got _configuration file')

  // Get config contents
  const firstCodeblock = content.split('\n```')[1]
  const config: { [string]: mixed } = (await parseFirstCodeblock(firstCodeblock)) ?? {}

  // Does it contain the section we want?
  // (use an alternative to dot notation that allows variables)
  if (firstCodeblock == null || config[configSectionName] == null) {
    console.log(`  getOrMakeConfigurationSection: no '${configSectionName}' config section found`)
    // The section is missing.
    // If no default configuration given, return nothing
    if (configSectionDefault === '') {
      console.log(`  getOrMakeConfigurationSection: no default given`)
      return {}
    }
    console.log(`  getOrMakeConfigurationSection: default available`)

    // If a default configuration given, offer to make it and populate it
    const shouldAddDefaultConfig = await chooseOption(
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
    const backtickParas = configFile.paragraphs.filter((p) => p.content.match(/```/))
    if (backtickParas.length > 0 && backtickParas[0].content.endsWith('javascript')) {
      // We have an existing codeblock, so insert new default configuration at the top of it
      const startFirstBlockLineNumber = backtickParas[0].lineIndex + 2
      // USED TO DO: insert paragraph just before second ``` line
      // const endFirstBlockLineNumber = backtickParas[1].lineIndex - 1
      if (startFirstBlockLineNumber !== undefined) {
        configFile.insertParagraph(configSectionDefault, startFirstBlockLineNumber, 'text')
        await showMessage(
          `Inserted default configuration for ${configSectionName}.`,
          `OK: I will cancel and check this before re-running the command.`,
        )
        // Editor.openNoteByFilename(configFile.filename)
        return {}
      } else {
        await showMessage(
          `Error: cannot create default configuration for ${configSectionName}`,
          `OK: I will cancel and check this before re-running the command.`,
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
        `OK: I will cancel and check this before re-running the command.`,
      )
      return {}
    }
  }

  // Yes, we have the configuration, so return it
  if (Object.keys(minimumRequiredConfig) && config[configSectionName]) {
    return validateMinimumConfig(
      // $FlowIgnore[incompatible-call]
      config[configSectionName],
      minimumRequiredConfig,
    )
  } else {
    // $FlowIgnore
    return config[configSectionName]
  }
}

/**
 * Check whether this config meets a minimum defined spec of keys and types.
 * @author @dwertheimer
 * @param {mixed} config - configuration as structured JSON5 object
 * @param {mixed} validations - JSON5 string to use as default values for this configuration section
 * @return {mixed} return this as structured data, in the format specified by the first line of the first codeblock
 */
function validateMinimumConfig(config: { [string]: mixed }, validations: { [string]: mixed }): { [string]: mixed } {
  let failed = false
  if (Object.keys(validations).length) {
    Object.keys(validations).forEach((v) => {
      if (config[v] == null) {
        console.log(`    validateMinimumConfig: Config required field: ${v} is missing`)
        failed = true
      }
      if (typeof config[v] !== validations[v]) {
        console.log(`    validateMinimumConfig: Config required field: ${v} is not of type ${String(validations[v])}`)
        failed = true
      }
    })
  }
  if (failed) {
    console.log(`    validateMinimumConfig: Config failed minimum validation spec!`)
    return {}
  } else {
    console.log(
      `    validateMinimumConfig: passed minimum validation spec`, // ; config=\n${JSON.stringify(config)}`
    )
    return config
  }
}
