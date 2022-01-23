// @flow
//-------------------------------------------------------------------------------
// Configuration Utilities
// @codedungeon unless otherwise noted

import { showMessage, showMessageYesNo } from './userInput'
import { parseJSON5 } from './general'

const STATIC_TEMPLATE_FOLDER = '📋 Templates'
const ALLOWED_FORMATS = ['javascript', 'json', 'json5']
const FORMAT_MAP = { javascript: 'json5' }

const INVALID_SECTION = 'Invalid Section'

/**
 * Get NotePlan Configuration
 * @author @codedungeon
 * @return return this as structured data, in the format specified by the first line of the codeblock (should be `javascript`)
 */
export async function getConfiguration(configSection: string): Promise<any> {
  if (configSection.length === 0) {
    return INVALID_SECTION
  }

  const configFile = DataStore.projectNotes
    .filter((n) => n.filename?.startsWith(STATIC_TEMPLATE_FOLDER))
    .find((n) => !!n.title?.startsWith('_configuration'))

  const content: ?string = configFile?.content
  if (content == null) {
    return {}
  }

  const firstCodeblock = content.split('\n```')[1]

  // $FlowIgnore
  const config = await parseFirstCodeblock(firstCodeblock)

  return config.hasOwnProperty(configSection) ? config[configSection] : {}
}

export async function migrateConfiguration(configSection: string, pluginJsonData: any): Promise<any> {
  const migrateData = {}
  const configData = await getConfiguration(configSection)
  const pluginSettings = pluginJsonData.hasOwnProperty('plugin.settings') ? pluginJsonData['plugin.settings'] : []

  pluginSettings.forEach((setting) => {
    const key: any = setting?.key || null
    if (key && configData?.[key]) {
      migrateData[key] = configData[key]
    }
  })

  return migrateData
}

/**
 * Parse first codeblock as JSON/JSON5/YAML/TOML
 * @author @nmn
 * @param {string} block - contents of first codeblock as string (excludes ``` delimiters)
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

  switch (format) {
    case 'json5':
      return parseJSON5(contents)
    default:
      console.log(`\tparseFirstCodeblock: error: unspported format "${format}""`)
  }
}
