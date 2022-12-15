// @flow

const pluginJson = `scrollpointclick.AI/helpers`
import { log, logDebug, logError, logWarn, clo, JSP, timer } from '@helpers/dev'
import { createPrettyRunPluginLink, createPrettyOpenNoteLink } from '@helpers/general'

export const modelOptions = {
  'text-davinci-003': 0.02,
  'text-curie-001': 0.002,
  'text-babbage-001': 0.0005,
  'text-ada-001': 0.0004,
}

const commandsPath = '/support/.readme_text/commands.md'
// const { bulletsAIKeyTerms, bulletsSummaryParagraphs } = DataStore.settings

/**
 * Calculates the cost of the request.
 * https://beta.openai.com/docs/api-reference/completions/create
 * @param {string} model - the text AI model used.
 * @param {number} total_tokens - The total amount of tokens used during the generation.
 */
export function calculateCost(model: string, total_tokens: number): number {
  logDebug(pluginJson, `calculateCost(): attempting to calculate cost.`)
  const request_cost = (modelOptions[model] / 1000) * total_tokens
  logDebug(
    pluginJson,
    `calculateCost():
    Model: ${model}
    Total Tokens: ${total_tokens}
    Model Cost/1k: ${modelOptions[model]}
    Total Cost: ${request_cost}\n`,
  )
  clo(modelOptions, 'model cost object')

  return request_cost
}

/**
 * Generates the Commands section of the README.md
 */
export function generateREADMECommands() {
  logDebug(pluginJson, `generateREADMECommands(): starting generation.`)
  let output = ''
  const commands = pluginJson['plugin.commands']
  logDebug(pluginJson, `generateREADMECommands(): found commands.`)
  clo(commands, 'COMMANDS')
  if (Array.isArray(commands)) {
    logDebug(pluginJson, `generateREADMECommands(): found array.`)
    output.push(`### Commands`)
    commands.forEach((command) => {
      const linkText = `try it`
      const rpu = createPrettyRunPluginLink(linkText, pluginJson['plugin.id'], command.name)
      const aliases = commmand.aliases && command.aliases.length ? `\r\t*Aliases:${command.aliases.toString()}*` : ''
      output.push(`- /${command.name} ${rpu}${aliases}\r\t*${command.description}*`)
    })
    logDebug(pluginJson, `generateREADMECommands(): finished generation.`)
  }
  if (output != '') {
    logDebug(pluginJson, `generateREADMECommands(): writing to file.`)
    fs.writeFile(commandsPath, output)
  }
}

/**
 * Format the prompt for the research text completion request
 * https://beta.openai.com/docs/api-reference/completions/create
 * @param {string} subject - A text description of what you'd like the AI to research.
 * @param {number} n - The number of key concepts to return.
 */
export function formatResearch(subject: string, n: number = 3): string {
  logDebug(pluginJson, `formatResearch running now.`)
  const promptOut = `Please provide a summary of the ${subject} in the following format:

List the top ${n} key concepts associated with the subject and write a summary of the concept as it pertains to the subject in the following Markdown format.
Each concept should include a Wikipedia link.
The further reading links should be from Goodreads.com.
The first heading should be "# ${subject}"
The second heading should be "## Key Concepts"
For each Key Concept, the heading should be "### [key concept in brakcets](Wikipedia link)" followed by a brief summary.
The fourth heading should be "#### Further Reading" followed by a Goodreads.com link for a recommended book on the topic.
`
  return promptOut
}

/**
 * Format the prompt for the text summary request
 * https://beta.openai.com/docs/api-reference/completions/create
 * @param {string} text - The text for the AI to summarize.
 */
export function formatResearchListRequest(subject: string): string {
  const promptOut = `
  Generate a summary of the provided text and a list of the key terms associated with the subject in the following JSON format.
  {
    "subject": Subject,
    "summary": Summary of the subject,
    "wikiLink": Wikipedia link to the subject,
    "keyTerms": [
      
    ]
  }
  Subject: ${subject}
  Response:
`
  return promptOut
}

