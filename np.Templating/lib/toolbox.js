// @flow

import { showMessage, showMessageYesNo } from '@helpers/userInput'
import { parseJSON5 } from '@helpers/general'

// (from @nmn / nmn.sweep)
export type Option<T> = $ReadOnly<{
  label: string,
  value: T,
}>

const STATIC_TEMPLATE_FOLDER = '📋 Templates'

const ALLOWED_FORMATS = ['javascript', 'json', 'json5']
const FORMAT_MAP = { javascript: 'json5' }

const DAILY_NOTE_TEMPLATE = `Daily Note Template
---
## Tasks

## Media
> {{quote()}}

## Journal
Weather: {{weather()}}
`

const MEETING_NOTE_TEMPLATE = `Meeting Note Template
---
## Project X Meeting on [[{{date-as-YYYY-MM-DD}}]] with {{people list}}

## Notes

## Actions
`

const TAGS_TEMPLATE = `Tags Template
---
# {{title}}

Created on {{date({locale: 'en-US', dateStyle: 'short'})}}
`

const CONFIG = ` _configuration
---
# Template Tag Configuration
This note provides a central location where you can configure various plugin options:

- Use the fenced code block below (which comes after a line made by 3 dashes) to customize global values for the various template tags.

- NotePlan plugin configuration uses JSON5 [JSON5 | JSON for Humans](https://json5.org/), which is a human-friendly superset of JSON, providing things such as comments, unquoted keys and other common patterns available in standard JavaScript objects.

	*Note: Despite JSON5 enhancements, multi-line strings are not supported, therefore to include them you need to use "\\n" (new line) for line breaks rather than actual line breaks.*

- Use the code block marked as \`javascript\` shown below to write your own custom custom configurations.

- While it is possible to have multiple \`javascript\` code blocks in this document, only the **first** code block will be used.

- If you have a quoted "string" which you want to have a **line break**, insert a "\\n" (i.e. backslash-n) where you want the line break, e.g., "These\\nAre\\nThree lines".

### Validating Configuration
The configuration code blocks below are validated in **realtime** by NotePlan as you edit:

- If there is a configuration mistake, all code below will all be a single color (based on theme).
- If the configuration passes the validation, you will see configuration settings will be formatted based on your current theme (e.g., orange, green, purple, black, etc.).

**TIP:** If your configuration is invalid, you can copy/paste the configuration block to [JSON5 Validator Online - JSON5 lint Tool to validate JSON5 data](https://codebeautify.org/json5-validator) which will provide details about the error(s) in your code block, indicating which line(s) contain the error(s).

### Reporting Plugin Issues
Should you run into an issue with a NotePlan plugin, you can use one of the following methods (in order of priority)
- 🐞 [NotePlan Plugin Issues](https://github.com/NotePlan/plugins/issues/new/choose)
- 🧩 [Discord](https://discord.com/channels/763107030223290449/784376250771832843)
- 📪 [NotePlan Support](hello@noteplan.io)
*****
## Plugin Configuration
*Note: While the following code block is marked as \`javascript\` it is actually \`JSON5\` and is only marked as \`javascript\` so that your theme will provide the appropriate syntax highlighting.*

\`\`\`javascript
{
  // configuration for weather data (used in Daily Note Template, for example)
  weather: {
    // API key for https://openweathermap.org/
    // !!REQUIRED!!
    openWeatherAPIKey: '... put your API key here ...',
    // Required location for weather forecast
    latPosition: 0.0,
    longPosition: 0.0,
    // Default units. Can be 'metric' (for Celsius), or 'imperial' (for Fahrenheit)
    openWeatherUnits: 'metric',
  },

  // configuration for daily quote (used in Daily Note Template, for example)
  quote: {
    // Available modes: [random (default), today, author]
    mode: 'today',
    // API key required, available authors: https://premium.zenquotes.io/available-authors/
    author: 'anne-frank',
    // Required for mode: 'author' (from https://premium.zenquotes.io/)
    apiKey: '... put your API key here ...',
  },
}

\`\`\`

`

