// @flow

import { showMessage } from '../../helpers/userInput'

export async function getDailyQuote(
  quoteParams: string,
  config: { [string]: ?mixed },
): Promise<string> {
  // TODO: Eventually support API options
  console.log('getDailyQuote():')
  const availableModes = [
    'today', // Zenquotes
    'random', // Zenquotes
    'author', // Zenquotes (premium account required)
    'readwise' // Readwise (account required)
  ]
  if (quoteParams != null) {
    await showMessage(
      "\tInfo: {{quote()}} tag parameters are not currently supported",
    )
  }
  
  const quoteConfig: any = config.quote ?? null
  if (quoteConfig == null) {
    console.log(`\tInfo: No 'quote' settings in Templates/_configuration note`)
  } else {
    console.log(`\tConfig for 'quote': ${JSON.stringify(quoteConfig)}`)
  }

  // Default setting
  // TODO: import proper config functions
  const pref_mode = (quoteConfig?.mode && availableModes.includes(quoteConfig?.mode))
    ? quoteConfig?.mode
    : 'random'

  let API: string
  let URL: string
  if (pref_mode === 'readwise') {
    const pref_readwise_key = quoteConfig?.readwiseKey ?? '<error - no key found>' // as token is mandatory
    API = `"https://readwise.io/api/v2/`
    ???.setRequestHeader('Authorization', pref_readwise_key);
    URL = `${API}highlights?page_size=10`
    // Ask for 1 result then read "count" 
    // then ask for random number within that count with page_size=1, page number that random

    console.log(`Before API call: ${URL}`)
    const response = await fetch(URL)
    if (response != null) {
      //$FlowIgnore[incompatible-call]
      const data = JSON.parse(response)[0]
      const quoteLine = `${data.q} - *${data.a}*`
      console.log(`\t${quoteLine}`)
      return quoteLine
    } else {
      console.log(`\tError in Quote lookup to ${API}. Please check your _configuration note.`)
      return `Error in Quote lookup to ${API}. Please check your _configuration note.`
    }
  }
  else {
    const pref_author = quoteConfig?.author // Available authors: https://premium.zenquotes.io/available-authors/
    const pref_zenquotes_key = quoteConfig?.zenquotesKey ?? '' // https://premium.zenquotes.io/
    API = `https://zenquotes.io/api/`
    URL = (pref_mode === 'author' && pref_author && pref_zenquotes_key)
      ? `${API}quotes/${pref_mode}/${pref_author}/${pref_zenquotes_key}`
      : `${API}${pref_mode}`
    console.log(`Before API call: ${URL}`)
    const response = await fetch(URL)
    if (response != null) {
      //$FlowIgnore[incompatible-call]
      const data = JSON.parse(response)[0]
      const quoteLine = `${data.q} - *${data.a}*`
      console.log(`\t${quoteLine}`)
      return quoteLine
    } else {
      console.log(`\tError in Quote lookup to ${API}. Please check your _configuration note.`)
      return `Error in Quote lookup to ${API}. Please check your _configuration note.`
    }

  }

}
