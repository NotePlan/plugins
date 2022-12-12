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

const commandsPath = "/support/.readme_text/commands.md"

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
  const commands = pluginJson["plugin.commands"]
  logDebug(pluginJson, `generateREADMECommands(): found commands.`)
  clo(commands, "COMMANDS")
  if (Array.isArray(commands)) {
    logDebug(pluginJson, `generateREADMECommands(): found array.`)
    output.push(`### Commands`)
    commands.forEach((command) => {
      const linkText = `try it`
      const rpu = createPrettyRunPluginLink(linkText, pluginJson["plugin.id"], command.name)
      const aliases = commmand.aliases && command.aliases.length ?
      `\r\t*Aliases:${command.aliases.toString()}*` : ''
      output.push(`- /${command.name} ${rpu}${aliases}\r\t*${command.description}*`)
    })
    logDebug(pluginJson, `generateREADMECommands(): finished generation.`)
  }
  if ( output != '' ) {
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
 * Formats the bullet summary response
 * @params (Object) learningTopic - General object that directs the behavior of the function.
 * Currently under construction.
 */
export async function formatBulletSummary(subject: string, summary: string, link: string, keyTerms: string, caller?: string) {
  // test('should create a link with a heading', () => {
  //       expect(g.createPrettyOpenNoteLink('baz', 'foo', true, 'bar')).toEqual('[baz](noteplan://x-callback-url/openNote?filename=foo&heading=bar)')
  //     })
  logDebug(pluginJson, `\n\nformatBulletSummary\nSubject: ${subject}\nResponse: ${summary}\nLink: ${link})}`)
  let title = subject.replace('-', '')
  title = title.trim()
  // fTitle = createPrettyOpenNoteLink(title)
  const formattedLink = `[Learn More](${link}})\n`
  const splitKeyTermsParts = keyTerms.split(',')
  let formattedList = ``
  for (var part in splitKeyTermsParts) {
    if (splitKeyTermsParts[part] != '') {
      logDebug(pluginJson, `\n\n\nBULLET POINT: ${splitKeyTermsParts[part]}`)
      const formattedPart = `- ${splitKeyTermsParts[part].trim()}`
      formattedList += `${formattedPart}\n`
    }
  }


  let output = `### ${title}\n\t${summary.trim()}\n${formattedLink}##### Go Further?\n${formattedList}- \n---`
  return output 
}

/**
 * Sets the prompt format for the summary part of the bullet prompt
 * @params (Object) learningTopic - General object that directs the behavior of the function.
 * Currently under construction.
 */
export async function formatBullet(promptIn: string) {
  let prompt = `Write a 1-2 paragraph summary of ${promptIn}.
  Summary:
  `
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
  let prompt = `Write a comma-separated array of the three most important key terms associated with ${promptIn}. No numbers.
  Example: Maple Syrup, hockey, Cold Weather
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