/**
 * Show alert (like modal) using CommandBar
 * @author @codedungeon
 * @param {string} message - text to display to user (parses each line as separate 'option')
 * @param {string} label - label text (appears in CommandBar filter field)
 * @param {[String]?} buttons - array of buttons (strings)
 */
export async function alert(
  message: string = '',
  title: string = '',
  buttons?: $ReadOnlyArray<string>,
): Promise<number> {
  const result = await CommandBar.prompt(message, title, buttons)

  return result
}

/**
 * Helper function to show a simple yes/no (could be OK/Cancel, etc.) dialog using CommandBar
 * @param {string} message - text to display to user
 * @param {Array<string>} - an array of the choices to give (default: ['Yes', 'No'])
 * @returns {string} - returns the user's choice - the actual *text* choice from the input array provided
 */
export async function confirm(message: string, choicesArray: Array<string> = ['Yes', 'No']): Promise<string> {
  const answer = await CommandBar.showOptions(choicesArray, message)
  return choicesArray[answer.index]
}

/**
 * Let user pick from a nicely-indented list of available folders (or return / for root)
 * @author @jgclark
 * @param {string} message - text to display to user
 * @returns {string} - returns the user's folder choice (or / for root)
 */
export async function chooseFolder(msg: string, includeArchive: boolean = false): Promise<string> {
  let folder: string
  const folders = DataStore.folders // excludes Trash and Archive
  if (includeArchive) {
    // $FlowFixMe
    folders.push('@Archive')
  }
  if (folders.length > 0) {
    // make a slightly fancy list with indented labels, different from plain values
    const folderOptionList: Array<any> = []
    for (const f of folders) {
      if (f !== '/') {
        const folderParts = f.split('/')
        for (let i = 0; i < folderParts.length - 1; i++) {
          folderParts[i] = '     '
        }
        folderParts[folderParts.length - 1] = `📁 ${folderParts[folderParts.length - 1]}`
        const folderLabel = folderParts.join('')
        folderOptionList.push({ label: folderLabel, value: f })
      } else {
        // deal with special case for root folder
        folderOptionList.push({ label: '📁 /', value: '/' })
      }
    }
    // const re = await CommandBar.showOptions(folders, msg)
    folder = await chooseOption(msg, folderOptionList, '/')
  } else {
    // no Folders so go to root
    folder = '/'
  }
  return folder
}

/**
 * ask user to choose from a set of options (from nmn.sweep)
 * @author @nmn
 * @param {string} message - text to display to user
 * @param {Array<T>} options - array of label:value options to present to the user
 * @param {TDefault} defaultValue - default label:value to use
 * @return {TDefault} - string that the user enters. Maybe be the empty string.
 */
export async function chooseOption<T, TDefault = T>(
  message: string,
  options: $ReadOnlyArray<Option<T>>,
  defaultValue: TDefault,
): Promise<T | TDefault> {
  const { index } = await CommandBar.showOptions(
    options.map((option) => option.label),
    message,
  )
  return options[index]?.value ?? defaultValue
}

/**
 * Get the Templates folder path, if it exists
 * @author @nmn
 * @return { ?string } - folder pathname
 */
export function getTemplateFolder(): ?string {
  return DataStore.folders.find((f) => f.includes(STATIC_TEMPLATE_FOLDER))
}

/**
 * Get the Templates folder path, without leading '/'
 * If it doesn't exist, offer to create it and populate it with samples
 * @author @nmn
 * @return { ?string } - relative folder pathname (without leading '/')
 */