/**
 * Format the prompt for the quick search
 * https://beta.openai.com/docs/api-reference/completions/create
 * @param {string} text - The text for the AI to summarize.
 */
export function formatQuickSearchRequest(text: string): string {
  const promptOut = `Briefly summarize the subject and provide a "Read More" link with the Wikipedia link to learn more.
  Format: 
  Summary \n
  [Learn More](link to related Wikipedia article)

  Subject:  ${text}
  
`
  return promptOut
}

/**
 * Formats the Go Further link
 * @params (Object) learningTopic - General object that directs the behavior of the function.
 * Currently under construction.
 */
export async function formatFurtherLink(text: string) {
  const fileName = Editor.filename

  // logError(pluginJson, `${Editor.filename}`)
  const furtherLink = createPrettyOpenNoteLink(text, fileName, true, text)
  return furtherLink
}

/**
 * Formats the bullet summary response
 * @params (Object) learningTopic - General object that directs the behavior of the function.
 * Currently under construction.
 */
export async function formatBulletSummary(subject: string, summary: string, link: string, keyTerms: string, remixText: string = '') {
  logDebug(pluginJson, `\n\nformatBulletSummary\nSubject: ${subject}\nResponse: ${summary}\nLink: ${link})}`)
  let title = subject.replace('-', '')
  title = title.trim()
  const filePath = Editor.filepath

  const remixPrompt = createPrettyRunPluginLink(`Remix`, 'scrollpointclick.AI', 'Remix Query', `${subject}`)
  const remixTitle = createPrettyOpenNoteLink('๏', Editor.filename, true, subject)

  const remixSubtitleParts = remixText.split('in the context of')
  let remixedSubtitle = `${title}`
  for (var index in remixSubtitleParts) {
    if (index > 0) {
      const trimmedSubtitlePart = remixSubtitleParts[index].trim()
      const remixBackLink = createPrettyOpenNoteLink(`${trimmedSubtitlePart}`, Editor.filename, true, `${trimmedSubtitlePart}`)
      remixedSubtitle = `${remixedSubtitle} in the context of ${remixBackLink}`
    }
  }

  const formattedLink = `[Learn More](${link}})\n`
  let splitKeyTermsParts = keyTerms.split(',')

  let formattedList = ``
  for (var part in splitKeyTermsParts) {
    // const matchedValue = `[${splitKeyTermsParts[part]}](noteplan://x-callback-url/runPlugin?pluginID=scrollpointclick.AI&command=Bullets%20AI&arg0=${encodeURI(splitKeyTermsParts[part])}&arg1=)`
    // const keyTerm = splitKeyTermsParts[part]
    // if (keyTerm) {
    //   for (var index in Editor.paragraphs) {
    //     // logError(pluginJson, `\nReading: ${ splitKeyTermsParts[part]}`)
    //     const paragraph = Editor.paragraphs[index]
    //     if (paragraph.type == 'title') {
    //       logError(pluginJson, `\n\nReading: \nTYPE: ${typeof(keyTerm)}\n${keyTerm}\nTitle: \nTYPE: ${typeof(paragraph.content)}\n${paragraph.content}\n------\n`)
    //       if (paragraph.content == keyTerm) {
    //         logError(pluginJson, `\nTITLE ITEM MATCHING: ${paragraph.content}\n************\n\n`)
    //     } else if (paragraph.type == 'list') {
    //       // logError(pluginJson, `\n\nReading: ${ splitKeyTermsParts[part]}\nList: ${paragraph.content}\n-------\n`)
    //       logError(pluginJson, `\n\nReading: ${ matchedValue}\nList: ${paragraph.content}\n-------\n`)
    //       if (paragraph.content.includes(matchedValue)) {
    //         logError(pluginJson, `\n\List Item Matching: ${ paragraph.content}`)
    //       }
    //     }
    //    }
    //   }
    const prettyKeyTerm = createPrettyRunPluginLink(`${splitKeyTermsParts[part].trim()}`, 'scrollpointclick.AI', 'Bullets AI', [
      splitKeyTermsParts[part].trim(),
      '',
      remixText ? remixText : subject,
    ])
    // const prettyKeyTerm = createPrettyRunPluginLink(`${splitKeyTermsParts[part].trim()}`, 'scrollpointclick.AI', 'Bullets AI', [splitKeyTermsParts[part].trim(), '', subject])
    // logError(pluginJson, `\n\n\nBULLET POINT: ${prettyKeyTerm}`)
    const formattedPart = `\t\t- ${prettyKeyTerm}`
    formattedList += `${formattedPart}\n`
  }
  let output = ''
  // logError(pluginJson, `\n\n\nREMIX TEXT:\n\n\n ${remixText}\n\n\n`)
  if (remixText) {
    // logError(pluginJson, `\n\n\nREMIX INSIDE\n\n`)
    output = `### ${title}\n**${remixedSubtitle}**\n*${remixPrompt}*\n\t${summary.trim()}\n${formattedLink}\t##### Go Further?\n${formattedList}\n---`
    // output = `**${remixText}** ${remixTitle}\n*${remixPrompt}*\n\t${summary.trim()}\n\t##### Go Further?\n${formattedList}\n---`
  } else {
    // logError(pluginJson, `\n\n\nREMIX INSIDE\n\n`)
    output = `### ${title}\n*${remixPrompt}*\n\t${summary.trim()}\n${formattedLink}\t##### Go Further?\n${formattedList}\n---`
  }

  return output
}

