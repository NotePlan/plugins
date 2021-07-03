// @flow

import { showMessage } from '../../nmn.sweep/src/userInput'

export async function getDailyQuote(
  params: string,
  config: { [string]: ?mixed },
): Promise<string> {
  // TODO: Eventually support API options
  const quoteParams = null
  if (quoteParams != null) {
    await showMessage(
      "{{quote()}} tag parameters are not currently supported",
    )
    return ''
  }
  
  const quoteConfig: any = config.quote ?? null
  // We don't care if there aren't any available settings
  // if (quoteConfig == null) {
  //   await showMessage(
  //     "Cannot find 'quote' settings in Templates/_configuration note",
  //   )
  //   return ''
  // }

  const availableModes = [
    'today',
    'random',
    'author'
  ]

  const pref_mode = (quoteConfig?.mode && availableModes.includes(quoteConfig?.mode)) ? quoteConfig?.mode : 'random' // Available modes: [today, random, author (premium only)].
  // For premium subscriptions
  const pref_author = quoteConfig?.author // Available authors: https://premium.zenquotes.io/available-authors/
  const pref_key = quoteConfig?.apiKey // https://premium.zenquotes.io/
    
  const zenQuotesAPI = `https://zenquotes.io/api/`
  const getDailyQuoteURL = (pref_mode === 'author' && pref_author && pref_key) ? `${zenQuotesAPI}quotes/${pref_mode}/${pref_author}/${pref_key}` : `${zenQuotesAPI}${pref_mode}`
  console.log(getDailyQuoteURL)
  const response = await fetch(getDailyQuoteURL)
  if (response != null) {
    //$FlowIgnore[incompatible-call]
    const data = JSON.parse(response)[0]
    const quoteLine = `> ${data.q} - *${data.a}*`
    console.log(`\t${quoteLine}`)
    return quoteLine
  } else {
    return 'Error in zenquotes.io Daily Quote lookup'
  }
}