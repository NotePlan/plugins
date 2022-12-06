// @flow

const pluginJson = `dwertheimer.AI/helpers`
import { log, logDebug, logError, logWarn, clo, JSP, timer } from '@helpers/dev'

const modelCost = {
  'text-davinci-003': 0.02,
  'text-curie-001': 0.002,
  'text-babbage-001': 0.0005,
  'text-ada-001': 0.0004,
}

/**
 * Calculates the cost of the request.
 * https://beta.openai.com/docs/api-reference/completions/create
 * @param {string} model - the text AI model used.
 * @param {number} total_tokens - The total amount of tokens used during the generation.
 */
export function calculateCost(model: string, total_tokens: number): number {
  logDebug(pluginJson, `calculateCost(): attempting to calculate cost.`)
  const request_cost = (modelCost[model] / 1000) * total_tokens
  logDebug(
    pluginJson,
    `calculateCost():
    Model: ${model}
    Total Tokens: ${total_tokens}
    Model Cost/1k: ${modelCost[model]}
    Total Cost: ${request_cost}\n`,
  )
  clo(modelCost, 'model cost object')

  return request_cost
}

/**
 * Format the prompt for the research text completion request
 * https://beta.openai.com/docs/api-reference/completions/create
 * @param {string} subject - A text description of what you'd like the AI to research.
 * @param {number} n - The number of key concepts to return.
 */
export function formatResearch(subject: string, n: number = 3): string {
  const promptOut = `Please provide a summary of the ${subject} in the following format:

Separate each result with three dashes
List the top ${n} key concepts associated with the subject and write a summary of the concept as it pertains to the subject in the following Markdown format.
Each concept should include a Wikipedia link
The further reading links should be from Goodreads.com.
The first heading should be "# ${subject}"
The second heading should be "## Key Concepts"
For each Key Concept, the heading should be "### [the key concept](the Wikipedia link)" followed by a brief summary.
The fourth heading should be "Further Reading" followed by a Goodreads.com link for a recommended book on the topic.
`
  return promptOut
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
