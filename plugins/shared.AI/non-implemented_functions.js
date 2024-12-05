import pluginJson from './plugin.json'
import { makeRequest } from './src/support/networking'
import { chooseOption, showMessageYesNo } from '@helpers/userInput'
import { logDebug, logError, logWarn, clo, JSP, timer } from '@helpers/dev'
import {
    generateResearchPrompt,
    generateResearchListRequest,
    generateQuickSearchPrompt,
    generateSummaryRequest,
    generateWikiLinkPrompt,
  } from './src/support/prompts'

/**
 * Use the note as a prompt for GPT-3.
 * Plugin entrypoint for command: "/Note to OpenAI Prompt"
 * Options:
 * @param {string} prompt - A text description of the prompt for the AI to interpret.
 * @param {string} user - A unique identifier representing your end-user, which can help OpenAI to monitor and detect abuse.
 */
export async function noteToPrompt(promptIn: string | null = '', userIn: string | null = null) {
    try {
      logDebug(pluginJson, `noteToPrompt running with prompt:${String(promptIn)} ${String(userIn)}`)
      const { defaultModel, max_tokens } = DataStore.settings
  
      const start = new Date()
      const prompt = Editor.content
      let chosenModel = checkModel()
      const reqBody: CompletionsRequest = { prompt, model: chosenModel, max_tokens: max_tokens }
      if (userIn) reqBody.user = userIn
      const request = await makeRequest(completionsComponent, 'POST', reqBody)
      const elapsed = timer(start)
      clo(request, `testConnection noteToPrompt result`)
      if (request) {
        const response = request.choices[0].text
        // Editor.appendParagraph("```", "text")
        Editor.appendParagraph(response.trim(), 'text')
        // Editor.appendParagraph("```", "text")
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
export async function createResearchRequest(promptIn: string | null = null, nIn: number = 3, userIn: string = '') {
    try {
      logDebug(pluginJson, `createResearchRequest running with prompt:${String(promptIn)} ${String(nIn)} ${userIn}`)
      const { defaultModel, max_tokens, researchDirectory } = DataStore.settings
  
      const start = new Date()
  
      const results = await getPromptAndNumberOfResults(promptIn, nIn) // adding a little extra code to keep Flow happy with type checking
      let { prompt } = results
      const { n } = results
      prompt = generateResearchPrompt(prompt, n)
  
      let chosenModel = checkModel()
      if (prompt.length && chosenModel.length) {
        const reqBody: CompletionsRequest = { prompt, model: chosenModel, max_tokens: max_tokens }
        const request = await makeRequest(completionsComponent, 'POST', reqBody)
        const time = timer(start)
        clo(request, `testConnection completionResult result`)
        if (request) {
          const response = request.choices[0].text
          let content = `${response}\n\n`
          const tokens = request.usage.total_tokens
          const { showStats } = DataStore.settings
          if (showStats) {
            const stats = `### **Stats**\n**Time to complete:** ${time}\n**Model:** ${chosenModel}\n**Total Tokens:** ${tokens}`
            content += stats
          }
          const filename = DataStore.newNoteWithContent(content, researchDirectory) 
          await Editor.openNoteByFilename(filename)
        }
      }
    } catch (error) {
      logError(pluginJson, JSP(error))
    }
  }
  
  export async function exploreList(selection: string, subject: string, options: [string]) {
    const currentPage = { selection: selection, options: options }
    history.push(currentPage)
  
    logDebug(pluginJson, `exploreList started with ${selection} and ${options}`)
    const prompt = `${selection} as it pertains to ${subject}`
    await createResearchListRequest(selection)
  }
  
/**
 * Entry point for generating research list requests
 * Plugin entrypoint for command: "/lista
 * @param {*} incoming
 */
export async function createResearchListRequest(promptIn: string | null, nIn: number = 10, userIn: string = '', isLast: boolean = false) {
try {
    const { defaultModel, max_tokens } = DataStore.settings
    const initialQuery = await getPromptAndNumberOfResults(promptIn, nIn)
    let history = { pages: [] }
    while (!isLast) {
    let currentPage: ResearchListResult = { initialQuery }

    let { prompt } = initialQuery
    let currentQuery = prompt
    if (promptIn) {
        let currentQuery = promptIn
        prompt = `${currentQuery} as it pertains to ${initialQuery}`
    } else {
    }

    prompt = generateResearchListRequest(prompt)

    let chosenModel = checkModel()
    const reqBody: CompletionsRequest = { prompt, model: chosenModel, max_tokens: max_tokens, n: initialQuery.n }
    // clo(`response: `, reqBody)
    const request = await makeRequest(completionsComponent, 'POST', reqBody)
    // const time = timer(start)
    clo(request, `testConnection completionResult result`)
    if (request) {
        const response = request.choices[0].text
        const jsonData = JSON.parse(response)
        clo(jsonData, `jsonParse() completionResult result`)

        const summary = { label: `Append ${jsonData.subject} Summary`, value: jsonData.summary }
        clo(summary, `jsonParse() summary result`)

        const wikiLink = { label: 'Learn more...', value: jsonData.wikiLink }
        const keyTerms = jsonData.keyTerms.map((term) => ({ label: term, value: term }))
        keyTerms.unshift(summary, wikiLink)
        clo(keyTerms, `jsonParse() keyTerms result`)

        const selection = await chooseOption(jsonData.subject, keyTerms)
        clo(selection, `jsonParse() selection result`)
    }
    }
} catch (error) {
    logError(pluginJson, `The error is ${error}`)
}
}
  
/**
 * Entry point for generating a quick search.
 * Plugin entrypoint for command: "/fs
 * @param {string} promptIn - An incoming prompt to use as the quick search query.
 */
export async function createQuickSearch(promptIn: string | null = null, userIn: string = '') {
    try {
      logDebug(pluginJson, `createQuickSearch running with prompt:${String(promptIn)} ${userIn}`)
      const { defaultModel, showStats, max_tokens } = DataStore.settings
  
      const start = new Date()
      const text = await CommandBar.showInput('Quick Search', 'Use GPT-3 to get a summary of your query.')
      const prompt = generateQuickSearchPrompt(text)
  
      let chosenModel = checkModel()
      const reqBody: CompletionsRequest = { prompt, model: chosenModel, max_tokens: max_tokens }
      const request = await makeRequest(completionsComponent, 'POST', reqBody)
      const elapsedTimeStr = timer(start)
      clo(request, `testConnection completionResult result`)
      if (request) {
        const response = request.choices[0].text
        const total_tokens = request.usage.total_tokens
  
        if (await showMessageYesNo(response, ['More Options', 'Done'], 'Summary', false)) {
          const selection = await chooseQuickSearchOption(response) //FIXME: This needs another argument
          logDebug(pluginJson, `createQuickSearch: selected to ${String(selection)}.`)
  
          if (selection === 'append') {
            Editor.insertTextAtCursor(`---\n## ${text}\n`)
            Editor.insertTextAtCursor(`${response}\n\n`)
            if (showStats) {
              insertStatsAtCursor(elapsedTimeStr, chosenModel, total_tokens)
            }
          } else {
            await createResearchRequest(text) //FIXME: this needs another argument
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
 * @param {string} promptIn - An incoming prompt to use as the quick search query.
 */
export async function summarizeNote(promptIn: string | null = null, userIn: string = '') {
    try {
      logDebug(pluginJson, `summarizeNote running with prompt:${String(promptIn)} ${userIn}`)
      const { defaultModel, showStats, max_tokens } = DataStore.settings
  
      const start = new Date()
      const text = Editor.content ?? ''
      const prompt = generateSummaryRequest(text)
  
      let chosenModel = checkModel()
      if (chosenModel) {
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
      }
    } catch (error) {
      logError(pluginJson, JSP(error))
    }
  }

  /**
 * Entry point for generating summary requests from selection
 * Plugin entrypoint for command: "/summarizeselection
 * @param {string} promptIn - An incoming prompt to use as the quick search query.
 */
export async function summarizeSelection(promptIn: string | null = null, userIn: string = '') {
    try {
      const { defaultModel, max_tokens } = DataStore.settings
  
      const start = new Date()
      const text = Editor.selectedText
      const prompt = generateSummaryRequest(text)
  
      let chosenModel = checkModel()
      if (chooseModel?.length) {
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
      }
    } catch (error) {
      logError(pluginJson, JSP(error))
    }
  }

export async function setPrompts(text: string, linkText: string = '') {
let prompt = await formatBullet(text)
const linkPrompt = await generateWikiLinkPrompt(linkText ? linkText : text)
const listPrompt = await formatBulletKeyTerms(text)
return prompt, linkPrompt, listPrompt
}
  

  /*
 * DEV FUNCTIONS
 */

export function updateREADME() {
    generateREADMECommands()
  }
