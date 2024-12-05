// @flow

const pluginJson = `shared.AI/helpers`
import { logDebug, logError, logWarn, clo, JSP } from '@helpers/dev'
import { createPrettyRunPluginLink, parseJSON5 } from '@helpers/general'
import { removeContentUnderHeading } from '@helpers/NPParagraph'
import { chooseOption } from '@helpers/userInput'
import { getInput } from '../../../helpers/userInput'
import { makeRequest } from './networking'

export const modelOptions = {
  'text-davinci-003': 0.02,
  'text-curie-001': 0.002,
  'text-babbage-001': 0.0005,
  'text-ada-001': 0.0004,
  'gpt-3.5-turbo': 0.002,
  'gpt-4': 0.003,
}

const commandsPath = '/support/.readme_text/commands.md'

/**
 * Calculates the cost of the request.
 * https://beta.openai.com/docs/api-reference/completions/create
 * @param {string} model - the text AI model used.
 * @param {number} total_tokens - The total amount of tokens used during the generation.
 */
export function calculateCost(model: string, total_tokens: number): number {
  logDebug(pluginJson, `calculateCost(): attempting to calculate cost.`)
  const request_cost = (modelOptions[model] / 1000) * total_tokens
  logDebug(
    pluginJson,
    `calculateCost():
    Model: ${model}
    Total Tokens: ${total_tokens}
    Model Cost/1k: ${modelOptions[model]}
    Total Cost: ${request_cost}\n`,
  )
  clo(modelOptions, 'model cost object')

  return request_cost
}

/**
 * Generates the Commands section of the README.md
 */
export function generateREADMECommands() {
  logDebug(pluginJson, `generateREADMECommands(): starting generation.`)
  let output = ''
  const commands = pluginJson['plugin.commands']
  logDebug(pluginJson, `generateREADMECommands(): found commands.`)
  clo(commands, 'COMMANDS')
  if (Array.isArray(commands)) {
    logDebug(pluginJson, `generateREADMECommands(): found array.`)
    output.push(`### Commands`)
    commands.forEach((command) => {
      const linkText = `try it`
      const rpu = createPrettyRunPluginLink(linkText, pluginJson['plugin.id'], command.name)
      const aliases = commmand.aliases && command.aliases.length ? `\r\t*Aliases:${command.aliases.toString()}*` : ''
      output.push(`- /${command.name} ${rpu}${aliases}\r\t*${command.description}*`)
    })
    logDebug(pluginJson, `generateREADMECommands(): finished generation.`)
  }
  if (output != '') {
    logDebug(pluginJson, `generateREADMECommands(): writing to file.`)
    fs.writeFile(commandsPath, output)
  }
}

/**
 * Sets the prompt format for the summary part of the bullet prompt
 * @params (Object) learningTopic - General object that directs the behavior of the function.
 * Currently under construction.
 */
export async function rerollSingleKeyTerm(promptIn: string, exclusions: string) {
  let prompt = `Return a single topic that is related to the topic of ${promptIn}. No numbers.
  Exclude the following topics from the result: ${exclusions}
  Example: Maple Syrup, Economic Growth in Nigeria (2020)
  List:
  `
  return prompt
}

/**
 * Get the model list from OpenAI and ask the user to choose one
 * @returns {string|null} the model ID chosen
 */
export async function adjustPreferences() {
  // let availablePreferences = []
  let prefs = getPreferences()
  const noteAISettings = DataStore.settings
  // const availablePreferences = noteAISettings.getOwnPropertyNames.map((option) => ({ label: option, value: option }))
  // const selectedPreference = await CommandBar.showOptions(availablePreferences, 'Select Preference')
  // const filteredModels = noteAISettings.filter((m) => noteAISettings.hasOwnProperty(m.id))
  clo(prefs, 'Mapped options')
  const selectedPreference = await chooseOption('Select Preference', prefs)

  let max_tokens = await CommandBar.showInput(`Set max tokens`, `Current: ${noteAISettings['max_tokens']}`)
  noteAISettings['max_tokens'] = Number(max_tokens)
  DataStore.settings = noteAISettings
}

function getPreferences() {
  let noteAISettings = DataStore.settings
  for (var key in noteAISettings) {
    // logDebug(pluginJson, `${key}`)
    const info = { label: `${noteAISettings[key]}`, value: key }
    availablePreferences.push(info)
  }
  return noteAISettings
}

export function removeEntry(heading: string) {
  // logDebug(pluginJson, `\n\n----- Removing Entry -----\n${heading}\n\n---- ----- ---- \n\n`)
  const paraBeforeDelete = Editor.paragraphs.find((p) => p.content === heading)
  if (paraBeforeDelete) {
    // logDebug(pluginJson, `removeEntry heading in document: "${paraBeforeDelete.content}" lineIndex:${paraBeforeDelete.lineIndex}`)
    const contentRange = paraBeforeDelete.contentRange
    const characterBeforeParagraph = contentRange.start - 1 // back up one character
    removeContentUnderHeading(Editor, heading, false, false) // delete the paragraph
    // logDebug(pluginJson, `removeEntry removed para: ${heading}`)
    Editor.highlightByIndex(characterBeforeParagraph, 0) // scroll to where it was
  }
}

