// @flow

const pluginJson = '@helpers/openAI.js'
import { log, logError, logWarn, logDebug, timer, clo, JSP } from '@helpers/dev'
import { getSettings } from '@helpers/NPConfiguration'
import { getInput, showMessage } from '@helpers/userInput'

// @flow

/****************************************************************************************************************************
 *                             CONSTANTS
 ****************************************************************************************************************************/

const BASE_URL = 'https://api.openai.com/v1'
const TOKEN_LIMIT = 3000 // tokens per request (actually 3072)
const MAX_RETRIES = 5 // number of times to retry a request if it fails
const CHAT_COMPONENT = 'chat/completions'
const MODEL_COST = { 'gpt-4': { inputCost: 0.03 / 1000, outputCost: 0.06 / 1000 }, 'gpt-3.5-turbo': { inputCost: 0.0015 / 1000, outputCost: 0.002 / 1000 } }

/****************************************************************************************************************************
 *                             TYPES
 ****************************************************************************************************************************/

// export type DallERequestOptions = { prompt?: string, n?: number, size?: string, response_format?: string, user?: string }
export type CompletionsRequest = { model: string, prompt?: string, max_tokens?: number, user?: string, suffix?: string, temperature?: string, top_p?: string, n?: number }
export type ResearchListResult = { initialQuery: string, currentQuery: string, selection?: string, options?: [string] }

export type JSONClickData = { unclickedLinks: Array<string>, clickedLinks: Array<string>, initialSubject: string, remixes: Array<string>, totalTokensUsed: number }

export type ChatMode = 'insert' | 'new_document' | 'return'

export type ChatReturn = { question: string, prompt: string, answer: string }

export type ChatResponse = {
  error?: {
    message: string,
    type: string,
    param: string,
    code: string,
  },
  id: string,
  object: string,
  created: number,
  model: string,
  usage: {
    prompt_tokens: number,
    completion_tokens: number,
    total_tokens: number,
  },
  choices: Array<{
    message: {
      role: string,
      content: string,
    },
    finish_reason: string,
    index: number,
  }>,
}

// https://platform.openai.com/docs/api-reference/completions
export type ChatObject = {
  model: string /* currently only gpt-3.5-turbo is supported */,
  messages: Array<{
    role: 'system' | 'user' | 'assistant',
    content: string,
  }>,
  suffix?: string,
  temperature?: number,
  max_tokens?: number,
  top_p?: number,
  presence_penalty?: number,
  frequency_penalty?: number,
  best_of?: number,
  n?: number,
  stream?: boolean,
  logprobs?: number,
  echo?: boolean,
}

/****************************************************************************************************************************
 *                             LOCAL FUNCTIONS
 ****************************************************************************************************************************/

/**
 * Make a request to the GPT API
 * @param {string} method - GET, POST, PUT, etc.
 * @param {any} body - JSON or null
 * @returns {any|null} JSON results or null
 */
export async function getFetchRequestObj(method: string = 'GET', body: any = null): any {
  const apiKey = await getOpenAIKey()
  if (apiKey?.length) {
    const obj = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    }
    if (body && method !== 'GET') {
      // logDebug(pluginJson, `getFetchRequestObj body type was: ${typeof body}`)
      // $FlowFixMe
      obj.body = typeof body === 'object' ? JSON.stringify(body) : body
    }
    // clo(obj, 'getFetchRequestObj request object is:')
    return obj
  } else {
    showMessage('Please set your API key in the plugin settings')
    logError(pluginJson, 'No API Key found')
    return null
  }
}

/**
 * Get a human-readable error string to display to the user
 * @param {Object} resultJSON - the JSON returned by the API
 * @returns a string to display to the user
 */
function getErrorStringToDisplay(resultJSON: any): string {
  const open = `OpenAI sent back an error message:\n"${resultJSON?.error?.message || ''}"`
  let middle = ''
  switch (resultJSON?.error?.code) {
    case 'insufficient_quota':
      middle = `\n\nDo you have a current credit card on your OpenAI account? If not, you will need to add one. Using OpenAI (chatGPT/DALL-E etc.) is quite inexpensive, but you do need a credit card on file.`
      break
    case 'too_many_requests':
      middle = `\n\nYou have may have made too many API calls in a short period of time or their servers are overloaded.`
      break
    case 'invalid_api_key':
      middle = `\n\nYou need to put a valid OpenAI API key in the plugin preferences for these commands to work properly. Please check your API key on OpenAI's website or create a new one.`
      break
    case 'invalid_request_error':
      middle = `\n\nThe request sent to OpenAI was invalid. This may be a bug in the plugin. Please report it.`
      break
  }
  const close = `\n\nPlease correct the error and try again.`
  return `${open}${middle}${close}`
}

