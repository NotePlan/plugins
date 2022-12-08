// @flow

/**
 * THIS IS AN NP**** FILE. ONLY FUNCTIONS WHICH TOUCH NOTEPLAN APIS GO IN THIS FILE
 * ALL SUPPORTING FUNCTIONS THAT CAN BE TESTED IN ISOLATION SHOULD GO IN A SEPARATE FILE
 * (E.G. support/helpers.js FUNCTIONS and the corresponding test files)
 */

import pluginJson from '../plugin.json'
import { calculateCost, formatResearch, formatSummaryRequest, formatResearchListRequest, formatQuickSearchRequest, modelOptions } from './support/helpers'
import { chooseOption, showMessage, showMessageYesNo } from '@helpers/userInput'
import { log, logDebug, logError, logWarn, clo, JSP, timer } from '@helpers/dev'
import { intro, learningOptions, openAILearningWizard, modelsInformation } from './support/introwizard'

/*
 * TYPES
 */

type DallERequestOptions = { prompt?: string, n?: number, size?: string, response_format?: string, user?: string }
type CompletionsRequest = { model?: string, prompt?: string,max_tokens?: number, user?: string, suffix?: string, temperature?: string, top_p?: string, n?: number }

/*
 * CONSTANTS
 */

const baseURL = 'https://api.openai.com/v1'
const modelsComponent = 'models'
const imagesGenerationComponent = 'images/generations'
const completionsComponent = 'completions'
const { apiKey, defaultModel, showStats, max_tokens, researchDirectory } = DataStore.settings //FIXME: change model to something else

const availableModels = [
  'text-davinci-003',
  'text-curie-001',
  'text-babbage-001',
  'text-ada-001'
]
/*
 * FUNCTIONS
 */

/**
 * Format a Fetch request object for the OpenAI API, including the Authorization header and the contents of the post if any
 * @param {string} method - GET, POST, PUT, DELETE
 * @param {string} body - JSON string to send with POST or PUT
 * @returns
 */
export const getRequestObj = (method: string = 'GET', body: any = null): any => {
  if (apiKey.length) {
    const obj = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    }
    if (body && method !== 'GET') {
      // $FlowFixMe
      obj.body = JSON.stringify(body)
    }
    clo(obj, 'getRequestObj returning:')
    return obj
  } else {
    showMessage('Please set your API key in the plugin settings')
    logError(pluginJson, 'No API Key found')
  }
}

/**
 * Make a request to the GPT API
 * @param {string} component - the last part of the URL (after the base URL), e.g. "models" or "images/generations"
 * @param {string} requestType - GET, POST, PUT, etc.
 * @param {string} data - body of a POST/PUT request - can be an object (it will get stringified)
 * @returns {any|null} JSON results or null
 */
export async function makeRequest(component: string, requestType: string = 'GET', data: any = null): any | null {
  const url = `${baseURL}/${component}`
  logDebug(pluginJson, `makeRequest: about to fetch ${url}`)
  const result = await fetch(url, getRequestObj(requestType, data))
  if (result) {
    clo(result, `makeRequest() result of fetch to: "${url}"`)
    const resultJSON = JSON.parse(result)
    if (resultJSON) {
      return resultJSON
    } else if (resultJSON.error) {
      logError(pluginJson, `makeRequest received error: ${JSP(resultJSON.error)}`)
      await showMessage(`GPT API Returned Error: ${resultJSON.error.message}`)
    }
    return null
  } else {
    // must have failed, let's find out why
    fetch(url, getRequestObj(requestType, data))
      .then((result) => {
        logError(pluginJson, `makeRequest failed the first time but the second response was: ${JSP(result)}`)
      })
      .catch((error) => {
        logError(pluginJson, `makeRequest failed and response was: ${JSP(error)}`)
        showMessage(`Fetch failed: ${JSP(error)}`)
      })
  }
  return null
}

