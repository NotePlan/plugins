// @flow

import moment from 'moment'

// const CHAT_MODEL = 'gpt-3.5-turbo'

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
 * Gracefully fail from errors encountered (keeping a prompt for later use)
 * @param {string} errorMessage
 * @param {string} text
 */
export async function chatError(errorMessage: string, text?: string | null): Promise<void> {
  errorMessage ? await showMessage(errorMessage, 'OK', 'Chat Error') : null
  Editor.insertTextAtCursor(`\n*Encountered an error: ${errorMessage ? errorMessage : ''}.\n`)
  text ? Editor.insertTextAtCursor(`Saving your text here for cutting in case you need it:*\n> ${text}\n`) : null
  logError(pluginJson, `chatError: "${errorMessage}"`)
}

/**
 * Create an initial chat request object with the starting system message
 * @param {string} prompt
 * @param {string} model
 * @returns
 */
export function createInitialChatRequest(model: string = 'gpt-3.5-turbo'): ChatRequest {
  const { initialChatSystemPrompt, chatModel } = DataStore.settings
  return {
    model: chatModel || model,
    messages: [{ role: 'system', content: initialChatSystemPrompt }],
  }
}

//TODO: Get back to these functions for related terms

// type RelatedTerms = {
//   cleanAnswer: string /* the answer with the related terms line removed */,
//   keyTerms: Array<string> /* the key terms */,
//   relatedTerms: Array<string> /* the related terms */,
// }

// function getTerms(line): Array<string> {
//   let relatedTermsLine = line.trim()
//   if (relatedTermsLine.endsWith('.')) {
//     relatedTermsLine = relatedTermsLine.substring(0, relatedTermsLine.length - 1)
//   }
//   return relatedTermsLine
//     .split(':')[1]
//     .split(',')
//     .map((term) => term.trim())
// }

// function peelOutRelatedTerms(answer: string): RelatedTerms {
//   const lines = answer.trim().split('\n')
//   // at the bottom of the answer, there is a line with a comma-separated list of key terms that were used to generate the answer
//   // we need to find that comma-separated list and remove it from the answer and process it separately
//   // we do not know what text will used, but we do know that it will be in the form of "some text: term1, term2, term3"
//   // so we will look for the colon and then the comma
//   let relatedTermsLine = lines.find((line) => line.includes(':') && line.includes(','))
//   if (relatedTermsLine) {
//     // remove a period from the end of the line if it exists
//     const terms = getTerms(relatedTermsLine)
//   }
// }

/**
 * Write Q&A out to editor
 * @param {string} question
 * @param {string} answer
 * @param {ChatMode} mode
 * @returns {Promise<string>} - the filename of the saved note
 */
