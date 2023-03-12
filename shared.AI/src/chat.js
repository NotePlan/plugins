// @flow

const CHAT_MODEL = 'gpt-3.5-turbo'

import moment from 'moment'
import { findParagraph } from '../../helpers/NPParagraph'
import { createPrettyRunPluginLink } from '../../helpers/general'

import { chooseFolder , getInput } from '../../helpers/userInput'


const SAVE_RESPONSES = true

import pluginJson from '../plugin.json'
import { makeRequest, saveDebugResponse, CHAT_COMPONENT } from './support/networking'
import { type ChatRequest, type ChatResponse, type ChatMode, type ChatReturn } from './support/AIFlowTypes'
import { saveDataFile } from './support/externalFileInteractions'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'

/****************************************************************************************************************************
 *
 ****************************************************************************************************************************/

/**
 * Create an initial chat request
 * @param {string} prompt
 * @param {string} model
 * @returns
 */
export function createInitialChatRequest(model: string = CHAT_MODEL): ChatRequest {
  const { initialChatSystemPrompt } = DataStore.settings
  return {
    model,
    messages: [{ role: 'system', content: initialChatSystemPrompt }],
  }
}

/**
 * Write Q&A out to editor
 * @param {string} question
 * @param {string} answer
 */
export async function outputResponse(question: string, prompt: string, answer: string, mode: ChatMode): Promise<void> {
  const outputAttribution = DataStore.settings
  const url = createPrettyRunPluginLink('Ask Follow-up Question', pluginJson['plugin.id'], 'continueChat', [question])
  const linkPara = findParagraph(Editor.paragraphs, { content: url }, ['content'])
  const credit = outputAttribution ? `\n\t*- ChatGPT ${moment().toLocaleString()}*` : ''
  const msg = `## ${prompt}\n${answer}${credit}\n`
  if (linkPara) {
    // this is a continuation
    const lineIndex = Editor.paragraphs[linkPara.lineIndex - 1].type === 'empty' ? linkPara.lineIndex - 1 : linkPara.lineIndex
    Editor.insertParagraph(msg, lineIndex, 'text')
  } else {
    // this is the first output
    const content = `${msg}\t${url}\n`
    if (mode === 'new_document') {
      const folder = await chooseFolder('Choose a folder to save the chat to:', false, true)
      if (folder) {
        const filename = await DataStore.newNoteWithContent(content, folder)
        await Editor.openNoteByFilename(filename)
      }
    } else {
      Editor.insertTextAtCursor(content)
    }
  }
}

/**
 * Ask a question - either a starting question or a follow-up question
 * @param {string} originalQuestion - the original question, if this is a follow-up
 */
export async function askNewQuestion(originalQuestion?: string, mode?: ChatMode = 'insert'): Promise<ChatReturn | null> {
  const fu = originalQuestion ? 'follow-up ' : ' '
  const prompt = await CommandBar.showInput(`What is your ${fu}question?`, `Ask the AI`)
  if (prompt && prompt.length) {
    let request: ChatRequest
    if (originalQuestion) {
      const filename: string = getDataFilename(originalQuestion)
      request = DataStore.loadJSON(filename) // load the chat history into the request
    } else {
      request = createInitialChatRequest() // start a new request
    }
    request.messages.push({ role: 'user', content: prompt })
    const chatResponse: ChatResponse = await makeRequest(CHAT_COMPONENT, 'POST', request)
    clo(chatResponse, `chat response typeof=${typeof chatResponse}`)
    // save responses for fetch mocking
    const question = originalQuestion ?? prompt
    saveDebugResponse('chatResponse', question, request, chatResponse)
    if (chatResponse && chatResponse.choices.length) {
      const answer = chatResponse.choices[0].message
      const history = { ...request, messages: [...request.messages, { role: answer.role, content: answer.content }] }
      // save chat history for continuing later
      DataStore.saveJSON(history, getDataFilename(question))
      if (mode === 'return') {
        return { question, prompt, answer: answer.content.trim() }
      }
      await outputResponse(question, prompt, answer.content.trim(), mode)
    }
  }
  return null
}

/**
 * Create a data JSON to store chat history based on the initial prompt text
 * @param {string} prompt
 * @returns {string} filename
 */
const getDataFilename = (prompt: string): string => `chatData/${prompt}.json`

/****************************************************************************************************************************
 *                             ENTRYPOINTS
 ****************************************************************************************************************************/

/**
 * startChat
 * Plugin entrypoint for "/insertChat"
 * Also used for template response (send the question as the first argument)
 * @author @dwertheimer
 */
export async function insertChat(question?: string) {
  try {
    const ret: ChatReturn | null = (await askNewQuestion(question, question ? 'return' : 'insert')) || null
    if (question && ret) {
      return `### ${question}\n${ret.answer}`
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Continue a Chat -- this is most likely coming from a callback link
 * Plugin entrypoint for command: "/continueChat"
 * @author @dwertheimer
 * @param {*} incoming
 */
export async function continueChat(question: string | null = null) {
  try {
    logDebug(pluginJson, `continueChat running with question:${String(question)}`)
    if (question) {
      await askNewQuestion(question)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Create chat in new document
 * Plugin entrypoint for command: "/createChat"
 * @author @dwertheimer
 * @param {*} incoming
 */
export async function createChat(incoming: string | null = null) {
  try {
    await askNewQuestion(undefined, 'new_document')
    logDebug(pluginJson, `createChat running with incoming:${String(incoming)}`)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