/**
 * Sets the prompt format for the summary part of the bullet prompt
 * @params (Object) learningTopic - General object that directs the behavior of the function.
 * Currently under construction.
 */
export async function formatBullet(promptIn: string) {
  let prompt = `Write a summary on the topic of of ${promptIn}. The response should be ${bulletsSummaryParagraphs} paragraphs in length.
  Summary:
  `
  // logError(pluginJson, `\n\n\n${prompt}\n\n\n`)
  return prompt
}

/**
 * Sets the prompt format for the link part of the bullet prompt
 * @params (Object) learningTopic - General object that directs the behavior of the function.
 * Currently under construction.
 */
export async function formatBulletLink(promptIn: string) {
  let prompt = `
  Provide the Wikipedia link for ${promptIn}. No extra text.
  Link: 
  `
  return prompt
}

/**
 * Sets the prompt format for the summary part of the bullet prompt
 * @params (Object) learningTopic - General object that directs the behavior of the function.
 * Currently under construction.
 */
export async function formatBulletKeyTerms(promptIn: string) {
  let prompt = `Write a comma-separated array of the ${bulletsAIKeyTerms} most important key topics associated with ${promptIn}. No numbers.
  Example: Maple Syrup, hockey, Cold Weather
  List:
  `
  return prompt
}

/**
 * Sets the prompt format for the summary part of the bullet prompt
 * @params (Object) learningTopic - General object that directs the behavior of the function.
 * Currently under construction.
 */
export async function rerollSingleKeyTerm(promptIn: string, exclusions: string) {
  let prompt = `Return a single topic that is related to the topic of ${promptIn}. No numbers.
  Exclude the following topics from the result: ${exclusions}
  Example: Maple Syrup, Economic Growth in Nigeria (2020)
  List:
  `
  return prompt
}

/**
 * Format the prompt for the text summary request
 * https://beta.openai.com/docs/api-reference/completions/create
 * @param {string} text - The text for the AI to summarize.
 */
export function formatSummaryRequest(text: string): string {
  const promptOut = `Generate a summary of the provided text.
  Input: ${text}
  Summary:
`
  return promptOut
}