export async function outputResponse(question: string, prompt: string, answer: string, mode: ChatMode): Promise<string> {
  const { outputAttribution, continueChatText } = DataStore.settings
  const credit = outputAttribution ? `\n\t*- ChatGPT ${moment().toLocaleString()}*` : ''
  let filename,
    url = '',
    linkPara
  if (mode !== 'new_document') {
    filename = Editor.filename
    url = createPrettyRunPluginLink(continueChatText, pluginJson['plugin.id'], 'continueChat', [question, filename])
    linkPara = findParagraph(Editor.paragraphs, { content: url }, ['content'])
  }
  const msg = `## ${prompt}\n${answer}${credit}\n`
  if (linkPara) {
    // this is a continuation
    const lineIndex = Editor.paragraphs[linkPara.lineIndex - 1].type === 'empty' ? linkPara.lineIndex - 1 : linkPara.lineIndex
    Editor.insertParagraph(msg, lineIndex, 'text')
  } else {
    // this is the first output
    if (mode === 'new_document') {
      // creating a new document
      const folder = await chooseFolder('Choose a folder to save the chat to:', false, true)
      if (folder) {
        filename = await DataStore.newNoteWithContent(msg, folder)
        await Editor.openNoteByFilename(filename)
        url = createPrettyRunPluginLink(continueChatText, pluginJson['plugin.id'], 'continueChat', [question, filename])
        Editor.appendParagraph(`\n\t${url}\n`, 'text')
      }
    } else {
      // inserting into the current document
      const contentWithURL = `${msg}\t${url}\n`
      Editor.insertTextAtCursor(contentWithURL)
    }
  }
  return filename ?? ''
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
 * @param {string} filename - the filename of the original question, if this is a follow-up
 * @param {ChatMode} mode - the mode to run in (default is 'insert')
 * @returns {Promise<ChatReturn | null>} - the question, prompt, and answer, or null if no answer
 */
export async function askNewQuestion(originalQuestion?: string | null, fname?: string | null, mode?: ChatMode = 'insert'): Promise<ChatReturn | null> {
  logDebug(pluginJson, `askNewQuestion running with vars: originalQuestion: ${String(originalQuestion)}, fname: ${String(fname)}, mode: ${mode}`)
  const isXCB = originalQuestion && fname === null && mode === 'new_document'
  const fu = fname ? 'follow-up ' : ' '
  const prompt = !isXCB ? await CommandBar.showInput(`What is your ${fu}question?`, `Ask the AI`) : originalQuestion
  if (prompt && prompt.length) {
    let request: ChatRequest
    if (originalQuestion && fname) {
      const filename: string = getDataFilename(fname, originalQuestion)
      request = DataStore.loadJSON(filename) // load the chat history into the request
    } else {
      request = createInitialChatRequest() // start a new request
    }
    if (!request) {
      await chatError(
        `Could not ${originalQuestion ? 'load' : 'create'} chat history. This is probably a bug. Please try again with debug logging turned on and report the error.`,
        prompt,
      )
      return null
    }
    const requestMessagesWithoutKeyTermsRequest = [...request.messages, { role: 'user', content: prompt }]
    const promptPlus = getPromptWithKeyTerms(prompt)
    request.messages.push({ role: 'user', content: promptPlus })
    const chatResponse: ChatResponse | null = await makeRequest(CHAT_COMPONENT, 'POST', request)
    clo(chatResponse || {}, `chat response typeof=${typeof chatResponse}`)
    if (!chatResponse || chatResponse?.error) {
      // await showMessage(`Error: ${chatResponse?.error?.message || ''}`)
      await chatError(`Error: ${chatResponse?.error?.message || ''}`, prompt)
    }
    if (chatResponse && chatResponse.choices?.length) {
      const question = originalQuestion ?? prompt
      const answer = chatResponse.choices[0].message
      const history = { ...request, messages: [...requestMessagesWithoutKeyTermsRequest, { role: answer.role, content: answer.content }] }
      // save chat history for continuing later
      const savedFilename = await outputResponse(question, prompt, answer.content.trim(), mode)
      if (!savedFilename) throw new Error(`No filename returned from outputResponse:\nquestion:"${question}"\nprompt:"${prompt}"\nanswer:"${answer.content.trim()}"`)
      logDebug(pluginJson, `askNewQuestion: savedFilename:${savedFilename}`)
      DataStore.saveJSON(history, getDataFilename(savedFilename, originalQuestion || prompt))
      // save responses for fetch mocking
      saveDebugResponse('chatResponse', addPartialPromptToFilename(savedFilename, question), request, chatResponse)
      if (mode === 'return') {
        return { question, prompt, answer: answer.content.trim() }
      }
    }
  } else {
    await showMessage('No prompt provided. Please try again and provide a prompt to ask the AI.')
    logError(pluginJson, `askNewQuestion: No prompt provided`)
  }
  return null
}

/**
 * Because you may have multiple chats going in one document, we need to add the prompt to the filename
 * @param {string} filename
 * @param {string} prompt
 * @returns {string}
 */
const addPartialPromptToFilename = (filename: string, prompt: string): string => `${filename.replace(/\.md$|\.txt$/g, '')}_${prompt.substring(0, 15).replace(/\/|\n|\t/g, '')}`

/**
 * Create a data JSON to store chat history based on the initial prompt text
 * So we can save multiple separate chats in one document
 * @param {string} filename - the filename of the query results document
 * @param {string} prompt - the prompt text
 * @returns {string} filename
 */
const getDataFilename = (filename: string, prompt: string): string => `chatData/${addPartialPromptToFilename(filename, prompt)}.json`

/****************************************************************************************************************************
 *                             ENTRYPOINTS
 ****************************************************************************************************************************/

/**
 * getChat
 * Plugin entrypoint for "/Get Chat Response" (NotePlan AI: Get Chat Response via template)
 * Also used for template response (send the question as the first argument)
 * @param {string} question - the question to ask
 * @param {string} showQuestion - whether to show the question in the output (default is false)
 * @author @dwertheimer
 */
export async function getChat(question: string, showQ?: string | boolean = 'false'): Promise<string | void> {
  try {
    const showQuestion = showQ === true || showQ === 'true' ? true : false
    logDebug(pluginJson, `getChat: question: ${question || ''} showQuestion:${String(showQuestion)} (${typeof showQuestion})`)
    const request: ChatRequest = createInitialChatRequest()
    request.messages.push({ role: 'user', content: question })
    const chatResponse: ChatResponse | null = await makeRequest(CHAT_COMPONENT, 'POST', request)
    const answer = chatResponse?.choices[0]?.message?.content
    logDebug(pluginJson, `getChat: answer: ${answer || ''}`)
    if (showQuestion && answer) {
      return `### ${question}\n${answer}`
    } else if (answer) {
      return answer.trim()
    } else {
      await chatError(`Error: ${chatResponse?.error?.message || ''}`, question)
    }
    logError(pluginJson, `getChat: No answer returned for question: ${question}`)
  } catch (error) {
    // await chatError(`Could not insert chat: "${error.message}". This is probably a bug. Please try again with debug logging turned on and report the error.`, question)
    logError(pluginJson, JSP(error))
  }
}

/**
 * insertChat
 * Plugin entrypoint for "/insertChat"
 * Also used for template response (send the question as the first argument)
 * @param {string} question - the question to ask
 * @author @dwertheimer
 */
export async function insertChat(question?: string): Promise<string | void> {
  try {
    logDebug(pluginJson, `insertChat running with incoming question:${String(question)}`)
    const ret: ChatReturn | null = (await askNewQuestion(question, null)) || null
    if (question && ret) {
      return `### ${question}\n${ret.answer}`
    }
  } catch (error) {
    await chatError(`Could not insert chat: "${error.message}". This is probably a bug. Please try again with debug logging turned on and report the error.`, question)
    logError(pluginJson, JSP(error))
  }
}

/**
 * Continue a Chat -- this is most likely coming from a callback link
 * Plugin entrypoint for command: "/continueChat"
 * @author @dwertheimer
 * @param {string} question
 * @param {string} filename
 */
export async function continueChat(question?: string | null = null, filename?: string | null = null) {
  try {
    logDebug(pluginJson, `continueChat running with question:${String(question)}`)
    if (question) {
      await askNewQuestion(question, filename)
    }
  } catch (error) {
    await chatError(`Could not insert chat: "${error.message}". This is probably a bug. Please try again with debug logging turned on and report the error.`, question)
    logError(pluginJson, JSP(error))
  }
}

/**
 * Create chat in new document
 * Plugin entrypoint for command: "/createChat"
 * @author @dwertheimer
 * @param {string} question
 */
export async function createChat(question?: string | null = null) {
  try {
    logDebug(pluginJson, `createChat running with incoming question:${String(question)}`)
    await askNewQuestion(question, null, 'new_document')
  } catch (error) {
    await chatError(`Could not insert chat: "${error.message}". This is probably a bug. Please try again with debug logging turned on and report the error.`, question)
    logError(pluginJson, JSP(error))
  }
}