/**
 * Get the model list from OpenAI and ask the user to choose one
 * @returns {string|null} the model ID chosen
 */
 export async function chooseModel(_tokens?: number = max_tokens): Promise<string | null> {
  logDebug(pluginJson, `chooseModel tokens:${_tokens}`)
  const models = (await makeRequest(modelsComponent))?.data
  const filteredModels = models.filter(m=>modelOptions.hasOwnProperty(m.id))
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

/**
 * Allow user to decide how to proceed with info gathered from Quick Search
 * @returns {string|null} the model ID chosen
 */
 export async function chooseQuickSearchOption(query: string, summary: string): Promise<string | null> {
  logDebug(pluginJson, `chooseQuickSearchOption starting selection`)
  const quickSearchOptions = [
    {"label": "Append this summary to the current note.", "value": "append"},
    {"label": "Generate note with deeper research.", "value": "research"}
  ]
  const mappedOptions = quickSearchOptions.map((option) => ({ label: option.label, value: option.value}))
  clo(mappedOptions, "Mapped options")

  const selection = await chooseOption('How would you like to proceed?', mappedOptions)
  logDebug(pluginJson, `chooseQuickSearchOption ${selection} selected.`)
  return selection
  
}

/**
 * Ask for a prompt and n results from user
 * @returns { prompt: string, n: number }
 */
export async function getPromptAndNumberOfResults(promptIn: string | null = null, nIn: number | null = null): Promise<{ prompt: string, n: number }> {
  const prompt = promptIn ?? (await CommandBar.showInput('Enter a prompt', 'Search for %@'))
  const n = nIn ?? (await CommandBar.showInput('Enter the number of results to generate', 'Ask for %@ results'))
  return { prompt, n: parseInt(n) }
}

/**
 * Generates and outputs the AI generation stats at the cursor
 * https://beta.openai.com/docs/api-reference/completions/create
 * @param {number} time - The time to completion.
 * @param {string} model - the text AI model used.
 * @param {number} total_tokens - The total amount of tokens used during the generation.
 */
export function insertStatsAtCursor(time: string, model: string, total_tokens: number) {
  Editor.insertTextAtCursor(
    `### **Stats**\n**Time to complete:** ${time}\n**Model:** ${model}\n**Total Tokens:** ${total_tokens}\n**Cost:** $${calculateCost(model, total_tokens)}`,
  )
}

/**
 * test connection to GPT API by getting models list and making a request for an image
 * Plugin entrypoint for command: "/COMMAND"
 * @param {*} incoming
 */
export async function testConnection(model: string | null = null) {
  try {
    logDebug(pluginJson, `testConnection running with model:${String(model)}`)

    let chosenModel = model
    // get models/engines (to choose pricing/capability)
    if (!model) {
      chosenModel = await chooseModel()
    }
    if (model == "Choose Model") {
      chosenModel = await chooseModel()
    }
    if (chosenModel) {
      clo(chosenModel, 'testConnection chosenModel')
    } else {
      logWarn(pluginJson, 'No model chosen')
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/*
 * PLUGIN ENTRYPOINT
 */

/**
 * Create DALL-E images
 * Plugin entrypoint for command: "/Create AI Images"
 * Options:
 * @param {string} prompt - A text description of the prompt for the AI to interpret.
 * @param {number} - n - The number of images to generate. Must be between 1 and 10
 * @param {size} size - The size of the generated images. Must be one of 256x256, 512x512, or 1024x1024.
 * @param {string} response_format - The format in which the generated images are returned. Must be one of url or b64_json
 * @param {string} user - A unique identifier representing your end-user, which can help OpenAI to monitor and detect abuse.
 */
export async function createAIImages(promptIn: string | null = '', nIn: number = 1, sizeIn: string = '1024x1024', response_formatIn: string = 'url', userIn: string | null = null) {
  try {
    logDebug(pluginJson, `createImages running with prompt:${String(promptIn)} ${String(nIn)} ${sizeIn} ${response_formatIn} ${String(userIn)}`)

    // get an image
    const start = new Date()
    const { prompt, n } = await getPromptAndNumberOfResults(promptIn, nIn)
    const reqBody: DallERequestOptions = { prompt, n: n || 1, size: sizeIn || '1024x1024', response_format: response_formatIn }
    if (userIn) reqBody.user = userIn
    const request = (await makeRequest(imagesGenerationComponent, 'POST', reqBody))?.data
    const elapsed = timer(start)
    clo(request, `testConnection imageRequest result`)
    if (request) {
      const msg = `Call to DALL-E took ${elapsed}. ${request.length} results for "${prompt}":`
      Editor.insertTextAtCursor(msg)
      request.forEach((r, i) => Editor.insertTextAtCursor(`[Result${i}](${r.url})`))
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

// TODO: Create generic getCompletions request

/**
 * Entry point for generating research requests
 * Plugin entrypoint for command: "/research
 * @param {*} incoming
 */
export async function createResearchRequest(promptIn: string | null = null, nIn: number = 3, userIn: string = '') {
  try {
    logDebug(pluginJson, `createResearchRequest running with prompt:${String(promptIn)} ${String(nIn)} ${userIn}`)
    const start = new Date()
    let { prompt, n } = await getPromptAndNumberOfResults(promptIn, nIn)
    logError(pluginJson, `Look at this output - ${prompt}`)
    prompt = formatResearch(prompt, n)
    

    let chosenModel = defaultModel
    if (defaultModel == "Choose Model") {
      logDebug(pluginJson, `summarizeNote: Choosing Model...`)
      chosenModel = await chooseModel()
      logDebug(pluginJson, `summarizeNote: ${chosenModel} selected`)
    }
    const reqBody: CompletionsRequest = { prompt, model: chosenModel, max_tokens: max_tokens }
    const request = await makeRequest(completionsComponent, 'POST', reqBody)
    const time = timer(start)
    clo(request, `testConnection completionResult result`)
    if (request) {
      const response = request.choices[0].text
      // Editor.insertTextAtCursor(`${response}\n\n`)
      const content = `${response}\n\n`
      let tokens = request.usage.total_tokens
      const { showStats } = DataStore.settings
      if (showStats) {
        // Editor.insertTextAtCursor(`### **Stats**\n**Time to complete:** ${time}\n**Model:** ${model}\n**Total Tokens:** ${tokens}`)
        const stats = `### **Stats**\n**Time to complete:** ${time}\n**Model:** ${model}\n**Total Tokens:** ${tokens}`
        content += stats
      }
      DataStore.newNoteWithContent(content, researchDirectory)
      const noteName = `${promptIn}`
      logDebug(pluginJson, "noteName is set to ${noteName}")
      Editor.openNoteByTitleCaseInsensitive(noteName)

    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Entry point for generating research requests
 * Plugin entrypoint for command: "/research
 * @param {*} incoming
 */
 export async function createResearchListRequest(promptIn: string | null = null, nIn: number = 3, userIn: string = '') {
  try {
    logDebug(pluginJson, `createResearchListRequest running with prompt:${String(promptIn)} ${String(nIn)} ${userIn}`)
    const start = new Date()
    let { prompt, n } = await getPromptAndNumberOfResults(promptIn, nIn)
    logError(pluginJson, `Look at this output - ${prompt}`)
    prompt = formatResearchListRequest(prompt)
    

    let chosenModel = defaultModel
    if (defaultModel == "Choose Model") {
      logDebug(pluginJson, `createResearchListRequest: Choosing Model...`)
      chosenModel = "text-davinci-003"
      logDebug(pluginJson, `createResearchListRequest: ${chosenModel} selected`)
    }
    const reqBody: CompletionsRequest = { prompt, model: chosenModel, max_tokens: max_tokens }
    // clo(`response: `, reqBody)
    const request = await makeRequest(completionsComponent, 'POST', reqBody)
    const time = timer(start)
    clo(request, `testConnection completionResult result`)
    if (request) {
      
      const response = request.choices[0].text
      const jsonData = JSON.parse(response)
      clo(jsonData, `jsonParse() completionResult result`)

      let summary = { label: `Append ${jsonData.subject} Summary`, value: jsonData.summary }
      clo(summary, `jsonParse() summary result`)

      const wikiLink = { label: "Learn more...", value: jsonData.wikiLink }
      let keyTerms = jsonData.keyTerms.map((term) => ({ label: term, value: term }))
      keyTerms.unshift(summary, wikiLink)
      clo(keyTerms, `jsonParse() keyTerms result`)

      let selection = await chooseOption(jsonData.subject, keyTerms)
      clo(selection, `jsonParse() selection result`)

      if ( selection == jsonData.summary ) {
        Editor.insertTextAtCursor(`---\n## Summary\n${selection}\n\n`)
      } else {
        logError(pluginJson, "createResearchListRequest: No data found with selection.value.")
      }

      // Editor.insertTextAtCursor(`${response}\n\n`)
      // const tokens = request.usage.total_tokens
      // const { showStats } = DataStore.settings
      // if (showStats) {
      //   Editor.insertTextAtCursor(`### **Stats**\n**Time to complete:** ${time}\n**Model:** ${model}\n**Total Tokens:** ${tokens}`)
      // }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function createQuickSearch(promptIn: string | null = null, userIn: string = '') {
  try {
    logDebug(pluginJson, `createQuickSearch running with prompt:${String(promptIn)} ${userIn}`)
    const start = new Date()
    const text = await CommandBar.showInput("Quick Search", "Use GPT-3 to get a summary of your query.")
    const prompt = formatQuickSearchRequest(text)

    let chosenModel = defaultModel
    if (defaultModel == "Choose Model") {
      chosenModel = await "text-davinci-003"
      logDebug(pluginJson, `createQuickSearch: Defaulting to ${chosenModel}.`)
    }
    const reqBody: CompletionsRequest = { prompt, model: chosenModel, max_tokens: max_tokens }
    const request = await makeRequest(completionsComponent, 'POST', reqBody)
    const elapsedTimeStr = timer(start)
    clo(request, `testConnection completionResult result`)
    if (request) {
      const response = request.choices[0].text
      const total_tokens = request.usage.total_tokens

      if ( await showMessageYesNo(response, ['More Options', 'Done'], 'Summary', false) ) {
        const selection = await chooseQuickSearchOption(response)
        logDebug(pluginJson, `createQuickSearch: selected to ${selection}.`)

        if ( selection == "append" ) {
          Editor.insertTextAtCursor(`---\n## ${text}\n`)
          Editor.insertTextAtCursor(`${response}\n\n`)
          if (showStats) {
            insertStatsAtCursor(elapsedTimeStr, chosenModel, total_tokens)
          }
        } else {
          createResearchRequest(text)
        }
      }    
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Entry point for generating summary requests
 * Plugin entrypoint for command: "/summarize
 * @param {*} incoming
 */
export async function summarizeNote(promptIn: string | null = null, userIn: string = '') {
  try {
    logDebug(pluginJson, `summarizeNote running with prompt:${String(promptIn)} ${userIn}`)
    const start = new Date()
    const text = Editor.content ?? ''
    const prompt = formatSummaryRequest(text)

    let chosenModel = defaultModel
    if (defaultModel == "Choose Model") {
      logDebug(pluginJson, `summarizeNote: Choosing Model...`)
      chosenModel = await chooseModel()
      logDebug(pluginJson, `summarizeNote: ${chosenModel} selected`)
    }
    const reqBody: CompletionsRequest = { prompt, model: chosenModel, max_tokens: max_tokens }
    const request = await makeRequest(completionsComponent, 'POST', reqBody)
    const elapsedTimeStr = timer(start)
    clo(request, `testConnection completionResult result`)
    if (request) {
      const response = request.choices[0].text
      const total_tokens = request.usage.total_tokens
      Editor.insertTextAtCursor(`---\n## Summary\n`)
      Editor.insertTextAtCursor(`${response}\n\n`)
      if (showStats) {
        insertStatsAtCursor(elapsedTimeStr, chosenModel, total_tokens)
      }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Entry point for generating summary requests from selection
 * Plugin entrypoint for command: "/summarizeselection
 * @param {*} incoming
 */
export async function summarizeSelection(promptIn: string | null = null, userIn: string = '') {
  try {
    const start = new Date()
    const text = Editor.selectedText
    const prompt = formatSummaryRequest(text)

    let chosenModel = defaultModel
    if (defaultModel == "Choose Model") {
      logDebug(pluginJson, `summarizeNote: Choosing Model...`)
      chosenModel = await chooseModel()
      logDebug(pluginJson, `summarizeNote: ${chosenModel} selected`)
    }

    const reqBody: CompletionsRequest = { prompt, model: chosenModel, max_tokens: max_tokens }
    const request = await makeRequest(completionsComponent, 'POST', reqBody)
    const time = timer(start)
    clo(request, `testConnection completionResult result`)
    if (request) {
      const response = request.choices[0].text
      const total_tokens = request.usage.total_tokens
      const { showStats } = DataStore.settings
      const endOfSelection = Editor.renderedSelection.end
      Editor.insertTextAtCharacterIndex(`---\n## Summary\n${response}\n\n`, endOfSelection)

      if (showStats) {
        const stats = formatTextStats(time, chosenModel, total_tokens)
        Editor.insertTextAtCursor(stats)
      }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function introWizard() {
  if ( await CommandBar.prompt(intro.title, intro.prompt, intro.buttons) == 0) {
    console.log("Fill this in shortly.")
    }
}

export async function helpWizard() {
  const options = learningOptions.map((option) => ({ label: option, value: option }))

  const topic = await chooseOption("Select a topic to learn more...", options)
  console.log(topic)
  const wizard = openAILearningWizard[topic]
  console.log(wizard)
  console.log(wizard.title)
  learnMore(wizard)

  
}

export async function learnMore(learningTopic: Object) {
  const wizard = learningTopic
  
  if ( wizard == openAILearningWizard.Models ) {
    // const selection = await CommandBar.prompt(wizard.title, wizard.prompt, wizard.buttons)
    console.log(wizard.title)
    const options = wizard.options.map((option) => ({ label: option, value: option}))
    const selection = await chooseOption(learningTopic.prompt2, options)

    const selectedModel = modelsInformation[selection]
    console.log(`Selected Model: ${selectedModel}`)
    const infolog = await chooseOption("Info", formatModelInformation(selectedModel))
    console.log(infolog)
  }
}

export function formatModelInformation(info: Object) {
  const modelInfo = `${info}\nGood At: ${info.goodAt} | Cost: ${info.cost}.`
  console.log(modelInfo)
  return modelInfo
}
