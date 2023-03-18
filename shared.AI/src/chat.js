// @flow

import moment from 'moment'

const CHAT_MODEL = 'gpt-3.5-turbo'

import { findParagraph } from '../../helpers/NPParagraph'
import { createPrettyRunPluginLink } from '../../helpers/general'

import { chooseFolder, showMessage } from '../../helpers/userInput'

import pluginJson from '../plugin.json'
import { makeRequest, saveDebugResponse, CHAT_COMPONENT } from './support/networking'
import { type ChatRequest, type ChatResponse, type ChatMode, type ChatReturn } from './support/AIFlowTypes'
// import { saveDataFile } from './support/externalFileInteractions'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'

/****************************************************************************************************************************
 *
 ****************************************************************************************************************************/

/**
 * Create an initial chat request object with the starting system message
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

function getTerms(line): Array<string> {
  let relatedTermsLine = line.trim()
  if (relatedTermsLine.endsWith('.')) {
    relatedTermsLine = relatedTermsLine.substring(0, relatedTermsLine.length - 1)
  }
  return relatedTermsLine
    .split(':')[1]
    .split(',')
    .map((term) => term.trim())
}

type RelatedTerms = {
  cleanAnswer: string /* the answer with the related terms line removed */,
  keyTerms: Array<string> /* the key terms */,
  relatedTerms: Array<string> /* the related terms */,
}

function peelOutRelatedTerms(answer: string): RelatedTerms {
  const lines = answer.trim().split('\n')
  // at the bottom of the answer, there is a line with a comma-separated list of key terms that were used to generate the answer
  // we need to find that comma-separated list and remove it from the answer and process it separately
  // we do not know what text will used, but we do know that it will be in the form of "some text: term1, term2, term3"
  // so we will look for the colon and then the comma
  let relatedTermsLine = lines.find((line, i) => line.includes(':') && line.includes(','))
  if (relatedTermsLine) {
    // remove a period from the end of the line if it exists
    const terms = getTerms(relatedTermsLine)
  }
}

/**
 * Write Q&A out to editor
 * @param {string} question
 * @param {string} answer
 * @param {ChatMode} mode
 * @returns {Promise<string>} - the filename of the saved note
 */
export async function outputResponse(question: string, prompt: string, answer: string, mode: ChatMode): Promise<string> {
  let filename = Editor.filename
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
        filename = await DataStore.newNoteWithContent(content, folder)
        await Editor.openNoteByFilename(filename)
      }
    } else {
      Editor.insertTextAtCursor(content)
    }
  }
  return filename
}

/**
 * Add extra instructions to the prompt to get related terms
 * @param {string} prompt
 * @returns {string} prompt with instructions for related terms
 */
function getPromptWithKeyTerms(prompt: string): string {
  const { numKeyTermsForFollowUp, numRelatedTerms } = DataStore.settings
  const promptWithKeyTerms =
    numKeyTermsForFollowUp > 0
      ? `${prompt}\n(The following instruction is in English but your response should be in the language specified in the system message): As the bottom of your response, please add a separate single line (no return characters) that contains a comma-delimited list of the ${numKeyTermsForFollowUp} most relevant and important terms that were used in your response to this prompt, in order of importance in the following format: "key terms: topic1, topic2, topic3". The phrase "key terms:" must be included in the line and should always be in English, regardless of the chat language.`
      : prompt
  const promptWithRelatedTerms =
    numRelatedTerms > 0
      ? `${promptWithKeyTerms}\nAlso add another single line at the bottom (no return characters) containing ${numRelatedTerms} closely related topics (as a comma-separated list) that were not explicitly mentioned in the response or key terms in the following format: "related topics: topic1, topic2, topic3". There should be no extra newlines between the key terms list and the related topics list. This whole line, including the translation of the words 'related topics' should be in the same language as the chat language.`
      : promptWithKeyTerms
  return promptWithRelatedTerms
}

/**
 * Ask a question - either a starting question or a follow-up question
 * @param {string} originalQuestion - the original question, if this is a follow-up
 * @param {ChatMode} mode - the mode to run in (default is 'insert')
 * @returns {Promise<ChatReturn | null>} - the question, prompt, and answer, or null if no answer
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
    const requestMessagesWithoutKeyTermsRequest = [...request.messages, { role: 'user', content: prompt }]
    const promptPlus = getPromptWithKeyTerms(prompt)
    request.messages.push({ role: 'user', content: promptPlus })
    const chatResponse: ChatResponse | null = await makeRequest(CHAT_COMPONENT, 'POST', request)
    clo(chatResponse || {}, `chat response typeof=${typeof chatResponse}`)
    if (!chatResponse || chatResponse?.error) {
      // await showMessage(`Error: ${chatResponse?.error?.message || ''}`)
      // clo(chatResponse?.error || {}, `askNewQuestion: Error. Prompt was: ${prompt}`)
    }
    if (chatResponse && chatResponse.choices?.length) {
      // save responses for fetch mocking
      const question = originalQuestion ?? prompt
      saveDebugResponse('chatResponse', question, request, chatResponse)
      const answer = chatResponse.choices[0].message
      const history = { ...request, messages: [...requestMessagesWithoutKeyTermsRequest, { role: answer.role, content: answer.content }] }
      // save chat history for continuing later
      DataStore.saveJSON(history, getDataFilename(question))
      if (mode === 'return') {
        return { question, prompt, answer: answer.content.trim() }
      }
      const savedFilename = await outputResponse(question, prompt, answer.content.trim(), mode)
    }
  } else {
    await showMessage('No prompt provided. Please try again and provide a prompt to ask the AI.')
    logError(pluginJson, `askNewQuestion: No prompt provided`)
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
export async function insertChat(question?: string): Promise<string | void> {
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