/**
 * Plugin entry point for (hidden) command: /Scroll to Entry (called via x-callback-url)
 * @param {string} heading - the heading to scroll to
 * @param {*} deleteItem - whether to delete the entry with the given heading first
 * @param {'true'|'false'|'toggle'} foldHeading - whether to fold the heading after scrolling to it
 */
export function scrollToEntry(_heading: string, _deleteItem?: ?string = null, foldHeading?: ?string = null): void {
  try {
    const heading =
      _heading === 'Table of Contents' ? createPrettyRunPluginLink('Table of Contents', 'shared.AI', 'Scroll to Entry', ['Table of Contents', 'false', 'toggle']) : _heading

    const deleteItem = _deleteItem === 'true' ? true : false
    // logDebug(pluginJson, `\n\n----- Scrolling to Entry -----\nheading:"${heading}" deleteItem:${String(deleteItem)} foldHeading:${String(foldHeading)}\n`)
    const selectedHeading = Editor.paragraphs.find(
      (p) => p.content === capitalizeFirstLetter(heading) || (p.content.startsWith(capitalizeFirstLetter(heading)) && Editor.isFolded(p)),
    )
    if (selectedHeading) {
      // logDebug(pluginJson, `scrollToEntry found selectedHeading="${selectedHeading.content}" lineIndex=${selectedHeading.lineIndex}`)
      let firstCharacter
      const contentRange = selectedHeading.contentRange
      if (deleteItem) {
        firstCharacter = (contentRange?.start || 1) - 1 // back up one character
        removeEntry(heading)
        // logDebug(pluginJson, `scrollToEntry after delete`)
      } else {
        firstCharacter = contentRange?.start || 0
        if (foldHeading === 'true' && !Editor.isFolded(selectedHeading)) Editor.toggleFolding(selectedHeading)
        if (foldHeading === 'false' && Editor.isFolded(selectedHeading)) Editor.toggleFolding(selectedHeading)
        if (foldHeading === 'toggle') {
          // logDebug(pluginJson, `scrollToEntry isFolded:${String(Editor.isFolded(selectedHeading))} `)
          Editor.toggleFolding(selectedHeading)
        }
      }
      Editor.highlightByIndex(firstCharacter, 0) // scroll to where it was
    }
  } catch (error) {
    logDebug(pluginJson, `scrollToEntry error: ${JSP(error)}`)
  }
}

export function capitalizeFirstLetter(string) {
  return string[0].toUpperCase() + string.slice(1)
}

export async function checkModel() {
  const { defaultModel } = DataStore.settings
  let chosenModel = defaultModel
  if (defaultModel === 'Choose Model') {
    logDebug(pluginJson, `noteToPrompt: Choosing Model...`)
    chosenModel = (await chooseModel()) || ''
    logDebug(pluginJson, `noteToPrompt: ${chosenModel} selected`)
  }
  return chosenModel
}

/**
 * Get the model list from OpenAI and ask the user to choose one
 * @returns {string|null} the model ID chosen
 */
export async function chooseModel(_tokens?: number = 1000): Promise<string | null> {
  logDebug(pluginJson, `chooseModel tokens:${_tokens}`)
  const models = (await makeRequest('models'))?.data
  const filteredModels = models?.filter((m) => modelOptions.hasOwnProperty(m.id)) || []
  if (filteredModels) {
    const modelsReturned = filteredModels.map((model) => {
      const cost = calculateCost(model.id, _tokens)
      const costStr = isNaN(cost) ? '' : ` ($${String(parseFloat(cost.toFixed(6)))} max)`
      return { label: `${model.id}${costStr}`, value: model.id }
    })
    return await chooseOption('Choose a model', modelsReturned)
  } else {
    logError(pluginJson, 'No models found')
  }
  return null
}

export async function listEndpoints() {
  // const allPlugins = await DataStore.listPlugins()
  // const aiPlugin = allPlugins.filter((p) => p.id == 'shared.AI')
  // let availableCommands = []
  // for (var p of aiPlugin) {
  //   for (var c of p.commands) {
  //     if (!c.isHidden) {
  //       availableCommands.push(c)
  //     }
  //   }
  // }
  // const aiCommands = await availableCommands.map((p) => ({ label: `${p.name}`, value: p.name }))
  // const selectedCommand = await chooseOption('NoteAI - Commands', aiCommands)
  // clo(selectedCommand, selectedCommand)
  // await DataStore.invokePluginCommandByName(selectedCommand, 'shared.AI')
  let { max_tokens } = DataStore.settings
  clo(max_tokens, max_tokens)

  const newMaxTokens = await CommandBar.showInput(`Current Value: ${max_tokens}`, 'Update Max Token Target')
  DataStore.settings = { ...DataStore.settings, max_tokens: Number(newMaxTokens) }
}
