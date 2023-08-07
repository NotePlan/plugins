// @flow

/**
 * DBW NOTE: MOVED MOST/ALL OF THESE FUNCTIONS TO @HELPERS/OPENAI
 */

import pluginJson from '../../plugin.json'
// import type { ChatResponse, ChatRequest } from './AIFlowTypes'
import { showMessage } from '@helpers/userInput'
import { logDebug, logWarn, logError, clo, JSP } from '@helpers/dev'
export { saveDebugResponse } from '@helpers/openAI'

/*
 * CONSTANTS
 */

const BASE_URL = 'https://api.openai.com/v1'
const TOKEN_LIMIT = 3000 // tokens per request (actually 3072)
const MAX_RETRIES = 5 // number of times to retry a request if it fails

// const modelsComponent = 'models'
// const completionsComponent = 'completions'
// const availableModels = ['text-davinci-003', 'text-curie-001', 'text-babbage-001', 'text-ada-001', 'gpt-3.5-turbo']

export const CHAT_COMPONENT = 'chat/completions'

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
 * Make a request to the GPT API
 * @param {string} component - the last part of the URL (after the base URL), e.g. "models" or "images/generations"
 * @param {string} requestType - GET, POST, PUT, etc.
 * @param {string} data - body of a POST/PUT request - can be an object (it will get stringified)
 * @param {number} retry - number of times through the retry loop (you don't need to set this)
 * @returns {any|null} JSON results or null
 */
export async function makeRequest(component: string, requestType: string = 'GET', data: any = null, retry: number = 0): any | null {
  const timesRetried = retry + 1
  const url = `${BASE_URL}/${component}`
  logDebug(pluginJson, `makeRequest: about to fetch ${url}`)
  // clo(data, `makeRequest() about to send to: "${url}" data=`)
  await testTOKEN_LIMIT(JSON.stringify(data), true)
  const requestObj = getRequestObj(requestType, data)
  if (!requestObj) {
    showMessage('There was an error getting the request object. Check the plugin log and please report this issue.')
    return null
  }
  const result = await fetch(url, requestObj)
  if (result) {
    clo(result, `makeRequest() result of fetch to: "${url}" response is type: ${typeof result} and value:`)
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
    return resultJSON
  } else {
    // must have timed out/failed, let's try again
    logWarn(pluginJson, `makeRequest failed on try: ${timesRetried}. Will retry.`)
    while (timesRetried < MAX_RETRIES) {
      const result = await makeRequest(component, requestType, data, timesRetried)
      if (result) {
        return result
      }
    }
    const failMsg = `Call to OpenAI failed after ${MAX_RETRIES} attempts. This may be a temporary problem (sometimes their servers are overloaded, or maybe you're offline?). Please try again, but report the problem if it persists.`
    await showMessage(failMsg)
    throw failMsg
  }
}

/**
 * Make a request to the GPT API
 * @param {string} method - GET, POST, PUT, etc.
 * @param {any} body - JSON or null
 * @returns {any|null} JSON results or null
 */
export const getRequestObj = (method: string = 'GET', body: any = null): any => {
  const { apiKey } = DataStore.settings
  if (apiKey?.length) {
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
    clo(obj, 'getRequestObj request object is:')
    return obj
  } else {
    showMessage('Please set your API key in the plugin settings')
    logError(pluginJson, 'No API Key found')
    return null
  }
}

/****************************************************************************************************************************
 *                             DEBUGGING
 ****************************************************************************************************************************/

/**
 * If the user has enabled saving responses, save the response to the DataStore
 * @param {string} folderName
 * @param {string} filename - the note filename (which will be based on the question but perhaps shortened by NP)
 * @param {ChatRequest} request
 * @param {ChatResponse} chatResponse
 */
// export function saveDebugResponse(folderName: string, filename: string, request: ChatRequest, chatResponse: ChatResponse | null) {
//   if (chatResponse) {
//     const { saveResponses } = DataStore.settings
//     if (saveResponses) {
//       const fa = filename.split('/')
//       const fname = fa[fa.length - 1].replace(/\.md$|\.txt$/g, '').substring(0, 100) + String(new Date())
//       logDebug(pluginJson, `saveDebugResponse fa=${fa.toString()} fname=${fname}`)
//       DataStore.saveJSON(chatResponse, `${folderName}/${fname}.${String(request.messages.length / 2)}.json`)
//       clo(chatResponse, `chatResponse/${filename}.${String(request.messages.length / 2)}.json`)
//     }
//   }
// }
