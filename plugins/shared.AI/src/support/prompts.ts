import { log, logDebug, logError, logWarn } from '@np/helpers/dev'

const pluginJson = `shared.AI/helpers`

/*
 *** FORMAT BULLET SECTION ***
 */

/**
 * Sets the prompt format for the summary part of the bullet prompt
 * @params (Object) learningTopic - General object that directs the behavior of the function.
 * Currently under construction.
 */
export async function generateSubjectSummaryPrompt(promptIn: string, prevSubject?: string = '') {
  const { bulletsSummaryParagraphs } = DataStore.settings

  let prompt = `Write a summary on the topic of ${
    prevSubject ? `${promptIn} in the context of ${prevSubject}` : promptIn
  }. The response should be ${bulletsSummaryParagraphs} paragraphs in length.  
    Summary:
    `
  logError(pluginJson, `\n\n\nINFO---------\n\n${prompt}\n\n\n`)
  return prompt
}

/**
 * Sets the prompt format for the summary part of the bullet prompt
 * @params (Object) learningTopic - General object that directs the behavior of the function.
 * Currently under construction.
 */
export async function generateKeyTermsPrompt(promptIn: string, prevSubject?: string = '', excludedTerms?: [string] = []) {
  const { bulletsAIKeyTerms } = DataStore.settings

  let exclusions = ''
  for (term of excludedTerms) {
    exclusions += `${term}, `
  }
  let prompt = `Write a comma-separated array of the ${bulletsAIKeyTerms} most important key topics associated with ${
    prevSubject ? `${promptIn} in the context of ${prevSubject}` : `${promptIn}`
  }. No numbers.
    ${exclusions ? `Exclude these terms: ${exclusions}` : ''}
    Example:Maple Syrup,hockey,Cold Weather
    List:
    `
  logError(pluginJson, `\n\n\nINFO---------\n\n${prompt}\n\n\n`)
  return prompt
}

/**
 * Sets the prompt format for the link part of the bullet prompt
 * @params (Object) learningTopic - General object that directs the behavior of the function.
 * Currently under construction.
 */
export async function generateWikiLinkPrompt(promptIn: string) {
  let prompt = `
    Provide the Wikipedia link for ${promptIn}. No extra text.
    Link: 
    `
  return prompt
}

export async function generateExplorationPrompt(promptIn: string, prevSubject: string) {
  let prompt = `
    ${promptIn}. In the context of ${prevSubject}.
    Output:`
  return prompt
}

/*
 *** FORMAT RESEARCH REQUEST SECTION ***
 */

/**
 * Format the prompt for the research text completion request
 * https://beta.openai.com/docs/api-reference/completions/create
 * @param {string} subject - A text description of what you'd like the AI to research.
 * @param {number} n - The number of key concepts to return.
 */
export function generateResearchPrompt(subject: string, n: number = 3): string {
  logDebug(pluginJson, `formatResearch running now.`)
  const promptOut = `Please provide a summary of the ${subject} in the following format:
  
  List the top ${n} key concepts associated with the subject and write a summary of the concept as it pertains to the subject in the following Markdown format.
  Each concept should include a Wikipedia link.
  The further reading links should be from Goodreads.com.
  The first heading should be "# ${subject}"
  The second heading should be "## Key Concepts"
  For each Key Concept, the heading should be "### [key concept in brackets](Wikipedia link)" followed by a brief summary.
  The fourth heading should be "#### Further Reading" followed by a Goodreads.com link for a recommended book on the topic.
  `
  return promptOut
}

/**
 * Format the prompt for the text summary request
 * https://beta.openai.com/docs/api-reference/completions/create
 * @param {string} text - The text for the AI to summarize.
 */
export function generateResearchListRequest(subject: string): string {
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

/*
 *** OLDER FORMATTING PROMPTS - MAY BE REUSABLE ***
 */

/**
 * Format the prompt for the text summary request
 * https://beta.openai.com/docs/api-reference/completions/create
 * @param {string} text - The text for the AI to summarize.
 */
export function generateSummaryRequest(text: string): string {
  const promptOut = `Generate a summary of the provided text.
    Input: ${text}
    Summary:
  `
  return promptOut
}

/**
 * Format the prompt for the quick search
 * https://beta.openai.com/docs/api-reference/completions/create
 * @param {string} text - The text for the AI to summarize.
 */
export function generateQuickSearchPrompt(text: string): string {
  const promptOut = `Briefly summarize the subject and provide a "Read More" link with the Wikipedia link to learn more.
    Format: 
    Summary \n
    [Learn More](link to related Wikipedia article)
  
    Subject:  ${text}
    
  `
  return promptOut
}
