// @flow

/**
 * THIS IS AN NP**** FILE. ONLY FUNCTIONS WHICH TOUCH NOTEPLAN APIS GO IN THIS FILE
 * ALL SUPPORTING FUNCTIONS THAT CAN BE TESTED IN ISOLATION SHOULD GO IN A SEPARATE FILE
 * (E.G. support/helpers.js FUNCTIONS and the corresponding test files)
 */

import pluginJson from '../plugin.json'
import { calculateCost, formatResearch, formatSummaryRequest } from './support/helpers'
import { chooseOption, showMessage } from '@helpers/userInput'
import { log, logDebug, logError, logWarn, clo, JSP, timer } from '@helpers/dev'

/*
 * TYPES
 */

type DallERequestOptions = { prompt?: string, n?: number, size?: string, response_format?: string, user?: string }
type CompletionsRequest = { model?: string, prompt?: string, max_tokens?: number, user?: string, suffix?: string, temperature?: string, top_p?: string, n?: number }

/*
 * CONSTANTS
 */

const baseURL = 'https://api.openai.com/v1'
const modelsComponent = 'models'
const imagesGenerationComponent = 'images/generations'
const completionsComponent = 'completions'
const { apiKey, model, showStats, max_tokens } = DataStore.settings //FIXME: change model to something else

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
export async function chooseModel(): Promise<string | null> {
  const models = (await makeRequest(modelsComponent))?.data
  if (models) {
    const modelOptions = models.map((model) => ({ label: model.id, value: model.id }))
    return await chooseOption('Choose a model', modelOptions)
  } else {
    logError(pluginJson, 'No models found')
  }
  return null
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
 * Create a request object for text completion request
 * https://beta.openai.com/docs/api-reference/completions/create
 * @param {string} prompt - A text description of the prompt for the AI to interpret.
 * @param {string} model - The desired model to use for the text completion.
 * @param {number} max_tokens - The maximum number of tokens to generate in the completion
 * @param {string} suffix - The suffix that comes after the completion.
 * @param {number} temperature - What sampling temperature to use. Higher values means the model will take more risks. Try 0.9 for more creative applications, and 0 (argmax sampling) for ones with a well-defined answer.
 * @param {number} top_p - An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.
 * @param {number} n - How many completions to generate for each prompt.
 * @param {string} user - A unique identifier representing your end-user, which can help OpenAI to monitor and detect abuse.
 */
export function createCompletionRequestBody(
  prompt: string,
  model: string,
  max_tokens: number = 500,
  suffix: string | null = null,
  temperature: number = 1,
  top_p: number = 1,
  n: number = 1,
  user: string | null = null,
): CompletionsRequest {
  logDebug(
    pluginJson,
    `createCompletionRequestBody running ${String(prompt)} ${String(model)} ${String(max_tokens)} ${String(suffix)} ${String(temperature)} ${String(top_p)} ${String(n)} ${String(
      user,
    )}`,
  )
  const obj = { model, prompt, max_tokens }

  if (user) obj.user = user
  return obj
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
    const { prompt, n } = await getPromptAndNumberOfResults(promptIn, nIn)
    // const model = await chooseModel()
    const request = await makeRequest(completionsComponent, 'POST', createCompletionRequestBody(formatResearch(prompt, n), model, max_tokens))
    const time = timer(start)
    clo(request, `testConnection completionResult result`)
    if (request) {
      const response = request.choices[0].text
      Editor.insertTextAtCursor(`${response}\n\n`)
      const tokens = request.usage.total_tokens
      const { showStats } = DataStore.settings
      if (showStats) {
        Editor.insertTextAtCursor(`### **Stats**\n**Time to complete:** ${time}\n**Model:** ${model}\n**Total Tokens:** ${tokens}`)
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
    const request = await makeRequest(completionsComponent, 'POST', createCompletionRequestBody(formatSummaryRequest(text), model, max_tokens))
    const elapsedTimeStr = timer(start)
    clo(request, `testConnection completionResult result`)
    if (request) {
      const response = request.choices[0].text
      const total_tokens = request.usage.total_tokens
      Editor.insertTextAtCursor(`---\n## Summary\n`)
      Editor.insertTextAtCursor(`${response}\n\n`)
      if (showStats) {
        insertStatsAtCursor(elapsedTimeStr, model, total_tokens)
      }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
