// @flow

import { showMessage } from '../../helpers/userInput'
import { getRandomElementFromArray } from '../../helpers/dev'
import { getOrMakeConfigurationSection } from './configuration'

// if there is no config in the '_configuration' file, then provide an example config
const EXAMPLE_CONFIG = `  
   /* >> custom affirmations start << */
   customAffirmations: [
     'I learn from my mistakes.',
     'I enjoy life to the fullest.',
     'I make a difference whenever I can.',
     'I commit to learning new things.',
   ],
   /* >> custom affirmations end << */`

/**
 * @description get an affirmation from the affirmations.dev api or custom ones from the _configuration
 * @author m1well
 *
 * @param custom leave it empty in the template for affirmation from the api
 *                or set it to true for a random affirmation from the _configuration
 * @returns {Promise<string>} the affirmation as string or the error from the api
 *                             (or empty string if there was no config)
 */
export const getAffirmation = async (custom: boolean = false): Promise<string> => {
  if (custom) {
    const customAffirmations = await provideConfigAffirmations()
    if (customAffirmations.length > 0) {
      return getRandomElementFromArray(customAffirmations)
    } else {
      return ''
    }
  } else {
    const result = await doFetchApi('https://affirmations.dev', true)
    if (result.error) {
      return result.error
    } else {
      return result.text ? result.text : 'api returned empty affirmation'
    }
  }
}

/**
 * @description get an advice from the adviceslip.com api
 * @author m1well
 *
 * @returns {Promise<string>} the advice as string or the error from the api
 */
export const getAdvice = async (): Promise<string> => {
  const result = await doFetchApi('https://api.adviceslip.com/advice', false)
  if (result.error) {
    return result.error
  } else {
    return result.text ? result.text : 'api returned empty advice'
  }
}

/**
 * @private
 */
const doFetchApi = async (url: string, affirmation: boolean): Promise<FetchTextResponse> => {
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    })
    const parsed = fetchResponseAsJson(response)
    if (affirmation) {
      const result = ((parsed: any): { affirmation: string })
      return {
        text: result.affirmation
      }
    } else {
      const result = ((parsed: any): { slip: { id: string, advice: string } })
      return {
        text: result.slip.advice
      }
    }
  } catch (err) {
    showMessage(`External URL fetch failed: ${err}`)
    return {
      text: '',
      error: err,
    }
  }
}

/**
 * @private
 */
const provideConfigAffirmations = (): Promise<string[]> => {
  return getOrMakeConfigurationSection(
    'customAffirmations',
    EXAMPLE_CONFIG
  )
    .then(result => {
      if (result == null || Object.keys(result).length === 0) {
        logError('exptected config could not be found in the _configuration file')
        return []
      } else {
        return ((result: any): string[])
      }
    })
}

/**
 * @private
 */
const fetchResponseAsJson = (response: Response): {} => {
  // return await response.json()
  // -> no matter where i look, this should actually be the way to go - but it doesn't work
  // although the response content-type is application/json
  return JSON.parse(((response: any): string))
}

/**
 * @private
 */
const logError = async (msg: string): Promise<void> => {
  console.log(`\taffirmations error: ${msg}`)
  await showMessage(`ERROR: ${msg}`)
}

type FetchTextResponse = {
  text: string,
  error?: string,
}