export async function getOrMakeTemplateFolder(): Promise<?string> {
  let folder = getTemplateFolder()

  if (folder == null) {
    // No template folder yet, so offer to make it and populate it
    const shouldCreateFolder = await chooseOption<boolean, boolean>(
      'No templates folder found.',
      [
        {
          label: `✅ Create ${STATIC_TEMPLATE_FOLDER} with samples`,
          value: true,
        },
        {
          label: '❌ Cancel command',
          value: false,
        },
      ],
      false,
    )

    if (!shouldCreateFolder) {
      return
    }

    const subFolder = await chooseOption<string>(
      'Select a location for the templates folder.',
      DataStore.folders.map((folder) => ({
        label: folder,
        value: folder + (folder.endsWith('/') ? '' : '/'), // ensure ends with '/'
      })),
      '',
    )
    folder = subFolder + STATIC_TEMPLATE_FOLDER

    // Now create a sample note in that folder, then we got the folder also created
    DataStore.newNote(DAILY_NOTE_TEMPLATE, folder)
    DataStore.newNote(MEETING_NOTE_TEMPLATE, folder)
    DataStore.newNote(TAGS_TEMPLATE, folder)
    DataStore.newNote(CONFIG, folder)
    // for 'folder' to be useful straight away we need to strip off any leading '/'
    folder = folder.startsWith('/') ? folder.slice(1) : folder
    await showMessage(`"${folder}" folder created with samples`)
  }
  return folder
}

/**
 * Write out a new _configuration file
 * @author @jgclark
 */
export function createDefaultConfigNote(): void {
  const folder = getTemplateFolder()
  if (folder != null) {
    DataStore.newNote(CONFIG, folder)
  }
}

/**
 * Get NotePlan Templating Configuration (helper for getStructuredConfiguration)
 * @author @codedungeon
 * @return return this as structured data, in the format specified by the first line of the codeblock (should be `javascript`)
 */
export async function getConfiguration(): Promise<?{
  [string]: ?mixed,
}> {
  return getStructuredConfiguration()
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

  switch (format) {
    case 'json5':
      return parseJSON5(contents)
    default:
      console.log(`\tparseFirstCodeblock: error: unspported format "${format}""`)
  }
}

/**
 * Get configuration section, validating its config if requested.
 * If configuration section not present, add a default one into the _configuration file (if given)
 * Only deals with json5 case.
 * @author @nmn, @jgclark, @dwertheimer, adapted from `nmn.Templates`
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
    templateFolder = getOrMakeTemplateFolder()
    return {}
  }

  let configFile = DataStore.projectNotes
    // $FlowIgnore[incompatible-call]
    .filter((n) => n.filename?.startsWith(templateFolder))
    .find((n) => !!n.title?.startsWith('_configuration'))

  if (configFile == null) {
    createDefaultConfigNote()
    configFile = DataStore.projectNotes
      // $FlowIgnore[incompatible-call]
      .filter((n) => n.filename?.startsWith(templateFolder))
      .find((n) => !!n.title?.startsWith('_configuration'))
  }

  const content: ?string = configFile?.content
  if (configFile == null || content == null) {
    // Really strange to get here: won't code a response, but will just error.
    await showMessage(`Error: missing or empty '_configuration' file in Templates folder.`)
    return {}
  }

  // Get config contents
  const firstCodeblock = content.split('\n```')[1]
  const config: { [string]: mixed } = (await parseFirstCodeblock(firstCodeblock)) ?? {}

  // Does it contain the section we want?
  // (use an alternative to dot notation that allows variables)
  if (firstCodeblock == null || config[configSectionName] == null) {
    // The section is missing.
    // If no default configuration given, return nothing
    if (configSectionDefault === '') {
      return {}
    }

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
 * @author @dwertheimer adapted from `nmn.Templates`
 * @param {mixed} config - configuration as structured JSON5 object
 * @param {mixed} validations - JSON5 string to use as default values for this configuration section
 * @return {mixed} return this as structured data, in the format specified by the first line of the first codeblock
 */
function validateMinimumConfig(config: { [string]: mixed }, validations: { [string]: mixed }): { [string]: mixed } {
  let failed = false
  if (Object.keys(validations).length) {
    Object.keys(validations).forEach((v) => {
      if (config[v] == null) {
        failed = true
      }
      if (typeof config[v] !== validations[v]) {
        failed = true
      }
    })
  }
  if (failed) {
    return {}
  } else {
    return config
  }
}
