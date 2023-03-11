// @flow

import { chooseFolder, chooseNote, chooseOption, showMessage, showMessageYesNo } from '../../helpers/userInput'
import pluginJson from '../plugin.json'
import { createInitialChatRequest } from './chat'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
import type { ChatResponse, ChatRequest } from './support/AIFlowTypes'
import { makeRequest, saveDebugResponse, CHAT_COMPONENT } from './support/networking'
import { findStartOfActivePartOfNote } from '../../helpers/paragraph'

/**
 * Ask the user to choose which note they want to summarize
 * @returns {TNote}
 */
async function chooseNotetoSummarize() {
  return await chooseNote(true, true, ['@Archive', '@Trash'], 'Choose a note to summarize', true)
}

/**
 * Ask user if they want to use a selection or the whole note
 * @param {string} sel
 * @returns
 */
async function askAboutSelection(sel) {
  const options = [
    { value: 'selection', label: 'Selected Text' },
    { value: 'all', label: 'The Whole Note' },
  ]
  return await chooseOption('What text would you like to summarize?', options)
}

/**
 * Ask user where to save the summary
 * @returns
 */
async function askWhereToSave() {
  const options = [
    { value: 'top', label: 'Top of Selected Document' },
    { value: 'newDoc', label: 'Create New Document' },
    { value: 'clipboard', label: 'Copy to Clipboard' },
  ]
  return await chooseOption('Where should I save the summary?', options)
}

/**
 * Make sure the user has at least once seen the warning about summaries
 * @returns {boolean} true if the user has seen and approved the warning
 */
async function userApprovesSummaries() {
  const { userApprovedSummaryWarning } = DataStore.settings
  if (userApprovedSummaryWarning) return true
  const resp = await showMessageYesNo(
    'Generating AI summaries requires the app to send your note contents to OpenAI to be summarized. Do you understand and still want to proceed?',
  )
  if (resp && resp === 'Yes') {
    const settings = DataStore.settings
    DataStore.settings = { ...settings, ...{ userApprovedSummaryWarning: true } }
    await showMessage('Thanks for your approval. You will not see this message again.')
    return true
  }
  return false
}

/**
 * Output the summary to the editor, a new document, or the clipboard
 * @param {ChatResponse} chatResponse - the response from the AI
 * @param {string} saveWhere - 'top', 'newDoc', or 'clipboard'
 * @param {TNote} note - the note that was summarized
 */
export async function writeOutResponse(chatResponse: ChatResponse, saveWhere: 'top' | 'newDoc' | 'clipboard', note: TNote) {
  const summaryText = chatResponse.choices[0].message.content.trim() || ''
  const { summaryHeading } = DataStore.settings
  if (summaryText.length) {
    const textWithHeading = `## ${summaryHeading}\n${summaryText}\n---\n`
    const textWithTitle = `# ${summaryHeading}: ${note.title || ''}\n${summaryText}\n`
    switch (saveWhere) {
      case 'top':
        const startIndex = findStartOfActivePartOfNote(note)
        note.insertParagraph(textWithHeading, startIndex, 'text')
        break
      case 'newDoc':
        const folder = await chooseFolder('Choose a folder to save the summary to:', false, true)
        if (folder) {
          const filename = await DataStore.newNoteWithContent(textWithTitle, folder)
          await await Editor.openNoteByFilename(filename)
        }
        break
      case 'clipboard':
        Clipboard.string = `#${textWithTitle}` //output two ## at front on clipboard version
        break
    }
  } else {
    logError('Summary failed')
  }
}

/**
 * Get the text of the chosen note, but if user chose the note in the editor
 * they may want just a selection, so ask about that first.
 * @param {CoreNoteFields} note
 * @returns {string} text
 */
async function getNoteText(note: CoreNoteFields) {
  let text = ''
  if (note.filename === Editor.note?.filename) {
    if (Editor.selectedText) {
      const choice = await askAboutSelection(Editor.selectedText)
      if (choice === 'selection') {
        text = Editor.selectedText
      }
    }
  }
  if (!text) text = note.content || ''
  return text
}

/**
 * Get the request to send to ChatGPT
 * @param {string} text - the text to summarize
 * @returns {ChatRequest} - the request to send to ChatGPT
 */
export function createSummaryRequest(text: string): ChatRequest {
  const { summaryPrompt } = DataStore.settings
  let request = createInitialChatRequest()
  const prompt = `${summaryPrompt}:\n${text}}`
  request.messages.push({ role: 'user', content: prompt })
  return request
}

/****************************************************************************************************************************
 *                             ENTRYPOINTS
 ****************************************************************************************************************************/

/**
 * Summarize a note (current|selection|choose)
 * Plugin entrypoint for command: "/COMMAND"
 * @author @dwertheimer
 * @param {*} incoming
 */
export async function summarizeNote(incoming: string | null = null) {
  try {
    logDebug(pluginJson, `summarizeNote running with incoming:${String(incoming)}`)
    const note = await chooseNotetoSummarize()
    if (note) {
      if (await userApprovesSummaries()) {
        const text = await getNoteText(note)
        const request = createSummaryRequest(text)
        const chatResponse = await makeRequest(CHAT_COMPONENT, 'POST', request)
        if (chatResponse) {
          saveDebugResponse('summarizeNote', `summarize_${note.title || ''}`, request, chatResponse)
          const saveWhere = await askWhereToSave()
          await writeOutResponse(chatResponse, saveWhere, note)
        }
      }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