/**
 * Count the number of tokens in a string (words + newlines)
 * @param {string} inputString
 * @returns {number} number of tokens in the string
 */
export function countTokens(inputString: string): number {
  const words = inputString.trim().split(' ')
  let count = 0

  words.forEach((word) => {
    count += word.split('\n').length
  })

  return count
}

/**
 * Test if a string is too long for the API
 * @param {string} string
 * @param {boolean} shouldShowMessage - show a message if the string is too long (default: false)
 * @returns {boolean} true if the string is too long, false if it is not
 */
export async function testTOKEN_LIMIT(str: string, shouldShowMessage: boolean = false): Promise<boolean> {
  const tokens = countTokens(str)
  if (tokens > TOKEN_LIMIT) {
    if (shouldShowMessage) {
      const message = `The string you entered is ${tokens} tokens long (including history). OpenAI's API has an approx limit of ${TOKEN_LIMIT} tokens. It may get rejected, but we will try it and see.`
      await showMessage(message, 'error')
    }
    return false
  }
  return true
}

function logUsage(request: ChatObject, response: ChatResponse) {
  const { model } = request
  const { usage } = response
  if (MODEL_COST[model]) {
    const { prompt_tokens, completion_tokens } = usage
    const { inputCost, outputCost } = MODEL_COST[model]
    const inputCostStr = (inputCost * prompt_tokens).toFixed(4)
    const outputCostStr = (outputCost * completion_tokens).toFixed(4)
    const totalCostStr = (inputCost * prompt_tokens + outputCost * completion_tokens).toFixed(4)
    logDebug(pluginJson, `outputUsage: inputCost=$${inputCostStr} outputCost=$${outputCostStr} totalCost=$${totalCostStr}`)
  }
}

/****************************************************************************************************************************
 *                             EXPORTED FUNCTIONS
 ****************************************************************************************************************************/

/**
 * Create an initial chat request object with the starting system message
 * (contains no input from the user)
 * @param {string|null} model - the model to use (default: gpt-3.5-turbo)
 * @param {string} systemMessage - the initial system message (e.g. "You are a helpful assistant")
 * @returns
 */
export function createInitialChatObject(model: string = 'gpt-3.5-turbo', systemMessage: string): ChatObject {
  const { chatModel } = DataStore.settings
  return {
    model: chatModel || model,
    messages: [{ role: 'system', content: systemMessage }],
  }
}

/**
 * Create a new chat request object with the starting system message and the user's initial request text
 * Uses the model specified in the plugin settings (DataStore.settings.chatModel)
 * @param {string} systemMessage  - the initial system message (e.g. "You are a helpful assistant")
 * @param {string} initialUserPrompt - the user's initial request text
 * @param {string} modelName - the model to use (otherwise pulls from DataStore.settings.chatModel)
 */
export function newChatObject(systemMessage: string, initialUserPrompt: string, modelName?: string): ChatObject | null {
  const chatModel = modelName ?? DataStore.settings.chatModel

  if (!chatModel) {
    logError(pluginJson, `newChatObject: chatModel is null. Stopping`)
    return null
  }
  const request: ChatObject = createInitialChatObject(chatModel, systemMessage)
  if (request) {
    request.messages.push({ role: 'user', content: initialUserPrompt })
  }
  return request
}

/**
 * Look in various places for the OpenAI API key. If we don't find it, ask the user for it.
 * @returns {string} api key
 */
export async function getOpenAIKey(): Promise<string | null> {
  // first check if key is in preferences
  let key = DataStore.preference('openAIKey')
  if (!key) {
    logDebug(pluginJson, `No OpenAI key in DataStore.preference`)
    // next check the running plugin's settings
    key = DataStore.settings?.apiKey

    if (!key) {
      logDebug(pluginJson, `No OpenAI key in this plugin's settings`)
      // next check AI plugin
      const settings = await getSettings('shared.AI', null)
      if (settings) {
        key = settings.apiKey
      }
      if (!key) {
        logDebug(pluginJson, `No OpenAI key in shared.AI plugin`)
        // finally, ask user
        key = await getInput('OpenAI API Key', 'OK', 'Enter Key', '')
      }
      if (!key) {
        logError(pluginJson, `Tried 3x to get API Key but was set to null`)
      }
    }
  }
  if (key && key.length) {
    // validate key?
    DataStore.setPreference('openAIKey', key)
  }
  return key ? String(key).trim() : null
}

/**
 * Make a one-shot chat request to the ChatGPT API
 * Use for one-off requests, or to begin a conversation
 * Returns object of the request and the response (so it can be used and saved for caching)
 * @returns {Promise<{request: ChatObject, response: ChatResponse | null}} API result JSON response or null
 */
