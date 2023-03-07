// @flow

const SAVE_RESPONSES = true

import pluginJson from '../plugin.json'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
import { makeRequest } from './support/networking'
import { type ChatRequest, type ChatResponse } from './support/AIFlowTypes'
import { getInput } from '@helpers/userInput'
import { saveDataFile } from './support/externalFileInteractions'

/**
 * Create an initial chat request
 * @param {string} prompt
 * @param {string} model
 * @returns
 */
function createChatRequest(prompt: string, model: string): ChatRequest {
  return {
    model,
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: prompt },
    ],
  }
}
/**
 * startChat
 * Plugin entrypoint for "/startChat"
 * @author @dwertheimer
 */
export async function startChat(incoming: string) {
  try {
    const chatComponent = 'chat/completions'
    const model = 'gpt-3.5-turbo'
    // const prompt = await getInput("What's your question?", 'Submit', 'Start a chat with the AI')
    const prompt = await CommandBar.showInput('What is your question?', 'Ask the AI')
    if (prompt && prompt.length) {
      // TODO: look to see if this is a continuation of a previous chat
      const request = createChatRequest(prompt, model)

      const chatResponse: ChatResponse = await makeRequest(chatComponent, 'POST', request)
      clo(chatResponse, `chat response typeof=${typeof chatResponse}`)
      SAVE_RESPONSES ? DataStore.saveJSON(chatResponse, `chatResponse/${prompt}.json`) : null
      if (chatResponse && chatResponse.choices.length) {
        const answer = chatResponse.choices[0].message
        outputResponse(prompt, answer.content)
        const history = { ...request, messages: [...request.messages, { role: answer.role, content: answer.content }] }
        DataStore.saveJSON(history, `chatData/${prompt}.json`)
      }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export function outputResponse(question: string, answer: string): void {
  const msg = `## ${question}\n> ${answer}`
  Editor.insertTextAtCursor(msg)
}
