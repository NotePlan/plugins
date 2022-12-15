// @flow

/**
 * THIS IS AN NP**** FILE. ONLY FUNCTIONS WHICH TOUCH NOTEPLAN APIS GO IN THIS FILE
 * ALL SUPPORTING FUNCTIONS THAT CAN BE TESTED IN ISOLATION SHOULD GO IN A SEPARATE FILE
 * (E.G. support/helpers.js FUNCTIONS and the corresponding test files)
 */

import pluginJson from '../plugin.json'
import {
  calculateCost,
  formatResearch,
  formatSummaryRequest,
  formatResearchListRequest,
  formatQuickSearchRequest,
  modelOptions,
  generateREADMECommands,
  formatBullet,
  formatBulletLink,
  formatBulletSummary,
  formatBulletKeyTerms,
  formatFurtherLink,
} from './support/helpers' // FIXME: Is there something better than this growth?
import { chooseOption, showMessage, showMessageYesNo, getInput } from '@helpers/userInput'
import { log, logDebug, logError, logWarn, clo, JSP, timer } from '@helpers/dev'
import { intro, learningOptions, openAILearningWizard, modelsInformation, externalReading } from './support/introwizard'

/*
 * TYPES
 */

type DallERequestOptions = { prompt?: string, n?: number, size?: string, response_format?: string, user?: string }
type CompletionsRequest = { model: string, prompt?: string, max_tokens?: number, user?: string, suffix?: string, temperature?: string, top_p?: string, n?: number }
type ResearchListResult = { initialQuery: string, currentQuery: string, selection?: string, options?: [string] }

/*
 * CONSTANTS
 */

const baseURL = 'https://api.openai.com/v1'
const modelsComponent = 'models'
const imagesGenerationComponent = 'images/generations'
const completionsComponent = 'completions'
// const { apiKey, defaultModel, showStats, max_tokens, researchDirectory, bulletsAIKeyTerms } = DataStore.settings