export async function makeOneShotChatRequest(SYSTEM_MESSAGE: string, userPrompt: string, model?: string): Promise<{ request: ChatObject, response: ChatResponse | null }> {
  const request = newChatObject(SYSTEM_MESSAGE, userPrompt, model)
  // clo(request, `makeOneShotChatObject: request=`)
  const response = await makeRequest(CHAT_COMPONENT, 'POST', request)
  return { request, response }
}

/**
 * Make a request to the GPT API
 * @param {string} component - the last part of the URL (after the base URL), e.g. "models" or "images/generations"
 * @param {string} requestType - GET, POST, PUT, etc.
 * @param {string} data - body of a POST/PUT request - can be an object (it will get stringified)
 * @param {number} retry - number of times through the retry loop (you don't need to set this)
 * @returns {any|null} JSON results or null
 */
export async function makeRequest(component: string, requestType: string = 'GET', requestBody: any = null, retry: number = 0): any | null {
  const timesRetried = retry + 1
  const url = `${BASE_URL}/${component}`
  // logDebug(pluginJson, `makeRequest: about to fetch ${url}`)
  // clo(data, `makeRequest() about to send to: "${url}" data=`)
  await testTOKEN_LIMIT(JSON.stringify(requestBody), true)
  const requestObj = await getFetchRequestObj(requestType, requestBody)
  if (!requestObj) {
    await showMessage('There was an error getting the request object. Check the plugin log and please report this issue.')
    return null
  }
  // clo(requestObj, `makeRequest() about to fetch ${url} requestObj=`)
  const result = await fetch(url, requestObj)
  if (result) {
    // clo(result, `makeRequest() result of fetch to: "${url}" response is type: ${typeof result} and value:`)
    const resultJSON = JSON.parse(result)
    if (!resultJSON || resultJSON?.error) {
      const msg = resultJSON ? getErrorStringToDisplay(resultJSON) : `No response from OpenAI. Check log.`
      await showMessage(msg)
      clo(resultJSON?.error || {}, `askNewQuestion: Error:`)
      return { error: { message: msg } }
    }
    // clo(resultJSON, `makeRequest() result of fetch to: "${url}" response is type: ${typeof resultJSON} and value:`)
    if (resultJSON?.choices && resultJSON.choices[0] && resultJSON.choices[0]['finish_reason'] === 'length') {
      resultJSON.choices[0].message += '... [ChatGPT truncated due to length, consider following up with "please continue"]'
      logWarn(pluginJson, `makeRequest: ChatGPT truncated due to length, consider following up with "please continue"`)
    }
    logUsage(requestBody, resultJSON)
    return resultJSON
  } else {
    // must have timed out/failed, let's try again
    logWarn(pluginJson, `makeRequest failed on try: ${timesRetried}. Will retry.`)
    while (timesRetried < MAX_RETRIES) {
      const result = await makeRequest(component, requestType, requestBody, timesRetried)
      if (result) {
        return result
      }
    }
    const failMsg = `Call to OpenAI failed after ${MAX_RETRIES} attempts. This may be a temporary problem (sometimes their servers are overloaded, or maybe you're offline?). Please try again, but report the problem if it persists.`
    await showMessage(failMsg)
    throw failMsg
  }
}

/****************************************************************************************************************************
 *                             DEBUGGING
 ****************************************************************************************************************************/

/**
 * If the user has enabled saving responses, save the response to the DataStore
 * Only saves if there is a setting in the running plugin's settings { saveResponses: true }
 * @param {string} folderName
 * @param {string} filename - the note filename (which will be based on the question but perhaps shortened by NP)
 * @param {ChatObject} request
 * @param {ChatResponse} chatResponse
 * @example const chatResponse = await makeRequest(CHAT_COMPONENT, 'POST', request)
            saveDebugResponse('summarizeNote', `summarize_${note.filename || ''}`, request, chatResponse)
 */
export function saveDebugResponse(folderName: string, filename: string, request: ChatObject, chatResponse: ChatResponse | null) {
  if (chatResponse) {
    const { saveResponses } = DataStore.settings
    if (saveResponses) {
      const fa = filename.split('/')
      const fname = fa[fa.length - 1].replace(/\.md$|\.txt$/g, '').substring(0, 100) + String(new Date())
      // logDebug(pluginJson, `saveDebugResponse fa=${fa.toString()} fname=${fname}`)
      DataStore.saveJSON(chatResponse, `${folderName}/${fname}.${String(request.messages.length / 2)}.json`)
      // clo(chatResponse, `chatResponse/${filename}.${String(request.messages.length / 2)}.json`)
    }
  }
}
