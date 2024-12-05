import { makeRequest } from './support/networking'
import { log, logDebug, logError, logWarn, clo, JSP, timer } from '@np/helpers/dev'


const pluginJson = `shared.AI/helpers`
const imagesGenerationComponent = 'images/generations'
type DallERequestOptions = { prompt?: string, n?: number, size?: string, response_format?: string, user?: string }

/**
 * Create DALL-E images
 * Plugin entrypoint for command: "/Create AI Images"
 * Options:
 * @param {string} prompt - A text description of the prompt for the AI to interpret.
 * @param {number} n - The number of images to generate. Must be between 1 and 10
 * @param {size} size - The size of the generated images. Must be one of 256x256, 512x512, or 1024x1024.
 * @param {string} response_format - The format in which the generated images are returned. Must be one of url or b64_json
 * @param {string} user - A unique identifier representing your end-user, which can help OpenAI to monitor and detect abuse.
 */
export async function createAIImages(promptIn: string | null = '', nIn: number = 1, sizeIn: string = '1024x1024', response_formatIn: string = 'url', userIn: string | null = null) {
    try {
        logDebug(pluginJson, `createImages running with prompt:${String(promptIn)} ${String(nIn)} ${sizeIn} ${response_formatIn} ${String(userIn)}`)
  
        // get an image
        const start = new Date()
        const n = 1
        //   const { prompt, n } = await getPromptAndNumberOfResults(promptIn, nIn)
        const prompt = await CommandBar.showInput('Enter a prompt', 'Search for %@')
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