const availableModels = ['text-davinci-003', 'text-curie-001', 'text-babbage-001', 'text-ada-001']

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
  const { apiKey } = DataStore.settings
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
  clo(data, `makeRequest: data:`)
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
  const filteredModels = models.filter((m) => modelOptions.hasOwnProperty(m.id))
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
    { label: 'Append this summary to the current note.', value: 'append' },
    { label: 'Generate note with deeper research.', value: 'research' },
  ]
  const mappedOptions = quickSearchOptions.map((option) => ({ label: option.label, value: option.value }))
  clo(mappedOptions, 'Mapped options')

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
    if (model == 'Choose Model') {
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

    const start = new Date()
    const prompt = Editor.content

    let chosenModel = defaultModel
    if (defaultModel === 'Choose Model') {
      logDebug(pluginJson, `noteToPrompt: Choosing Model...`)
      chosenModel = (await chooseModel()) || ''
      logDebug(pluginJson, `noteToPrompt: ${chosenModel} selected`)
    }
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

    const results = await getPromptAndNumberOfResults(promptIn, nIn) // adding a little extra code to keep Flow happy with type checking
    let { prompt } = results
    const { n } = results
    logError(pluginJson, `Look at this output - ${prompt}`)
    prompt = formatResearch(prompt, n)

    let chosenModel = defaultModel
    if (defaultModel === 'Choose Model') {
      logDebug(pluginJson, `summarizeNote: Choosing Model...`)
      chosenModel = (await chooseModel()) || ''
      logDebug(pluginJson, `summarizeNote: ${chosenModel} selected`)
    }
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
        const filename = DataStore.newNoteWithContent(content, researchDirectory) //newNoteWithContent returns the filename created
        // you probably don't need any of this
        // if ( promptIn ) {
        //   const noteName = promptIn
        // } else {
        //   const noteName = `${prompt}`
        // }
        // logDebug(pluginJson, `noteName is set to ${noteName}`)
        // Editor.openNoteByTitleCaseInsensitive(noteName)
        await Editor.openNoteByFilename(filename)
      }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function exploreList(selection: string, subject: string, options: [string]) {
  const currentPage = { selection: selection, options: options }
  logError(pluginJson, `${currentPage}`)
  history.push(currentPage)

  logDebug(pluginJson, `exploreList started with ${selection} and ${options}`)
  logError(pluginJson, `${clo(history, 'exploreList history')}`)
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

      prompt = formatResearchListRequest(prompt)

      let chosenModel = defaultModel
      if (defaultModel === 'Choose Model') {
        logDebug(pluginJson, `createResearchListRequest: Choosing Model...`)
        chosenModel = 'text-davinci-003'
        logDebug(pluginJson, `createResearchListRequest: ${chosenModel} selected`)
      }
      // logDebug(pluginJson, `createResearchListRequest: ${currentQuery} is the current query.`)
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

        // if (selection != jsonData.summary) {
        //   const currentPage = {
        //     'selection': selection,
        //     'inReferenceTo': currentQuery,
        //     'relatedTerms': keyTerms
        //   }
        //   history['pages'].push(currentPage)
        //   clo(history, 'History')
        // }
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
    const start = new Date()
    const text = await CommandBar.showInput('Quick Search', 'Use GPT-3 to get a summary of your query.')
    const prompt = formatQuickSearchRequest(text)

    let chosenModel = defaultModel
    if (defaultModel === 'Choose Model') {
      chosenModel = await 'text-davinci-003'
      logDebug(pluginJson, `createQuickSearch: Defaulting to ${chosenModel}.`)
    }
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
    const start = new Date()
    const text = Editor.content ?? ''
    const prompt = formatSummaryRequest(text)

    let chosenModel = defaultModel
    if (defaultModel === 'Choose Model') {
      logDebug(pluginJson, `summarizeNote: Choosing Model...`)
      chosenModel = await chooseModel()
      logDebug(pluginJson, `summarizeNote: ${String(chosenModel)} selected`)
    }
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
    const start = new Date()
    const text = Editor.selectedText
    const prompt = formatSummaryRequest(text)

    let chosenModel = defaultModel
    if (defaultModel == 'Choose Model') {
      logDebug(pluginJson, `summarizeNote: Choosing Model...`)
      chosenModel = await chooseModel()
      logDebug(pluginJson, `summarizeNote: ${String(chosenModel)} selected`)
    }
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

/**
 * Entry point for introducing the user to the plugin
 * Plugin entrypoint for command: "/aiintro"
 * Currently under construction.
 */
export async function introWizard() {
  if ((await CommandBar.prompt(intro.title, intro.prompt, intro.buttons)) == 0) {
    console.log('Fill this in shortly.')
  }
}

/**
 * Entry point for providing help topics for the user
 * Plugin entrypoint for command: "/helpOpenAI"
 * Currently under construction.
 */
export async function helpWizard() {
  const options = learningOptions.map((option) => ({ label: option, value: option }))

  const topic = await chooseOption('Select a topic to learn more...', options)
  console.log(topic)
  const wizard = openAILearningWizard[topic]
  console.log(wizard)
  console.log(wizard.title)
  await learnMore(wizard)
}

/**
 * Allows the user to learn more about the selected option from the Help Wizard.
 * @params (Object) learningTopic - General object that directs the behavior of the function.
 * Currently under construction.
 */
export async function learnMore(learningTopic: Object) {
  const wizard = learningTopic

  if (wizard == openAILearningWizard.Models) {
    let options = wizard.options.map((option) => ({ label: option, value: option }))
    let externalReadingLinks = []
    externalReading.models.forEach((model) => {
      externalReadingLinks.unshift(model.link)
      options.unshift({ label: model.title, value: model.link })
    })

    const selection = await chooseOption(learningTopic.prompt2, options)

    if (externalReadingLinks.includes(selection)) {
      NotePlan.openURL(selection)
    }

    const selectedModel = modelsInformation[selection]
    const infolog = formatModelInformation(selectedModel)
    const nextSelection = await showMessage(infolog, 'Okay', selectedModel.title)
    console.log(nextSelection)
    clo(nextSelection, 'Information')
    await learnMore(wizard)
  }
}

export async function bulletsAI(inputText: string = '', remixText: string = '', initialSubject: string = '', userIn: string = '') {
  try {
    const start = new Date()
    const paragraphs = Editor.paragraphs
    let currentHeading = ''
    if (inputText == '') {
      for (var index in paragraphs) {
        const text = paragraphs[index].content
        const lineType = paragraphs[index].type

        if (lineType == 'title') {
          // Update the current heading.
          currentHeading = text
          logDebug(pluginJson, `\n\nCurrent heading now:\n${currentHeading}`)
        } else if (lineType == 'list') {
          if (text != '') {
            logDebug(pluginJson, `is:\n ${text}`)
            let prompt = await formatBullet(text)
            const linkPrompt = await formatBulletLink(text)
            const listPrompt = await formatBulletKeyTerms(text)

            logDebug(pluginJson, `bulletsAI got the formatted prompt:\n\n${prompt}`)

            let chosenModel = defaultModel

            if (defaultModel == 'Choose Model') {
              logDebug(pluginJson, `summarizeNote: Choosing Model...`)
              chosenModel = 'text-davinci-003'
              logDebug(pluginJson, `summarizeNote: ${String(chosenModel)} selected`)
            }

            const reqBody: CompletionsRequest = { prompt, model: chosenModel, max_tokens: max_tokens }
            prompt = linkPrompt
            const reqLinkBody: CompletionsRequest = { prompt, model: chosenModel, max_tokens: max_tokens }
            prompt = listPrompt
            const reqListBody: CompletionsRequest = { prompt, model: chosenModel, max_tokens: max_tokens }

            const request = await makeRequest(completionsComponent, 'POST', reqBody)
            const linkRequest = await makeRequest(completionsComponent, 'POST', reqLinkBody)
            const listRequest = await makeRequest(completionsComponent, 'POST', reqListBody)
            const time = timer(start)
            clo(request, `testConnection completionResult result`)
            let summary = ''
            if (request) {
              const response = request.choices[0].text
              const link = linkRequest.choices[0].text
              const keyTermsList = listRequest.choices[0].text
              const total_tokens = request.usage.total_tokens
              const { showStats } = DataStore.settings
              summary = await formatBulletSummary(text, response, link, keyTermsList)

              if (currentHeading == 'Go Further?') {
                paragraphs[index].content = await formatFurtherLink(text)
              } else {
                paragraphs[index].content = text
              }

              paragraphs[index].type = 'title'

              Editor.appendParagraph(`${summary}`)
            }
          } else {
            // If list item is empty
            Editor.removeParagraph(paragraphs[index])
          }
          Editor.updateParagraphs(paragraphs)
        }
      }
    } else {
      let text = inputText
      let prompt = ''
      let linkPrompt = ''
      let listPrompt = ''
      if (initialSubject != '' && initialSubject != null) {
        remixText = `${text} in the context of ${initialSubject}`
      }
      if (remixText != '' && remixText != null) {
        // logError(pluginJson, `\n\In a REMIX\n`)
        logDebug(pluginJson, `bulletsAI got the remixed text:\n\n${remixText}`)
        prompt = await formatBullet(remixText)
        linkPrompt = await formatBulletLink(text)
        listPrompt = await formatBulletKeyTerms(remixText)
      }

      logDebug(pluginJson, `bulletsAI got the formatted prompt:\n\n${prompt}`)

      let chosenModel = defaultModel

      if (defaultModel == 'Choose Model') {
        logDebug(pluginJson, `summarizeNote: Choosing Model...`)
        chosenModel = 'text-davinci-003'
        logDebug(pluginJson, `summarizeNote: ${String(chosenModel)} selected`)
      }

      const reqBody: CompletionsRequest = { prompt, model: chosenModel, max_tokens: max_tokens }
      prompt = linkPrompt
      const reqLinkBody: CompletionsRequest = { prompt, model: chosenModel, max_tokens: max_tokens }
      prompt = listPrompt
      const reqListBody: CompletionsRequest = { prompt, model: chosenModel, max_tokens: max_tokens }

      const request = await makeRequest(completionsComponent, 'POST', reqBody)
      const linkRequest = await makeRequest(completionsComponent, 'POST', reqLinkBody)
      const listRequest = await makeRequest(completionsComponent, 'POST', reqListBody)
      const time = timer(start)
      clo(request, `testConnection completionResult result`)
      let summary = ''
      if (request) {
        const response = request.choices[0].text
        const link = linkRequest.choices[0].text
        const keyTermsList = listRequest.choices[0].text
        const total_tokens = request.usage.total_tokens
        const { showStats } = DataStore.settings
        summary = await formatBulletSummary(text, response, link, keyTermsList, remixText)

        const matchedValue = `[${text}](noteplan://x-callback-url/runPlugin?pluginID=scrollpointclick.AI&command=Bullets%20AI&arg0=${encodeURI(text)}&arg1=)`
        let alteredLinks = []
        for (var index in paragraphs) {
          // logError(pluginJson, `\n\n\n\nREMIX VALUE\n\n${remixText}\n\n\n\n`)

          // logWarn(pluginJson, `\n\nDETAILS-----------\nAt Paragraph ${index}:\n${paragraphs[index].content}\n\nShould Match: \n${matchedValue}`)
          if (paragraphs[index].content.includes(`[${text}](`) || (paragraphs[index].content.includes(`${text}`) && paragraphs[index].type == 'title')) {
            // logError(pluginJson, `\n\n------MATCH------\n\n${index}\n\n`)
            paragraphs[index].content = await formatFurtherLink(text)
            paragraphs[index].type = 'title'
            Editor.updateParagraph(paragraphs[index])
            if (!alteredLinks.includes(matchedValue)) {
              logError(pluginJson, `\n\n------MATCH------\n\n${index}\n\n`)
              Editor.appendParagraph(`${summary}`)
            }
            alteredLinks.push(matchedValue)
          }
        }
        if (remixText) {
          if (!alteredLinks.includes(matchedValue)) {
            Editor.appendParagraph(`${summary}`)
          }
        }
      }
    }
    if (showStats) {
      const stats = formatTextStats(time, chosenModel, total_tokens)
      Editor.insertTextAtCursor(stats)
    }
  } catch (error) {
    logError(pluginJson, `Error Message: ${error}`)
  }
}

/**
 * Remix the summary request with additional details
 * https://beta.openai.com/docs/api-reference/completions/create
 * @param {string} subject - The initial subject value.
 */
export async function remixQuery(subject: string) {
  const additionalDetails = await CommandBar.showInput('Rewrite this query with addional detail.', 'Remix')
  bulletsAI(subject, additionalDetails)
}

/**
 * Formats the incoming model object to display its information in a more readable format.
 * https://beta.openai.com/docs/api-reference/completions/create
 * @param {Object} info - The info needed to provide the function with something to parse and format.
 */
export function formatModelInformation(info: Object) {
  const modelInfo = `Good At: ${info.goodAt}\n\nCost: ${info.cost}.`
  console.log(modelInfo)
  return modelInfo
}

/*
 * DEV FUNCTIONS
 */

export function updateREADME() {
  generateREADMECommands()
}
